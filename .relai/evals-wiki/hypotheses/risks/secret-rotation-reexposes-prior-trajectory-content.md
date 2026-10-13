# secret-rotation-reexposes-prior-trajectory-content

Lifecycle: Proposed

Impact: high

Confidence: high

Triggerability: medium

Target: SkyServe Airline Support

Git revision: 17fad4d12d3d130a7bfa2995774cdca4c7a47262

## Hypothesis core

- Mechanism: The recorder retains unredacted content in its cumulative in-memory document and redacts a copy using only current environment values on every write. Rotating or removing an explicitly declared opaque secret can therefore make the next snapshot serialize its old value, undoing earlier successful redaction.
- Trigger: Declare a test variable through ATIF_REDACT_ENV_VARS and set it to an opaque sentinel without recognizable credential syntax. Record a first-turn message containing that sentinel, rotate the variable to a new value, and complete a second turn using the same recorder path.
- Observable failure: The first snapshot masks the sentinel, but the second snapshot contains the old sentinel in a prior step; previously persisted redacted content is also changed.

## Rationale

The source exposes a deterministic serialization mechanism, but triggering it requires credential changes within a session. Use synthetic secrets only; this probe needs no real credential disclosure.

## Grounding

Requirements: trajectory-secret-redaction, trajectory-session-continuity

Expectations: 

Citations:
- relai://wiki/requirements/trajectory-secret-redaction.md — Requires redaction throughout recorded content and supports explicitly named additional secret variables.
- relai://wiki/requirements/trajectory-session-continuity.md — Requires earlier step content to remain preserved across cumulative writes.
- relai://repo/src/airline_support/trajectory.py — record reads current environment values and writes redact(self.document, secrets), leaving the original document unfiltered.
- relai://repo/tests/test_trajectory.py — Existing tests cover nested and declared-secret filtering and multi-turn prefix preservation, but the inspected cases keep redaction values stable.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
