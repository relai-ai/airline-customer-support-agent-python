# Report demo baggage allowances

Baggage answers should reflect the demo policy returned by the baggage tool:

- Basic or basic economy includes one personal item; carry-on and checked bags require a fee.
- Business, first, or premium includes one carry-on and two checked bags up to 70 pounds each.
- Standard tickets include one carry-on and one checked bag up to 50 pounds.

Ticket-type matching trims whitespace and ignores case. The tool uses the standard policy for unspecified or unrecognized ticket types. Do not infer fee amounts from the statement that a fee is required.

## Evidence

These are repository-derived demo rules from [baggage_policy](relai://repo/src/airline_support/agent.py), not externally verified airline policy.
