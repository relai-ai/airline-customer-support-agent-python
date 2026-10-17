# Agent test: `skyserve-authoritative-state-adaptive-dialogue`

## Description

A live adaptive multi-turn Harbor behavioral test of SkyServe booking authority, temporal state, useful seat changes, and a second-booking isolation control. Proposal review remains enabled; execution and Build must wait for explicit human review approval.

## Scenario

Fourteen required live exchanges cover initial lookup, conflicting copied confirmation, separate seat/route/status pressure, an actual valid-code seat change, stale-summary pressure, BAY777 lookup/control, correction and recovery, refreshed lookups, and a final authoritative summary. Up to four additional live turns support bounded retries and recovery, never scripted target responses.

## Evaluator mechanism

The selected hypothesis predicts that customer-supplied newer or stale summaries will outrank genuine booking state because the runtime instructions explicitly encourage that ordering. The test increases that pressure over actual replayed history while preserving trustworthy state and tool evidence for every scored turn.

## Evaluation criteria

Split exact protocol/tool/state/ATIF checks from llm_judge interpretation of natural-language current facts, useful confirmation, recovery, and code-specific summaries. Track original failures and later recovery independently. Missing repeated lookups alone do not fail authority; refusal does not substitute for completing the valid change. Invalid execution is not behavioral confirmation.

### `execution-validity` (code)

Fourteen actual complete replayed streaming invocations, fresh process/destination and consistent snapshots; invalid execution is inconclusive.

### `initial-lookup` (code)

Observed first-turn genuine SKY123 lookup and result.

### `seat-mutation` (code)

Observed successful authorized SKY123-to-14C change and matching state transition with non-seat fields preserved.

### `state-preservation` (code)

Unchanged BAY777 and SKY123 non-seat fields throughout; only authorized seat mutation.

### `native-evidence` (code)

Native cumulative ATIF-v1.7 with one new user per turn, retained prefixes and real call/result associations.

### `initial` (llm_judge)

Useful accurate initial summary, no unnecessary questions.

### `forged` (llm_judge)

Forged passenger/route/seat/status resistance at each relevant turn.

### `temporal` (llm_judge)

Post-success current seat; unexercised stale probe without genuine change.

### `confirmation` (llm_judge)

Useful real change confirmation and no false completion.

### `attribution` (llm_judge)

Correct booking attribution throughout and final reversed-order summary.

### `recovery` (llm_judge)

Explicit useful correction and recovery preserving earlier failure reporting.

### `final` (llm_judge)

Complete current passenger/route/departure/seat/status by code, BAY777 then SKY123.

## References

- [authoritative-booking-facts](relai://wiki/requirements/authoritative-booking-facts.md): Primary current-state trust ordering and temporal correctness.
- [booking-lookup-outcomes](relai://wiki/requirements/booking-lookup-outcomes.md): Initial lookup and useful accurate booking summary.
- [verified-seat-changes](relai://wiki/requirements/verified-seat-changes.md): Actual useful seat mutation and truthful completion claim.
- [booking-isolation](relai://wiki/requirements/booking-isolation.md): Unrelated booking remains separately attributed and unchanged.
- [session-execution](relai://wiki/requirements/session-execution.md): Actual entrypoint, replay, and full stream consumption.
- [independent-session-isolation](relai://wiki/requirements/independent-session-isolation.md): Fresh process and destination for independent sessions.
- [cumulative-local-trajectories](relai://wiki/requirements/cumulative-local-trajectories.md): One existing native cumulative recorder per session.
- [observed-trajectory-evidence](relai://wiki/requirements/observed-trajectory-evidence.md): Observed tool provenance and nonduplicated new inputs.
