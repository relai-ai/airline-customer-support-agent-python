# SkyServe booking and seat-change smoke

Two normal customer turns look up SKY123, then change its seat to non-paid 16A using the same session. The separate verifier checks real lookup and change-seat calls, observed arguments, and same-call-ID results in the cumulative ATIF artifact. The reusable adapter replays history through `airline_support.agent.stream_agent_response` from `/workspace/src`; all mutable demo state stays in one fresh process per trial. Existing SDK callbacks serialize filtered snapshots synchronously under one lock, so consuming and closing the stream leaves no queued writes.

Runtime credentials belong in `.relai/simulator.env` outside task assets. Supply a native provider key, or the existing scoped provider selector and its three runtime settings. No backend or external booking service is needed.

## File guide

Edit `environment/scenario.json` and optional `environment/mocks/` to define this scenario, and declare its evaluators in `task.toml`: code evaluators run in the verifier `tests/evaluate.py`, and LLM judges are `tests/evaluator.toml` manifests with a rubric. Harbor requires `instruction.md`; new tasks leave it empty.

Configure packaging to generate `generated/build.json`, `generated/dependencies.json`, the Dockerfiles, and verifier launch script. `generated/runtime/` contains the portable snapshot of common runtime inputs; it is part of a self-contained task package. A task whose `generated/build.json` has schema_version 2 instead uses the shared project runtime in `.relai/harbor/runtime/` and keeps only its own packaging. Author the reusable leaf adapter under `.relai/harbor/adapter/`, then explicitly select its staged snapshot through packaging. The package includes exact runtime inputs needed to rebuild it.
