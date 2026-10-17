#!/usr/bin/env python3
"""Keep typed RELAI workflows attached to the hosted command sandbox.

Only the wait duration changes. Workflow deadlines, budgets, checkpoints, native
review responses, cancellation, stdout, and exit status belong to the real CLI.
"""
import os
import base64
import json
import re
import sys
import urllib.request
from urllib.parse import urlsplit

REAL_CLI = '/opt/playground/relai-real'
WAIT = '24h'


def worker_workflow(argv):
    if any(arg in ('--help', '-h', '--version', '-V') for arg in argv):
        return False
    return ('--agent-interaction' in argv or argv[:2] == ['runs', 'wait'])


def run_worker(argv, url, token):
    target = urlsplit(url)
    if (target.scheme != 'http' or target.hostname != '127.0.0.1' or
            not target.port or target.username or target.password or
            target.path not in ('', '/') or target.query or target.fragment):
        raise ValueError('Invalid session-local RELAI worker address')
    request = urllib.request.Request(url.rstrip('/') + '/run',
        data=json.dumps({'argv': argv}).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    # Keep the managed proxy: bypassing it would be denied by Codex's network
    # sandbox. No retry: a failed connection must never duplicate a workflow.
    with urllib.request.urlopen(request, timeout=3600) as response:
        for line in response:
            event = json.loads(line)
            if 'exitCode' in event:
                return int(event['exitCode'])
            stream = event.get('stream')
            if stream not in ('stdout', 'stderr'):
                raise ValueError('Invalid RELAI worker event')
            output = getattr(sys, stream)
            output.buffer.write(base64.b64decode(event['data'], validate=True))
            output.flush()
    raise RuntimeError('RELAI worker disconnected before returning an exit status; do not restart blindly')


def attached_argv(argv):
    boundary = argv.index('--') if '--' in argv else len(argv)
    options, positional = argv[:boundary], argv[boundary:]
    typed = '--agent-interaction' in options
    waiting = options[:2] == ['runs', 'wait']
    if not (typed or waiting) or any(arg in ('--help', '-h', '--version', '-V') for arg in options):
        return argv
    result = []
    index = 0
    while index < len(options):
        arg = options[index]
        if arg == '--wait':
            if index + 1 == len(options):
                return argv  # Preserve CLI validation of a missing value.
            value = options[index + 1]
            if not re.fullmatch(r'(?:\d+(?:\.\d+)?(?:ms|s|m|h|d|w))+', value):
                return argv  # Do not hide malformed CLI input.
            index += 2
            continue
        if arg.startswith('--wait='):
            if not re.fullmatch(r'(?:\d+(?:\.\d+)?(?:ms|s|m|h|d|w))+', arg[7:]):
                return argv
            index += 1
            continue
        result.append(arg)
        index += 1
    return result + ['--wait', WAIT] + positional


if __name__ == '__main__':
    argv = attached_argv(sys.argv[1:])
    if os.environ.get('RELAI_WORKER_URL') and worker_workflow(argv):
        try:
            sys.exit(run_worker(argv, os.environ['RELAI_WORKER_URL'], os.environ['RELAI_WORKER_TOKEN']))
        except (KeyboardInterrupt, BrokenPipeError):
            sys.exit(130)  # Closing the stream cancels the worker process group.
        except Exception:
            print('RELAI worker unavailable. No successful result is recorded; preserve the checkpoint and inspect the runtime.', file=sys.stderr)
            sys.exit(1)
    os.execv(REAL_CLI, [REAL_CLI, *argv])
