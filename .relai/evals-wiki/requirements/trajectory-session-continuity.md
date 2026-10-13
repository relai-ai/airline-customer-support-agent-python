# Preserve cumulative session evidence

The recorder must preserve observed evidence across turns in one session. Reuse one path and cumulative recorder within that session rather than rebuilding the recorder each turn. Replayed conversation history is context, not new evidence: only the newly supplied final user message becomes a new user step.

Steps must retain their prior order and content as new evidence is appended, with sequential step IDs. New independent sessions must start with fresh evidence.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [agent boundary](relai://repo/src/airline_support/agent.py), [recorder](relai://repo/src/airline_support/trajectory.py), and [multi-turn/fresh-session tests](relai://repo/tests/test_trajectory.py).
