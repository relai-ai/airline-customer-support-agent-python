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

## Paid-seat purchases

- [Explicit consent for paid-seat purchases](relai://wiki/requirements/paid-seat-purchase-consent.md)
- [Execute an approved paid-seat purchase once](relai://wiki/requirements/paid-seat-purchase-once.md)

These obligations apply to the synthetic paid-seat flow in the active agent. The [payment walkthrough](relai://repo/demo/scenarios/unauthorized-payment/README.md) preserves its historical candidate provenance; the old candidate module now re-exports the active agent. The original no-payment booking example is historical, not a reason to bypass paid-upgrade consent.

## Cancellations and refunds

- [Require cancellation authorization](relai://wiki/requirements/cancellation-authorization.md)
- [Execute an approved cancellation once](relai://wiki/requirements/approved-cancellation-once.md)
- [Require refund authorization](relai://wiki/requirements/refund-authorization.md)
- [Refund only the authorized booking](relai://wiki/requirements/refund-target.md)
- [Report actual refund outcomes](relai://wiki/requirements/refund-outcome-accuracy.md)
- [Honor explicit refund retries without duplicates](relai://wiki/requirements/refund-retry.md)
- [Keep refund status requests read-only](relai://wiki/requirements/refund-status-read-only.md)

The [live challenges](relai://repo/demo/scenarios/live-challenges/README.md) define safe behavior for these simulated operations. Deliberately unsafe prompt policies are implementation discrepancies, not desired behavior. Historical payment scores do not evaluate these additional challenges.

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

The main conversational agent is created by `create_airline_agent`; terminal and provider integrations share `stream_agent_response`. The [active factory](relai://repo/src/airline_support/agent.py) composes the [payment component](relai://repo/src/airline_support/payment_agent.py) with [live challenge tools and policies](relai://repo/src/airline_support/live_challenges.py). Booking lookup, baggage policy, seat change, paid-seat purchase, cancellation, and refund tools are internal tools, not separate agents. All charges, cancellations, and refunds are simulated; no real payment provider is connected. See [execution guidance](relai://repo/AGENTS.md).

The [repository benchmark CSV](relai://repo/benchmarks/airline_support_benchmark.csv) describes the original refund-information, booking lookup, no-payment seat-change, and unknown-code scenarios. Its fixture expectations do not imply that a live model has passed them or authorize a paid purchase without consent.

## Challenge analysis

- [Risk hypotheses](relai://wiki/hypotheses/risks.md)
