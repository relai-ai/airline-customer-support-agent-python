"""Run the real Python sample with traveler input passed as JSON data."""
import base64
import json
import subprocess
import sys

code = """import asyncio,json,sys
from airline_support.agent import stream_agent_response
from airline_support.sessions import ChatMessage
async def main():
    request=json.load(sys.stdin)
    messages=[ChatMessage(m['role'], m['content'], '') for m in request.get('history', []) if m['role'] in ('user','assistant')]
    messages.append(ChatMessage('user',request['user_input'],''))
    reply=''.join([part async for part in stream_agent_response(messages)])
    print(json.dumps({'assistant_message':reply}))
asyncio.run(main())
"""
try:
    request = json.loads(base64.b64decode(sys.argv[1], validate=True))
    result = subprocess.run(["uv", "run", "--no-sync", "python", "-c", code],
        cwd="/home/user/airline", input=json.dumps(request), text=True,
        capture_output=True, timeout=150)
    if result.returncode:
        raise RuntimeError("Agent failed")
    reply = json.loads(result.stdout.strip())
    if not isinstance(reply.get("assistant_message"), str):
        raise RuntimeError("No reply")
    print(json.dumps(reply))
except Exception:
    print("The airline agent could not respond. Check session model access and retry.", file=sys.stderr)
    sys.exit(1)
