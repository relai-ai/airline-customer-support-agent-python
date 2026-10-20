"""Compatibility import for the archived, frozen payment test adapter.

The sample agent lives in src/airline_support/agent.py. This module contains no
agent implementation; shared state is mutated in place by the archived adapter.
"""
from airline_support.agent import (  # noqa: F401
    BOOKINGS, PAYMENTS, create_airline_agent, stream_agent_response,
)
