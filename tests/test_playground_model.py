import json

import httpx
import pytest
from agents import Agent, OpenAIResponsesModel, RunConfig, Runner
from openai import AsyncOpenAI
from openai.types.responses import ResponseTextDeltaEvent

from airline_support.agent import baggage_policy
from airline_support.playground_model import ScopedResponsesTransport


def native(output, status="completed"):
    return dict(id="resp_test", object="response", created_at=1, status=status,
        model="server-pinned", output=output, error=None, incomplete_details=None,
        instructions=None, metadata={}, parallel_tool_calls=True, temperature=None,
        tool_choice="auto", tools=[], top_p=None, usage=None)


@pytest.mark.asyncio
async def test_sdk_stream_executes_real_tool_and_retains_native_history():
    calls = []

    def gateway(request):
        calls.append(json.loads(request.content))
        assert str(request.url) == "https://gateway.example/runtime/session/api/v1/model-proxy/codex/responses/"
        assert request.headers["Authorization"] == "Token temporary-session"
        assert calls[-1]["store"] is False and calls[-1]["stream"] is False
        if len(calls) == 1:
            output = [{"id": "fc_1", "type": "function_call", "call_id": "call_1",
                "name": "baggage_policy", "arguments": '{"ticket_type":"standard"}', "status": "completed"}]
        else:
            evidence = [item for item in calls[-1]["input"] if item.get("type") == "function_call_output"]
            assert len(evidence) == 1 and "50 pounds" in evidence[0]["output"]
            output = [{"id": "msg_1", "type": "message", "role": "assistant", "status": "completed",
                "content": [{"type": "output_text", "text": "One carry-on and one checked bag up to 50 pounds.", "annotations": []}]}]
        return httpx.Response(200, json=native(output))

    transport = ScopedResponsesTransport("https://gateway.example/runtime/session/", "temporary-session", httpx.MockTransport(gateway))
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = AsyncOpenAI(api_key="placeholder", base_url="https://session.invalid/v1", http_client=http_client, max_retries=0)
        model = OpenAIResponsesModel(model="server-pinned", openai_client=client)
        result = Runner.run_streamed(Agent(name="SkyServe", model=model, tools=[baggage_policy]), input="Standard baggage?", run_config=RunConfig(tracing_disabled=True))
        text = ""
        async for event in result.stream_events():
            if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
                text += event.data.delta
        assert text == result.final_output == "One carry-on and one checked bag up to 50 pounds."
        assert len(calls) == 2


@pytest.mark.asyncio
async def test_denial_never_replays_provider_error_or_becomes_a_success():
    transport = ScopedResponsesTransport("https://gateway.example/", "temporary-session",
        httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "sensitive provider details"})))
    async with httpx.AsyncClient(transport=transport) as client:
        response = await client.post("https://session.invalid/v1/responses", json={"input": "hello", "stream": True})
        assert response.status_code == 401
        assert "sensitive provider details" not in response.text
        assert "response.completed" not in response.text


@pytest.mark.parametrize("base", ["http://evil.example/", "https://token@gateway.example/", "https://gateway.example/?token=x"])
def test_invalid_session_routes_are_rejected(base):
    with pytest.raises(ValueError):
        ScopedResponsesTransport(base, "temporary-session")


def test_playground_selection_requires_scoped_config_even_when_host_key_exists(monkeypatch):
    from airline_support.models import select_model

    monkeypatch.setenv("AIRLINE_MODEL_PROVIDER", "relai")
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-be-used")
    monkeypatch.delenv("RELAI_SESSION_MODEL", raising=False)
    with pytest.raises(RuntimeError, match="session model"):
        select_model()
