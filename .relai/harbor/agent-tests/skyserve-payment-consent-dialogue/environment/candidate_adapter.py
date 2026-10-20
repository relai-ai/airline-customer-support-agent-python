"""Execute only the isolated candidate; preserve its native events and observe state."""
import asyncio
import contextlib
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys

os.chdir('/workspace')
sys.path.insert(0, '/workspace/src')
with contextlib.redirect_stdout(sys.stderr):
    from airline_support.sessions import ChatMessage
    from airline_support.trajectory import get_recorder
    spec = importlib.util.spec_from_file_location('paid_seat_candidate', '/workspace/demo/scenarios/unauthorized-payment/agent.py')
    candidate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(candidate)

initial = copy.deepcopy(candidate.BOOKINGS)

def reset():
    candidate.BOOKINGS.clear()
    candidate.BOOKINGS.update(copy.deepcopy(initial))
    candidate.PAYMENTS.clear()

def state():
    return copy.deepcopy({'bookings': candidate.BOOKINGS, 'payments': candidate.PAYMENTS})

async def main():
    protocol = sys.stdout
    history = []
    next_turn = 0
    reset()
    for line in sys.stdin:
        request = json.loads(line)
        index = request['turn_index']
        if index != next_turn or index >= 6:
            raise ValueError('Expected exactly six ordered scenario turns')
        if index == 3:
            reset()
            history = []
        before = state()
        history.append(ChatMessage('user', request['user_input'], ''))
        recorder = get_recorder()
        if recorder is None:
            raise RuntimeError('Native recorder unavailable')
        start = len(recorder.document['steps'])
        with contextlib.redirect_stdout(sys.stderr):
            stream = candidate.stream_agent_response(history)
            try:
                response = ''.join([chunk async for chunk in stream])
            finally:
                await stream.aclose()
        end = len(recorder.document['steps'])
        snapshot = {'turn_index': index, 'conversation': 'non-authorizing' if index < 3 else 'approved',
                    'reset_before_turn': index in (0, 3), 'before': before, 'after': state(),
                    'step_start': start, 'step_end': end, 'assistant_message': response}
        # Only observational metadata: no invented steps, messages or tool events.
        def observe():
            recorder.document.setdefault('extra', {}).setdefault('paid_seat_snapshots', []).append(snapshot)
        recorder.record(observe)
        history.append(ChatMessage('assistant', response, ''))
        protocol.write(json.dumps({'assistant_message': response}) + '\n')
        protocol.flush()
        next_turn += 1

if __name__ == '__main__':
    asyncio.run(main())
