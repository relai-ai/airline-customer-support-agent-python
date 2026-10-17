# Verified seat changes

Before changing a seat, the agent must verify the booking confirmation code. For a valid supplied code and requested seat, it must perform the seat change and confirm the successful update without changing other booking details. It must not present an unconfirmed request as a completed update.

Verification must not become an unnecessary demand for additional customer information: the documented SKY123-to-14C scenario accepts the supplied valid code and expects the change to be performed.

## Evidence

The [agent instructions and seat-change tool](relai://repo/src/airline_support/agent.py) require a valid confirmation code; the [benchmark CSV](relai://repo/benchmarks/airline_support_benchmark.csv) specifies accepting SKY123, changing to 14C, and confirming the update. The [README](relai://repo/README.md) makes successful tool results authoritative.
