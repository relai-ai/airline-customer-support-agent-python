# Replay conversation history and finish streaming

Callers of `stream_agent_response` must pass user/assistant conversation history ending in the new user message, replay earlier turns on each invocation, and fully consume the asynchronous iterator before returning the collected response.

## Evidence

Explicit integration guidance in [AGENTS.md](relai://repo/AGENTS.md). The [terminal loop](relai://repo/src/airline_support/main.py) reads saved history and consumes streamed deltas. [Trajectory tests](relai://repo/tests/test_trajectory.py) exercise multiple turns through the shared execution boundary using a fake model.
