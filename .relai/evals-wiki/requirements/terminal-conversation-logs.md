# Persist terminal conversations

Each terminal conversation must save user and assistant turns as a local JSONL log and print its log and trajectory paths. Ordinary unnamed runs must create distinct session logs. Reusing a named terminal session must overwrite that named session's prior logs rather than append a new independent conversation to them.

## Evidence

The [README](relai://repo/README.md) documents local logs and named-session overwrite semantics. The [terminal implementation](relai://repo/src/airline_support/main.py), [session storage](relai://repo/src/airline_support/sessions.py), [CLI tests](relai://repo/tests/test_cli.py), and [trajectory tests](relai://repo/tests/test_trajectory.py) provide deterministic implementation evidence.
