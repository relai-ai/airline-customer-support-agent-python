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

## Live conversational evidence (schema 3)

New conversational recordings use `schemaVersion: 3` and `evidenceKind:
live-agent`. All four replies, including Apply, are completed native Codex
captures from the same thread. The target responses come from real model
calls through the agent's normal entry point and its actual booking tools.
No scripted SDK responses are used as demo evidence. Legacy schemas remain
readable for compatibility.

The bundle preserves a measured failing baseline, an accepted RELAI optimizer
change, and a separate targeted verification with a distinct invocation and
run ID. Validation checks complete exchanges, observed tool results, scored
execution without evaluator errors, and the frozen generated test package.
Every artifact is hashed. Before/after source snapshots and the patch must
agree, so review works even in a workspace without Git history.

Each six-rollout optimizer budget includes its final before/after evaluation.
When a separately approved follow-up is needed, preserve both complete reports
and receipts in `optimizerHistory`; their budgets must sum to `totalRollouts`.
A later passing run must not erase an earlier regression from the evidence.
Independent targeted verification is recorded separately; never label that
extra verification as an optimizer rollout. Describe remaining deductions and
limitations accurately. The loader requires passing independent verification
before a recording can be released as verified.

`savedLinks` maps response links to hashed packaged public artifacts. Unknown
links remain literal text. Keep raw native events, private reasoning,
credentials, simulator environment files, and private CLI state outside the
bundle. Historical bundles belong in task output, not the active demo.

The risk reply displays one risk table and keeps Open saved wiki results.
Timing badges consistently read “Codex + RELAI precomputed results ·” followed
by the actual measured phase and duration. Prefilled prompts use complete
sentences. Exact response exports remain unchanged; display trimming is
presentation only. Baseline turns appear in a table, and submitting a prompt
anchors it near the top so the answer can be read from its beginning.

The UI does not display a Saved run artifacts inventory or append a separate
fixture response/viewer. The Apply reply comes from its captured coding-agent
response; applying the saved patch still validates source hashes and preserves
visitor edits. A new preview session must use a new session ID and clear its
saved workspace state before presenting the first prompt again.

A schema-3 recording may have `verificationStatus: mixed` when the independent
replay passes but the retained optimizer history contains a regression or
remaining deductions. This is distinct from a consistently verified fix.
It requires an explicit `reliabilityNote`, shown with the fix reply. The actual
scores and full historical reports remain hashed and unchanged. Applying such
a candidate still requires the visitor's explicit Apply step; that action does
not convert its evaluation status to verified. A failed independent execution or code validity check still prevents release.
A partially improved candidate must explicitly list every remaining semantic
deduction in `unresolvedEvaluatorIds`, pass its originally failing targeted
evaluators, and improve its independent mean over the original baseline. It
remains `mixed`; neither a user Apply action nor a passing unit test changes
that behavioral status.
