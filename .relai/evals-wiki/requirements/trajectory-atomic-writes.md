# Write trajectories atomically

Trajectory mutations and writes must be serialized so overlapping updates remain cumulative and cannot corrupt the document. Persist each snapshot atomically using a temporary file in the destination directory and replacement of the destination. Clean up temporary files after write attempts.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md), [locked atomic writer](relai://repo/src/airline_support/trajectory.py), and [overlapping-write and write-failure tests](relai://repo/tests/test_trajectory.py).
