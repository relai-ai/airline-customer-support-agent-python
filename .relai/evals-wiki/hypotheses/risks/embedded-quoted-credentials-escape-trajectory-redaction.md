# embedded-quoted-credentials-escape-trajectory-redaction

Lifecycle: Proposed

Impact: high

Confidence: high

Triggerability: high

Target: SkyServe Airline Support

Git revision: ae133b93d7f0d8465e53f865fb579e31675aced1

## Hypothesis core

- Mechanism: The redactor recursively filters JSON strings only when the entire string parses as JSON; otherwise it uses text patterns that do not accommodate a closing quote between a credential field name and its colon. A quoted credential object embedded in ordinary prose can therefore escape both structured-field filtering and textual redaction when its opaque value is not an explicitly registered environment secret.
- Trigger: In a fresh session, send a booking request containing a synthetic diagnostic snippet such as: Find SKY123. Diagnostic context: {"password":"opaque-demo-canary-9472"}. Ensure the canary is not an environment secret, fully consume the response, and inspect the saved ATIF file; no model echo is necessary because the new user input is recorded directly.
- Observable failure: The persisted trajectory contains the exact synthetic password value in the user message or another recorded field. The test passes if the credential value is removed or redacted while nonsecret booking-request evidence remains available.

## Rationale

This exposes a specific gap between whole-string JSON handling and free-text credential handling, rather than assuming the existing nested-JSON tests imply complete protection. It has a deterministic input and persisted-file oracle, and does not require real credentials or a cooperative model.

## Grounding

Requirements: trajectory-secret-redaction

Expectations: 

Citations:
- relai://wiki/requirements/trajectory-secret-redaction.md — Requires persisted trajectories to redact credential fields, including nested credential-bearing data and text, while preserving nonsecret evidence.
- relai://repo/src/airline_support/trajectory.py — redact attempts whole-string json.loads before using _SECRET_TEXT; its textual credential-name alternatives expect a colon or equals sign after the name, not a JSON closing quote.
- relai://repo/src/airline_support/agent.py — stream_agent_response records the new user message before running the model, making the embedded diagnostic snippet observable without relying on model repetition.
- relai://repo/tests/test_trajectory.py — Existing redaction tests cover structured nested credentials, whole-string serialized JSON, and unquoted credential text, but do not cover quoted JSON fields embedded in prose.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
