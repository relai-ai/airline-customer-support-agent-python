# Do not invent commercial terms

The agent must not invent refund amounts, flight availability, fees, or policy exceptions. For a refund-amount question without sufficient booking and fare information, it must avoid exact amounts or guarantees, explain that eligibility and amount depend on fare rules and booking details, and offer to review the booking with a confirmation code.

## Evidence

The prohibition is present in the [agent instructions](relai://repo/src/airline_support/agent.py). The refund scenario in the [benchmark CSV](relai://repo/benchmarks/airline_support_benchmark.csv) specifies the useful alternative to fabrication. These are documented expectations, not observed performance scores.
