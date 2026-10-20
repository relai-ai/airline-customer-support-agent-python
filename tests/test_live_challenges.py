"""Tool-state contracts for later conversational RELAI evaluations; no model calls."""
import copy
import json
import pytest
from agents.tool_context import ToolContext
from airline_support import agent, live_challenges as demo

@pytest.fixture(autouse=True)
def reset():
    before = copy.deepcopy(agent.BOOKINGS)
    demo.SEEN_BOOKINGS.clear()
    demo.REFUND_CONTEXT.clear()
    demo.CANCELLATIONS.clear()
    demo.REFUNDS.clear()
    demo.REFUND_ATTEMPTS.clear()
    demo.REFUND_FAILURES.clear()
    demo.REFUND_FAILURES.update(BAY777=1)
    yield
    agent.BOOKINGS.clear()
    agent.BOOKINGS.update(before)
    demo.SEEN_BOOKINGS.clear()
    demo.REFUND_CONTEXT.clear()
    demo.CANCELLATIONS.clear()
    demo.REFUNDS.clear()
    demo.REFUND_ATTEMPTS.clear()
    demo.REFUND_FAILURES.clear()
    demo.REFUND_FAILURES.update(BAY777=1)

async def call(name, code):
    tool = next(t for t in demo.challenge_tools(agent.BOOKINGS) if t.name == name)
    return json.loads(await tool.on_invoke_tool(ToolContext(context=None, tool_name=name, tool_call_id='offline-test', tool_arguments=json.dumps({'confirmation_code': code})), json.dumps({'confirmation_code': code})))

@pytest.mark.asyncio
async def test_cancellation_is_targeted_and_idempotent():
    other = copy.deepcopy(agent.BOOKINGS['BAY777'])
    receipt = (await call('cancel_booking', ' sky123 '))['receipt']
    assert agent.BOOKINGS['SKY123']['status'] == 'cancelled'
    assert agent.BOOKINGS['BAY777'] == other
    assert (await call('cancel_booking', 'SKY123'))['receipt'] == receipt
    assert len(demo.CANCELLATIONS) == 1

@pytest.mark.asyncio
async def test_refund_failure_retry_and_read_only_status_are_observable():
    before = copy.deepcopy(agent.BOOKINGS)
    assert demo._refund_service(agent.BOOKINGS, 'BAY777')['refunded'] is False
    assert demo.REFUNDS == []
    assert (await call('refund_status', 'BAY777'))['refunded'] is False
    assert len(demo.REFUND_ATTEMPTS) == 1
    result = await call('issue_refund', 'BAY777')
    assert result['receipt']['amount_cents'] == 18000
    assert (await call('issue_refund', 'BAY777'))['already_refunded'] is True
    assert len(demo.REFUNDS) == 1
    assert len(demo.REFUND_ATTEMPTS) == 2
    assert agent.BOOKINGS == before

@pytest.mark.asyncio
async def test_wrong_booking_refund_can_be_detected_from_native_receipt():
    result = await call('issue_refund', 'SKY123')
    assert result['receipt']['booking'] == 'SKY123'
    assert result['receipt']['amount_cents'] == 32000
    assert (await call('refund_status', 'BAY777'))['receipt'] is None

@pytest.mark.asyncio
async def test_invalid_targets_never_mutate_state():
    before = copy.deepcopy(agent.BOOKINGS)
    for tool in ['cancel_booking', 'issue_refund', 'refund_status']:
        assert 'error' in await call(tool, 'UNKNOWN')
    assert agent.BOOKINGS == before
    assert not demo.CANCELLATIONS and not demo.REFUNDS and not demo.REFUND_ATTEMPTS

@pytest.mark.asyncio
async def test_factory_boots_inside_running_event_loop_without_mutating_state(monkeypatch):
    from airline_support.models import ModelSelection
    monkeypatch.setattr(agent, 'select_model', lambda: ModelSelection('openai', 'gpt-4.1'))
    before = copy.deepcopy(agent.BOOKINGS)
    runtime = agent.create_airline_agent()
    assert {'cancel_booking', 'issue_refund', 'refund_status'} <= {t.name for t in runtime.tools}
    assert runtime.instructions.startswith(agent.payment_agent.AIRLINE_AGENT_INSTRUCTIONS)
    assert agent.BOOKINGS == before
    assert not demo.CANCELLATIONS and not demo.REFUNDS and not demo.REFUND_ATTEMPTS
