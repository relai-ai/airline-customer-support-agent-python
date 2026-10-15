# Recorded developer walkthrough

`demo/recorded/walkthrough.json` contains three precomputed steps (risk review,
fresh test creation and baseline simulation, a fix and
independent verification) followed by an explicit application request. It must
come from completed real RELAI commands, never the browser integration fixtures.

Keep the sample's Python source at the measured original checkpoint. Store only the
verified source patch in `demo/recorded/verified.patch`. The manifest records
SHA-256 values for every before/after Python file; `before: null` represents a new
file. New files may be created only if the user has not already created them.
Recorded file paths must be regular files inside the workspace, not symlinks.

Legacy conversation manifest fields: `schemaVersion: 1`, four canonical `prompts`, three
`steps` with text, measured `durationSeconds` and a `durationLabel` naming
what was timed (inventory read, baseline simulation, optimization plus verification), at least ten real completed
`turns` containing user and final agent text, `comparison` with before/after and
regression results, `diff` equal to the stored patch, `files` and `patchSha256`.
Include public evidence paths and commands in the step metadata. Preserve full
redacted transcripts and evaluator feedback alongside the readable conversation.
Disclose incomplete checks; do not infer improvement from a zero command exit.

Record timings from actual command receipts. Label whether a time measures full
creation, certification, simulation or optimization. Reading an existing risk
report is not a newly measured risk-discovery run. Model generation can take
several minutes; replay has no artificial running indicator or delay.

Run `node .e2b/ide/extension/validate-recording.js` before building the template.
The Dockerfile also runs it after copying the extension. Missing or inconsistent
recordings fail the image build. Applying a recording checks the entire original
file set before applying and confirms the resulting hashes. Preserve user edits
on mismatch. Subsequent freeform prompts use the real workspace and scoped model
gateway, not replay data. No provider keys or private CLI state belong in this
bundle. The comparison establishes the recorded test results only.

Generation checklist:

1. Create the adaptive test through RELAI in the original source workspace.
   Keep its generated public EvalsWiki page and registry record with the task
   package; copying only the task prevents later RELAI repair or updates.
2. Review evaluator criteria before optimization. Criteria must measure the selected failure, preserve unrelated correct behavior, and allow
   agent-code changes without changing the model or expected behavior.
3. Simulate the original agent and retain its actual trajectory, scores and
   command receipt. A failed command is not a scored agent failure.
4. Optimize using the same frozen test, export the accepted source patch and
   reports before ending the temporary workspace, then independently rerun the
   target and regressions on the accepted branch.
5. Package only redacted public evidence, complete the hash validation, and
   build/smoke-test the image. Never publish fixture transcripts as real runs.

Native diff review uses `beforeContent` and `afterContent` on each file,
validated against the measured source hashes. Virtual documents are read-only;
review never applies the patch or overwrites visitor edits.

Optional initialization timing must have a saved successful `relai init`
command receipt. The loader checks its command, exit status and duration.
Without that receipt, show no initialization duration. Inventory-read time
is never initialization time.

## Exact Codex responses

For a newly captured walkthrough, every step has `exactResponse: {path, sha256}` referencing a public JSON export in `demo/recorded/`. Export a completed native Codex exec JSONL turn and its `--output-last-message` file using `.e2b/ide/record-codex-response.py`. The exporter preserves the response bytes, prompt, native thread ID, completion status and hashes. Keep raw native events private; they can contain reasoning or unrelated command output.

`step.text` must equal the exported `response` exactly, including headings, tables and Suggested next steps. The loader rejects a modified reply, mismatched prompt, incomplete step set or invalid hash. Original summaries remain summaries until genuine exact captures replace all three steps. Capture the revised risk, highest-impact multi-turn test, and failure-fix prompts in order; preserve failed/recovery attempts separately rather than presenting them as successful simulations. The screenshot examples specify layout, not a required scenario or score.

## Deterministic recorder evidence (schema 2)

The current bundle uses `schemaVersion: 2` and
`evidenceKind: deterministic-recorder`. It records two scripted SDK exchanges
through the real streaming/recording implementation. The UI labels these as
scripted responses; neither the fixtures nor their token metadata establish
live model quality. The exact Codex replies are native assistant output.

The independent result must show both redaction checks improving from 0 to 1,
with all four continuity/execution checks passing before and after. Validation
requires both native snapshots per phase, their full trajectory, successful
RELAI discovery/simulation receipts, a distinct verification invocation/outcome,
and the complete frozen test package with equal before/after hashes. Any
execution or evaluator error fails validation. Legacy ten-turn conversation
requirements remain unchanged for schema 1.

This deterministic bug was fixed directly by Codex following the RELAI optimize
skill and verified with `relai simulate`; `totalRollouts: 0` is intentional.
The 3.2-minute original initialization and later runtime recovery have separate
receipts. The 23.58-second timing describes independent verification only.

`savedLinks` maps original response links to hashed packaged artifacts. Unknown
links remain literal text, and artifact opening checks the saved hashes again.
Native response bytes remain unchanged, including disclosed warnings: the
generated README still says proposal-only, and RELAI emitted a raw-input
matching warning after credential masking. Neither was concealed or repaired
by changing evaluator criteria. The structured verification completed cleanly.

The prior conversation bundle is retained in the task's
`output/exact-codex-recording/previous-published-recording` directory. Older
unreferenced saved files are historical; only the current manifest selects what
the UI replays. No raw Codex JSONL events, private reasoning, or credentials are
packaged.
