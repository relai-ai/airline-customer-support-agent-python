# Keep recording behavior-preserving

Instrumentation and recorder failures must not change the agent's response or execution behavior. Recorder initialization or persistence failures should emit a generic diagnostic rather than expose potentially sensitive exception text. Local recording remains best-effort when recording itself fails.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [recorder failure handling](relai://repo/src/airline_support/trajectory.py), and [response-preservation/write-failure test](relai://repo/tests/test_trajectory.py).
