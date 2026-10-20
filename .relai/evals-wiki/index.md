# EvalsWiki

Repository requirements and evaluation knowledge for SkyServe Airline Support.

## Conversational behavior

- [Required response ending](relai://wiki/requirements/response-ending.md)
- [Airline-only assistance](relai://wiki/requirements/airline-only-assistance.md)
- [Authoritative booking facts](relai://wiki/requirements/authoritative-booking-facts.md)
- [Keep unrelated bookings separate](relai://wiki/requirements/booking-isolation.md)
- [Booking lookup outcomes](relai://wiki/requirements/booking-lookup-outcomes.md)
- [Verified seat changes](relai://wiki/requirements/verified-seat-changes.md)
- [Do not invent commercial terms](relai://wiki/requirements/no-invented-commercial-terms.md)

## Isolated paid-seat candidate

- [Explicit consent for paid-seat purchases](relai://wiki/requirements/paid-seat-purchase-consent.md)
- [Execute an approved paid-seat purchase once](relai://wiki/requirements/paid-seat-purchase-once.md)

These obligations concern the separate [local-only payment candidate](relai://repo/demo/scenarios/unauthorized-payment/README.md), whose purchase tool records synthetic charges. They do not make the original demo's seat changes paid purchases. Its intentionally defective prompt is implementation evidence, not the desired consent policy or proof of a measured failure.

## Session execution and evidence

- [Replay conversation history and finish streaming](relai://wiki/requirements/session-execution.md)
- [Isolate independent demo sessions](relai://wiki/requirements/independent-session-isolation.md)
- [Persist terminal conversations](relai://wiki/requirements/terminal-conversation-logs.md)
- [Cumulative local trajectories](relai://wiki/requirements/cumulative-local-trajectories.md)
- [Record observed events faithfully](relai://wiki/requirements/observed-trajectory-evidence.md)
- [Atomic trajectory writes](relai://wiki/requirements/atomic-trajectory-writes.md)
- [Behavior-preserving recording and error propagation](relai://wiki/requirements/behavior-preserving-recording.md)
- [Redact trajectory secrets](relai://wiki/requirements/trajectory-secret-redaction.md)

## Project context

The main conversational agent is created by `create_airline_agent`; terminal and provider integrations share `stream_agent_response`. Booking lookup, baggage policy, and seat change are internal tools, not separate agents. See [execution guidance](relai://repo/AGENTS.md) and [implementation](relai://repo/src/airline_support/agent.py). The isolated paid-seat candidate supplies its own agent module and adds paid-seat options and purchase tools.

The [repository benchmark CSV](relai://repo/benchmarks/airline_support_benchmark.csv) describes refund, booking lookup, seat change, and unknown-code scenarios. Its fixture expectations do not imply that a live model has passed them.


## Challenge analysis

- [Risk hypotheses](relai://wiki/hypotheses/risks.md)
