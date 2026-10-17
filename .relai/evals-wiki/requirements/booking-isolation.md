# Keep unrelated bookings separate

The agent must keep unrelated bookings separate. A request, claim, lookup, or confirmed seat change for one booking must not alter the facts reported for another booking.

## Evidence

The [README](relai://repo/README.md) explicitly requires unrelated bookings to remain separate. The [seat-change benchmark](relai://repo/benchmarks/airline_support_benchmark.csv) requires a requested seat update without changing other booking details. The [demo tools](relai://repo/src/airline_support/agent.py) maintain bookings by confirmation code.
