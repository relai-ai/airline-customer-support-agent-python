"""RELAI learning environment for multi-turn response signoff behavior."""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from relai import CodeEvaluator, EvaluationResult, FixedInput, FixedTurn, RELAIEnvironment, SimulationResult


TAGS = ["end-to-end", "multi-turn-signoff-on-every-reply"]
EXPECTED_SIGNOFF = "please let me know if you have any questions"


def mock_change_seat(*args, **kwargs):
    """Return the same shape of string result as the live seat-change tool."""
    confirmation_code = str(kwargs.get("confirmation_code", "")).strip().upper()
    requested_seat = str(kwargs.get("requested_seat", "")).strip().upper()
    if confirmation_code not in {"SKY123", "BAY777"}:
        return "Seat changes require a valid confirmation code."
    if not requested_seat:
        requested_seat = "UNSPECIFIED"
    return f"Seat updated to {requested_seat} for booking {confirmation_code}."


def _normalize_text(text: str) -> str:
    normalized = text.casefold()
    normalized = normalized.replace("\u2019", "'").replace("\u2018", "'")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


def _get_field(node: Any, field: str) -> Any:
    if isinstance(node, dict):
        return node.get(field)
    return getattr(node, field, None)


def _iter_children(node: Any) -> Iterable[Any]:
    if isinstance(node, dict):
        return node.values()
    if isinstance(node, (list, tuple, set)):
        return node
    model_dump = getattr(node, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        if isinstance(dumped, dict):
            return dumped.values()
    as_dict = getattr(node, "dict", None)
    if callable(as_dict):
        dumped = as_dict()
        if isinstance(dumped, dict):
            return dumped.values()
    try:
        return vars(node).values()
    except TypeError:
        return ()


def _collect_assistant_messages(node: Any, seen: set[int] | None = None) -> list[str]:
    if seen is None:
        seen = set()

    node_id = id(node)
    if node_id in seen:
        return []
    seen.add(node_id)

    messages: list[str] = []
    role = _get_field(node, "role")
    content = _get_field(node, "content")
    event_type = _get_field(node, "type")
    assistant_message = _get_field(node, "assistant_message")

    if role == "assistant" and isinstance(content, str):
        messages.append(content)
    elif event_type in {"agent_message", "assistant_message"} and isinstance(content, str):
        messages.append(content)
    elif isinstance(assistant_message, str):
        messages.append(assistant_message)

    for child in _iter_children(node):
        messages.extend(_collect_assistant_messages(child, seen))

    return messages


def _dedupe_in_order(messages: Iterable[str]) -> list[str]:
    deduped: list[str] = []
    seen_messages: set[str] = set()
    for message in messages:
        if message in seen_messages:
            continue
        seen_messages.add(message)
        deduped.append(message)
    return deduped


def evaluate_signoff(simulation_result: SimulationResult) -> EvaluationResult:
    assistant_messages = _dedupe_in_order(
        _collect_assistant_messages(getattr(simulation_result, "transcript", simulation_result))
    )
    if not assistant_messages and isinstance(getattr(simulation_result, "final_output", None), str):
        assistant_messages = [simulation_result.final_output]

    if not assistant_messages:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "No assistant replies were available in the simulation result, so the required end-of-response "
                "signoff could not be verified."
            ),
        )

    expected_suffix = _normalize_text(EXPECTED_SIGNOFF)
    for index, message in enumerate(assistant_messages, start=1):
        observed_suffix = _normalize_text(message)
        if not observed_suffix.endswith(expected_suffix):
            return EvaluationResult(
                score=0.0,
                feedback=(
                    f"Assistant turn {index} did not end with the required signoff. "
                    f"Expected a closing equivalent to '{EXPECTED_SIGNOFF}'. "
                    f"Observed reply: {message!r}."
                ),
            )

    return EvaluationResult(
        score=1.0,
        feedback="Every assistant reply ended with the required signoff.",
    )


environment = RELAIEnvironment(
    id="response-signoff",
    name="Response Signoff",
    description="Tests that every airline-support reply ends with the required signoff sentence.",
    tags=TAGS,
    input=FixedInput(
        turns=[
            FixedTurn(content="What is the baggage policy for a standard ticket?"),
            FixedTurn(content="My confirmation code is SKY123. Can you look up that booking?"),
        ]
    ),
    mocks={
        "airline_support.agent:change_seat": mock_change_seat,
    },
    evaluators=[
        CodeEvaluator(
            id="reply-signoff",
            description="Checks that each assistant reply ends with the required signoff phrase.",
            evaluate=evaluate_signoff,
        )
    ],
)
