"""Separate, network-free verification of observed booking tool evidence."""
import json
from pathlib import Path


def evaluate():
    trajectory = json.loads(Path('/logs/agent/trajectory.json').read_text())
    assert trajectory['schema_version'] == 'ATIF-v1.7'
    assert trajectory['agent']['name'] and trajectory['agent']['version']
    steps = trajectory['steps']
    assert [s['step_id'] for s in steps] == list(range(1, len(steps) + 1))
    users = 0
    responses = 0
    found = set()
    complete = True
    for step in steps:
        if step['source'] == 'user':
            users += 1
        if step['source'] == 'agent':
            assert users, 'Agent step without preceding user input'
            if not step.get('tool_calls') and step['message'].strip():
                responses += 1
        for call in step.get('tool_calls', []):
            results = [r for r in step.get('observation', {}).get('results', [])
                       if r['source_call_id'] == call['tool_call_id']]
            complete = complete and bool(results)
            args = call['arguments']
            text = '\n'.join(r['content'] for r in results)
            if (call['function_name'] == 'lookup_booking'
                    and args.get('confirmation_code') == 'SKY123'
                    and 'Maya Chen' in text and '12A' in text):
                found.add('lookup_booking')
            if (call['function_name'] == 'change_seat'
                    and args.get('confirmation_code') == 'SKY123'
                    and args.get('requested_seat') == '16A'
                    and 'Seat updated to 16A' in text):
                found.add('change_seat')
    return (users >= 2 and responses >= 2 and complete
            and found == {'lookup_booking', 'change_seat'})


if __name__ == '__main__':
    output = Path('/logs/verifier')
    output.mkdir(parents=True, exist_ok=True)
    try:
        passed = evaluate()
    except Exception:
        (output / 'reward.txt').write_text('0\n')
        raise
    else:
        (output / 'reward.txt').write_text('1\n' if passed else '0\n')
