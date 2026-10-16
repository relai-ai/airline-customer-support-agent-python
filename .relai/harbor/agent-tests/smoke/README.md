# RELAI task

Edit `environment/scenario.json` and optional `environment/mocks/` to define this scenario, and declare its evaluators in `task.toml`: code evaluators run in the verifier `tests/evaluate.py`, and LLM judges are `tests/evaluator.toml` manifests with a rubric. Harbor requires `instruction.md`; new tasks leave it empty.

Configure packaging to generate `generated/build.json`, `generated/dependencies.json`, the Dockerfiles, and verifier launch script. `generated/runtime/` contains the portable snapshot of common runtime inputs; it is part of a self-contained task package. A task whose `generated/build.json` has schema_version 2 instead uses the shared project runtime in `.relai/harbor/runtime/` and keeps only its own packaging. Author the reusable leaf adapter under `.relai/harbor/adapter/`, then explicitly select its staged snapshot through packaging. The package includes exact runtime inputs needed to rebuild it.
