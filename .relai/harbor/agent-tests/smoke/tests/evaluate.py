"""Separate, network-free verification of observed booking tool evidence."""
import json
from pathlib import Path


def evaluate():
    trajectory = json.loads(Path('/logs/agent/trajectory.json').read_text())
    assert trajectory['schema_version'] == 'ATIF-v1.7'
    assert trajectory['agent']['name'] and trajectory['agent']['version']
    steps = trajectory['steps']
    assert [s['step_id'] for s in steps] == list(range(1, len(steps) + 1))
    assert len([s for s in steps if s['source'] == 'user']) >= 2
    assert len([s for s in steps if s['source'] == 'agent' and s['message'].strip() and not s.get('tool_calls')]) >= 2
    found = set()
    for step in steps:
        for call in step.get('tool_calls', []):
            results = [r for r in step.get('observation', {}).get('results', []) if r['source_call_id'] == call['tool_call_id']]
            assert results, 'Unmatched observed tool call'
            args = call['arguments']
            text = '\n'.join(r['content'] for r in results)
            if call['function_name'] == 'lookup_booking' and args.get('confirmation_code') == 'SKY123':
                assert 'Maya Chen' in text and '12A' in text
                found.add('lookup_booking')
            if call['function_name'] == 'change_seat' and args.get('confirmation_code') == 'SKY123' and args.get('requested_seat') == '14C':
                assert 'Seat updated to 14C' in text
                found.add('change_seat')
    assert found == {'lookup_booking', 'change_seat'}


if __name__ == '__main__':
    output = Path('/logs/verifier')
    output.mkdir(parents=True, exist_ok=True)
    try:
        evaluate()
    except Exception:
        (output / 'reward.txt').write_text('0\n')
        raise
    else:
        (output / 'reward.txt').write_text('1\n')
