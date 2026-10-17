"""OpenAI Agents SDK transport for a temporary, server-pinned RELAI session.

The gateway returns a complete native Responses result. Convert that observed
result into SDK events, without fabricating token timing or changing tool items.
No shared provider credential is installed in the playground.
"""
from __future__ import annotations

import json
from urllib.parse import urlsplit

import httpx
from agents import OpenAIResponsesModel, set_tracing_disabled
from openai import AsyncOpenAI


def response_events(response: dict) -> bytes:
    events = []

    def emit(kind, **fields):
        event = {"type": kind, "sequence_number": len(events), **fields}
        events.append(f"event: {kind}\ndata: {json.dumps(event)}\n\n")

    emit("response.created", response={**response, "status": "in_progress", "output": []})
    for output_index, item in enumerate(response["output"]):
        added = dict(item)
        if item["type"] == "message":
            added["content"] = []
        elif item["type"] == "function_call":
            added["arguments"] = ""
        emit("response.output_item.added", output_index=output_index, item=added)
        if item["type"] == "message":
            for content_index, part in enumerate(item["content"]):
                fields = dict(item_id=item["id"], output_index=output_index, content_index=content_index)
                emit("response.content_part.added", **fields, part={**part, "text": ""} if part["type"] == "output_text" else part)
                if part["type"] == "output_text":
                    emit("response.output_text.delta", **fields, delta=part["text"])
                    emit("response.output_text.done", **fields, text=part["text"])
                emit("response.content_part.done", **fields, part=part)
        elif item["type"] == "function_call":
            fields = dict(item_id=item["id"], output_index=output_index)
            emit("response.function_call_arguments.delta", **fields, delta=item["arguments"])
            emit("response.function_call_arguments.done", **fields, arguments=item["arguments"])
        emit("response.output_item.done", output_index=output_index, item=item)
    terminal = {"completed": "completed", "incomplete": "incomplete", "failed": "failed"}[response["status"]]
    emit("response." + terminal, response=response)
    return "".join(events).encode()


class ScopedResponsesTransport(httpx.AsyncBaseTransport):
    def __init__(self, base: str, token: str, upstream=None):
        url = urlsplit(base)
        if (url.scheme != "https" and not (url.scheme == "http" and url.hostname == "host.docker.internal")) or url.username or url.password or url.query or url.fragment:
            raise ValueError("Invalid scoped playground gateway URL")
        if not token or "\n" in token or "\r" in token:
            raise ValueError("Missing scoped playground credential")
        self.endpoint = base.rstrip("/") + "/api/v1/model-proxy/codex/responses/"
        self.token = token
        self.upstream = upstream

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if request.method != "POST" or request.url.path != "/v1/responses":
            return httpx.Response(404, json={"error": {"message": "Only stateless Responses turns are supported"}})
        payload = json.loads(await request.aread())
        if payload.get("previous_response_id") or payload.get("conversation") or payload.get("background"):
            return httpx.Response(400, json={"error": {"message": "Stored response chaining is unavailable"}})
        streamed = payload.get("stream", False)
        native_request = httpx.Request("POST", self.endpoint,
            headers={"Authorization": "Token " + self.token, "Content-Type": "application/json"},
            json={**payload, "stream": False, "store": False}, extensions=request.extensions)
        upstream = self.upstream or httpx.AsyncHTTPTransport()
        response = None
        try:
            response = await upstream.handle_async_request(native_request)
            body = await response.aread()
            if response.status_code != 200:
                # Provider error bodies may include secrets; preserve status only.
                return httpx.Response(response.status_code, json={"error": {"message": "Scoped model gateway denied or could not complete this request"}})
            native = json.loads(body)
            if native.get("status") not in ("completed", "incomplete", "failed") or not isinstance(native.get("output"), list):
                return httpx.Response(502, json={"error": {"message": "Invalid scoped Responses result"}})
            return httpx.Response(200, content=response_events(native) if streamed else body,
                headers={"Content-Type": "text/event-stream" if streamed else "application/json"})
        finally:
            if response is not None:
                await response.aclose()
            if self.upstream is None:
                await upstream.aclose()

    async def aclose(self):
        if self.upstream is not None:
            await self.upstream.aclose()


def playground_model(environment) -> OpenAIResponsesModel:
    model = environment.get("RELAI_SESSION_MODEL", "").split("/")[-1]
    if not model:
        raise RuntimeError("Playground session model is missing")
    transport = ScopedResponsesTransport(environment.get("RELAI_API_BASE", ""), environment.get("RELAI_TEAM_API_KEY", ""))
    set_tracing_disabled(disabled=True)
    client = AsyncOpenAI(api_key="scoped-session-transport", base_url="https://session.invalid/v1",
        max_retries=0, http_client=httpx.AsyncClient(transport=transport, timeout=120, follow_redirects=False))
    return OpenAIResponsesModel(model=model, openai_client=client)
