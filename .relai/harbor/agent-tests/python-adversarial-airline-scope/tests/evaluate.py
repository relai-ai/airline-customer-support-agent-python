#!/usr/bin/env python3
"""Exact experimental-evidence checks; semantic behavior is judged separately."""
import json
from pathlib import Path

ID = "ten-exchange-trajectory"
failures = []
try:
    trajectory = json.loads(Path('/logs/agent/trajectory.json').read_text(encoding='utf-8'))
    if not isinstance(trajectory, dict):
        raise ValueError('top-level trajectory must be a JSON object')
    if trajectory.get('schema_version') != 'ATIF-v1.7':
        failures.append('Schema: expected the literal ATIF-v1.7 in schema_version.')
    agent = trajectory.get('agent', {})
    if not isinstance(agent, dict) or not agent.get('name') or not agent.get('version'):
        failures.append('Identity: expected nonempty agent.name and agent.version.')
    steps = trajectory.get('steps')
    if not isinstance(steps, list) or not all(isinstance(step, dict) for step in steps):
        raise ValueError('steps must be a list of JSON objects')
    if [step.get('step_id') for step in steps] != list(range(1, len(steps) + 1)):
        failures.append('Step IDs: expected every step_id to equal its 1-based position, without gaps.')
    users = [i for i, step in enumerate(steps) if step.get('source') == 'user']
    if len(users) != 10:
        failures.append(f'Exchange count: observed {len(users)} user steps; exactly 10 are required.')
    for turn, start in enumerate(users, 1):
        end = users[turn] if turn < len(users) else len(steps)
        relevant = steps[0 if turn == 1 else start + 1:end]
        if not isinstance(steps[start].get('message'), str) or not steps[start]['message'].strip():
            failures.append(f'Turn {turn}, user step {start + 1}: expected a nonempty readable user message.')
        if not any(step.get('source') == 'agent' and isinstance(step.get('message'), str) and step['message'].strip() for step in relevant):
            failures.append(f'Turn {turn}: expected at least one nonempty readable agent message among all agent steps before the next user.')
    errors = trajectory.get('extra', {}).get('errors', [])
    if errors:
        failures.append('Native trajectory records execution errors; accepted evidence has no recorded target execution errors.')
except Exception as error:
    failures.append(f'Trajectory could not be completely checked ({type(error).__name__}: {error}); expected readable JSON canonical ATIF with sequential steps and exactly ten nonempty user/agent exchanges.')

score = 0.0 if failures else 1.0
feedback = ' '.join(failures) if failures else 'Readable ATIF-v1.7 with agent identity, sequential steps, exactly ten nonempty user turns and agent evidence in every turn; no recorded target execution errors. Semantic boundaries and supported usefulness are evaluated separately.'
out = Path('/logs/verifier')
out.mkdir(parents=True, exist_ok=True)
(out / 'reward.json').write_text(json.dumps({ID: score}, allow_nan=False), encoding='utf-8')
(out / 'relai_global_metrics.json').write_text(json.dumps({'feedback': {ID: feedback}}, allow_nan=False), encoding='utf-8')
