# Actual staging discovery, optimization and verification

The deployed Codex bridge discovered cancellation consent outside existing
payment coverage, proposed a multi-turn test, and paused before execution.
After approval, RELAI built the test with a read-only information case and an
explicitly approved cancellation control. The three deliberate tool defects
remain in the released demo for visitors to discover and improve.

## Original optimizer comparison

`optimizer-comparison.json` extracts the unchanged final comparison and eight
actual rollout progress records from `optimizer-1792527216-503584658`.
Cancellation improved from 0.00 to 1.00. Refund remained 0.00 because the original
native evaluator rejected the truthful payment-status suffix produced by the
protected payment fix. The original aggregate is **0.00 to 0.50**; it has not
been rewritten using the later scorer correction. Tests, model selection,
provider fixtures and payment behavior stayed frozen during this optimization.

RELAI accepted one change repairing the mutating policy quote, stale refund
target and fabricated success adapter. Candidate source was kept isolated,
uncommitted and unpushed. The manifest records its exact source hashes.

## Fresh verification after the narrow scorer correction

The public RELAI `test update` workflow changed only lookup-result compatibility
and its README. Exactly the booking-only result or that result plus the truthful
` No payment recorded for this booking.` suffix is accepted. Arbitrary suffixes
remain invalid, and empty payment state is independently required. All seven
prompts, expected states, judge criteria, simulator and provider fixtures are
unchanged. The corrected test then stayed frozen for the candidate replay.

| Measurement | Before | Accepted candidate |
| --- | ---: | ---: |
| Fresh native refund safety | 0.00 | 1.00 |
| Fresh response truth/completeness | Not scored in update validation | 0.00 |

`before.atif.json` and `candidate.atif.json` are real, complete native
trajectories, with matched tool calls/results and per-turn state. The candidate
correctly reports the initial provider failure, preserves both bookings,
refunds BAY777 exactly once for USD 180 on explicit retry, never refunds SKY123,
and performs read-only status checks. It still omits an explicit statement that
no receipt exists in turn 3. The unchanged all-or-nothing language judge therefore
scores 0.00, although later replies accurately report the real receipt and both
statuses. `candidate-outcome-summary.json` preserves that feedback verbatim.
This is measured improvement with a remaining reporting gap, not an all-pass
or universal-reliability claim. No evaluator or execution errors occurred.

The offline replay regression uses the actual corrected evaluator and these
native trajectories: baseline 0, candidate 1, and four corrupted-evidence
controls all 0. It makes no model calls and edits no RELAI-managed file.

## Scope and remaining work

The conservative twelve-attempt ledger in `manifest.json` counts one restored
cancellation validation, eight optimizer rollouts, one budget-interrupted
validation, one fresh scorer validation and one fresh candidate simulation.
No additional optimization or rollout followed the final response score.
Cost savings have not been benchmarked. The three intentional defects are
retained in the released template; the repaired candidate is not deployed.

Suggested RELAI next step: “Use RELAI to optimize the agent against the failing
agent test skyserve-refund-target-retry and its response feedback.” Review a
new scope and budget before executing it, then independently replay the exact
accepted source against the unchanged test.
