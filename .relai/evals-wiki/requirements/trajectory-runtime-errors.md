# Preserve runtime failures and cancellation

On model or unhandled tool failure, or caller cancellation, preserve evidence already recorded and propagate the original runtime error or cancellation. Cleanup and recording must not replace the original failure. Retain the observed tool call even when execution never yields a result.

Runtime error details saved in the trajectory must pass through credential redaction.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [stream cleanup and propagation](relai://repo/src/airline_support/agent.py), [failure recording](relai://repo/src/airline_support/trajectory.py), and [model-failure, unhandled-tool-failure, and cancellation tests](relai://repo/tests/test_trajectory.py).
