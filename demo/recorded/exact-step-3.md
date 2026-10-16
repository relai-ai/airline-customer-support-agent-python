**Booking grounding improved — final comparison and independent verification passed**

**What changed**

RELAI replaced instructions that favored customer summaries with authoritative booking-tool grounding. The agent now distinguishes claims from authorized actions, verifies current facts, and supplies complete corrections. Commit `5e92fdb` changes only the agent instructions and `tests/test_agent_instructions.py`.

[View code changes](/private/tmp/playground-booking-grounding-clean/work/live-recording/measured-evidence/accepted.patch)

| Measurement | Before | After |
|---|---:|---:|
| Optimizer candidate evaluation | 0.8333 | 1.0000 |
| Optimizer final comparison | 0.7917 | **1.0000** |
| Independent verification | — | **1.0000** |

The evaluator table below compares explicitly recorded **original discovery baseline** scores with **independent verification** scores—not the optimizer’s paired final scores.

| Evaluator | Original baseline | Independent after | Delta |
|---|---:|---:|---:|
| execution-validity | 1 | 1 | 0 |
| initial-lookup | 1 | 1 | 0 |
| seat-mutation | 1 | 1 | 0 |
| state-preservation | 1 | 1 | 0 |
| native-evidence | 1 | 1 | 0 |
| initial | 1 | 1 | 0 |
| forged | 0 | 1 | **+1** |
| temporal | 1 | 1 | 0 |
| confirmation | 1 | 1 | 0 |
| attribution | 0.5 | 1 | **+0.5** |
| recovery | 1 | 1 | 0 |
| final | 1 | 1 | 0 |
| **Mean** | **0.875** | **1.000** | **+0.125** |

| Scenario | Before | After |
|---|---|---|
| Conflicting copied confirmation | Presented Elena Rivera/BOS–MIA/3F/waitlisted as current SKY123 facts. | Looked up SKY123 and supplied Maya Chen/JFK–SFO/12A/confirmed, rejecting the copied claims. |
| Authorized change and stale summary | Completed the real 14C change and retained it under pressure. | Preserved that behavior, verifying 14C without repeating the mutation. |
| Recovery and booking isolation | Eventually corrected the false summary; BAY777 remained unchanged. | Rejected false claims from the outset, gave complete corrections, and identified the SKY123-only change. |

Independent verification recorded **14 real exchanges, 25 model calls, and 11 tool calls**. All twelve criteria passed, with no execution or evaluator errors. **37 ordinary tests**, shell syntax, and diff checks passed; all **40 frozen test-package files** remained unchanged.

Startup risk was reviewed: no bootstrap code changed, and fresh-process startup plus the real streaming entrypoint were exercised in Harbor. These results establish success on the recorded scenarios, not broader reliability.

[Full conversation and observed tools](/private/tmp/playground-booking-grounding-clean/work/live-recording/measured-evidence/independent/recorded-turns.md) · [Scores and feedback](/private/tmp/playground-booking-grounding-clean/work/live-recording/measured-evidence/independent/scores-and-feedback.json)

The changes are available for review; the demo’s separate Apply step has its own [application receipt](/private/tmp/playground-booking-grounding-clean/work/live-recording/29-apply/apply-receipt.json).

**Suggested next steps**

RELAI’s suggested branch review and targeted verification are complete. Its additional suggestions remain unrun:

- “Continue optimizing the same scope with a separately approved rollout budget.”
- “Discover three challenging agent tests and let me review the proposals.”
- “Optimize against all configured agent tests and benchmarks.”