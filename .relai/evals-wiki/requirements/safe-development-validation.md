# Validate without launching live chat

Do not use `start.sh` for development validation: it can prompt for credentials, call live models, and commit dependency changes. The documented checks are `uv run pytest`, `bash -n start.sh`, and `git diff --check`; use syntax checking rather than executing the launcher for shell validation.

## Evidence

[AGENTS.md](relai://repo/AGENTS.md) explicitly states this safeguard. [start.sh](relai://repo/start.sh) installs dependencies, prompts for keys when needed, attempts dependency commits, and starts the live terminal agent. [Project configuration](relai://repo/pyproject.toml) defines the pytest setup and console entry point.
