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

<!-- relai:review-assertions:start -->

## Review evidence

- **Criterion:** After turn one completes, the complete saved snapshot contains no opaque-demo-73915, and the recorded first user message contains a redaction marker in place of password-bearing content while retaining its ordinary baggage context.
  - Requirement: [trajectory-secret-redaction](relai://wiki/requirements/trajectory-secret-redaction.md)
  - Excerpt: Before trajectory serialization, redact provider key values, credential-bearing structured fields, and recognizable credential text throughout recorded messages, tool output, and errors, including nested structures and serialized objects.
  - Rationale: The known synthetic field and marker make password removal and non-vacuous message retention mechanically decidable.
  - Implementation paths: environment/offline_adapter.py, tests/evaluate.py
- **Criterion:** After turn two completes, the complete saved snapshot still contains no opaque-demo-73915 and its original user message remains masked with benign baggage context retained.
  - Requirement: [trajectory-secret-redaction](relai://wiki/requirements/trajectory-secret-redaction.md)
  - Excerpt: Before trajectory serialization, redact provider key values, credential-bearing structured fields, and recognizable credential text throughout recorded messages, tool output, and errors, including nested structures and serialized objects.
  - Rationale: Independently scores the second persisted snapshot rather than assuming the first result remains true.
  - Implementation paths: environment/offline_adapter.py, tests/evaluate.py
- **Criterion:** The first snapshot's steps are an exact ordered prefix of the second snapshot's steps, with additional steps appended.
  - Requirement: [trajectory-session-continuity](relai://wiki/requirements/trajectory-session-continuity.md)
  - Excerpt: Steps must retain their prior order and content as new evidence is appended, with sequential step IDs.
  - Rationale: Parsed step-array equality directly verifies cumulative evidence preservation.
  - Implementation paths: tests/evaluate.py
- **Criterion:** Snapshot one has exactly one user step; snapshot two has exactly two, in supplied turn order, with the new follow-up recorded once and all step IDs sequential starting at one.
  - Requirement: [trajectory-session-continuity](relai://wiki/requirements/trajectory-session-continuity.md)
  - Excerpt: Replayed conversation history is context, not new evidence: only the newly supplied final user message becomes a new user step.
  - Rationale: Counts, ordering, exact follow-up content and integer ID sequences detect replay duplication or recorder resets without natural-language interpretation.
  - Implementation paths: tests/evaluate.py
- **Criterion:** Both invocations call stream_agent_response with ChatMessage history ending in the new user input; the second replays the actual first input and collected assistant response, and both async iterators reach normal exhaustion before snapshot capture.
  - Requirement: [conversation-execution](relai://wiki/requirements/conversation-execution.md)
  - Excerpt: Earlier user and assistant messages must be replayed each turn. Consumers must fully exhaust the async iterator before returning the collected response.
  - Rationale: Execution records and observed SDK inputs provide exact protocol evidence and prevent invented history.
  - Implementation paths: environment/offline_adapter.py, tests/evaluate.py
- **Criterion:** The trial begins in a fresh process with a previously unused trajectory destination, and both turns reuse that same destination within the process.
  - Requirement: [session-isolation](relai://wiki/requirements/session-isolation.md)
  - Excerpt: Independent integration sessions must use fresh processes because demo bookings are mutable globals. They must also use separate trajectory paths so independent trials do not share evidence.
  - Rationale: Process identity, initially absent destination and recorded path equality are deterministic preconditions for trustworthy cumulative evidence.
  - Implementation paths: environment/offline_adapter.py, tests/evaluate.py

<!-- relai:review-assertions:end -->
