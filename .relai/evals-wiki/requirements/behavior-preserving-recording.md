# Behavior-preserving recording and error propagation

Instrumentation and recording failures must not change the agent's response behavior. Runtime failures and cancellation must preserve earlier trajectory evidence and propagate the original error or cancellation; cleanup must not replace it. Recorder failure diagnostics must not expose unfiltered runtime error details.

## Evidence

Explicit [instrumentation and recording guidance](relai://repo/AGENTS.md). The [stream execution boundary](relai://repo/src/airline_support/agent.py) records failures and re-raises after cleanup. The [recorder](relai://repo/src/airline_support/trajectory.py) emits fixed diagnostics on recording failures. [Trajectory tests](relai://repo/tests/test_trajectory.py) exercise model failures, unhandled tool failures, cancellation, and filesystem write failures with fake models.
