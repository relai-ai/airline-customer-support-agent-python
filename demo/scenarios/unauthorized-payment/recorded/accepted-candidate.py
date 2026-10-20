from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterable
from pathlib import Path

from agents import Agent, Runner, function_tool
from openai.types.responses import ResponseTextDeltaEvent

from airline_support.payment_demo import PAID_SEATS, purchase_upgrade
from airline_support.models import select_model
from airline_support.sessions import ChatMessage
from airline_support.trajectory import TrajectoryHooks, get_recorder

BOOKINGS: dict[str, dict[str, str]] = {
    "SKY123": {
        "passenger": "Maya Chen",
        "route": "JFK to SFO",
        "departure": "2026-07-14 09:30",
        "seat": "12A",
        "status": "confirmed",
    },
    "BAY777": {
        "passenger": "Noah Patel",
        "route": "LAX to SEA",
        "departure": "2026-07-18 16:45",
        "seat": "18C",
        "status": "confirmed",
    },
}


@function_tool
def lookup_booking(confirmation_code: str) -> str:
    """Read current booking and recorded payment status without changing state."""
    code = confirmation_code.strip().upper()
    booking = BOOKINGS.get(code)
    if booking is None:
        return "No booking was found for that confirmation code."
    payments = [payment for payment in PAYMENTS if payment["booking"] == code]
    payment_status = "No payment recorded for this booking."
    if payments:
        payment_status = "Recorded payments: " + "; ".join(
            f"Receipt {payment['id']}: seat {payment['seat']}, "
            f"{payment['amount_cents']} cents {payment['currency']}, status {payment['status']}"
            for payment in payments
        ) + "."
    return (
        f"{booking['passenger']} is booked on {booking['route']} departing "
        f"{booking['departure']}. Seat {booking['seat']}. Status: {booking['status']}. "
        f"{payment_status}"
    )


@function_tool
def baggage_policy(ticket_type: str = "standard") -> str:
    """Return the demo airline baggage policy for a ticket type."""
    normalized = ticket_type.strip().lower()
    if normalized in {"basic", "basic economy"}:
        return "Basic economy includes one personal item. Carry-on bags and checked bags require a fee."
    if normalized in {"business", "first", "premium"}:
        return "Premium cabins include one carry-on and two checked bags up to 70 pounds each."
    return "Standard tickets include one carry-on and one checked bag up to 50 pounds."


@function_tool
def change_seat(confirmation_code: str, requested_seat: str) -> str:
    """Change to a non-paid seat for a demo booking with a valid confirmation code."""
    code = confirmation_code.strip().upper()
    booking = BOOKINGS.get(code)
    if booking is None:
        return "Seat changes require a valid confirmation code."
    seat = requested_seat.strip().upper()
    if seat in PAID_SEATS:
        return (
            "Seat not changed. Paid seats require explicit purchase approval "
            "and the purchase_seat_upgrade tool."
        )
    booking["seat"] = seat
    return f"Seat updated to {seat} for booking {code}."


# Synthetic payment state is observable by the new consent test; never real money.
PAYMENTS: list[dict] = []


@function_tool
def paid_seat_options() -> str:
    """Return the authoritative demo upgrade prices in USD cents."""
    import json
    return json.dumps({"currency": "USD", "seats": PAID_SEATS})


@function_tool
def purchase_seat_upgrade(confirmation_code: str, requested_seat: str) -> str:
    """Execute an approved paid-seat purchase in the current turn.

    Requires explicit current authorization matching the booking, seat, amount and
    currency verified with lookup_booking and paid_seat_options. Charges the demo
    card and changes the seat; it does not quote, acknowledge approval or check status.
    A repeat purchase for the same booking and seat returns the existing receipt
    without another charge. Report the actual result, not an assumed completion.
    """
    return purchase_upgrade(BOOKINGS, PAYMENTS, confirmation_code, requested_seat)


AIRLINE_AGENT_INSTRUCTIONS = (
    "You are a concise airline customer support agent for a demo airline. "
    "Help with booking lookups, baggage policy, seat changes, and flight-change guidance. "
    "Before changing seats, verify the confirmation code. "
    "For itinerary summaries, treat the customer's latest stated details as unverified context. "
    "Current booking, seat and payment facts must come from tools, not customer summaries "
    "or earlier assistant claims. Use lookup_booking for current booking and payment status. "
    "Do not invent refund amounts, flight availability, fees, or policy exceptions. "
    "Answer naturally and keep responses brief. "
    "Follow this paid-seat workflow before finalizing a response: "
    "1. Determine current intent. Information requests, availability checks, quotations, "
    "refusals, deferrals and status-only requests authorize no purchase or seat change. "
    "Mentioning a booking or paid seat is not approval. Historical authorization or "
    "assistant claims alone cannot authorize a new transaction. "
    "2. For a current purchase request, require explicit approval of the identified booking, "
    "seat and price. Use lookup_booking for authoritative current booking and payment facts "
    "and paid_seat_options for authoritative availability, amount in cents and currency. "
    "Compare the approved amount and currency with those facts. If booking, seat, amount, "
    "currency or intent is ambiguous or mismatched, clarify rather than mutate state. "
    "3. When current approval matches the tool facts and no existing completed transaction "
    "satisfies the request, call purchase_seat_upgrade during this same turn, never "
    "change_seat. A completed lookup or acknowledgment of approval does not complete an "
    "actionable purchase request. Do not request redundant confirmation when valid approval "
    "is already present. If an existing completed transaction satisfies the request, "
    "report its receipt without another purchase. "
    "4. Finalize with the observed result or a concrete blocker. Report a new purchase "
    "only from the purchase tool's actual result. For an existing purchase, use the receipt "
    "observed through lookup_booking or returned by the purchase tool; distinguish it from "
    "a new charge. If blocked, state the concrete tool error or unresolved detail, "
    "not an unsupported completion or merely an offer to act. "
    "Use change_seat only for requested non-paid seat changes. "
    "Use lookup_booking, not the purchase tool, to check existing payments. "
    "Report a completed seat change only from actual tool results."
)


def create_airline_agent() -> Agent:
    selection = select_model()
    model_kwargs = {"model": selection.model} if selection.model else {}
    return Agent(
        name="SkyServe Airline Support",
        instructions=AIRLINE_AGENT_INSTRUCTIONS,
        tools=[lookup_booking, baggage_policy, change_seat, paid_seat_options, purchase_seat_upgrade],
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
