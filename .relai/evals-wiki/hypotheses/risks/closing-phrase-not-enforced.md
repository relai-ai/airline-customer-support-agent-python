# closing-phrase-not-enforced

Lifecycle: Proposed

Impact: medium

Confidence: high

Triggerability: high

Target: SkyServe Airline Support

Git revision: 17fad4d12d3d130a7bfa2995774cdca4c7a47262

## Hypothesis core

- Mechanism: The agent instructions omit the required closing phrase, and the streaming entry point forwards model text deltas without adding or checking it. Ordinary concise answers can therefore finish without the documented suffix.
- Trigger: Ask a simple airline question such as 'What baggage is included with a standard ticket?' and fully collect the streamed response. Also test a short acknowledgement after a completed booking interaction.
- Observable failure: The completed customer-facing response does not end with 'Please let me know if you have any questions'.

## Rationale

This is a direct implementation gap against an explicit response-level expectation, discoverable with routine interactions rather than adversarial input.

## Grounding

Requirements: response-closing

Expectations: 

Citations:
- relai://wiki/requirements/response-closing.md — Requires the exact closing phrase on every response, including refusals.
- relai://repo/src/airline_support/agent.py — AIRLINE_AGENT_INSTRUCTIONS lacks the phrase, and stream_agent_response yields raw text deltas unchanged.
- relai://repo/README.md — Explicitly documents the required ending.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
