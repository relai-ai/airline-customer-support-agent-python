#!/usr/bin/env python3
"""Six independent exact scores; invalid probes never establish leakage."""
import json
from pathlib import Path

ROOT = Path('/logs/agent')
OUT = Path('/logs/verifier')
IDS = ['snapshot-one-redaction', 'snapshot-two-redaction', 'cumulative-prefix',
       'user-steps-and-ids', 'history-and-exhaustion', 'session-isolation']
SENTINEL = 'opaque-demo-73915'
FIRST = ('What baggage is included with a standard ticket? Here is a synthetic diagnostic; '
         'it is not a real account credential.\n```json\n'
         '{"password":"opaque-demo-73915","ticket_type":"standard"}\n```\n'
         'Please help with the baggage allowance.')
SECOND = 'Thanks. What is the checked-bag weight limit for that standard ticket?'
MARKER = '[REDACTED]'
# Complete accepted forms: replace only value, whole password assignment,
# whole JSON object, or whole fenced diagnostic, retaining surrounding prose.
MASKED = {
    FIRST.replace(SENTINEL, MARKER),
    FIRST.replace('"password":"' + SENTINEL + '"', MARKER),
    FIRST.replace('{"password":"' + SENTINEL + '","ticket_type":"standard"}', MARKER),
    FIRST.replace('```json\n{"password":"' + SENTINEL + '","ticket_type":"standard"}\n```', MARKER),
}
MASK_CONSTRAINTS = ('Accepted masking uses literal [REDACTED] replacing the password value, '
    'the complete "password":"opaque-demo-73915" assignment, the complete JSON object, '
    'or the complete fenced diagnostic; surrounding prose must be retained exactly '
    '(whitespace may differ). For value-only replacement, JSON spacing may differ. '
    'No literal opaque-demo-73915 may occur anywhere in the complete serialized or decoded snapshot.')
scores = {key: 0.0 for key in IDS}
feedback = {}

def norm(s):
    return ' '.join(s.split())

def users(doc):
    return [s for s in doc['steps'] if s.get('source') == 'user']

def masked(message):
    if not isinstance(message, str):
        return False
    if norm(message) in {norm(s) for s in MASKED}:
        return True
    # JSON formatting variation for the value-only masked form.
    start, diagnostic, end = message.partition('```json')
    if not diagnostic:
        return False
    body, fence, tail = end.partition('```')
    try:
        return bool(fence and norm(start) == norm(FIRST.split('```')[0]) and
                    norm(tail) == 'Please help with the baggage allowance.' and
                    json.loads(body) == {'password': MARKER, 'ticket_type': 'standard'})
    except (ValueError, TypeError):
        return False

def put(key, problems, passing):
    scores[key] = 0.0 if problems else 1.0
    feedback[key] = '; '.join(problems) if problems else passing

def run():
    trace = json.loads((ROOT / 'probe-trace.json').read_text())
    raw = [(ROOT / name).read_text() for name in ['snapshot-one.json', 'snapshot-two.json']]
    docs = [json.loads(s) for s in raw]
    turns, sdk = trace.get('turns', []), trace.get('sdk', [])
    if trace.get('error_type') or len(turns) != 2 or len(sdk) != 2:
        raise ValueError('Require two completed turns and two observed SDK calls without an execution error')
    for i, (doc, turn, call) in enumerate(zip(docs, turns, sdk)):
        if (doc.get('schema_version') != 'ATIF-v1.7' or not doc.get('steps') or
            not any(s.get('source') == 'agent' for s in doc['steps']) or
            doc.get('extra', {}).get('errors') or not turn.get('exhausted') or
            not call.get('completed_event') or not call.get('exhausted') or
            not call['completed_ns'] <= call['exhausted_ns'] <= turn['exhausted_ns'] < turn['captured_ns']):
            raise ValueError(f'Turn {i+1}: native snapshot or completion/exhaustion evidence invalid')
    isolation = []
    if not trace.get('fresh_exec') or not trace.get('initial_path_absent') or not trace.get('initial_recorders_empty'):
        isolation.append('Session setup did not demonstrate fresh exec, initially absent destination and empty recorder cache; require all three')
    allowed = {'PATH', 'HOME', 'LANG', 'OPENAI_AGENTS_DISABLE_TRACING', 'RELAI_ATIF_TRAJECTORY_PATH', 'LC_CTYPE'}
    if set(trace.get('environment_names', [])) - allowed:
        isolation.append('Worker environment has undeclared variables; require the documented credential-free minimal environment only')
    for i, t in enumerate(turns):
        if t.get('pid') != trace.get('pid') or t.get('path') != trace.get('path') or t.get('effective_recorder_paths') != [trace.get('path')]:
            isolation.append(f'Turn {i+1}: PID or effective native recorder destination differs; require both turns to share the fresh process and single resolved destination')
    put('session-isolation', isolation, 'Fresh exec, absent path and empty cache observed; both turns share PID and effective native destination in a minimal credential-free environment.')
    if isolation:
        raise ValueError('Isolation preconditions invalid: ' + '; '.join(isolation))

    protocol = []
    expected = [[{'role': 'user', 'content': FIRST}],
                [{'role': 'user', 'content': FIRST},
                 {'role': 'assistant', 'content': turns[0].get('response')},
                 {'role': 'user', 'content': SECOND}]]
    for i, (t, c, exp) in enumerate(zip(turns, sdk, expected)):
        if t.get('history') != exp:
            protocol.append(f'Turn {i+1}: supplied history mismatches accepted actual-history replay; require first input then actual collected assistant response then the new user input')
        if t.get('chatmessage_types') != ['ChatMessage'] * len(exp):
            protocol.append(f'Turn {i+1}: require every entry to be a native ChatMessage')
        if c.get('input') != exp:
            protocol.append(f'Turn {i+1}: observed SDK model input differs from actual replay history; require the full ordered role/content list')
        if not t.get('response') or t['response'] != ''.join(t.get('deltas', [])):
            protocol.append(f'Turn {i+1}: collected response is empty or differs from observed deltas; require their nonempty exact concatenation')
        if c.get('index') != i or t.get('snapshot') != ['snapshot-one.json', 'snapshot-two.json'][i]:
            protocol.append(f'Turn {i+1}: SDK/capture order differs; require zero-based call index and corresponding immutable native snapshot')
    if turns[1]['started_ns'] <= turns[0]['captured_ns']:
        protocol.append('Turn 2 began before snapshot 1 capture; require first completed snapshot before next invocation')
    put('history-and-exhaustion', protocol, 'Both native ChatMessage invocations replay actual collected history; observed SDK inputs agree, completion events and model/target exhaustion precede immutable captures.')
    if protocol:
        # A miswired probe cannot substantiate a target redaction defect.
        for key in ['snapshot-one-redaction', 'snapshot-two-redaction']:
            feedback[key] = 'INVALID/INCONCLUSIVE, not evidence of leakage: repair all history-and-exhaustion conditions. ' + MASK_CONSTRAINTS
    else:
        for i, key in enumerate(IDS[:2]):
            problems = []
            if SENTINEL in raw[i] or SENTINEL in json.dumps(docs[i], ensure_ascii=False):
                locations = [f'steps[{j}].message' for j, s in enumerate(docs[i]['steps']) if SENTINEL in str(s.get('message', ''))]
                problems.append(f'Completed native snapshot {i+1} contains literal synthetic sentinel opaque-demo-73915 at {locations or "other serialized field"}; remove it throughout serialized evidence')
            us = users(docs[i])
            if not us or not masked(us[0].get('message')):
                problems.append(f'Snapshot {i+1} original user step lacks accepted masking with retained benign context. ' + MASK_CONSTRAINTS)
            put(key, problems, f'Completed native snapshot {i+1} contains no literal sentinel and original user message retains baggage prose with accepted [REDACTED] replacement.')

    a, b = [d['steps'] for d in docs]
    prefix = []
    if len(b) <= len(a):
        prefix.append(f'Snapshot 2 has {len(b)} steps versus {len(a)} in snapshot 1; require additional appended steps')
    if b[:len(a)] != a:
        mismatches = [i+1 for i, s in enumerate(a) if i >= len(b) or b[i] != s]
        prefix.append(f'Prior steps changed at IDs/positions {mismatches}; require exact full ordered prefix equality, not reconstructed history')
    put('cumulative-prefix', prefix, 'All original steps are the exact ordered prefix of snapshot 2 with new evidence appended.')
    unique = []
    u1, u2 = [users(d) for d in docs]
    if len(u1) != 1:
        unique.append(f'Snapshot 1 has {len(u1)} user steps; require exactly one')
    if len(u2) != 2:
        unique.append(f'Snapshot 2 has {len(u2)} user steps; require exactly two, one per new supplied turn')
    if not u1 or not u2 or u1[0].get('message') != u2[0].get('message'):
        unique.append('Original user message changed or is absent; require identical retained first user message')
    if not u1 or (u1[0].get('message') != FIRST and not masked(u1[0].get('message'))):
        unique.append('First user message does not match the supplied first input or accepted masked form; require the accepted first diagnostic context. ' + MASK_CONSTRAINTS)
    if len(u2) < 2 or u2[1].get('message') != SECOND or sum(s.get('message') == SECOND for s in u2) != 1:
        unique.append('Snapshot 2 follow-up missing, reordered or duplicated; require exactly one second user step with literal: ' + SECOND)
    for i, steps in enumerate([a, b]):
        if any(type(s.get('step_id')) is not int for s in steps) or [s.get('step_id') for s in steps] != list(range(1, len(steps)+1)):
            unique.append(f'Snapshot {i+1}: IDs not sequential integers; require exactly 1 through step count in array order')
    put('user-steps-and-ids', unique, 'Exactly one then two ordered user steps, unchanged original user and exact follow-up once; IDs are sequential integers starting at one.')

try:
    run()
except Exception as error:
    # Synthetic verifier trajectories lack probe attachments by design. Fail closed
    # with valid numeric rewards and feedback rather than throwing or asserting leak.
    reason = f'INVALID/INCONCLUSIVE probe ({type(error).__name__}): {error}. '
    for key in IDS:
        if key not in feedback:
            feedback[key] = reason + 'Require both native snapshots, two completed SDK streams, actual history/deltas, and fresh-process/path evidence before scoring. '
            if key in IDS[:2]:
                feedback[key] += MASK_CONSTRAINTS
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'reward.json').write_text(json.dumps(scores, allow_nan=False))
(OUT / 'relai_global_metrics.json').write_text(json.dumps({'feedback': feedback}, allow_nan=False))
