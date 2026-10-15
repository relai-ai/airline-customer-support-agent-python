"""Offline persistent leaf: inject only SDK model selection, never recording."""
import asyncio
import contextlib
import copy
import json
import os
from pathlib import Path
import sys
import time

# Do not read credential values or inherited config. Retain only the explicit
# launcher-selected destination, then replace the entire environment before imports.
if sys.argv[1:] != ['--clean']:
    destination = os.environ['RELAI_ATIF_TRAJECTORY_PATH']
    os.execve(sys.executable, [sys.executable, str(Path(__file__).resolve()), '--clean'], {
        'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/tmp/skyserve-offline',
        'LANG': 'C.UTF-8', 'OPENAI_AGENTS_DISABLE_TRACING': '1',
        'RELAI_ATIF_TRAJECTORY_PATH': destination,
    })

Path('/tmp/skyserve-offline').mkdir(exist_ok=True)
sys.path.insert(0, '/workspace/src')
os.chdir('/workspace')

# Fail closed on accidental network, without replacing any project boundary.
def deny_network(event, args):
    if event in {'socket.connect', 'socket.getaddrinfo', 'socket.sendto'}:
        raise RuntimeError('Offline probe forbids network access')
sys.addaudithook(deny_network)

with contextlib.redirect_stdout(sys.stderr):
    from agents import Model, set_tracing_disabled
    from openai.types.responses import (Response, ResponseCompletedEvent,
        ResponseOutputMessage, ResponseOutputText, ResponseTextDeltaEvent)
    from openai.types.responses.response_usage import ResponseUsage
    from airline_support import agent as sample, trajectory
    from airline_support.models import ModelSelection
    from airline_support.sessions import ChatMessage

set_tracing_disabled(True)
native = Path(os.environ['RELAI_ATIF_TRAJECTORY_PATH']).resolve()
trace_path = native.parent / 'probe-trace.json'
trace = {'pid': os.getpid(), 'fresh_exec': True, 'path': str(native),
         'initial_path_absent': not native.exists(),
         'initial_recorders_empty': not trajectory._recorders,
         'environment_names': sorted(os.environ), 'turns': [], 'sdk': []}

def save_trace():
    trace_path.write_text(json.dumps(trace, ensure_ascii=False), encoding='utf-8')

class ScriptedModel(Model):
    def __init__(self, responses):
        self.responses = list(responses)
        self.index = 0

    async def get_response(self, *args, **kwargs):
        raise AssertionError('Non-streaming model access is forbidden')

    async def stream_response(self, *args, **kwargs):
        index = self.index
        self.index += 1
        observed_input = kwargs['input'] if 'input' in kwargs else args[1]
        observation = {'index': index, 'input': copy.deepcopy(observed_input),
                       'started_ns': time.monotonic_ns(), 'completed_event': False,
                       'exhausted': False}
        trace['sdk'].append(observation)
        text = self.responses[index]  # An unexpected extra model call fails closed.
        output = [ResponseOutputMessage(id=f'message-{index}', type='message',
            role='assistant', status='completed', content=[ResponseOutputText(
                type='output_text', text=text, annotations=[])])]
        yield ResponseTextDeltaEvent(type='response.output_text.delta',
            item_id=output[0].id, output_index=0, content_index=0,
            delta=text, sequence_number=0, logprobs=[])
        response = Response.model_construct(id=f'response-{index}', created_at=0,
            object='response', model='offline-scripted-fixture', output=output,
            status='completed', usage=ResponseUsage(input_tokens=10, output_tokens=5,
            total_tokens=15, input_tokens_details={'cached_tokens': 0},
            output_tokens_details={'reasoning_tokens': 0}))
        observation['completed_event'] = True
        observation['completed_ns'] = time.monotonic_ns()
        yield ResponseCompletedEvent(type='response.completed', response=response,
                                     sequence_number=1)
        observation['exhausted'] = True
        observation['exhausted_ns'] = time.monotonic_ns()

async def main():
    model = None
    expected_history = []
    for line in sys.stdin:
        request = json.loads(line)
        index = len(trace['turns'])
        if index > 1 or request['turn_index'] != index:
            raise ValueError('Exactly two ordered probe turns required')
        if request['history'] != expected_history:
            raise ValueError('Launcher history does not replay the collected response')
        fixture = request['task']['mocks']['sdk_model']
        if model is None:
            if not trace['initial_path_absent'] or not trace['initial_recorders_empty']:
                raise ValueError('Session was not isolated')
            if len(fixture['responses']) != 2:
                raise ValueError('Exactly two SDK fixture outputs required')
            model = ScriptedModel(fixture['responses'])
            # Only the model dependency changes. The original factory, Runner,
            # stream function, hooks, recorder, redactor and writes remain active.
            sample.select_model = lambda: ModelSelection(provider='offline-fixture', model=model)
        messages = [ChatMessage(m['role'], m['content'], '') for m in request['history']]
        messages.append(ChatMessage('user', request['user_input'], ''))
        entry = {'pid': os.getpid(), 'path': str(native),
                 'history': [{'role': m.role, 'content': m.content} for m in messages],
                 'chatmessage_types': [type(m).__name__ for m in messages],
                 'started_ns': time.monotonic_ns(), 'exhausted': False, 'deltas': []}
        trace['turns'].append(entry)
        save_trace()
        with contextlib.redirect_stdout(sys.stderr):
            async for delta in sample.stream_agent_response(messages, trajectory_path=native):
                entry['deltas'].append(delta)
        entry['exhausted'] = True
        entry['exhausted_ns'] = time.monotonic_ns()
        response = ''.join(entry['deltas'])
        entry['response'] = response
        entry['effective_recorder_paths'] = [str(p) for p in trajectory._recorders]
        # Copy actual bytes only, exclusively create and never rewrite snapshots.
        snapshot = native.parent / ('snapshot-one.json' if index == 0 else 'snapshot-two.json')
        with snapshot.open('xb') as handle:
            handle.write(native.read_bytes())
        entry['snapshot'] = snapshot.name
        entry['captured_ns'] = time.monotonic_ns()
        expected_history += [{'role': 'user', 'content': request['user_input']},
                             {'role': 'assistant', 'content': response}]
        save_trace()
        print(json.dumps({'assistant_message': response}), flush=True)
    if len(trace['turns']) != 2:
        raise ValueError('Incomplete two-turn probe')

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except BaseException as error:
        trace['error_type'] = type(error).__name__
        save_trace()
        print('Offline probe invalid/inconclusive: execution did not complete.', file=sys.stderr)
        sys.exit(1)
