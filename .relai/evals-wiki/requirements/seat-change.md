# Apply requested seat changes

For a valid demo confirmation code, the seat-change operation must update the requested seat and confirm the change without altering other booking details. For an unknown code, it must decline the change and state that a valid confirmation code is required.

The benchmark example changes SKY123 to 14C. The tool trims and uppercases the requested seat and code; the demo does not implement an availability check.

## Evidence

[Seat-change benchmark](relai://repo/benchmarks/airline_support_benchmark.csv) and [change_seat implementation](relai://repo/src/airline_support/agent.py).
