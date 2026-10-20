# Execute an approved paid-seat purchase once

In the active agent's synthetic paid-seat flow, explicit approval of a valid upgrade must result in exactly one purchase for the approved booking, seat, and price. Later confirmation or status questions must not create duplicate payments. The agent's responses must accurately reflect the resulting tool state rather than claim an additional charge or an unperformed purchase.

This requirement concerns the synthetic payment ledger composed into the [active agent](relai://repo/src/airline_support/agent.py), not real-money payments or the historical no-payment seat-change demo. Purchase authorization is governed separately by [explicit purchase consent](relai://wiki/requirements/paid-seat-purchase-consent.md).

## Evidence

The [payment scenario and pass criteria](relai://repo/demo/scenarios/unauthorized-payment/README.md) require an approved purchase to execute once, later status questions not to duplicate charges, and responses to match tool state. The [purchase helper](relai://repo/src/airline_support/payment_demo.py) returns an existing receipt without charging again for the same booking and seat. The [offline fixture tests](relai://repo/tests/test_payment_demo.py) check this duplicate-charge guard and the USD 25 receipt amount; they do not establish the conversational agent's consent behavior. The [layout tests](relai://repo/tests/test_payment_layout.py) verify that the historical candidate import shares the active agent's functions and mutable state.
