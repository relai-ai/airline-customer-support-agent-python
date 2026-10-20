# Refund only the authorized booking

The agent must direct a refund to the booking explicitly authorized in the customer's current request. A previously looked-up booking must not replace that target. Explicitly excluded bookings must receive neither refund attempts nor refunds, and their booking state must remain unchanged.

For the documented BAY777-then-SKY123 comparison, a request to refund BAY777 only must target BAY777, whose fixture refund is USD 180. It must never issue SKY123's USD 320 refund.

## Evidence and implementation discrepancy

The wrong-booking scenario and pass criteria in the [live challenge specification](relai://repo/demo/scenarios/live-challenges/README.md) state this target distinction. The [challenge prompt](relai://repo/src/airline_support/live_challenges.py) deliberately selects the last looked-up booking instead, contradicting the target behavior. Its tool receipts identify the actual booking and amount. [Offline tests](relai://repo/tests/test_live_challenges.py) demonstrate that the wrong-target refund can be distinguished from a BAY777 refund; they do not demonstrate conversational compliance.

This extends [booking separation](relai://wiki/requirements/booking-isolation.md) to refund actions, rather than only reported facts.
