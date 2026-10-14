"""Export an exact public response from native Codex exec JSONL; no model calls."""
import argparse, hashlib, json
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('--events', type=Path, required=True)
parser.add_argument('--reply', type=Path, required=True)
parser.add_argument('--prompt', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
events = [json.loads(line) for line in args.events.read_text().splitlines() if line.strip()]
thread = next((e.get('thread_id') for e in events if e.get('type') == 'thread.started'), None)
messages = [e['item']['text'] for e in events if e.get('type') == 'item.completed' and e.get('item', {}).get('type') == 'agent_message']
turns = [e for e in events if e.get('type') in ('turn.completed', 'turn.failed')]
if not thread or not turns or turns[-1].get('type') != 'turn.completed' or not messages:
    raise SystemExit('A completed native Codex turn is required')
response = args.reply.read_text()
if messages[-1].rstrip('\n') != response.rstrip('\n'):
    raise SystemExit('Final reply does not match the native Codex event')
record = {'schemaVersion': 1, 'engine': 'codex-cli', 'threadId': thread,
          'prompt': args.prompt, 'response': response,
          'responseSha256': hashlib.sha256(response.encode()).hexdigest(),
          'eventsSha256': hashlib.sha256(args.events.read_bytes()).hexdigest()}
args.output.write_text(json.dumps(record, indent=2) + '\n')
print('Exact Codex response exported; private reasoning and raw commands omitted.')
