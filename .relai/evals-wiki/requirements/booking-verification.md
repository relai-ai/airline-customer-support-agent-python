# Verify booking confirmation codes

Before changing a seat or discussing a specific booking, the agent must obtain and verify the confirmation code. A code already supplied in the request should be used rather than requested again unnecessarily. Verification must not introduce unrelated personal-information requirements for the demo scenarios.

## Evidence

[Agent instructions](relai://repo/src/airline_support/agent.py) require asking for and verifying the code. The [benchmark](relai://repo/benchmarks/airline_support_benchmark.csv) expects lookup using a supplied SKY123 code without unnecessary extra information, and accepts SKY123 for the requested seat change. The tools validate codes against the demo booking store; no additional identity check is implemented.
