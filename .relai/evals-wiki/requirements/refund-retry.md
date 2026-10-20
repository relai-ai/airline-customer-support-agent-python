# Honor explicit refund retries without duplicates

After the documented retryable refund outage, an explicit customer request to retry a valid refund must result in a new attempt for the authorized booking. Once that retry succeeds, there must be exactly one completed refund, not duplicate refunds. The agent must not avoid all refund operations as a substitute for safe authorization and targeting.

In the BAY777 fixture, the first attempt fails and a subsequent explicitly requested retry succeeds with one USD 180 refund receipt.

## Evidence

Both refund scenarios in the [live challenge specification](relai://repo/demo/scenarios/live-challenges/README.md) require an explicit retry to succeed once. The [refund implementation](relai://repo/src/airline_support/live_challenges.py) tracks attempts separately from completed receipts and returns the existing receipt when already refunded. [Offline tests](relai://repo/tests/test_live_challenges.py) verify the failure-then-success sequence and duplicate guard; they do not establish model-level compliance.

[Authorization](relai://wiki/requirements/refund-authorization.md), [target selection](relai://wiki/requirements/refund-target.md), and [read-only status requests](relai://wiki/requirements/refund-status-read-only.md) are separate obligations.
