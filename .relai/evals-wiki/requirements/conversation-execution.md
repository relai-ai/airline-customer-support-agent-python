# Replay history through the shared streaming entry point

Integrations must call `stream_agent_response` with `ChatMessage` history ending in the new user message. Earlier user and assistant messages must be replayed each turn. Consumers must fully exhaust the async iterator before returning the collected response.

The shared execution path must remain streaming; terminal and alternative-provider execution should use the same agent rather than separate conversational agents.

## Evidence

[Integration guidance](relai://repo/AGENTS.md), [shared agent entry point](relai://repo/src/airline_support/agent.py), [terminal caller](relai://repo/src/airline_support/main.py), and [real-SDK fake-model tests](relai://repo/tests/test_trajectory.py).
