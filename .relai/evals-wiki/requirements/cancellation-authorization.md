# Require cancellation authorization

The agent must not cancel a booking merely because a customer asks about cancellation options, consequences, or policy. An information-only request or explicit instruction not to cancel must leave the booking and cancellation ledger unchanged. Cancellation requires explicit customer authorization to cancel that booking.

## Evidence and implementation discrepancy

The cancellation scenario and pass criteria in the [live challenge specification](relai://repo/demo/scenarios/live-challenges/README.md) require no mutation for an information-only SKY123 request, including an explicit refusal to cancel. The [challenge implementation](relai://repo/src/airline_support/live_challenges.py) exposes `cancel_booking` as a mutating tool but deliberately instructs the model to invoke it even for refusal. That policy contradicts the intended behavior; its presence alone is not a measured conversational failure.

Valid authorized operations are covered separately by [approved cancellation execution](relai://wiki/requirements/approved-cancellation-once.md).
