# Agent test: `embedded-json-redaction-two-turn`

## Description

Proposal-only, keyless two-turn integration probe for the existing embedded-JSON credential redaction hypothesis. No runtime or conversational result is claimed.

## Scenario

Covers prose plus fenced JSON containing one synthetic password during ordinary baggage support, followed by an ordinary baggage follow-up using actual replayed history and a shared trajectory path. No matching registered redaction artifact was returned; reuse the inspected offline SDK testing pattern.

## Evaluator mechanism

Whole-string JSON parsing fails for a prose-wrapped code fence, and fallback assignment matching may skip the quoted JSON password field. A subsequent cumulative write tests whether both persisted snapshots consistently protect the original message without losing continuity.

## Evaluation criteria

Separate deterministic checks for masking in each saved snapshot, prefix continuity, user-step uniqueness and IDs, full-consumption/history protocol, and isolated session setup. Confirm the selected weakness only from a literal sentinel leak in actual completed native evidence.

### `snapshot-one-redaction` (code)

Complete first native snapshot has no sentinel; first user message retains baggage context and literal [REDACTED] replacing the value, password assignment, JSON object or whole fenced diagnostic. Whitespace and value-only JSON spacing may differ.

### `snapshot-two-redaction` (code)

Independently applies the same complete-content masking check to the second completed snapshot.

### `cumulative-prefix` (code)

First snapshot steps exactly prefix second snapshot steps and additional steps are appended.

### `user-steps-and-ids` (code)

One then two ordered user steps, exact follow-up once, unchanged original user message, integer sequential step IDs starting at one.

### `history-and-exhaustion` (code)

Native ChatMessage histories and observed SDK inputs replay actual collected first response; both real streaming iterators normally exhaust after SDK completion events and before capture. Missing or aborted evidence is invalid/inconclusive, not proof of leakage; scripted outputs are fixtures, not graded semantics.

### `session-isolation` (code)

Fresh exec with initially absent destination and empty native recorder cache; both turns share PID and single effective resolved native path in a minimal credential-free environment.

## References

- [trajectory-secret-redaction](relai://wiki/requirements/trajectory-secret-redaction.md): Defines the primary credential serialization obligation.
- [trajectory-session-continuity](relai://wiki/requirements/trajectory-session-continuity.md): Defines preservation and nonduplication of earlier turn evidence.
- [conversation-execution](relai://wiki/requirements/conversation-execution.md): Defines history replay and full streaming consumption.
- [session-isolation](relai://wiki/requirements/session-isolation.md): Defines fresh-process and independent-path setup.
