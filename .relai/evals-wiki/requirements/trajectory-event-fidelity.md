# Capture observed model and tool activity

Trajectory evidence must come from observed SDK model and tool events, not inferred activity in final answers. Record actual model output, including tool-only responses, and preserve tool-call IDs, names, and valid arguments before tool dispatch. Attach observed tool results to the originating call, including parallel calls and IDs reused in subsequent turns.

Preserve malformed call output without fabricating valid arguments. Record tool error feedback only as actually observed; an unhandled failure must not be represented as a successful tool result.

Record observed token usage when available. Do not invent missing usage; cumulative token totals should only be reported when all recorded agent steps have metrics.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [TrajectoryHooks and metrics](relai://repo/src/airline_support/trajectory.py), and [SDK boundary, malformed-call, parallel-call, and error-feedback tests](relai://repo/tests/test_trajectory.py).
