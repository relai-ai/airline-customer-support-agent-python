# Record observed events faithfully

Trajectories must preserve observed model and tool events across turns. Do not infer tool activity from final answer text. Record the new user input once rather than duplicating replayed history. Preserve actual tool calls, arguments, and observed results with their call associations; malformed observed arguments must not be replaced with fabricated valid arguments.

## Evidence

The [recording guidance](relai://repo/AGENTS.md) requires observed-event preservation. [Trajectory hooks](relai://repo/src/airline_support/trajectory.py) observe model outputs before tool dispatch and attach results by call ID. [Trajectory tests](relai://repo/tests/test_trajectory.py) check replay handling, malformed calls, tool error feedback, parallel calls, and call IDs reused on later turns. These tests use synthetic model outputs and establish recorder behavior, not airline reasoning quality.
