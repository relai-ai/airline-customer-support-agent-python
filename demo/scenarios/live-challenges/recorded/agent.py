from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterable
from pathlib import Path

from agents import Agent, Runner, function_tool
from openai.types.responses import ResponseTextDeltaEvent

from airline_support import payment_agent
from airline_support.payment_agent import (
    BOOKINGS, PAYMENTS, lookup_booking, baggage_policy, change_seat,
    paid_seat_options, purchase_seat_upgrade,
)
from airline_support.live_challenges import challenge_tools, CHALLENGE_INSTRUCTIONS, tracked_lookup
from airline_support.models import select_model
from airline_support.sessions import ChatMessage
from airline_support.trajectory import TrajectoryHooks, get_recorder

def create_airline_agent() -> Agent:
    selection = select_model()
    model_kwargs = {"model": selection.model} if selection.model else {}
    return Agent(
        name="SkyServe Airline Support",
        instructions=payment_agent.AIRLINE_AGENT_INSTRUCTIONS + CHALLENGE_INSTRUCTIONS,
        tools=[tracked_lookup(lookup_booking, BOOKINGS), baggage_policy, change_seat, paid_seat_options, purchase_seat_upgrade,
               *challenge_tools(BOOKINGS)],
        **model_kwargs,
    )


def _messages_to_agent_input(messages: Iterable[ChatMessage]) -> list[dict[str, str]]:
    return [
        {"role": message.role, "content": message.content}
        for message in messages
        if message.role in {"user", "assistant"}
    ]


async def stream_agent_response(
    messages: Iterable[ChatMessage], *, trajectory_path: Path | None = None
) -> AsyncIterator[str]:
    agent_input = _messages_to_agent_input(messages)
    recorder = get_recorder(trajectory_path)
    if recorder is not None and agent_input and agent_input[-1]["role"] == "user":
        # History is replay context; only the new input is a new trajectory step.
        recorder.user(agent_input[-1]["content"])
    kwargs = {"hooks": TrajectoryHooks(recorder)} if recorder is not None else {}
    result = None
    try:
        result = Runner.run_streamed(create_airline_agent(), input=agent_input, **kwargs)
        async for event in result.stream_events():
            if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
                if event.data.delta:
                    yield event.data.delta
        # Older SDKs stop streaming instead of propagating caller cancellation.
        if recorder is not None and asyncio.current_task().cancelling():
            raise asyncio.CancelledError()
    except BaseException as error:
        if recorder is not None:
            if result is not None:
                result.cancel()
                try:
                    async for _ in result.stream_events():
                        pass
                except BaseException:
                    pass  # Cleanup must not replace the original target error.
            recorder.failure(error)
        raise
