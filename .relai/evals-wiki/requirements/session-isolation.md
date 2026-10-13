# Isolate independent demo sessions

Independent integration sessions must use fresh processes because demo bookings are mutable globals. They must also use separate trajectory paths so independent trials do not share evidence. Reuse a process-local default path only for turns belonging to the same session.

Starting a fresh terminal log alone does not reset global booking mutations.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md) explicitly requires process and path isolation. The mutable [BOOKINGS store](relai://repo/src/airline_support/agent.py) and [recorder cache](relai://repo/src/airline_support/trajectory.py) explain the distinction.
