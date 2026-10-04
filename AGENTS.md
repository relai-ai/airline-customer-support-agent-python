# SkyServe Airline Support

## Agent and execution

This repository has one conversational agent: **SkyServe Airline Support**.
`create_airline_agent` in `src/airline_support/agent.py` creates it, and
`stream_agent_response` is its shared execution entry point. The terminal
interfaces and alternative model providers all use this same agent.
`lookup_booking`, `baggage_policy`, and `change_seat` are its internal tools,
not separate agents.

Pass `ChatMessage` history ending in the new user message to
`stream_agent_response`. Replay earlier user/assistant messages on each turn
and consume the entire async iterator to collect the response. Use a fresh
process for each independent session because demo bookings use mutable globals.

## Trajectory recording

`src/airline_support/trajectory.py` always records local ATIF-v1.7 trajectories.
Terminal sessions save `logs/<session-id>.atif.json` alongside their JSONL logs.
Integrations can pass `trajectory_path` to `stream_agent_response` or override
the destination with `ATIF_TRAJECTORY_PATH`; reuse the existing recorder.
Direct calls without a path share a generated session path for the process.

The recorder preserves observed model and tool events across turns. Reuse one
trajectory path within a session and a fresh path for each independent session.
Do not recreate the recorder per turn or infer tool activity from final answers.
Writes are serialized and atomic; fully consume the stream before returning a
response. Preserve prior evidence and propagate the original runtime error or
cancellation. Recording failures must not change agent behavior.

Provider keys and credential fields are redacted. For additional secrets, list
specific environment variable names in comma-separated `ATIF_REDACT_ENV_VARS`.
Local recording works independently of hosted SDK tracing.

## Development

Keep instrumentation behavior-preserving. Keep credentials and generated
runtime files local. Do not use `start.sh` for validation: it prompts for
credentials, calls models, and may commit dependency changes. Do not commit
or push unless asked.

```sh
uv run pytest
bash -n start.sh
git diff --check
```