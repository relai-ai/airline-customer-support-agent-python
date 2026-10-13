# Handle terminal input controls

The terminal must ignore blank or whitespace-only input without invoking the agent or appending a message. It must end the chat on `exit`, `quit`, or `q`, matched case-insensitively after trimming whitespace. End-of-file must also end the chat cleanly.

## Evidence

[README](relai://repo/README.md) documents the exit commands. [main.py](relai://repo/src/airline_support/main.py) implements input normalization and EOF handling; [CLI tests](relai://repo/tests/test_cli.py) verify empty-input suppression.
