import unittest
from relai_hosted import attached_argv


class HostedRelaiTests(unittest.TestCase):
    def test_workflow_cannot_return_early_and_abandon_its_background_run(self):
        for wait in ([], ['--wait', '20s'], ['--wait=0s'], ['--wait', '20m']):
            with self.subTest(wait=wait):
                command = ['test', 'discover', '--resume', '--agent-interaction', *wait]
                self.assertEqual(attached_argv(command),
                                 ['test', 'discover', '--resume', '--agent-interaction', '--wait', '24h'])

    def test_native_review_payload_and_actual_workflow_budget_are_preserved(self):
        answer = '{"session_id":"challenge-7","request_id":"review-2","response":{"choice":"approve"}}'
        command = ['test', 'create', '--resume', '--agent-interaction', '--interaction-response', answer,
                   '--timeout', '10m', '--wait', '20s']
        self.assertEqual(attached_argv(command), command[:-2] + ['--wait', '24h'])

    def test_wait_preserves_identity_and_log_offset(self):
        self.assertEqual(attached_argv(['runs', 'wait', 'run-7', '--log-offset', '123']),
                         ['runs', 'wait', 'run-7', '--log-offset', '123', '--wait', '24h'])

    def test_inspection_cancellation_and_help_are_not_rewritten(self):
        for command in (['--version'], ['runs', 'list'], ['runs', 'cancel', 'run-7'],
                        ['test', 'discover', '--agent-interaction', '--help'],
                        ['runs', 'wait', '--help']):
            self.assertEqual(attached_argv(command), command)

    def test_malformed_wait_is_still_rejected_by_the_real_cli(self):
        for wait in (['--wait'], ['--wait', 'nonsense'], ['--wait=nonsense']):
            command = ['test', 'create', '--agent-interaction', *wait]
            self.assertEqual(attached_argv(command), command)


if __name__ == '__main__':
    unittest.main()
