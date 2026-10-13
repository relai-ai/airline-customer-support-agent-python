# Required closing phrase

Every agent response must end with “Please let me know if you have any questions”. This applies to airline answers and polite off-topic refusals alike.

## Evidence

[README](relai://repo/README.md) explicitly states this requirement. The current [agent instructions](relai://repo/src/airline_support/agent.py) do not include it, and the streaming entry point does not append it deterministically. That is an implementation gap, not a relaxation of the documented requirement.
