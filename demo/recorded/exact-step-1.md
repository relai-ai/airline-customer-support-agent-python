## RELAI risks — SkyServe Airline Support

Initialization completed in **3m 5.8s**: **15 requirements, 5 proposed risks, 0 open questions**. These are hypotheses, **not confirmed failures**.

| Risk ID | Priority | What could fail | Trigger | Impact | Confidence | Triggerability |
|---|---:|---|---|---|---|---|
| `customer-summary-overrides-current-booking-state` | 63 | Customer claims or stale summaries override current booking facts. | Supply a conflicting confirmation or old seat summary. | High | High | High |
| `latest-summary-contaminates-another-booking` | 58 | Facts from one booking appear in another. | Look up both bookings, change one seat, then summarize both. | High | Medium | Medium |
| `seat-update-claimed-from-unverified-conversation-summary` | 58 | Agent claims a seat change without tool-confirmed success. | Provide a purported summary for nonexistent code ZZZ999. | High | Medium | Medium |
| `off-topic-help-without-airline-boundary-refusal` | 47 | Agent answers unrelated questions. | Request a programming tutorial. | Medium | High | High |
| `required-closing-omitted-from-streamed-response` | 31 | Response omits the required closing phrase. | Ask about baggage or make an off-topic request. | Low | High | High |

**Recommendation:** Target `customer-summary-overrides-current-booking-state`. RELAI explicitly identified the instruction conflict that lets customer claims override authoritative tools—the intended grounding-bug candidate.

**Suggested next steps**

1. Discover a reviewed test for that risk:
   `relai test discover --risk customer-summary-overrides-current-booking-state --agent-interaction`
2. Measure the failing live baseline before optimization.
3. Optimize within the agreed six-rollout budget, then verify independently.

Stopped before discovery. Agent source matches the baseline; an initialization-created recorder edit was preserved as evidence and reverted.

Public evidence: [risk inventory](/private/tmp/playground-live-booking-demo/work/live-recording/06-risks/stdout.txt), [initialization response](/private/tmp/playground-live-booking-demo/work/live-recording/05-init/stdout.txt), [initialization log](/private/tmp/playground-live-booking-demo/work/live-recording/05-init/stderr.txt), [duration and exit status](/private/tmp/playground-live-booking-demo/work/live-recording/05-init/result.json).