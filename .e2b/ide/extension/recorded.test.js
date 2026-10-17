const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const exec = require("node:util").promisify(execFile);
const {
  prompts,
  digest,
  loadRecording,
  applyRecording,
  reviewFile,
} = require("./recorded");
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "relai-recorded-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "src/airline_support"), { recursive: true });
  await fs.mkdir(path.join(root, "demo/recorded"), { recursive: true });
  await exec("git", ["init", "-q"], { cwd: root });
  const before = "package airline\n\nfunc seat() bool { return true }\n",
    after = "package airline\n\nfunc seat() bool { return false }\n";
  await fs.writeFile(path.join(root, "src/airline_support/agent.py"), before);
  await exec("git", ["add", "src/airline_support/agent.py"], { cwd: root });
  await fs.writeFile(path.join(root, "src/airline_support/agent.py"), after);
  const { stdout: patch } = await exec(
    "git",
    ["diff", "--", "src/airline_support/agent.py"],
    { cwd: root },
  );
  await fs.writeFile(path.join(root, "src/airline_support/agent.py"), before);
  await fs.writeFile(path.join(root, "demo/recorded/verified.patch"), patch);
  const manifest = {
    schemaVersion: 1,
    verificationStatus: "verified",
    prompts,
    steps: Array.from({ length: 3 }, () => ({
      text: "Measured result",
      durationSeconds: 60,
    })),
    turns: Array.from({ length: 12 }, () => ({
      user: "Traveler request",
      agent: "Actual response",
    })),
    files: [
      {
        path: "src/airline_support/agent.py",
        before: digest(before),
        after: digest(after),
        beforeContent: before,
        afterContent: after,
      },
    ],
    patchSha256: digest(patch),
    diff: patch,
    comparison: { before: "Before", after: "After", regressions: "Passed" },
  };
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  return { root, manifest, before, after };
}
test("packaged live demo requires passing final and independent results with unchanged criteria", async (t) => {
  const { root } = await fixture(t);
  await fs.cp(path.resolve(__dirname, "../../../demo/recorded"), path.join(root, "demo/recorded"), { recursive: true });
  const manifest = await loadRecording(root);
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.evidenceKind, "live-agent");
  assert.equal(manifest.turns.length, 14);
  assert.equal(manifest.verificationStatus, "verified");
  assert.deepEqual(manifest.liveEvidence.unresolvedEvaluatorIds, []);
  assert.equal(manifest.provenance.totalRollouts, 6);
  const resultPath = manifest.liveEvidence.after.result;
  const resultFile = path.join(root, resultPath);
  const original = await fs.readFile(resultFile);
  const result = JSON.parse(original);
  result.runs[0].result.evaluations[0].score = 0;
  const changed = Buffer.from(JSON.stringify(result));
  await fs.writeFile(resultFile, changed);
  manifest.provenance.artifacts.find(ref => ref.path === resultPath).sha256 = digest(changed);
  const manifestFile = path.join(root, "demo/recorded/walkthrough.json");
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(loadRecording(root), /still has failing criteria/);
  await fs.writeFile(resultFile, original);
  manifest.provenance.artifacts.find(ref => ref.path === resultPath).sha256 = digest(original);
  const criteriaPath = manifest.liveEvidence.criteriaAfter;
  const criteria = JSON.parse(await fs.readFile(path.join(root, criteriaPath)));
  criteria["tests/evaluate.py"] = "0".repeat(64);
  const altered = Buffer.from(JSON.stringify(criteria));
  await fs.writeFile(path.join(root, criteriaPath), altered);
  manifest.provenance.artifacts.find(ref => ref.path === criteriaPath).sha256 = digest(altered);
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  await assert.rejects(loadRecording(root), /criteria changed/);
});
test("recorded patch changes actual code exactly once", async (t) => {
  const { root, after } = await fixture(t);
  const manifest = await loadRecording(root);
  assert.match(await applyRecording(root, manifest), /Applied/);
  assert.equal(
    await fs.readFile(path.join(root, "src/airline_support/agent.py"), "utf8"),
    after,
  );
  assert.match(await applyRecording(root, manifest), /already applied/);
});
test("native review uses measured snapshots even when the visitor edits the working file", async (t) => {
  const { root, manifest, before, after } = await fixture(t);
  await fs.writeFile(path.join(root, "src/airline_support/agent.py"), "// visitor draft\n");
  assert.deepEqual(reviewFile(manifest, "src/airline_support/agent.py"), { before, after });
  assert.throws(
    () => reviewFile(manifest, ".relai/config.toml"),
    /not part of the recorded change/,
  );
  manifest.files[0].afterContent = "// different proposed change\n";
  assert.throws(() => reviewFile(manifest, "src/airline_support/agent.py"), /do not match/);
});
test("post-apply example must match an actual recorded reply, not a tool-call message", async (t) => {
  const { root, manifest } = await fixture(t);
  const trajectory = "demo/recorded/verified-example.json";
  manifest.fixedExample = { trajectory, user: "Request 99Z", agent: "Rejected; no change." };
  await fs.writeFile(path.join(root, trajectory), JSON.stringify({ steps: [
    { source: "user", message: "Request 99Z" },
    { source: "agent", message: "lookup", tool_calls: [{ function_name: "lookup_booking" }] },
    { source: "agent", message: "Rejected; no change." },
  ] }));
  const save = () => fs.writeFile(path.join(root, "demo/recorded/walkthrough.json"), JSON.stringify(manifest));
  await save();
  assert.equal((await loadRecording(root)).fixedExample.agent, "Rejected; no change.");
  manifest.fixedExample.agent = "Invented success";
  await save();
  await assert.rejects(loadRecording(root), /differs from its actual recorded response/);
});
test("inventory reads cannot be displayed as initialization timings", async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.initialization = {
    receipt: "demo/recorded/init-receipt.json",
    durationSeconds: 1,
  };
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  const receipt = {
    argv: ["relai", "wiki", "list", "risks"],
    exitCode: 0,
    durationSeconds: 1,
  };
  await fs.writeFile(
    path.join(root, manifest.initialization.receipt),
    JSON.stringify(receipt),
  );
  await assert.rejects(() => loadRecording(root), /completed relai init/);
  receipt.argv = ["relai", "init"];
  await fs.writeFile(
    path.join(root, manifest.initialization.receipt),
    JSON.stringify(receipt),
  );
  assert.equal((await loadRecording(root)).initialization.durationSeconds, 1);
});
test("conflicting user edits are preserved", async (t) => {
  const { root, manifest } = await fixture(t);
  const edit = "// user edit\n";
  await fs.writeFile(path.join(root, "src/airline_support/agent.py"), edit);
  await assert.rejects(
    () => applyRecording(root, manifest),
    /edits were preserved/,
  );
  assert.equal(
    await fs.readFile(path.join(root, "src/airline_support/agent.py"), "utf8"),
    edit,
  );
});
test("pending verification permits preview but prevents applying or releasing the patch", async (t) => {
  const { root, manifest, before } = await fixture(t);
  manifest.verificationStatus = "pending";
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  assert.equal((await loadRecording(root)).verificationStatus, "pending");
  await assert.rejects(
    () => applyRecording(root, manifest),
    /verification is pending/,
  );
  await assert.rejects(
    () => require("./validate-recording").validate(root),
    /before building the release template/,
  );
  assert.equal(
    await fs.readFile(path.join(root, "src/airline_support/agent.py"), "utf8"),
    before,
  );
});
test("modified evidence and short simulations cannot be presented as the recording", async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.turns = manifest.turns.slice(0, 9);
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  await assert.rejects(() => loadRecording(root), /ten real exchanges/);
  manifest.turns = Array.from({ length: 10 }, () => ({
    user: "request",
    agent: "reply",
  }));
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  await fs.appendFile(
    path.join(root, "demo/recorded/verified.patch"),
    "tampered",
  );
  await assert.rejects(() => loadRecording(root), /integrity/);
});
test("symlink targets cannot overwrite another workspace", async (t) => {
  const { root, manifest } = await fixture(t);
  await fs.rename(
    path.join(root, "src/airline_support/agent.py"),
    path.join(root, "src/airline_support/other.py"),
  );
  await fs.symlink("other.py", path.join(root, "src/airline_support/agent.py"));
  await assert.rejects(() => applyRecording(root, manifest), /symlinks/);
});
test("verified new Python files apply once and never replace an existing user file", async (t) => {
  const { root, manifest } = await fixture(t);
  const content = "package airline\n\n// Verified new file.\n";
  const patch =
    "diff --git a/src/airline_support/validation.py b/src/airline_support/validation.py\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/src/airline_support/validation.py\n@@ -0,0 +1,3 @@\n+package airline\n+\n+// Verified new file.\n";
  const updated = {
    ...manifest,
    files: [
      { path: "src/airline_support/validation.py", before: null, after: digest(content) },
    ],
    patchSha256: digest(patch),
    diff: patch,
  };
  await fs.writeFile(path.join(root, "demo/recorded/verified.patch"), patch);
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(updated),
  );
  const recording = await loadRecording(root);
  assert.match(await applyRecording(root, recording), /Applied/);
  assert.equal(
    await fs.readFile(path.join(root, "src/airline_support/validation.py"), "utf8"),
    content,
  );
  assert.match(await applyRecording(root, recording), /already applied/);
  await fs.writeFile(
    path.join(root, "src/airline_support/validation.py"),
    "// user-owned file\n",
  );
  await assert.rejects(
    () => applyRecording(root, recording),
    /edits were preserved/,
  );
  assert.equal(
    await fs.readFile(path.join(root, "src/airline_support/validation.py"), "utf8"),
    "// user-owned file\n",
  );
});

test("image validation requires the original baseline and rejects an invented displayed diff", async (t) => {
  const { root, manifest } = await fixture(t);
  const { validate } = require("./validate-recording");
  await validate(root);
  manifest.files[0].afterContent = "// invented review snapshot\n";
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  await assert.rejects(() => validate(root), /snapshots do not match/);
  manifest.files[0].afterContent =
    "package airline\n\nfunc seat() bool { return false }\n";
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  await fs.writeFile(
    path.join(root, "src/airline_support/agent.py"),
    "// newer template\n",
  );
  await assert.rejects(() => validate(root), /measured baseline/);
  manifest.diff = "unrelated displayed changes";
  await fs.writeFile(
    path.join(root, "demo/recorded/walkthrough.json"),
    JSON.stringify(manifest),
  );
  await assert.rejects(() => loadRecording(root), /Displayed changes/);
});

test("displayed risk inventory must match its saved wiki evidence", async (t) => {
  const { root, manifest } = await fixture(t);
  const snapshot = "# Risk hypotheses\n\n## proposed\n\n- [`invalid-seat`](relai://wiki/hypotheses/risks/invalid-seat.md) — high/medium/high; mechanism: Unchecked write.; trigger: Request 99Z.; observable failure: Invalid seat saved.; requirements: seat-layout\n";
  const inventory = {
    command: "relai wiki list risks",
    source: ".relai/evals-wiki/hypotheses/risks.md",
    snapshot: "demo/recorded/wiki-risks.md",
    sha256: digest(snapshot),
    risks: [{ id: "invalid-seat", impact: "high", confidence: "medium", triggerability: "high", mechanism: "Unchecked write.", trigger: "Request 99Z.", failure: "Invalid seat saved.", lifecycle: "proposed" }],
  };
  manifest.riskInventory = inventory;
  await fs.writeFile(path.join(root, inventory.snapshot), snapshot);
  const save = () => fs.writeFile(path.join(root, "demo/recorded/walkthrough.json"), JSON.stringify(manifest));
  await save();
  assert.equal((await loadRecording(root)).riskInventory.risks.length, 1);
  inventory.risks[0].impact = "low";
  await save();
  await assert.rejects(loadRecording(root), /Displayed risks differ/);
  inventory.risks[0].impact = "high";
  await save();
  await fs.appendFile(path.join(root, inventory.snapshot), "modified");
  await assert.rejects(loadRecording(root), /inventory integrity/);
});

test("CLI JSON inventory preserves lifecycle and rejects incomplete pages", async (t) => {
  const { root, manifest } = await fixture(t);
  const result = {total: 1, results: [{id: "seat-risk", impact: "high", confidence: "medium", triggerability: "high", mechanism: "Unchecked write.", trigger: "Request 99Z.", observable_failure: "Invalid seat saved.", lifecycle: "confirmed"}]};
  manifest.riskInventory = {command: "relai wiki list risks", source: ".relai/evals-wiki/hypotheses/risks.md", snapshot: "demo/recorded/wiki-risks.json", risks: [{id: "seat-risk", impact: "high", confidence: "medium", triggerability: "high", mechanism: "Unchecked write.", trigger: "Request 99Z.", failure: "Invalid seat saved.", lifecycle: "confirmed"}]};
  const save = async () => {
    const snapshot = JSON.stringify(result);
    manifest.riskInventory.sha256 = digest(snapshot);
    await fs.writeFile(path.join(root, manifest.riskInventory.snapshot), snapshot);
    await fs.writeFile(path.join(root, "demo/recorded/walkthrough.json"), JSON.stringify(manifest));
  };
  await save();
  assert.equal((await loadRecording(root)).riskInventory.risks[0].lifecycle, "confirmed");
  result.total = 2;
  await save();
  await assert.rejects(loadRecording(root), /include every returned risk/);
});

test("a Codex label requires completed command receipts and authentic baseline turns", async (t) => {
  const { root, manifest } = await fixture(t);
  manifest.provenance = {orchestrator: "Codex", threadId: "01a1361a-9807-7ab2-a709-9f1dbcd442aa", sourceRevision: "a".repeat(40), totalRollouts: 30, receipts: {}, artifacts: [], baselineTrajectory: "demo/recorded/codex-baseline.json"};
  const save = () => fs.writeFile(path.join(root, "demo/recorded/walkthrough.json"), JSON.stringify(manifest));
  await save();
  await assert.rejects(loadRecording(root), /completed workflow receipts/);
  for (const phase of ["initialize", "baseline", "optimize", "verify"]) {
    const command = phase === "initialize" ? "init" : phase === "optimize" ? "optimize" : "simulate";
    const bytes = JSON.stringify({orchestrator:"Codex", exitCode:0, durationSeconds:60, argv:["relai",command,"--total-rollouts","30"]});
    const pathName = `demo/recorded/${phase}-receipt.json`;
    await fs.writeFile(path.join(root,pathName),bytes);
    manifest.provenance.receipts[phase] = {path:pathName, sha256:digest(bytes)};
  }
  const bytes = JSON.stringify({steps: manifest.turns.flatMap((turn) => [{source:"user",message:turn.user},{source:"agent",message:turn.agent}])});
  await fs.writeFile(path.join(root,manifest.provenance.baselineTrajectory),bytes);
  manifest.provenance.artifacts = [{path:manifest.provenance.baselineTrajectory,sha256:digest(bytes)}];
  await save();
  await assert.rejects(loadRecording(root), /independent final evaluation/);
  const evaluation = { schemaVersion: 1, status: "completed", phases: {} };
  for (const [phase, score] of [["before", 0], ["after", 1]]) {
    evaluation.phases[phase] = { meanScopeQuality: score, runs: [] };
    for (let index = 0; index < 10; index++) {
      const name = `demo/recorded/final-${phase}-${index}.json`;
      const bytes = JSON.stringify({ schema_version: "relai.simulation_suite_result.v1", total_count: 1, success_count: 1, failure_count: 0, failures: [], runs: [{result: {evaluation_errors: [], evaluations: [{evaluator_id: "ten-exchange-trajectory", score: 1}, {evaluator_id: "airline-scope-quality", score}]}}] });
      await fs.writeFile(path.join(root, name), bytes);
      manifest.provenance.artifacts.push({path: name, sha256: digest(bytes)});
      evaluation.phases[phase].runs.push({result: name});
    }
  }
  manifest.provenance.finalEvaluation = "demo/recorded/final-evaluation.json";
  const saveEvaluation = async () => {
    const bytes = JSON.stringify(evaluation);
    await fs.writeFile(path.join(root,manifest.provenance.finalEvaluation),bytes);
    manifest.provenance.artifacts = manifest.provenance.artifacts.filter(item => item.path !== manifest.provenance.finalEvaluation);
    manifest.provenance.artifacts.push({path:manifest.provenance.finalEvaluation,sha256:digest(bytes)});
    await save();
  };
  await saveEvaluation();
  assert.equal((await loadRecording(root)).provenance.totalRollouts,30);
  evaluation.phases.after.meanScopeQuality = 0.5;
  await saveEvaluation();
  await assert.rejects(loadRecording(root), /mean differs from actual scores/);
  evaluation.phases.after.meanScopeQuality = 1;
  await saveEvaluation();
  manifest.turns[0].agent = "Invented reply";
  await save();
  await assert.rejects(loadRecording(root), /differs from the actual trajectory/);
});

test("saved artifacts open only validated evidence and reject credentials or later edits", async (t) => {
  const { root, manifest } = await fixture(t);
  const { artifactContent } = require("./recorded");
  const snapshot = "demo/recorded/wiki-risks.json";
  const content = '{"results":[]}';
  await fs.writeFile(path.join(root, snapshot), content);
  manifest.riskInventory = { snapshot, sha256: digest(content) };
  assert.equal(await artifactContent(root, manifest, snapshot), content);
  await assert.rejects(artifactContent(root, manifest, ".relai/simulator.env"), /not a saved/);
  await fs.writeFile(path.join(root, snapshot), "edited");
  await assert.rejects(artifactContent(root, manifest, snapshot), /integrity/);
});

test("exact Codex replay requires matching prompt, unchanged reply and completed capture for every step", async t => {
  const { root } = await fixture(t), manifestPath = path.join(root, "demo/recorded/walkthrough.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.prompts[1] = "Use RELAI to build a multi-turn test for the highest-impact risk u found";
  manifest.prompts[2] = "Use relai to fix the failures the test found";
  for (const [index, step] of manifest.steps.entries()) {
    const response = { engine: "codex-cli", turnStatus: "completed", threadId: "offline-fixture", prompt: manifest.prompts[index], response: step.text, responseSha256: digest(step.text) };
    const bytes = JSON.stringify(response), name = `demo/recorded/response-${index}.json`;
    await fs.writeFile(path.join(root, name), bytes);
    step.exactResponse = { path: name, sha256: digest(bytes) };
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await loadRecording(root);
  manifest.steps[1].text = "Invented result";
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(loadRecording(root), /does not match its exact Codex response/);
});

// These are offline loader fixtures, never shipped as measured demo evidence.
async function liveFixture(t) {
  const { root, manifest } = await fixture(t);
  manifest.schemaVersion = 3;
  manifest.evidenceKind = "live-agent";
  manifest.prompts = [prompts[0], "Use RELAI to build a multi-turn test for the highest-impact risk you found.", "Use RELAI to fix the failures the test found.", "These changes look great. Apply them."];
  manifest.provenance = { orchestrator: "Codex", threadId: "11111111-1111-4111-8111-111111111111", sourceRevision: "a".repeat(40), totalRollouts: 6, artifacts: [] };
  const put = async (name, value) => {
    const file = "demo/recorded/" + name;
    const bytes = JSON.stringify(value);
    await fs.writeFile(path.join(root, file), bytes);
    manifest.provenance.artifacts.push({ path: file, sha256: digest(bytes) });
    return file;
  };
  const capture = async (index, response) => {
    const file = await put(`exact-${index}.json`, { engine: "codex-cli", turnStatus: "completed", threadId: manifest.provenance.threadId, prompt: manifest.prompts[index], response, responseSha256: digest(response) });
    return manifest.provenance.artifacts.find(ref => ref.path === file);
  };
  for (const [index, step] of manifest.steps.entries()) step.exactResponse = await capture(index, step.text);
  manifest.applyMessage = "Applied the verified booking fix.";
  manifest.exactApplyResponse = await capture(3, manifest.applyMessage);
  const e = manifest.liveEvidence = { testId: "booking-grounding", targetedEvaluatorIds: ["booking-correctness"], unresolvedEvaluatorIds: [] };
  for (const [phase, score] of [["before", 0], ["after", 1]]) {
    const steps = manifest.turns.flatMap((turn, index) => [
      { source: "user", message: turn.user },
      { source: "agent", tool_calls: [{ function_name: "lookup_booking" }], observation: { results: [{ content: "Authoritative booking" }] } },
      { source: "agent", message: turn.agent },
    ]);
    e[phase] = {
      result: await put(`${phase}-result.json`, { schema_version: "relai.simulation_suite_result.v1", total_count: 1, success_count: 1, failure_count: 0, failures: [], runs: [{ result: { run_id: phase, learning_environment_id: e.testId, evaluation_errors: [], evaluations: [{ evaluator_id: "booking-correctness", score, min_score: 0, max_score: 1 }] } }] }),
      trajectory: await put(`${phase}-trajectory.json`, { steps, final_metrics: { total_completion_tokens: 100 } }),
    };
  }
  e.after.receipt = await put("verify-receipt.json", { argv: ["relai", "simulate", "--tests", e.testId], exitCode: 0, outcomeInvocationId: "verify-1" });
  e.outcome = await put("verify-outcome.json", { schema_version: "relai.agent_simulation_outcome.v1", invocation_id: "verify-1", execution: { status: "completed", failures: [], runs: [{ run_id: "after", evaluator_errors: [] }] } });
  const content = { checks: ["authoritative booking state"] };
  const packageFile = await put("test-scenario.json", content);
  const hashes = { "scenario.json": digest(JSON.stringify(content)) };
  e.criteriaBefore = await put("criteria-before.json", hashes);
  e.criteriaAfter = await put("criteria-after.json", hashes);
  e.packageFiles = { "scenario.json": packageFile };
  e.optimizerReceipt = await put("optimizer-receipt.json", { argv: ["relai", "optimize", "--tests", e.testId, "--total-rollouts", "6", "--batch-size", "1", "--no-pr"], exitCode: 0 });
  e.optimizerReport = await put("optimizer-report.json", { changes: [{ title: "Ground booking facts in tools" }] });
  e.optimizerResult = await put("optimizer-result.json", { accepted_updates: 1, accepted_turn_indices: [1], final_evaluation_summary: { aggregate_score_before: 0.8, aggregate_score_after: 1, updated_agent_evaluated: true, terminated_early: false, environment_summaries: [{ score_before: 0.8, score_after: 1 }] } });
  const save = () => fs.writeFile(path.join(root, "demo/recorded/walkthrough.json"), JSON.stringify(manifest));
  await save();
  return { root, manifest, save };
}
test("live demo requires measured failure, genuine tool evidence, unchanged criteria and exact Apply capture", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  assert.equal((await loadRecording(root)).evidenceKind, "live-agent");
  manifest.turns[0].agent = "Invented displayed response";
  await save();
  await assert.rejects(loadRecording(root), /differ from the actual trajectory/);
  manifest.turns[0].agent = "Actual response";
  manifest.applyMessage = "Invented Apply confirmation";
  await save();
  await assert.rejects(loadRecording(root), /exact native Codex capture/);
});
test("live verification rejects a failing result even when artifact hashes are updated", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  const file = manifest.liveEvidence.after.result;
  const result = JSON.parse(await fs.readFile(path.join(root, file)));
  result.runs[0].result.evaluations[0].score = 0;
  const bytes = JSON.stringify(result);
  await fs.writeFile(path.join(root, file), bytes);
  manifest.provenance.artifacts.find(ref => ref.path === file).sha256 = digest(bytes);
  await save();
  await assert.rejects(loadRecording(root), /still has failing criteria/);
});

test("a passing independent replay cannot hide a regressed optimizer final comparison", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  const target = manifest.liveEvidence.optimizerResult;
  const result = JSON.parse(await fs.readFile(path.join(root, target)));
  result.final_evaluation_summary.aggregate_score_after = 0.7;
  const bytes = Buffer.from(JSON.stringify(result));
  await fs.writeFile(path.join(root, target), bytes);
  manifest.provenance.artifacts.find(item => item.path === target).sha256 = digest(bytes);
  await save();
  await assert.rejects(loadRecording(root), /final evaluation does not establish an improvement/);
});

test("follow-up budgets retain distinct historical reports and cannot discard a prior regression", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  const e = manifest.liveEvidence;
  const first = { budget: 6 };
  for (const key of ["receipt", "result", "report"]) {
    const source = e["optimizer" + key[0].toUpperCase() + key.slice(1)];
    const file = "demo/recorded/first-" + key + ".json";
    const data = JSON.parse(await fs.readFile(path.join(root, source)));
    if (key === "result") data.final_evaluation_summary.aggregate_score_after = 0.6;
    const bytes = JSON.stringify(data);
    await fs.writeFile(path.join(root, file), bytes);
    manifest.provenance.artifacts.push({ path: file, sha256: digest(bytes) });
    first[key] = file;
  }
  manifest.provenance.totalRollouts = 12;
  e.optimizerHistory = [first, { budget: 6, receipt: e.optimizerReceipt, result: e.optimizerResult, report: e.optimizerReport }];
  await save();
  assert.equal((await loadRecording(root)).liveEvidence.optimizerHistory.length, 2);
  e.optimizerHistory.shift();
  await save();
  await assert.rejects(loadRecording(root), /history differs from the approved total budget/);
});

test("mixed results remain explicit and applying the candidate does not rewrite their scores", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  const file = manifest.liveEvidence.optimizerResult;
  const result = JSON.parse(await fs.readFile(path.join(root, file)));
  result.final_evaluation_summary.aggregate_score_after = 0.7;
  result.final_evaluation_summary.environment_summaries[0].score_after = 0.7;
  const bytes = JSON.stringify(result);
  await fs.writeFile(path.join(root, file), bytes);
  manifest.provenance.artifacts.find(ref => ref.path === file).sha256 = digest(bytes);
  manifest.verificationStatus = "mixed";
  await save();
  await assert.rejects(loadRecording(root), /explicit reliability note/);
  manifest.reliabilityNote = "Independent replay passed; the optimizer final comparison regressed from 0.8 to 0.7.";
  await save();
  const loaded = await loadRecording(root);
  assert.match(await applyRecording(root, loaded), /results remain mixed/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, file))).final_evaluation_summary.aggregate_score_after, 0.7);
});

test("partial improvement must disclose the exact remaining semantic deductions", async (t) => {
  const { root, manifest, save } = await liveFixture(t);
  for (const [phase, score] of [["before", 1], ["after", 0.67]]) {
    const file = manifest.liveEvidence[phase].result;
    const suite = JSON.parse(await fs.readFile(path.join(root, file)));
    suite.runs[0].result.evaluations.push({ evaluator_id: "recovery", evaluator_type: "llm", score, min_score: 0, max_score: 1 });
    const bytes = JSON.stringify(suite);
    await fs.writeFile(path.join(root, file), bytes);
    manifest.provenance.artifacts.find(ref => ref.path === file).sha256 = digest(bytes);
  }
  manifest.verificationStatus = "mixed";
  manifest.reliabilityNote = "Booking grounding improved; recovery remains 0.67.";
  await save();
  await assert.rejects(loadRecording(root), /disclose every remaining deduction/);
  manifest.liveEvidence.unresolvedEvaluatorIds = ["recovery"];
  await save();
  assert.equal((await loadRecording(root)).verificationStatus, "mixed");
});
