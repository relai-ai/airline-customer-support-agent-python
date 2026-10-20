"""Observe the actual composed agent, never replace policy, tools or native events."""
import asyncio
import contextlib
import copy
import json
import os
import sys

os.chdir('/workspace')
sys.path.insert(0, '/workspace/src')
with contextlib.redirect_stdout(sys.stderr):
    from airline_support import agent, live_challenges
    from airline_support.sessions import ChatMessage
    from airline_support.trajectory import get_recorder


def state():
    return copy.deepcopy({
        'BOOKINGS': agent.BOOKINGS,
        'PAYMENTS': agent.PAYMENTS,
        'CANCELLATIONS': live_challenges.CANCELLATIONS,
        'REFUNDS': live_challenges.REFUNDS,
        'REFUND_ATTEMPTS': live_challenges.REFUND_ATTEMPTS,
        'REFUND_FAILURES': live_challenges.REFUND_FAILURES,
    })


async def main():
    protocol = sys.stdout
    expected_history = []
    turn = 0
    recorder = get_recorder()
    if recorder is None:
        raise RuntimeError('Native recorder unavailable')
    if recorder.document['steps']:
        raise RuntimeError('A fresh trajectory is required')
    for line in sys.stdin:
        request = json.loads(line)
        history = [{'role': item['role'], 'content': item['content']}
                   for item in request['history'] if item['role'] in {'user', 'assistant'}]
        if history != expected_history:
            raise RuntimeError('Launcher history is not the full prior conversation')
        turn += 1
        sent = history + [{'role': 'user', 'content': request['user_input']}]
        messages = [ChatMessage(item['role'], item['content'], '') for item in sent]
        before = state()
        completed = False
        with contextlib.redirect_stdout(sys.stderr):
            stream = agent.stream_agent_response(messages)
            try:
                response = ''.join([chunk async for chunk in stream])
                completed = True
            finally:
                await stream.aclose()
        snapshot = {
            'turn': turn, 'user': request['user_input'], 'assistant': response,
            'history': sent, 'stream_completed': completed,
            'before': before, 'after': state(),
        }
        # Same native recorder and lock; append observations in extra only.
        # No synthetic user, assistant or tool steps are created here.
        recorder.record(lambda: recorder.document.setdefault('extra', {}).setdefault(
            'live_challenge_snapshots', []).append(snapshot))
        expected_history = sent + [{'role': 'assistant', 'content': response}]
        protocol.write(json.dumps({'assistant_message': response}) + '\n')
        protocol.flush()


if __name__ == '__main__':
    asyncio.run(main())
