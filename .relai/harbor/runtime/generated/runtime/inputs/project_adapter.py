"""Reusable Harbor leaf for the repository's native history-replay stream."""
import asyncio
import contextlib
import json
import os
import sys

os.chdir('/workspace')
sys.path.insert(0, '/workspace/src')

# Keep all project diagnostics away from the response protocol.
with contextlib.redirect_stdout(sys.stderr):
    from airline_support.agent import stream_agent_response
    from airline_support.sessions import ChatMessage


async def main():
    protocol = sys.stdout
    for line in sys.stdin:
        request = json.loads(line)
        messages = [
            ChatMessage(item['role'], item['content'], '')
            for item in request['history']
            if item['role'] in {'user', 'assistant'}
        ]
        messages.append(ChatMessage('user', request['user_input'], ''))
        # The original entrypoint owns the recorder. Its RLock-protected writes
        # are synchronous; exhausting/closing the stream leaves no pending writes.
        with contextlib.redirect_stdout(sys.stderr):
            stream = stream_agent_response(messages)
            try:
                response = ''.join([chunk async for chunk in stream])
            finally:
                await stream.aclose()
        protocol.write(json.dumps({'assistant_message': response}) + '\n')
        protocol.flush()


if __name__ == '__main__':
    asyncio.run(main())
