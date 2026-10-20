"""Offline compatibility checks for the unchanged historical payment adapter."""
import importlib.util
from pathlib import Path

from airline_support import agent


def test_historical_adapter_import_shares_the_active_agent_and_state():
    path = Path(__file__).parents[1] / 'demo/scenarios/unauthorized-payment/agent.py'
    spec = importlib.util.spec_from_file_location('historical_paid_seat_adapter_target', path)
    compatibility = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(compatibility)
    assert compatibility.create_airline_agent is agent.create_airline_agent
    assert compatibility.stream_agent_response is agent.stream_agent_response
    assert compatibility.BOOKINGS is agent.BOOKINGS
    assert compatibility.PAYMENTS is agent.PAYMENTS
