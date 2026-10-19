"""One real sample-agent turn; trusted host retains each lane's history/state."""
import asyncio
import json
import sys


async def run(request):
    from airline_support import agent
    from airline_support.sessions import ChatMessage

    if request.get('bookings') is not None:
        agent.BOOKINGS.clear()
        agent.BOOKINGS.update(request['bookings'])
    messages = [ChatMessage(m['role'], m['content'], '') for m in request['history']]
    messages.append(ChatMessage('user', request['prompt'], ''))
    reply = ''.join([part async for part in agent.stream_agent_response(messages)])
    return {'reply': reply, 'bookings': agent.BOOKINGS}


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.read(131073))
        print(json.dumps(asyncio.run(run(request))))
    except Exception:
        print('Sample agent could not respond. Check session model access and retry.', file=sys.stderr)
        sys.exit(1)
