# Booking lookup outcomes

For a booking lookup request with a supplied confirmation code, the agent must use the code to obtain and summarize the known booking details without unnecessary additional questions or invented details. If no booking is found, it must clearly report that outcome and must not fabricate passenger, route, seat, or status information.

## Evidence

The lookup and unknown-code scenarios in the [benchmark CSV](relai://repo/benchmarks/airline_support_benchmark.csv) specify these outcomes. The [lookup tool](relai://repo/src/airline_support/agent.py) returns either current booking details or a not-found message.

The SKY123 fixture initially describes Maya Chen, JFK to SFO, departure 2026-07-14 09:30, seat 12A, confirmed status. These are initial demo facts, not immutable facts after a successful seat change; [current tool state governs](relai://wiki/requirements/authoritative-booking-facts.md).
