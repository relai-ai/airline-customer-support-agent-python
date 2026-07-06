from __future__ import annotations

import json
from typing import Any

from agents import Runner
from airline_support.agent import AIRLINE_AGENT

from relai_simulator.adapter_contract import AgentAdapter, AgentTurnResult


class ProjectAgentAdapter:
    def __init__(self) -> None:
        self.agent_or_tools: object | None = AIRLINE_AGENT

    async def run_turn(self, user_input: object) -> AgentTurnResult:
        if not isinstance(user_input, str):
            raise TypeError(
                "airline_support simulator turns must be plain strings matching FixedTurn.content."
            )

        result = await Runner.run(AIRLINE_AGENT, user_input)
        return AgentTurnResult(
            assistant_message=_stringify_output(result.final_output),
            metadata=_result_metadata(result),
        )


def build_agent_adapter() -> AgentAdapter:
    return ProjectAgentAdapter()


def _stringify_output(output: Any) -> str | None:
    if output is None or isinstance(output, str):
        return output
    if hasattr(output, "model_dump"):
        return json.dumps(output.model_dump(mode="json"), ensure_ascii=True, sort_keys=True)
    try:
        return json.dumps(output, ensure_ascii=True, sort_keys=True)
    except TypeError:
        return str(output)


def _result_metadata(result: Any) -> dict[str, object]:
    last_agent_name = getattr(getattr(result, "last_agent", None), "name", None)
    if isinstance(last_agent_name, str) and last_agent_name:
        return {"last_agent": last_agent_name}
    return {}
