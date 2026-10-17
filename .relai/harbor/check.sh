#!/usr/bin/env bash
set -euo pipefail
uv run --frozen python -c 'import airline_support.agent; import agents; from importlib.metadata import version; print("openai-agents", version("openai-agents"))'
uv run --frozen pytest -q
