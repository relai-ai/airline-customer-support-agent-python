from __future__ import annotations

import asyncio
import json
from typing import Any

from agents import Runner

from airline_support.agent import create_airline_agent

from relai_simulator.adapter_contract import AgentTurnResult
from relai_simulator.adapter_contract import AgentAdapter


class ProjectAgentAdapter:
    def __init__(self) -> None:
        self._agent = create_airline_agent()
        self._history: list[dict[str, str]] = []
        self.agent_or_tools: object | None = self._agent

    async def run_turn(self, user_input: object) -> AgentTurnResult:
        prompt = _coerce_user_input(user_input)
        turn_messages = [*self._history, {"role": "user", "content": prompt}]
        result = await asyncio.to_thread(
            Runner.run_sync,
            self._agent,
            input=turn_messages,
        )
        assistant_message = _stringify_output(getattr(result, "final_output", None))
        self._history.extend(
            [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": assistant_message},
            ]
        )
        return AgentTurnResult(assistant_message=assistant_message)


def build_agent_adapter() -> AgentAdapter:
    return ProjectAgentAdapter()


def _coerce_user_input(user_input: Any) -> str:
    if isinstance(user_input, str):
        return user_input
    raise TypeError(
        "airline_support simulator turns must be raw strings matching the agent's user message input."
    )


def _stringify_output(output: Any) -> str:
    if output is None:
        return ""
    if isinstance(output, str):
        return output
    if isinstance(output, (dict, list, int, float, bool)):
        return json.dumps(output, ensure_ascii=True)
    return str(output)
