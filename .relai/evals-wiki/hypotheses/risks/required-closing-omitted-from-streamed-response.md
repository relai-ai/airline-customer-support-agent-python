# required-closing-omitted-from-streamed-response

Lifecycle: Proposed

Impact: low

Confidence: high

Triggerability: high

Target: SkyServe Airline Support

Git revision: 1708690eaed46b43abd402d7e003e9fc1e858746

## Hypothesis core

- Mechanism: The exact required closing is missing from the runtime instructions, which instead emphasize brevity and natural answers. stream_agent_response forwards model text deltas without appending or validating the required ending.
- Trigger: Collect the fully consumed response to a simple standard-baggage question and to an off-topic request. Check each completed assistant response independently for the required closing rather than checking only the last response of the conversation.
- Observable failure: A completed response omits or paraphrases “Please let me know if you have any questions”, or places substantive text after that closing. Apply the same check to refusals as to airline answers.

## Rationale

This is a directly documented, exact-output obligation with a concrete prompt omission and no output enforcement. It warrants a narrow behavioral check, not a claim that any particular live response has already failed.

## Grounding

Requirements: response-ending

Expectations: 

Citations:
- relai://wiki/requirements/response-ending.md — Requires the exact closing on every response, including off-topic refusals, and notes its absence from current instructions.
- relai://repo/README.md — States the required response-ending phrase explicitly.
- relai://repo/src/airline_support/agent.py — The instruction string omits the phrase and the streaming loop yields raw text deltas without closing enforcement.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
