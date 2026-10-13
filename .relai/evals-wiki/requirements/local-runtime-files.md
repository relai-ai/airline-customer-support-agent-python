# Keep secrets and generated files local

Credentials and generated runtime files must remain local rather than be committed. In particular, keep `.env`, generated JSONL session logs, and ATIF trajectories ignored by Git.

This is a repository-locality requirement, not a claim that JSONL chat logs receive the trajectory recorder's credential redaction.

## Evidence

[Development guidance](relai://repo/AGENTS.md), [local-log documentation](relai://repo/README.md), and [ignore rules](relai://repo/.gitignore).
