# Redact trajectory credentials

Before trajectory serialization, redact provider key values, credential-bearing structured fields, and recognizable credential text throughout recorded messages, tool output, and errors, including nested structures and serialized objects. Preserve ordinary token-count metrics rather than treating them as secret tokens.

Additional secret values must be specified by comma-separated environment variable names in `ATIF_REDACT_ENV_VARS`. The recorder should inspect only the two supported provider-key variables and explicitly named additional variables, not enumerate the environment.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [serialization-boundary redaction](relai://repo/src/airline_support/trajectory.py), and [nested/declared-secret and failure redaction tests](relai://repo/tests/test_trajectory.py).
