# Start fresh terminal logs

Each unnamed terminal run must create a distinct session log. Supplying a log name must start a fresh session at that named JSONL destination, overwriting its previous conversation rather than resuming it. Its trajectory must likewise start fresh, including when a trajectory override reuses a destination.

## Evidence

[README](relai://repo/README.md), [terminal session creation](relai://repo/src/airline_support/main.py), [CLI tests](relai://repo/tests/test_cli.py), and [fresh-session trajectory tests](relai://repo/tests/test_trajectory.py).
