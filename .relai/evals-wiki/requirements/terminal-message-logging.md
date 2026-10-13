# Persist terminal messages

Terminal conversations must persist user and assistant messages in order in a JSONL session log. Each accepted user message is appended before model execution, and each nonempty completed assistant answer is saved after streamed chunks are assembled. Subsequent turns must replay the saved conversation.

Logs default to `logs/`; `AIRLINE_SUPPORT_LOG_DIR` changes the directory. The terminal must display the session and log destination and report the saved log path when the conversation ends.

## Evidence

[README](relai://repo/README.md), [terminal implementation](relai://repo/src/airline_support/main.py), [session storage](relai://repo/src/airline_support/sessions.py), [CLI tests](relai://repo/tests/test_cli.py), and [session tests](relai://repo/tests/test_sessions.py).
