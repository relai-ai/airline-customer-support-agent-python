"""One real sample-agent turn; trusted host retains each lane's history/state."""
import asyncio
import json
import sys


async def run(request):
    from airline_support import agent, live_challenges
    from airline_support.sessions import ChatMessage

    if request.get('bookings') is not None:
        agent.BOOKINGS.clear()
        agent.BOOKINGS.update(request['bookings'])
    if hasattr(agent, 'PAYMENTS') and request.get('payments') is not None:
        agent.PAYMENTS[:] = request['payments']
    challenge_state = request.get('challenges') or {}
    for name in ['CANCELLATIONS', 'REFUNDS', 'REFUND_ATTEMPTS', 'REFUND_FAILURES']:
        if name in challenge_state:
            target = getattr(live_challenges, name)
            target.clear()
            if isinstance(target, dict):
                target.update(challenge_state[name])
            else:
                target.extend(challenge_state[name])
    messages = [ChatMessage(m['role'], m['content'], '') for m in request['history']]
    messages.append(ChatMessage('user', request['prompt'], ''))
    reply = ''.join([part async for part in agent.stream_agent_response(messages)])
    return {'reply': reply, 'bookings': agent.BOOKINGS, 'payments': getattr(agent, 'PAYMENTS', []),
            'challenges': {name: getattr(live_challenges, name) for name in
                           ['CANCELLATIONS', 'REFUNDS', 'REFUND_ATTEMPTS', 'REFUND_FAILURES']}}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read(131073))
        print(json.dumps(asyncio.run(run(request))))
    except Exception:
        print('Sample agent could not respond. Check session model access and retry.', file=sys.stderr)
        sys.exit(1)
