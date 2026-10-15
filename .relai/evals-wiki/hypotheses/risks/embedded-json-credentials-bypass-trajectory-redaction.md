# embedded-json-credentials-bypass-trajectory-redaction

Lifecycle: Confirmed

Impact: high

Confidence: high

Triggerability: high

Target: SkyServe Airline Support

Git revision: 396a94ecf82adf93c1176a0cb6c12b9adec35ed2

## Hypothesis core

- Mechanism: The redactor recursively filters serialized credential fields only when the entire string parses as JSON. JSON embedded in prose or a Markdown code fence fails that parse, while the fallback credential regex does not match quoted JSON field names such as "password" followed by a closing quote before the colon.
- Trigger: In a fresh isolated session, submit a baggage-support message containing a fenced JSON diagnostic with {"password":"opaque-demo-73915"}, then fully consume the response and inspect the native trajectory. Use only this synthetic sentinel, leave it absent from provider keys and explicitly declared secret variables, and include surrounding prose so the message is not a standalone JSON document.
- Observable failure: The saved ATIF user step contains the literal synthetic password value instead of masking it, even though it is explicitly labeled as a password in the embedded JSON.

## Rationale

This tests a deterministic serialization-boundary gap without relying on model compliance or real credentials. Support diagnostics commonly combine prose and structured snippets, and the existing tests demonstrate standalone serialized-object filtering rather than this wrapped representation.

## Grounding

Requirements: trajectory-secret-redaction

Expectations: 

Citations:
- relai://wiki/requirements/trajectory-secret-redaction.md — Requires credential-bearing structured fields and recognizable credential text to be redacted throughout recorded messages, including serialized objects.
- relai://repo/src/airline_support/trajectory.py — redact attempts json.loads on the complete string and otherwise uses _SECRET_TEXT; the assignment regex does not allow the closing JSON field-name quote before the colon.
- relai://repo/src/airline_support/agent.py — stream_agent_response records the final user message before starting model execution, making the unfiltered diagnostic directly observable in trajectory evidence.
- relai://repo/tests/test_trajectory.py — The inspected redaction test covers a standalone serialized password object, nested fields, and unquoted credential assignments, but not JSON wrapped in prose or code fences.

## Probe evidence

- `embedded-json-redaction-two-turn` — Triggered; package `b1aca818d00416f52d14902084a31da9018ee109e8145bd137d7cfdbcb1b35f0`; result `3b91d2679f3c53b30a527bdff5e933d36079f14a4c8a7b57e502ccd6e26c14a4`

## Artifact lineage

relai://learning-env/embedded-json-redaction-two-turn
relai://attachment/challenge-evidence/challenge-6193-1#item=summary
