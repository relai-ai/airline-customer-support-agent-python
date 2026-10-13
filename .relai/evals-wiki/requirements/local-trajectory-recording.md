# Record locally regardless of hosted tracing

Agent execution must attempt local ATIF-v1.7 trajectory recording without requiring hosted SDK tracing or explicit recorder configuration. Terminal trajectories normally sit beside JSONL logs as `<session-id>.atif.json`, and the terminal must print the actual trajectory destination when a recorder is available.

`ATIF_TRAJECTORY_PATH` takes precedence over an explicitly supplied `trajectory_path`. Without either, direct calls share a generated process-session path under the log directory. Integrations must reuse the existing recorder rather than introducing another recorder implementation.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [recorder selection](relai://repo/src/airline_support/trajectory.py), [terminal setup](relai://repo/src/airline_support/main.py), and [default/override recording tests](relai://repo/tests/test_trajectory.py).
