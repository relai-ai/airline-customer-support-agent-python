# Report booking lookup results faithfully

A successful booking lookup must summarize the known booking details without inventing unrelated facts. An unknown code must produce a clear not-found response without fabricated passenger, route, seat, or status information.

## Demo scenario

In a fresh demo process, SKY123 belongs to Maya Chen, travels JFK to SFO, departs 2026-07-14 at 09:30, has seat 12A, and is confirmed. Subsequent seat changes must be reflected rather than overwritten by the initial fixture value. Code lookup trims whitespace and ignores letter case.

## Evidence

[Benchmark scenarios](relai://repo/benchmarks/airline_support_benchmark.csv) specify the SKY123 and ZZZ999 cases. [Booking store and lookup tool](relai://repo/src/airline_support/agent.py) supply the fixture and normalization behavior.
