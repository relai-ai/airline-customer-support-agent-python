# Decline non-airline requests

The agent must not answer off-topic, non-airline questions. It must politely explain that it can only help with airline booking, baggage, seat, and flight-change questions.

## Evidence

[README](relai://repo/README.md) explicitly specifies the boundary. The current [agent prompt](relai://repo/src/airline_support/agent.py) describes airline support but does not explicitly instruct refusal. The named-log case in [CLI tests](relai://repo/tests/test_cli.py) uses a mocked refusal; it demonstrates logging, not successful live enforcement of this boundary.
