#!/usr/bin/env python3
"""Keep typed RELAI workflows attached to the hosted command sandbox.

Only the wait duration changes. Workflow deadlines, budgets, checkpoints, native
review responses, cancellation, stdout, and exit status belong to the real CLI.
"""
import os
import re
import sys

REAL_CLI = '/opt/playground/relai-real'
WAIT = '24h'


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
    os.execv(REAL_CLI, [REAL_CLI, *attached_argv(sys.argv[1:])])
