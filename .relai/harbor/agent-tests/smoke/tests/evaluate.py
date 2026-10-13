#!/usr/bin/env python3
"""Separate verifier: only task-owned criteria and exported ATIF, no project mount."""
import json
from pathlib import Path


def evaluate():
    trajectory = json.loads(Path('/logs/agent/trajectory.json').read_text())
    assert trajectory['schema_version'] == 'ATIF-v1.7'
    assert trajectory['agent']['name'] and trajectory['agent']['version']
    steps = trajectory['steps']
    assert [s['step_id'] for s in steps] == list(range(1, len(steps) + 1))
    assert len([s for s in steps if s['source'] == 'user']) >= 2
    assert all(s.get('message') for s in steps if s['source'] == 'agent')
    required = [
        ('lookup_booking', {'confirmation_code': 'SKY123'}, 'Seat 12A'),
        ('change_seat', {'confirmation_code': 'SKY123', 'requested_seat': '14C'}, 'Seat updated to 14C'),
    ]
    observed = []
    for step in steps:
        for call in step.get('tool_calls', []):
            results = [r for r in step.get('observation', {}).get('results', [])
                       if r['source_call_id'] == call['tool_call_id']]
            assert results, 'Tool call lacks same-step matched observation'
            observed.append((call, results))
    for name, arguments, fragment in required:
        assert any(call['function_name'] == name
                   and all(call['arguments'].get(k) == v for k, v in arguments.items())
                   and any(fragment in str(r['content']) for r in results)
                   for call, results in observed), 'Required booking tool evidence absent'
    # Each user turn must have a real model message, not just a tool invocation.
    groups = []
    for step in steps:
        if step['source'] == 'user':
            groups.append([])
        elif step['source'] == 'agent' and groups:
            groups[-1].append(step)
    assert all(any(not s.get('tool_calls') and s['message'].strip() for s in g) for g in groups)


if __name__ == '__main__':
    output = Path('/logs/verifier')
    output.mkdir(parents=True, exist_ok=True)
    reward = 0
    try:
        evaluate()
        reward = 1
    finally:
        (output / 'reward.txt').write_text(str(reward))
