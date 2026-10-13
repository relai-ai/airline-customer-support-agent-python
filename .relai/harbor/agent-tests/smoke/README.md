# SkyServe booking / seat-change smoke

`environment/scenario.json` supplies a booking lookup followed by a seat-change request referencing that booking. The native agent replays history; its mutable demo bookings remain alive in one process per trial. No tools are mocked and real provider credentials are required (OpenAI takes precedence over Anthropic).

- `task.toml`: identity, input asset, separate verifier and trajectory export.
- `environment/scenario.json`: editable fixed turns and task services.
- `tests/evaluate.py`: matched real lookup/change-seat ATIF evidence, two turns and real responses; always writes a numeric reward.
- `tests/Dockerfile`: self-contained Python verifier without project source or credentials.
- `instruction.md`: intentionally empty required Harbor file.
- `relai-init-expectations.json`: minimum init integration evidence.

Reusable adapter source lives at `.relai/harbor/adapter/project_adapter.py`; the staged environment leaf is its package snapshot. It imports the original entrypoint from `/workspace/src`, never a copied agent or detached backend. Recorder updates are synchronous under one lock with unique sibling atomic replacements, and complete before the fully consumed stream returns.

Generated packaging is owned by `configure_harbor_packaging`: `generated/build.json`, `generated/dependencies.json`, `generated/runtime/`, `environment/Dockerfile` and `tests/test.sh`. Do not hand-edit generated files. Dependency setup uses frozen uv inputs, not host dependencies. Configure provider keys privately in `.relai/simulator.env`, not task assets.
