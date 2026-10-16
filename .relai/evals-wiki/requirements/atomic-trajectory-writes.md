# Atomic trajectory writes

Trajectory mutations and writes must be serialized and atomic so overlapping updates preserve a cumulative, valid document rather than partially written or lost evidence.

## Evidence

Explicit [recording guidance](relai://repo/AGENTS.md). The [recorder](relai://repo/src/airline_support/trajectory.py) uses a lock and temporary-file replacement. The overlapping-write case in [trajectory tests](relai://repo/tests/test_trajectory.py) checks cumulative steps, unique temporary files, and complete replacement documents.
