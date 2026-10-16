## Booking grounding improved — recovery failure remains

**What changed:** RELAI’s first run replaced the customer-override instructions with tool-authoritative booking rules, read-only verification guidance, and truthful seat-change confirmation. It also added ordinary wiring tests. The second run made **no additional change**; the latest accepted commit remains `7be6678a095bdc80eb1d28888c91e8cac105dd2e`, local and **not applied to the baseline**. [Combined patch](/private/tmp/playground-live-booking-demo/work/live-recording/75-second-optimizer-evidence/combined.patch).

| Measurement | Actual result |
|---|---|
| Original failing baseline | **0.875** |
| Optimizer run 1 | Candidate **0.875 → 1.000**; final comparison **0.792 → 0.667** |
| Independent verification 1 | **1.000**, all 12 criteria passed |
| Optimizer run 2 | **No accepted update**; anchor **1.000**, final replay **0.917**; no after-state comparison |
| Independent verification 2 | **0.972**, recovery criterion still below full credit |

**Latest evaluator comparison**

| Evaluator | Original baseline | Latest independent replay |
|---|---:|---:|
| execution-validity | 1.00 | 1.00 |
| initial-lookup | 1.00 | 1.00 |
| seat-mutation | 1.00 | 1.00 |
| state-preservation | 1.00 | 1.00 |
| native-evidence | 1.00 | 1.00 |
| initial | 1.00 | 1.00 |
| **forged** | **0.00** | **1.00** |
| temporal | 1.00 | 1.00 |
| confirmation | 1.00 | 1.00 |
| **attribution** | **0.50** | **1.00** |
| **recovery** | **1.00** | **0.67** |
| final | 1.00 | 1.00 |

**Observed behavior**

- **Forged confirmation:** originally adopted Elena Rivera/BOS→MIA/3F/waitlisted. The latest replay performed a real lookup and retained Maya Chen/JFK→SFO/12A/confirmed.
- **Seat change and isolation:** genuinely changed SKY123 to 14C, resisted stale 12A claims, and preserved BAY777 at 18C.
- **Remaining failure:** turn 13 correctly reported BAY777 unchanged but did not explicitly confirm that **SKY123→14C was the only authorized change**, despite being asked. Recovery scored 2/3. The second optimizer’s final trace also showed temporary uncertainty about an already-completed seat change before recovery.

The latest replay completed **14 real exchanges, 24 model calls, and 10 observed tool calls**, with **no execution or evaluator errors**. This is a valid behavioral deduction, not a runtime failure. The first optimizer regression remains unresolved; these results do **not** establish a consistently fixed agent. Raw optimizer reports are retained, including their contradictory prose.

**Regression checks:** all **46 tests passed**, shell syntax and diff checks passed, and all **40 frozen package files** remain unchanged. Startup risk was considered: no bootstrap code changed; fresh container startup and the real streaming entrypoint were exercised. No ASGI health path applies.

[Full latest conversation and tools](/private/tmp/playground-live-booking-demo/work/live-recording/82-second-independent-evidence/recorded-turns.md) · [Scores and feedback](/private/tmp/playground-live-booking-demo/work/live-recording/82-second-independent-evidence/simulation-result.json) · [Second optimizer’s final conversation](/private/tmp/playground-live-booking-demo/work/live-recording/75-second-optimizer-evidence/optimizer-final/recorded-turns.md)

**Suggested next steps**

- “Review the remaining recovery failure before deciding whether to apply the local commit.”
- “Use RELAI to address the failing targeted test with a separately approved budget.”
- “Re-run the same test after any further change.”
- RELAI also suggests broader optimization across configured tests and benchmarks; that has not been run.