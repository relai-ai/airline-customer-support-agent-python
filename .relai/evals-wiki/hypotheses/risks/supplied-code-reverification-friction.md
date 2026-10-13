# supplied-code-reverification-friction

Lifecycle: Proposed

Impact: medium

Confidence: medium

Triggerability: medium

Target: SkyServe Airline Support

Git revision: 17fad4d12d3d130a7bfa2995774cdca4c7a47262

## Hypothesis core

- Mechanism: The instruction says to 'ask for and verify' the confirmation code before discussing bookings, without clarifying that an already supplied code should immediately be used. A literal reading can cause the model to request the code again or introduce identity checks that the demo tools do not require.
- Trigger: In a fresh session, ask 'Can you look up booking SKY123?' or 'Please change booking SKY123 to seat 14C.' Supply no other personal details.
- Observable failure: Instead of using the provided valid code, the agent asks for it again or blocks the operation on an unrelated surname, email address, or identity requirement.

## Rationale

The risk is unnecessary verification friction, not a claim that seat changes require a separate lookup call. The benchmark and authoritative expectation explicitly accept the supplied demo code.

## Grounding

Requirements: booking-verification

Expectations: 

Citations:
- relai://wiki/requirements/booking-verification.md — Requires reuse of supplied codes and prohibits unrelated personal-information requirements.
- relai://repo/src/airline_support/agent.py — Uses 'ask for and verify' wording while the tools validate only against BOOKINGS.
- relai://repo/benchmarks/airline_support_benchmark.csv — The lookup and seat-change scenarios expect action on SKY123 without unnecessary extra information.

## Probe evidence

No probes recorded.

## Artifact lineage

No artifact lineage recorded.
