# Airline-only assistance

The agent must not answer off-topic, non-airline questions. It must politely explain that it can only help with airline booking, baggage, seat, and flight-change questions.

## Evidence

Explicit behavioral direction in the [README](relai://repo/README.md). The named-log case in [CLI tests](relai://repo/tests/test_cli.py) uses a scripted refusal to test persistence, not the real model's ability to enforce this boundary.
