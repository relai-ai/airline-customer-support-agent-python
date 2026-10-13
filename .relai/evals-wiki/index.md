# EvalsWiki

SkyServe Airline Support is a terminal demo airline assistant built on the OpenAI Agents SDK. Its booking lookup, baggage policy, and seat-change functions are internal tools of one conversational agent. The terminal interface and provider alternatives share `stream_agent_response`.

The requirements below distill repository documentation, agent instructions, benchmark expectations, and test contracts. They are repository-derived obligations, not independently confirmed user intent. Implementation observations are distinguished from desired behavior where relevant.

## Customer-facing behavior

- [Required closing phrase](relai://wiki/requirements/response-closing.md)
- [Decline non-airline requests](relai://wiki/requirements/airline-topic-boundary.md)
- [Brief, natural responses](relai://wiki/requirements/concise-responses.md)
- [Verify booking confirmation codes](relai://wiki/requirements/booking-verification.md)
- [Report booking lookup results faithfully](relai://wiki/requirements/booking-lookup.md)
- [Apply requested seat changes](relai://wiki/requirements/seat-change.md)
- [Report demo baggage allowances](relai://wiki/requirements/baggage-policy.md)
- [Avoid unsupported airline claims](relai://wiki/requirements/grounded-airline-claims.md)

## Conversation and runtime

- [Replay history through the shared streaming entry point](relai://wiki/requirements/conversation-execution.md)
- [Isolate independent demo sessions](relai://wiki/requirements/session-isolation.md)
- [Persist terminal messages](relai://wiki/requirements/terminal-message-logging.md)
- [Start fresh terminal logs](relai://wiki/requirements/terminal-log-lifecycle.md)
- [Handle terminal input controls](relai://wiki/requirements/terminal-input-controls.md)
- [Select a supported provider](relai://wiki/requirements/provider-selection.md)

## Local trajectory evidence

- [Record locally regardless of hosted tracing](relai://wiki/requirements/local-trajectory-recording.md)
- [Preserve cumulative session evidence](relai://wiki/requirements/trajectory-session-continuity.md)
- [Capture observed model and tool activity](relai://wiki/requirements/trajectory-event-fidelity.md)
- [Write trajectories atomically](relai://wiki/requirements/trajectory-atomic-writes.md)
- [Preserve runtime failures and cancellation](relai://wiki/requirements/trajectory-runtime-errors.md)
- [Keep recording behavior-preserving](relai://wiki/requirements/recording-failure-isolation.md)
- [Redact trajectory credentials](relai://wiki/requirements/trajectory-secret-redaction.md)

## Development safeguards

- [Keep secrets and generated files local](relai://wiki/requirements/local-runtime-files.md)
- [Validate without launching live chat](relai://wiki/requirements/safe-development-validation.md)
- [Require permission to commit or push](relai://wiki/requirements/version-control-permission.md)

## Evidence entry points

[Project documentation](relai://repo/README.md), [integration and development guidance](relai://repo/AGENTS.md), [agent implementation](relai://repo/src/airline_support/agent.py), [benchmark scenarios](relai://repo/benchmarks/airline_support_benchmark.csv), and [package configuration](relai://repo/pyproject.toml).


## Challenge analysis

- [Risk hypotheses](relai://wiki/hypotheses/risks.md)
