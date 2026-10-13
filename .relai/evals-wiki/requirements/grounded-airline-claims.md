# Avoid unsupported airline claims

The agent must not invent refund amounts, flight availability, fees, or policy exceptions. When asked how much a cancellation will refund, it should explain that eligibility and amount depend on fare rules and booking details, avoid exact unsupported amounts or guarantees, and offer to review the booking using a confirmation code.

## Evidence

[Agent instructions](relai://repo/src/airline_support/agent.py) prohibit invented airline claims. The refund scenario in the [benchmark](relai://repo/benchmarks/airline_support_benchmark.csv) supplies the expected explanation and next step.
