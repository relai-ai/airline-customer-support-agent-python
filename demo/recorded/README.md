# Recorded Python SkyServe walkthrough

Codex Desktop orchestrated real RELAI CLI commands for this Python repository.
The saved `relai wiki list risks --json` response contains all six identified
risk hypotheses. The walkthrough focuses on `off-topic-help-without-refusal`.
The prefilled conversation replays this evidence; custom requests use real Codex
app-server in the visitor's private workspace. Only explicit apply changes code.

The student agent retained the Python SDK default model, `gpt-5.4-mini`.
The independent final evaluation used the unchanged adaptive ten-exchange test:

| Measurement | Original agent | Candidate |
| --- | --- | --- |
| Completed final simulations | 10 | 10 |
| Mean airline scope quality | 0.370833/1 | 0.910417/1 |
| Scope quality range | 0.333333–0.437500 | 0.875000–0.937500 |
| Complete ten-exchange evidence | 1/1 in every run | 1/1 in every run |

The semantic judge credited all six unrelated-request turns in every candidate
run for withholding unrelated deliverables. Some scope explanations and baggage
answers still received deductions. These measurements describe this recorded
experiment; they are not a guarantee for every request or a different model.

RELAI's configured optimization budget was 30 rollouts. It retained one accepted
change. A transient staging transport failure interrupted its final evaluation;
the original `optimizer-result.json` and `optimizer-report.md` intentionally
retain status `repair_failed`. The documented test-update resume completed with
all test files unchanged. Codex then completed the reserved ten-before/ten-after
evaluations independently. `final-evaluation.json`, the twenty actual result
files, their receipts and full ATIF trajectories establish the final comparison.
Do not interpret optimizer process exit code alone as successful validation.

The existing smoke task is execution-only. Codex checked its actual ATIF evidence:
`lookup_booking` verified SKY123 at seat 12A, and `change_seat` updated it to 14C.
`booking-seat-regression.json` describes these checks; it is not a separately
registered LLM evaluator score. All 43 candidate Python tests passed.

`live-codex-local.json` records a genuine app-server turn with seven observed
commands, all six wiki risks, an evidence file written by Codex, and saved history
restoration. `live-python-gateway.json` records the real Python agent's native
scoped-gateway booking and baggage tool roundtrip. Both used separate disposable
local containers and the actual native ASGI backend. Hosted verification on the
final E2B template remains a separate release gate.

The native backend must use a validated Responses profile. The local check used
GPT-6.1 Sol with its documented context allowance; a 100,000-byte conservative
allowance rejected a later Codex input. See the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
Provider credentials remain on the backend; only expiring scoped access reaches
the private workspace. The Python terminal uses that prepared environment without
asking for a provider key or automatically committing dependencies.

## Reproduce and inspect

```sh
relai wiki list risks --json
relai simulate --tests python-adversarial-airline-scope
relai optimize --tests python-adversarial-airline-scope --total-rollouts 30 --batch-size 1 --no-pr
relai simulate --tests smoke
```

The test package includes its persona, original criteria and SDK adapter. To
create another test, use `relai test create --prompt "<describe the behavior>"`.
For broader failure discovery, use `relai test discover --count 3`.

The image contains the measured original source. `verified.patch` contains the
reviewed candidate; SHA-256 values and before/after snapshots protect explicit
application and preserve visitor edits. Saved artifacts open read-only in the IDE.
No provider credentials or private CLI configuration belong in this bundle.
