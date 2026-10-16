# Isolate independent demo sessions

Independent demo conversations must run in fresh processes because the booking fixtures use mutable process-global state. Each independent session must also use a fresh trajectory destination; turns within one session must share their destination.

## Evidence

The [execution and recording guidance](relai://repo/AGENTS.md) explicitly requires process and trajectory isolation. [Demo seat changes](relai://repo/src/airline_support/agent.py) mutate the global booking dictionary. [Session-bound trajectory behavior](relai://wiki/requirements/cumulative-local-trajectories.md) defines the within-session counterpart.
