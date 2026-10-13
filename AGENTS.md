# SkyServe Airline Support

## Agent and execution

This repository has one conversational agent: **SkyServe Airline Support**.
`create_airline_agent` in `src/airline_support/agent.py` creates it, and
`stream_agent_response` is its shared execution entry point. The terminal
interfaces and alternative model providers all use this same agent.
`lookup_booking`, `baggage_policy`, and `change_seat` are its internal tools,
not separate agents.

Pass `ChatMessage` history ending in the new user message to
`stream_agent_response`. Replay earlier user/assistant messages on each turn
and consume the entire async iterator to collect the response. Use a fresh
process for each independent session because demo bookings use mutable globals.

## Trajectory recording

`src/airline_support/trajectory.py` always records local ATIF-v1.7 trajectories.
Terminal sessions save `logs/<session-id>.atif.json` alongside their JSONL logs.
Integrations can pass `trajectory_path` to `stream_agent_response` or override
the destination with `ATIF_TRAJECTORY_PATH`; reuse the existing recorder.
Direct calls without a path share a generated session path for the process.

The recorder preserves observed model and tool events across turns. Reuse one
trajectory path within a session and a fresh path for each independent session.
Do not recreate the recorder per turn or infer tool activity from final answers.
Writes are serialized and atomic; fully consume the stream before returning a
response. Preserve prior evidence and propagate the original runtime error or
cancellation. Recording failures must not change agent behavior.

Provider keys and credential fields are redacted. For additional secrets, list
specific environment variable names in comma-separated `ATIF_REDACT_ENV_VARS`.
Local recording works independently of hosted SDK tracing.

## Development

Keep instrumentation behavior-preserving. Keep credentials and generated
runtime files local. Do not use `start.sh` for validation: it prompts for
credentials, calls models, and may commit dependency changes. Do not commit
or push unless asked.

```sh
uv run pytest
bash -n start.sh
git diff --check
```

<!-- relai:managed-policy:v1 -->
## RELAI workflow policy

This repository uses RELAI to preserve knowledge about the agent and to evaluate
and improve its behavior. Follow the installed RELAI plugin and the most specific
applicable skill for exact commands, sequencing, approvals, and resume handling.
Do not invent RELAI commands or options, directly edit RELAI-managed artifacts,
or weaken evaluations to make an implementation pass.

Apply this policy once to the completed conversation and its resulting changes.
Choose the narrowest action that preserves durable agent knowledge or evaluates
meaningful agent behavior. Do not turn every coding request into RELAI work.

## Decision ladder

1. **No RELAI action.** Use ordinary implementation and deterministic tests for
   routine refactors, formatting, infrastructure work, missing product
   capabilities, and deterministic defects with a clear failing path. Do not
   create RELAI artifacts merely because an agent was used to make the change.
2. **Wiki-only checkpoint.** When the work yields a confirmed durable
   requirement, correction, decision, constraint, preference, or useful
   hypothesis about the project or agent, update EvalsWiki even if no
   behavioral coverage is warranted. Do not record temporary plans, routine
   progress, raw transcripts, secrets, or transient implementation detail.
3. **Reuse or update existing coverage.** When a behavior already has matching
   agent test, evaluator, or benchmark coverage, inspect that
   knowledge and coverage first. Update the existing artifact only for a
   related correction or extension; preserve its identity and target. If the
   update is driven by newly confirmed durable intent, first record or
   reconcile that intent in EvalsWiki before updating coverage. Pure reuse
   with no new durable knowledge is read-only. Do not create a duplicate.
4. **Create grounded coverage.** Create an agent test or evaluator
   only for an observed or intended agent behavior that is valuable to preserve
   or measure over time and lacks suitable coverage. First record or reconcile
   the durable behavioral intent in EvalsWiki, then create the grounded
   artifact. A deterministic implementation defect alone is not sufficient;
   a behavioral failure involves judgment such as prompting, policy following,
   tool selection or ordering, reasoning, multi-turn behavior, or evaluation
   criteria.
5. **Run a targeted simulation.** Measure only existing or newly grounded,
   relevant coverage when the resulting agent behavior needs validation, a
   behavioral regression is reported, or a baseline is needed before a
   behavior-focused change. Do not run broad simulations for ordinary code
   changes.

The selected action can include its necessary predecessor: grounded coverage
creation, and coverage updates driven by new durable intent, require a durable
Wiki checkpoint first. A targeted simulation may follow updated or new
coverage. Reuse existing knowledge and coverage before creating anything new.

## Explain the decision

For a material RELAI action, tell the user which rung applies and why. Surface
unresolved grounding gaps, ambiguous behavior-versus-defect classification,
missing feedback or run logs, absent matching coverage, and any simulation or
evaluation failure. When the durable intent or suitable coverage cannot be
determined, report the gap and take the lower rung (a Wiki checkpoint or no
action) instead of asking; the user can request more.

## Examples

- **Deterministic:** A parser panics on valid input or a product lacks a
  required endpoint. Fix or implement it directly with focused tests; no RELAI
  action unless the work also establishes durable agent intent. Code bugs and missing capabilities,
  including a missing tool, are direct implementation.
- **Behavioral:** An agent repeatedly searches before reading repository
  context (tool selection), or a valid answer follows the wrong reasoning path.
  Record the durable expectation, reuse or create grounded agent test coverage,
  then run that case if validation is needed. Prompt behavior, multi-turn
  drift, and evaluator scoring criteria follow the same path.
- **Ambiguous:** A prompt change fixes one incorrect answer, but it is unclear
  whether the cause is a deterministic template bug or the agent's judgment.
  Explain the gap, preserve any confirmed durable intent in EvalsWiki, and do
  not create coverage or run a simulation until the classification is clear.
<!-- /relai:managed-policy:v1 -->
