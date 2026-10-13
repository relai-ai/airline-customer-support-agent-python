#!/usr/bin/env bash
set -euo pipefail
uv run --frozen python -c 'from airline_support.agent import stream_agent_response; from airline_support.trajectory import TrajectoryHooks'
uv run --frozen pytest
