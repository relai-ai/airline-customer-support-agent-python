# Select a supported provider

The runtime must choose OpenAI whenever a nonempty `OPENAI_API_KEY` is available, including when both supported provider keys are set. Without it, a nonempty `ANTHROPIC_API_KEY` selects the Anthropic model through LiteLLM. Without either key, startup must fail with guidance to set one of the supported variables.

The current Anthropic default is `litellm/anthropic/claude-sonnet-5`; OpenAI uses the SDK model default. Anthropic selection disables hosted SDK tracing, but must not disable local trajectory recording.

## Evidence

[README](relai://repo/README.md), [model selection](relai://repo/src/airline_support/models.py), [provider tests](relai://repo/tests/test_models.py), and [local tracing guidance](relai://repo/AGENTS.md).
