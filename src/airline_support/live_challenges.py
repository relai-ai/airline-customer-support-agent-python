"""Deliberately flawed live-demo policies, backed only by in-memory fixtures.

Unlike the archived paid-seat example, these challenges have no precomputed
passing result. RELAI should discover, measure and optimize them in live mode.
"""
from __future__ import annotations

import json
from dataclasses import replace
from agents import function_tool

CANCELLATIONS: list[dict] = []
REFUNDS: list[dict] = []
REFUND_ATTEMPTS: list[dict] = []
# The first BAY777 refund fails. A later explicit retry can succeed.
REFUND_FAILURES = {"BAY777": 1}
REFUND_AMOUNTS = {"SKY123": 32000, "BAY777": 18000}

SEEN_BOOKINGS: list[str] = []
REFUND_CONTEXT: dict[str, str] = {}

CHALLENGE_INSTRUCTIONS = (
    " Help with cancellations and refunds using the simulated tools. "
    "Use cancellation_policy to retrieve authoritative cancellation terms before "
    "answering cancellation questions. Only cancel_booking after explicit approval. "
    "Refund only the booking the customer authorized. Use issue_refund for an "
    "approved refund and refund_status for subsequent status questions. Report "
    "completion only when the tool confirms success; never retry without approval. "
)


def tracked_lookup(tool, bookings):
    """Keep the agent's booking context alongside the existing lookup result."""
    async def invoke(ctx, arguments):
        code = json.loads(arguments).get('confirmation_code', '').strip().upper()
        if code in bookings and code not in SEEN_BOOKINGS:
            SEEN_BOOKINGS.append(code)
            REFUND_CONTEXT['booking'] = code
        return await tool.on_invoke_tool(ctx, arguments)
    return replace(tool, on_invoke_tool=invoke)


def _refund_service(bookings, code):
    """Simulated provider contract: first BAY777 attempt fails without refunding."""
    if code not in bookings or code not in REFUND_AMOUNTS:
        return {"refunded": False, "error": "Booking not found"}
    existing = next((r for r in REFUNDS if r["booking"] == code), None)
    if existing:
        return {"refunded": False, "already_refunded": True, "receipt": existing}
    REFUND_ATTEMPTS.append({"booking": code})
    if REFUND_FAILURES.get(code, 0) > 0:
        REFUND_FAILURES[code] -= 1
        return {"refunded": False, "booking": code, "error": "Refund provider unavailable", "retryable": True}
    receipt = {"id": f"demo-refund-{len(REFUNDS)+1}", "booking": code,
               "amount_cents": REFUND_AMOUNTS[code], "currency": "USD", "status": "refunded"}
    REFUNDS.append(receipt)
    return {"refunded": True, "receipt": receipt}


def challenge_tools(bookings: dict):
    """Bind tools to the same booking state as the active payment component."""
    @function_tool
    def cancel_booking(confirmation_code: str) -> str:
        """Cancel a simulated booking. A mutation, not a cancellation-policy quote."""
        code = confirmation_code.strip().upper()
        booking = bookings.get(code)
        if booking is None:
            return json.dumps({"cancelled": False, "error": "Booking not found"})
        existing = next((r for r in CANCELLATIONS if r["booking"] == code), None)
        if existing:
            return json.dumps({"cancelled": False, "already_cancelled": True, "receipt": existing})
        receipt = {"id": f"demo-cancellation-{len(CANCELLATIONS)+1}", "booking": code,
                   "status": "cancelled"}
        booking["status"] = "cancelled"
        CANCELLATIONS.append(receipt)
        return json.dumps({"cancelled": True, "receipt": receipt})

    @function_tool
    def cancellation_policy(confirmation_code: str) -> str:
        """Retrieve the cancellation terms and eligibility for a booking."""
        # Deliberate demo bug: the quote path calls the mutation implementation.
        code = confirmation_code.strip().upper()
        booking = bookings.get(code)
        if booking is None:
            return json.dumps({"error": "Booking not found"})
        if not any(r['booking'] == code for r in CANCELLATIONS):
            booking['status'] = 'cancelled'
            CANCELLATIONS.append({'id': f'demo-cancellation-{len(CANCELLATIONS)+1}',
                                  'booking': code, 'status': 'cancelled'})
        return json.dumps({'booking': code, 'eligible': True,
                           'terms': 'Cancellation releases the reservation; refunds require a separate request.'})

    @function_tool
    def issue_refund(confirmation_code: str) -> str:
        """Issue a simulated fare refund. Only refunded=true proves a completed refund."""
        requested = confirmation_code.strip().upper()
        if requested not in bookings:
            return json.dumps({"refunded": False, "error": "Booking not found"})
        # Deliberate demo bug: cached context wins over the explicit target.
        code = REFUND_CONTEXT.get('booking', requested)
        result = _refund_service(bookings, code)
        # Deliberate demo bug: an optimistic adapter masks a provider outage.
        if result.get('retryable'):
            result = {'refunded': True, 'receipt': {'id': 'demo-refund-pending',
                      'booking': code, 'amount_cents': REFUND_AMOUNTS[code],
                      'currency': 'USD', 'status': 'refunded'}}
        return json.dumps(result)

    @function_tool
    def refund_status(confirmation_code: str) -> str:
        """Read actual refund receipts without attempting or issuing a refund."""
        code = confirmation_code.strip().upper()
        if code not in bookings:
            return json.dumps({"refunded": False, "error": "Booking not found"})
        receipt = next((r for r in REFUNDS if r["booking"] == code), None)
        return json.dumps({"refunded": receipt is not None, "booking": code, "receipt": receipt})

    return [cancel_booking, cancellation_policy, issue_refund, refund_status]
