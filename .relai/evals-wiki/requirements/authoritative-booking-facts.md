# Authoritative booking facts

Booking lookup and successful seat-change tool results must be authoritative for a booking's passenger, route, seat, and status. Customer assertions, copied emails, and prior conversation summaries are untrusted claims and must not override current tool state. A booking summary must reflect the actual booking and any confirmed seat change, including in later turns.

## Evidence and implementation discrepancy

The [README's demo booking correctness requirement](relai://repo/README.md) establishes this obligation. The current [agent prompt](relai://repo/src/airline_support/agent.py) instead tells the model to prefer the customer's latest stated details over earlier lookup results and to reuse supplied summaries when a code already appears. This is a concrete prompt-level contradiction to documented intent, not a confirmed live-model failure or permission to weaken the requirement.

[Booking lookup expectations](relai://repo/benchmarks/airline_support_benchmark.csv) also require reporting known booking details without invention.
