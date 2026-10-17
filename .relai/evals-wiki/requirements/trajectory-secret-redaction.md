# Redact trajectory secrets

Persisted trajectories must redact provider keys and credential fields, including credential-bearing nested data and error or tool-output text. Additional secret values must be selectable through explicit environment variable names in comma-separated `ATIF_REDACT_ENV_VARS`, rather than requiring environment-wide collection. Redaction must preserve nonsecret evidence such as token-count metrics.

## Evidence

The [recording guidance](relai://repo/AGENTS.md) specifies credential redaction and explicit additional secret names. The [serialization boundary](relai://repo/src/airline_support/trajectory.py) applies structured and textual redaction. [Trajectory tests](relai://repo/tests/test_trajectory.py) check nested credential fields, serialized data, declared secret values, error messages, and preservation of token metrics.
