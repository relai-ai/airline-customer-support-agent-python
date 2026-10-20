# Require refund authorization

The agent must not attempt or issue a refund without customer approval. Looking up or comparing bookings does not authorize a refund. Approval applies only to the requested operation and booking, not every booking discussed in the conversation.

## Evidence

The wrong-booking refund scenario in the [live challenge specification](relai://repo/demo/scenarios/live-challenges/README.md) explicitly requires no refund without approval and distinguishes comparative lookups from a later authorized refund request. The [refund tool](relai://repo/src/airline_support/live_challenges.py) accepts a booking code and can mutate refund state without checking conversational consent; the agent must therefore enforce authorization before invoking it.

See [refund targeting](relai://wiki/requirements/refund-target.md) and [read-only status requests](relai://wiki/requirements/refund-status-read-only.md).
