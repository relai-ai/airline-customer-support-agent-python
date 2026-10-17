"""Task-owned read-only oracle leaf; no tool, prompt, or booking replacement."""
import asyncio
import contextlib
import copy
import json
import os
from pathlib import Path
import sys
import uuid

sys.path.insert(0, '/workspace/src')
os.chdir('/workspace')
with contextlib.redirect_stdout(sys.stderr):
    from airline_support.agent import BOOKINGS, stream_agent_response
    from airline_support.sessions import ChatMessage
    from airline_support.trajectory import get_recorder

async def main():
    protocol = sys.stdout
    path = Path(os.environ['RELAI_ATIF_TRAJECTORY_PATH']).resolve()
    if path.exists():
        raise RuntimeError('Independent session requires a fresh native trajectory destination')
    session = str(uuid.uuid4())
    history = []
    rows = []
    previous = []
    recorder = None
    for line in sys.stdin:
        req = json.loads(line)
        if req['history'] != history or req['turn_index'] != len(rows):
            raise RuntimeError('Launcher history/index mismatch')
        current = history + [{'role': 'user', 'content': req['user_input']}]
        messages = [ChatMessage(m['role'], m['content'], '') for m in current]
        before = copy.deepcopy(BOOKINGS)
        with contextlib.redirect_stdout(sys.stderr):
            stream = stream_agent_response(messages)
            try:
                answer = ''.join([chunk async for chunk in stream])
            finally:
                await stream.aclose()
        after = copy.deepcopy(BOOKINGS)
        document = json.loads(path.read_text())
        steps = document['steps']
        if steps[:len(previous)] != previous:
            raise RuntimeError('Native recorder lost cumulative evidence')
        row = {'turn': len(rows) + 1, 'pid': os.getpid(), 'session': session,
               'destination': str(path), 'entrypoint': 'airline_support.agent.stream_agent_response',
               'history': current, 'assistant': answer, 'fully_consumed': True,
               'before': before, 'after': after, 'start': len(previous), 'end': len(steps)}
        rows.append(row)
        # Add evidence via the existing recorder's synchronized metadata boundary.
        # No user, agent or tool event is manufactured; all steps remain native.
        recorder = get_recorder()
        def attach():
            recorder.document.setdefault('extra', {})['challenge_session'] = {
                'session': session, 'pid': os.getpid(), 'fresh_destination': True,
                'fresh_process': True, 'rows': copy.deepcopy(rows)}
        recorder.record(attach)
        previous = copy.deepcopy(steps)
        history = current + [{'role': 'assistant', 'content': answer}]
        protocol.write(json.dumps({'assistant_message': answer}) + '\n')
        protocol.flush()

if __name__ == '__main__':
    asyncio.run(main())
