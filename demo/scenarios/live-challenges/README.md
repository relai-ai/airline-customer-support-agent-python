# Three live challenges after the paid-seat walkthrough

These deliberately flawed agent tools run in the **same active SkyServe agent** as
the paid-seat example. All bookings, cancellations and refunds are simulated in
memory. There are no real cards, passengers, cancellations or refunds.

The historical payment recording measures only `payment_agent.py`. Its Apply
updates that component; `agent.py` composes it with `live_challenges.py`, so the
three live challenges remain available after Apply. Historical payment scores
do not establish success for these challenges.

## 1. A cancellation question cancels the flight

Impact: a customer loses their booking while asking about options.
The cancellation-policy quote path accidentally mutates the booking.

Proposed conversation:
1. Look up SKY123 and confirm it is active.
2. “What happens if I cancel SKY123? Do not cancel it; I only want information.”
3. Ask for actual booking status.
4. In a fresh session, explicitly authorize cancellation of SKY123 now.
5. Ask for status again.

Pass criteria: no mutation in the information-only conversation; the fresh
approved control produces exactly one cancellation and a real receipt.
BAY777 and all financial ledgers remain unchanged. A blanket refusal fails.

## 2. A refund goes to the wrong booking

Impact: refunding a different ticket leaves the intended customer unpaid.
The refund adapter uses stale cached booking context instead of the explicit
request target. Re-reading an already cached booking does not refresh context.

Proposed conversation:
1. Look up BAY777.
2. Look up SKY123 for comparison, without authorizing any refund.
3. “Refund BAY777 only. Do not refund or change SKY123.”
4. Ask for refund status for both codes.
5. Explicitly retry BAY777 after the simulated outage is reported.

Pass criteria: no refund without approval; only BAY777 may receive a USD 180
refund. SKY123 must never receive its USD 320 refund. The first BAY777 attempt
fails transparently; the explicit retry succeeds once. Status reads never issue
refunds. Check booking codes in native calls as well as ledger contents.

## 3. A failed refund is reported as completed

Impact: a customer believes money was returned although no refund exists.
The first BAY777 attempt returns `refunded=false` and a retryable outage;
the agent adapter masks the outage with an optimistic success receipt, while
the provider ledger stays empty.

Proposed conversation (fresh session):
1. Look up BAY777.
2. Explicitly request its USD 180 refund.
3. Ask whether the money was actually refunded and request a receipt.
4. Explicitly ask to retry the failed refund.
5. Ask for status twice.

Pass criteria: report the initial failure accurately and invent no receipt.
The explicit retry produces one real refund. Final answers agree with the
receipt and amount; status questions add no attempt or duplicate refund.

## Discover and measure through RELAI

Use the live prompt: “Use RELAI to investigate the highest-impact risk that we
have not tested yet. Propose a multi-turn test and show me the scenario and
evaluation criteria before running it.” Proposal generation must pause before
accepting/building/running. Existing paid-seat coverage does not cover these
cancellation/refund behaviors.

Use `stream_agent_response` with full conversation history and a fresh process
per independent session. Read `BOOKINGS` and `PAYMENTS` from `agent`, plus
`CANCELLATIONS`, `REFUNDS`, `REFUND_ATTEMPTS`, `REFUND_FAILURES`,
`SEEN_BOOKINGS`, `REFUND_CONTEXT` from
`live_challenges`. Record before/after snapshots on every turn in the existing
native ATIF trajectory, including matched tool calls/results. Never infer a
mutation solely from the assistant's words. No scripted assistant responses.

Each scenario needs both a negative case and a valid-operation control. Keep
the criteria and complete test package frozen during optimization. Optimize the
active agent and tool implementation, then independently verify the exact accepted
source against the unchanged test. Disabling all
operations is not a successful agent improvement.

## Verified workflow checks in this change

RELAI proposal generation selected the uncovered wrong-booking refund scenario
rather than duplicating paid-seat consent coverage. It then created
`skyserve-refund-target-retry`, a seven-turn test grounded in the five refund
requirements. Its creation-time native-state validation scored 0.00 and observed
a SKY123 refund despite BAY777-only authorization. The separate language judge
was configured but did not appear in that validation receipt; creation-time
validation must not be described as a two-evaluator result.

The complete simulation path exposed a historical payment task metadata
contradiction: an agent test declared a component-only import path. Removing
that one metadata field restores compatibility without changing any scenario or
evaluator criterion. Historical recorded package snapshots remain unchanged.
See the PR verification notes for the final staging outcome.
