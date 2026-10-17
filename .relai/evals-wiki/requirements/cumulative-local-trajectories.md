# Cumulative local trajectories

Agent execution must record local ATIF-v1.7 trajectories independently of hosted SDK tracing. Terminal sessions must save `logs/<session-id>.atif.json` alongside their JSONL logs unless a destination override applies. Integrations may supply `trajectory_path` or use `ATIF_TRAJECTORY_PATH`; direct calls without an explicit destination must share a generated process-session path.

Reuse the existing recorder and one cumulative trajectory path across turns. Do not recreate the recorder for each turn or overwrite earlier evidence within a session. Start a fresh recording for a new terminal conversation, including when reusing a named log.

## Evidence

Explicit [recording guidance](relai://repo/AGENTS.md), [recorder implementation](relai://repo/src/airline_support/trajectory.py), and [trajectory tests](relai://repo/tests/test_trajectory.py).

The implementation additionally prioritizes `RELAI_ATIF_TRAJECTORY_PATH` over the local override, as checked by [RELAI path tests](relai://repo/tests/test_relai_trajectory.py).
