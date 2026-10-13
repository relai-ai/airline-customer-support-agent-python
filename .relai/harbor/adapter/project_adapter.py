"""Persistent NDJSON leaf: replay native history, retaining process-local bookings."""
import asyncio
import contextlib
import json
import os
import sys


async def main():
    os.chdir('/workspace')
    sys.path.insert(0, '/workspace/src')
    # Stdout belongs exclusively to the framed response stream, including imports.
    protocol = sys.stdout
    with contextlib.redirect_stdout(sys.stderr):
        from airline_support.agent import stream_agent_response
        from airline_support.sessions import ChatMessage

    for line in sys.stdin:
        request = json.loads(line)
        messages = [ChatMessage(item['role'], item['content'], '')
                    for item in request['history'] if item['role'] in ('user', 'assistant')]
        messages.append(ChatMessage('user', request['user_input'], ''))
        with contextlib.redirect_stdout(sys.stderr):
            # Fully draining the iterator also completes every synchronous locked ATIF
            # write. There are no detached recorder tasks to outlive a response/error.
            response = ''.join([part async for part in stream_agent_response(messages)])
        protocol.write(json.dumps({'assistant_message': response}, ensure_ascii=False) + '\n')
        protocol.flush()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except BaseException:
        # Original execution has already retained partial evidence; never print
        # unfiltered exception details or turn an error into a successful response.
        print('SkyServe adapter stopped before completing its request stream.', file=sys.stderr)
        sys.exit(1)
