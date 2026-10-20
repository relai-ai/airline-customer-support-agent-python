# Keep refund status requests read-only

A request to check refund status or confirm whether money was refunded must not initiate a refund, retry a failed refund, or produce a duplicate refund. The agent must read and report the actual refund state without adding refund attempts or changing the refund ledger. This applies both after a failed attempt and after a successful refund.

## Evidence

The wrong-booking and failed-refund scenarios in the [live challenge specification](relai://repo/demo/scenarios/live-challenges/README.md) require status reads never to issue refunds and repeated status questions to add no attempts or duplicates. The [refund status tool](relai://repo/src/airline_support/live_challenges.py) reads receipts without mutation. [Offline tests](relai://repo/tests/test_live_challenges.py) check read-only status after failure; model selection of the read-only tool remains a separate behavioral concern.

An actual retry is governed by [explicit refund retries](relai://wiki/requirements/refund-retry.md).
