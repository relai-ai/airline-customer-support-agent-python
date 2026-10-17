# latest-summary-contaminates-another-booking

Lifecycle: Proposed

Impact: high

Confidence: medium

Triggerability: medium

Target: SkyServe Airline Support

Git revision: 1708690eaed46b43abd402d7e003e9fc1e858746

## Hypothesis core

- Mechanism: The prompt's instruction to reuse a supplied summary when a code appears in conversation does not require matching that summary to the particular booking. With multiple codes in replayed history, the model may attach the most recent booking's facts or seat update to the wrong code even though the tools store bookings separately.
- Trigger: Look up SKY123 and BAY777 in one session, then change SKY123 to 14C. Ask for a code-labeled summary of both bookings with BAY777 listed first and without supplying any false booking facts.
- Observable failure: BAY777 is reported with SKY123's seat 14C, passenger, or route, or SKY123 is reported with BAY777's facts. Compare each code's summary against its own current tool state rather than merely checking that both codes appear.

## Rationale

This isolates cross-booking attribution from deliberate customer misinformation and from ordinary stale-seat recall. The fixture provides two distinct bookings and a mutation affecting only one, enabling a precise evaluator.

## Grounding

Requirements: booking-isolation, authoritative-booking-facts

Expectations: 

Citations:
- relai://wiki/requirements/booking-isolation.md — Explicitly prohibits one booking's lookup or seat change from altering facts reported for another.
- relai://repo/src/airline_support/agent.py — Defines distinct SKY123 and BAY777 records, mutates seats by code, replays text history, and instructs summary reuse without an explicit code-scoping condition.
- relai://repo/README.md — Requires unrelated bookings to remain separate and current tool results to govern summaries.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
