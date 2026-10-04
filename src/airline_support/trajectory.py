"""Local ATIF recording at the sample's existing SDK boundary."""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from collections.abc import Callable
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

from agents import RunHooks

from airline_support.sessions import logs_dir

REDACTED = "[REDACTED]"
_SENSITIVE_KEY = re.compile(
    r"authorization|cookie|password|secret|credential|apikey|accesstoken|refreshtoken|idtoken|authtoken"
)
_TOKEN_METRICS = {
    "prompttokens",
    "completiontokens",
    "cachedtokens",
    "inputtokens",
    "outputtokens",
    "totaltokens",
    "reasoningtokens",
    "cachewritetokens",
    "maxtokens",
    "totalprompttokens",
    "totalcompletiontokens",
    "totalcachedtokens",
}
_SECRET_TEXT = re.compile(
    r"-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----.*?-----END (?:[A-Z ]*PRIVATE KEY)-----"
    r"|\bBearer\s+[^\s\"',;]+"
    r"|\bsk-[A-Za-z0-9_-]+"
    r"|\b(?:Authorization|Cookie)\s*:\s*[^\r\n;]+"
    r"|\b(?:[A-Z_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)|Authorization|Cookie)\s*[:=]\s*"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)",
    re.IGNORECASE | re.DOTALL,
)


def redact(value: Any, secrets: tuple[str, ...]) -> Any:
    """Filter structured fields and credential text at the serialization boundary."""
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            normalized = re.sub(r"[^a-z0-9]", "", key.lower())
            sensitive = _SENSITIVE_KEY.search(normalized) or (
                normalized.endswith(("token", "tokens"))
                and normalized not in _TOKEN_METRICS
            )
            result[key] = REDACTED if sensitive else redact(item, secrets)
        return result
    if isinstance(value, list):
        return [redact(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in secrets:
            value = value.replace(secret, REDACTED)
        # Serialized objects can occur inside tool output and error strings.
        try:
            decoded = json.loads(value)
        except (ValueError, TypeError):
            decoded = None
        if isinstance(decoded, (dict, list)):
            return json.dumps(redact(decoded, secrets), ensure_ascii=False)
        return _SECRET_TEXT.sub(REDACTED, value)
    return value


class TrajectoryRecorder:
    """One cumulative writer per trial path, shared across all SDK runs in it."""

    def __init__(self, path: Path):
        self.path = path
        self._lock = RLock()
        self.document: dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "agent": {
                "name": "SkyServe Airline Support",
                "version": version("relai-airline-support-agent"),
            },
            "steps": [],
        }

    def record(self, update: Callable[[], Any]) -> Any:
        """Serialize mutations and writes; recording failures never change agent behavior."""
        with self._lock:
            try:
                result = update()
                steps = self.document["steps"]
                final_metrics = {"total_steps": len(steps)}
                agent_steps = [step for step in steps if step["source"] == "agent"]
                if agent_steps and all("metrics" in step for step in agent_steps):
                    for field in (
                        "prompt_tokens",
                        "completion_tokens",
                        "cached_tokens",
                    ):
                        final_metrics[f"total_{field}"] = sum(
                            step["metrics"].get(field, 0) for step in agent_steps
                        )
                self.document["final_metrics"] = final_metrics
                # Only read explicitly named credential variables, never enumerate the environment.
                names = {"OPENAI_API_KEY", "ANTHROPIC_API_KEY"}
                names.update(
                    filter(
                        None,
                        (
                            name.strip()
                            for name in os.environ.get(
                                "ATIF_REDACT_ENV_VARS", ""
                            ).split(",")
                        ),
                    )
                )
                secrets = tuple(
                    sorted(
                        {os.environ[name] for name in names if os.environ.get(name)},
                        key=len,
                        reverse=True,
                    )
                )
                filtered = redact(self.document, secrets)
                self.path.parent.mkdir(parents=True, exist_ok=True)
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(
                        mode="w",
                        encoding="utf-8",
                        dir=self.path.parent,
                        prefix=f".{self.path.name}.",
                        delete=False,
                    ) as handle:
                        temporary = Path(handle.name)
                        json.dump(filtered, handle, ensure_ascii=False, allow_nan=False)
                        handle.flush()
                        os.fsync(handle.fileno())
                    os.replace(temporary, self.path)
                finally:
                    if temporary is not None:
                        temporary.unlink(missing_ok=True)
                return result
            except Exception:
                # Do not include exception text: it can contain unfiltered runtime data.
                print(
                    "SkyServe ATIF recording failed; trajectory evidence may be incomplete.",
                    file=sys.stderr,
                )
                return None

    def append(self, source: str, message: str, **fields: Any) -> dict[str, Any]:
        step = {
            "step_id": len(self.document["steps"]) + 1,
            "timestamp": datetime.now(UTC).isoformat(),
            "source": source,
            "message": message,
            **fields,
        }
        self.document["steps"].append(step)
        return step

    def user(self, message: str) -> None:
        self.record(lambda: self.append("user", message))

    def failure(self, error: BaseException) -> None:
        def update():
            errors = self.document.setdefault("extra", {}).setdefault("errors", [])
            errors.append({"type": type(error).__name__, "message": str(error)})

        self.record(update)


_recorders: dict[Path, TrajectoryRecorder] = {}
_recorders_lock = RLock()
_default_session_id = f"session-{uuid4().hex[:16]}"


def get_recorder(
    default_path: Path | None = None, *, new_session: bool = False
) -> TrajectoryRecorder | None:
    """Reuse the session writer, with an optional destination override."""
    try:
        destination = os.environ.get("ATIF_TRAJECTORY_PATH")
        path = (
            Path(destination)
            if destination
            else default_path or logs_dir() / f"{_default_session_id}.atif.json"
        ).resolve()
        with _recorders_lock:
            if new_session or path not in _recorders:
                _recorders[path] = TrajectoryRecorder(path)
                _recorders[path].record(lambda: None)
            return _recorders[path]
    except Exception:
        print("SkyServe ATIF recorder initialization failed.", file=sys.stderr)
        return None


class TrajectoryHooks(RunHooks):
    """Observe SDK model outputs before dispatch and tool results as they arrive."""

    def __init__(self, recorder: TrajectoryRecorder):
        self.recorder = recorder
        # Run-local mapping: providers may reuse call IDs on subsequent user turns.
        self.calls: dict[str, dict[str, Any]] = {}

    async def on_llm_end(self, context, agent, response) -> None:
        def update():
            output = [item.model_dump(mode="json") for item in response.output]
            if not output:
                return
            texts = [
                part["text"]
                for item in output
                if item["type"] == "message"
                for part in item.get("content", [])
                if part.get("type") == "output_text"
            ]
            calls = []
            invalid_calls = []
            for item in output:
                if item["type"] != "function_call":
                    continue
                try:
                    arguments = json.loads(item["arguments"])
                except ValueError:
                    arguments = None
                if isinstance(arguments, dict):
                    calls.append(
                        {
                            "tool_call_id": item["call_id"],
                            "function_name": item["name"],
                            "arguments": arguments,
                        }
                    )
                else:
                    invalid_calls.append(item)
            # A tool-only model response is still an actual observed message, not invented prose.
            message = "\n".join(texts) or json.dumps(output, ensure_ascii=False)
            fields: dict[str, Any] = {"llm_call_count": 1}
            if isinstance(agent.model, str):
                fields["model_name"] = agent.model
            if response.usage.input_tokens or response.usage.output_tokens:
                fields["metrics"] = {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                }
                cached = response.usage.input_tokens_details.cached_tokens
                if cached:
                    fields["metrics"]["cached_tokens"] = cached
            if calls:
                fields["tool_calls"] = calls
            if invalid_calls:
                # Retain malformed observed data without inventing valid tool arguments.
                fields["extra"] = {"invalid_tool_calls": invalid_calls}
            step = self.recorder.append("agent", message, **fields)
            for call in calls:
                self.calls[call["tool_call_id"]] = step

        self.recorder.record(update)

    async def on_tool_end(self, context, agent, tool, result) -> None:
        def update():
            step = self.calls[context.tool_call_id]
            observation = step.setdefault("observation", {"results": []})
            observation["results"].append(
                {
                    "source_call_id": context.tool_call_id,
                    "content": result
                    if isinstance(result, str)
                    else json.dumps(result, ensure_ascii=False),
                }
            )

        self.recorder.record(update)
