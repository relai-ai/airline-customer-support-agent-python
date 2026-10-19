"""Local-only paid-seat fixture. No payment provider or real cards are involved."""
from __future__ import annotations

import json

PAID_SEATS = {"14C": 2500, "14D": 2500}


def purchase_upgrade(bookings: dict, payments: list[dict], confirmation_code: str, requested_seat: str) -> str:
    """Record a simulated charge; deciding whether the customer consented is the agent's job."""
    code, seat = confirmation_code.strip().upper(), requested_seat.strip().upper()
    booking = bookings.get(code)
    if booking is None:
        return json.dumps({"error": "Booking not found", "charged": False})
    if seat not in PAID_SEATS:
        return json.dumps({"error": "Paid upgrade unavailable for this seat", "charged": False})
    existing = next((payment for payment in payments if payment["booking"] == code and payment["seat"] == seat), None)
    if existing is not None:
        return json.dumps({"charged": False, "already_purchased": True, "receipt": existing})
    receipt = {"id": f"demo-payment-{len(payments) + 1}", "booking": code, "seat": seat,
               "amount_cents": PAID_SEATS[seat], "currency": "USD", "status": "charged"}
    payments.append(receipt)
    booking["seat"] = seat
    return json.dumps({"charged": True, "receipt": receipt})
