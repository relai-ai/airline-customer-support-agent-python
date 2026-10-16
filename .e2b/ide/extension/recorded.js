// Recorded runs are evidence, never live command execution.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const exec = promisify(execFile);
const prompts = [
  "What are the risks identified for this agent by RELAI?",
  "Use RELAI to create a new agent test for the off-topic-help-without-refusal risk with at least 10 turns and a sophisticated adversarial user; show me the readable result of the agent simulation against this test.",
  "Use RELAI to fix the issue discovered in this agent test",
  "These changes look great; apply",
];
const exactPrompts = [
  prompts[0],
  "Use RELAI to build a multi-turn test for the highest-impact risk u found",
  "Use relai to fix the failures the test found",
  prompts[3],
];
const livePrompts = [
  prompts[0],
  "Use RELAI to build a multi-turn test for the highest-impact risk you found.",
  "Use RELAI to fix the failures the test found.",
  "These changes look great. Apply them.",
];
const digest = (data) => crypto.createHash("sha256").update(data).digest("hex");
async function regular(root, name) {
  if (
    !/^((?:src\/airline_support\/[a-zA-Z0-9_-]+\.py|tests\/test_[a-zA-Z0-9_-]+\.py)|demo\/recorded\/[a-zA-Z0-9_.-]+)$/.test(
      name,
    )
  )
    throw Error("Invalid recorded artifact path");
  const file = path.join(await fs.realpath(root), name);
  if ((await fs.realpath(file)) !== file)
    throw Error("Recorded artifacts cannot use symlinks");
  if (!(await fs.stat(file)).isFile())
    throw Error("Recorded artifacts must be regular files");
  return fs.readFile(file);
}
async function loadRecording(root) {
  const manifest = JSON.parse(
    await regular(root, "demo/recorded/walkthrough.json"),
  );
  if (
    ![1, 2, 3].includes(manifest.schemaVersion) ||
    !["pending", "verified", "mixed"].includes(manifest.verificationStatus) ||
    (manifest.verificationStatus === "mixed" && manifest.schemaVersion !== 3) ||
    manifest.steps?.length !== 3 ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw Error("Recorded walkthrough is incomplete");
  if (manifest.schemaVersion === 2) await validateRecorderEvidence(root, manifest);
  if (manifest.schemaVersion === 3) await validateLiveEvidence(root, manifest);
  for (const step of manifest.steps)
    if (
      !Number.isFinite(step.durationSeconds) ||
      step.durationSeconds < 0 ||
      typeof step.text !== "string"
    )
      throw Error("Recorded run metadata unavailable");
  if (manifest.steps.some(step => step.exactResponse)) {
    if (manifest.steps.some(step => !step.exactResponse))
      throw Error("Every recorded step requires its exact Codex response");
    for (const [index, step] of manifest.steps.entries()) {
      const bytes = await regular(root, step.exactResponse.path);
      if (digest(bytes) !== step.exactResponse.sha256)
        throw Error("Exact Codex response integrity check failed");
      const response = JSON.parse(bytes);
      if (response.engine !== "codex-cli" || response.turnStatus !== "completed" || !response.threadId ||
          ([2, 3].includes(manifest.schemaVersion) && response.threadId !== manifest.provenance.threadId) ||
          response.prompt !== manifest.prompts[index] || response.response !== step.text ||
          digest(response.response) !== response.responseSha256)
        throw Error("Recorded reply does not match its exact Codex response");
    }
  }
  if (manifest.riskInventory) {
    const inventory = manifest.riskInventory;
    if (inventory.command !== "relai wiki list risks" ||
        inventory.source !== ".relai/evals-wiki/hypotheses/risks.md" ||
        !["demo/recorded/wiki-risks.md", "demo/recorded/wiki-risks.json"].includes(inventory.snapshot))
      throw Error("Recorded wiki inventory metadata is invalid");
    const snapshot = await regular(root, inventory.snapshot);
    if (digest(snapshot) !== inventory.sha256)
      throw Error("Recorded wiki inventory integrity check failed");
    let lifecycle = "";
    const rows = inventory.snapshot.endsWith(".json")
      ? JSON.parse(snapshot).results?.map((risk) => ({
          id: risk.id, impact: risk.impact, confidence: risk.confidence,
          triggerability: risk.triggerability, mechanism: risk.mechanism,
          trigger: risk.trigger, failure: risk.observable_failure, lifecycle: risk.lifecycle,
        }))
      : snapshot.toString().split("\n").flatMap((line) => {
      if (line.startsWith("## ")) lifecycle = line.slice(3).trim();
      const match = line.match(/^- \[`([^`]+)`\].*? — ([^;]+); mechanism: (.*?); trigger: (.*?); observable failure: (.*?); requirements:/);
      if (!match) return [];
      const [, id, ratings, mechanism, trigger, failure] = match;
      const [impact, confidence, triggerability] = ratings.split("/");
      return [{ id, impact, confidence, triggerability, mechanism, trigger, failure, lifecycle }];
    });
    if (!rows?.length || rows.some((row) =>
      !["id", "impact", "confidence", "triggerability", "mechanism", "trigger", "failure", "lifecycle"]
        .every((key) => typeof row[key] === "string" && row[key].length > 0)) ||
      JSON.stringify(rows) !== JSON.stringify(inventory.risks))
      throw Error("Displayed risks differ from the saved wiki inventory");
    if (inventory.snapshot.endsWith(".json") && JSON.parse(snapshot).total !== rows.length)
      throw Error("Recorded wiki inventory must include every returned risk");
  }
  if (manifest.initialization) {
    const init = manifest.initialization;
    if (!/^demo\/recorded\/[a-zA-Z0-9_.-]+\.json$/.test(init.receipt ?? ""))
      throw Error("Initialization timing requires a saved command receipt");
    const receipt = JSON.parse(await regular(root, init.receipt));
    if (
      receipt.argv?.[0] !== "relai" ||
      receipt.argv?.[1] !== "init" ||
      receipt.exitCode !== 0 ||
      !Number.isFinite(receipt.durationSeconds) ||
      receipt.durationSeconds <= 0 ||
      init.durationSeconds !== receipt.durationSeconds
    )
      throw Error(
        "Initialization timing must come from a completed relai init command",
      );
  }
  if (manifest.provenance && manifest.schemaVersion === 1) {
    const provenance = manifest.provenance;
    if (provenance.orchestrator !== "Codex" ||
        !/^[a-f0-9-]{36}$/.test(provenance.threadId ?? "") ||
        !/^[a-f0-9]{40}$/.test(provenance.sourceRevision ?? "") ||
        !Number.isInteger(provenance.totalRollouts) || provenance.totalRollouts < 6)
      throw Error("Codex recording provenance is incomplete");
    const phases = ["initialize", "baseline", "optimize", "verify"];
    for (const phase of phases) {
      const reference = provenance.receipts?.[phase];
      if (!reference) throw Error("Codex recording requires completed workflow receipts");
      const bytes = await regular(root, reference.path);
      if (digest(bytes) !== reference.sha256) throw Error("Codex receipt integrity check failed");
      const receipt = JSON.parse(bytes);
      if (receipt.orchestrator !== "Codex" || receipt.exitCode !== 0 ||
          receipt.argv?.[0] !== "relai" ||
          receipt.argv[1] !== (phase === "initialize" ? "init" : phase === "optimize" ? "optimize" : "simulate") ||
          !Number.isFinite(receipt.durationSeconds) ||
          receipt.durationSeconds <= 0)
        throw Error("Codex recording requires successful RELAI command receipts");
      if (phase === "optimize" &&
          Number(receipt.argv[receipt.argv.indexOf("--total-rollouts") + 1]) !== provenance.totalRollouts)
        throw Error("Codex rollout count differs from its command receipt");
    }
    if (!Array.isArray(provenance.artifacts) || !provenance.artifacts.length)
      throw Error("Codex recording requires saved run artifacts");
    for (const reference of provenance.artifacts)
      if (digest(await regular(root, reference.path)) !== reference.sha256)
        throw Error("Codex run artifact integrity check failed");
    if (!provenance.artifacts.some((item) => item.path === provenance.baselineTrajectory))
      throw Error("Codex recording requires its measured baseline trajectory");
    const trajectory = JSON.parse(await regular(root, provenance.baselineTrajectory));
    const actualTurns = [];
    for (const step of trajectory.steps ?? []) {
      if (step.source === "user") actualTurns.push({ user: step.message, agent: "" });
      else if (step.source === "agent" && !step.tool_calls?.length && actualTurns.length)
        actualTurns.at(-1).agent = step.message;
    }
    if (JSON.stringify(actualTurns) !== JSON.stringify(manifest.turns))
      throw Error("Displayed Codex baseline differs from the actual trajectory");
    if (manifest.verificationStatus === "verified") {
      const reference = provenance.finalEvaluation;
      if (!reference || !provenance.artifacts.some((item) => item.path === reference))
        throw Error("Verified Codex recordings require their independent final evaluation");
      const evaluation = JSON.parse(await regular(root, reference));
      if (evaluation.schemaVersion !== 1 || evaluation.status !== "completed")
        throw Error("Independent final evaluation did not complete");
      const means = {};
      for (const phase of ["before", "after"]) {
        const runs = evaluation.phases?.[phase]?.runs;
        if (!Array.isArray(runs) || runs.length !== 10)
          throw Error("Independent final evaluation requires ten before and ten after runs");
        const values = [];
        for (const run of runs) {
          if (!provenance.artifacts.some((item) => item.path === run.result))
            throw Error("Final evaluation is missing its actual result artifacts");
          const result = JSON.parse(await regular(root, run.result));
          const actual = result.runs?.[0]?.result;
          if (result.schema_version !== "relai.simulation_suite_result.v1" || result.total_count !== 1 ||
              result.success_count !== 1 || result.failure_count !== 0 ||
              result.runs?.length !== 1 || result.failures?.length || actual?.evaluation_errors?.length)
            throw Error("Final evaluation contains an incomplete or failed simulation");
          const integrity = actual?.evaluations?.find((item) => item.evaluator_id === "ten-exchange-trajectory");
          const quality = actual?.evaluations?.find((item) => item.evaluator_id === "airline-scope-quality");
          if (integrity?.score !== 1 || !Number.isFinite(quality?.score) || quality.score < 0 || quality.score > 1)
            throw Error("Final evaluation lacks complete scored evidence");
          values.push(quality.score);
        }
        means[phase] = values.reduce((sum, value) => sum + value, 0) / values.length;
        if (!Number.isFinite(evaluation.phases[phase].meanScopeQuality) ||
            Math.abs(means[phase] - evaluation.phases[phase].meanScopeQuality) > 1e-9)
          throw Error("Displayed final evaluation mean differs from actual scores");
      }
      if (means.after <= means.before)
        throw Error("Verified Codex recordings require an independently measured improvement");
    }
  }
  if (
    typeof manifest.diff !== "string" ||
    !["before", "after", "regressions"].every(
      (key) => typeof manifest.comparison?.[key] === "string",
    )
  )
    throw Error("Recorded comparison is incomplete");
  for (const file of manifest.files)
    if (
      !/^(?:src\/airline_support\/[a-zA-Z0-9_-]+\.py|tests\/test_[a-zA-Z0-9_-]+\.py)$/.test(file.path) ||
      (file.before !== null && !/^[a-f0-9]{64}$/.test(file.before)) ||
      !/^[a-f0-9]{64}$/.test(file.after)
    )
      throw Error("Recorded source hashes are invalid");
  if (
    new Set(manifest.files.map((file) => file.path)).size !==
    manifest.files.length
  )
    throw Error("Recorded files must be unique");
  if (
    !Array.isArray(manifest.turns) ||
    manifest.turns.length < (manifest.schemaVersion === 2 ? 2 : 10) ||
    !manifest.turns.every(
      (t) => typeof t.user === "string" && typeof t.agent === "string",
    )
  )
    throw Error(manifest.schemaVersion === 2 ? "Recording requires its complete measured exchanges" : "Recording requires ten real exchanges");
  if (manifest.baselineExample &&
      (!Number.isInteger(manifest.baselineExample.turnIndex) ||
       manifest.baselineExample.turnIndex < 0 || manifest.baselineExample.turnIndex >= manifest.turns.length))
    throw Error("Recorded baseline example must identify an actual exchange");
  if (
    !Array.isArray(manifest.prompts) ||
    manifest.prompts.length !== 4 ||
    !manifest.prompts.every((p, i) => p === (manifest.schemaVersion === 3 ? livePrompts[i] : manifest.steps.every(step => step.exactResponse) ? exactPrompts[i] : prompts[i]))
  )
    throw Error("Recorded prompts do not match the walkthrough");
  if (manifest.fixedExample) {
    const example = manifest.fixedExample;
    if (!/^demo\/recorded\/[a-zA-Z0-9_.-]+\.json$/.test(example.trajectory ?? ""))
      throw Error("Verification example requires a recorded trajectory");
    const trajectory = JSON.parse(await regular(root, example.trajectory));
    const user = trajectory.steps?.find((step) => step.source === "user");
    const agent = trajectory.steps?.find(
      (step) => step.source === "agent" && !step.tool_calls?.length && step.message,
    );
    if (example.user !== user?.message || example.agent !== agent?.message)
      throw Error("Verification example differs from its actual recorded response");
  }
  const patch = await regular(root, "demo/recorded/verified.patch");
  if (digest(patch) !== manifest.patchSha256)
    throw Error("Recorded patch integrity check failed");
  if (manifest.diff !== patch.toString())
    throw Error("Displayed changes do not match the recorded patch");
  return manifest;
}
// Live conversational demos keep their native simulation, frozen criteria and
// optimizer provenance separate from deterministic recorder probes.
async function validateLiveEvidence(root, manifest) {
  const p = manifest.provenance, e = manifest.liveEvidence;
  if (manifest.evidenceKind !== "live-agent" || !["verified", "mixed"].includes(manifest.verificationStatus) ||
      p?.orchestrator !== "Codex" || !/^[a-f0-9-]{36}$/.test(p.threadId || "") ||
      !/^[a-f0-9]{40}$/.test(p.sourceRevision || "") || ![6, 12].includes(p.totalRollouts) ||
      !manifest.steps.every(step => step.exactResponse) || !e)
    throw Error("Live agent evidence provenance is incomplete");
  const artifacts = new Map();
  for (const ref of p.artifacts || []) {
    if (artifacts.has(ref.path)) throw Error("Duplicate live agent evidence");
    const bytes = await regular(root, ref.path);
    if (digest(bytes) !== ref.sha256) throw Error("Live agent evidence integrity check failed");
    artifacts.set(ref.path, bytes);
  }
  const read = name => {
    if (!artifacts.has(name)) throw Error("Missing live agent evidence");
    return JSON.parse(artifacts.get(name));
  };
  for (const target of Object.values(manifest.savedLinks || {}))
    if (!artifacts.has(target)) throw Error("Saved link is not a verified artifact");
  let baselineFailed = false;
  const phaseScores = {};
  for (const phase of ["before", "after"]) {
    const suite = read(e[phase].result), result = suite.runs?.[0]?.result;
    if (suite.schema_version !== "relai.simulation_suite_result.v1" || suite.total_count !== 1 ||
        suite.success_count !== 1 || suite.failure_count !== 0 || suite.failures?.length ||
        suite.runs?.length !== 1 || result?.evaluation_errors?.length ||
        result?.learning_environment_id !== e.testId || !result.evaluations?.length)
      throw Error("Live agent simulation did not complete cleanly");
    phaseScores[phase] = result.evaluations;
    for (const score of result.evaluations) {
      if (!Number.isFinite(score.score) || !Number.isFinite(score.max_score) ||
          !Number.isFinite(score.min_score) || score.max_score <= score.min_score ||
          score.score < score.min_score || score.score > score.max_score)
        throw Error("Invalid live agent evaluation score");
      if (phase === "before" && score.score < score.max_score) baselineFailed = true;
      if (phase === "after" && score.score !== score.max_score &&
          (manifest.verificationStatus === "verified" || score.evaluator_type === "code"))
        throw Error("Live verification still has failing criteria");
    }
    const trajectory = read(e[phase].trajectory);
    const turns = [];
    for (const step of trajectory.steps || []) {
      if (step.source === "user") turns.push({ user: step.message, agent: "" });
      else if (step.source === "agent" && !step.tool_calls?.length && step.message && turns.length)
        turns.at(-1).agent = step.message;
    }
    if (turns.length < 10 || turns.some(turn => !turn.user || !turn.agent) ||
        !trajectory.steps.some(step => step.tool_calls?.length && step.observation?.results?.length) ||
        !(trajectory.final_metrics?.total_completion_tokens > 0))
      throw Error("Live demo requires complete tool-backed model exchanges");
    if (phase === "before" && JSON.stringify(turns) !== JSON.stringify(manifest.turns))
      throw Error("Displayed live exchanges differ from the actual trajectory");
  }
  if (!baselineFailed) throw Error("Live demo requires a measured baseline failure");
  const beforeScores = new Map(phaseScores.before.map(score => [score.evaluator_id, score]));
  const afterScores = new Map(phaseScores.after.map(score => [score.evaluator_id, score]));
  if (beforeScores.size !== phaseScores.before.length || afterScores.size !== phaseScores.after.length ||
      beforeScores.size !== afterScores.size || [...beforeScores].some(([id, score]) =>
        !afterScores.has(id) || score.min_score !== afterScores.get(id).min_score || score.max_score !== afterScores.get(id).max_score))
    throw Error("Live before/after evaluator contracts differ");
  if (manifest.verificationStatus === "mixed") {
    const unresolved = phaseScores.after.filter(score => score.score < score.max_score).map(score => score.evaluator_id).sort();
    const declared = [...(e.unresolvedEvaluatorIds || [])].sort();
    const targets = e.targetedEvaluatorIds || [];
    const mean = scores => scores.reduce((sum, score) => sum + (score.score - score.min_score) / (score.max_score - score.min_score), 0) / scores.length;
    if (JSON.stringify(unresolved) !== JSON.stringify(declared) ||
        mean(phaseScores.after) <= mean(phaseScores.before) || !targets.length ||
        targets.some(id => !beforeScores.has(id) || beforeScores.get(id).score >= beforeScores.get(id).max_score ||
          afterScores.get(id).score !== afterScores.get(id).max_score))
      throw Error("Mixed candidate must improve the targeted failure and disclose every remaining deduction");
  }
  const before = read(e.criteriaBefore), after = read(e.criteriaAfter);
  if (!Object.keys(before).length || JSON.stringify(before) !== JSON.stringify(after) ||
      Object.keys(before).length !== Object.keys(e.packageFiles || {}).length)
    throw Error("Live test criteria changed during optimization");
  for (const [name, hash] of Object.entries(before))
    if (!artifacts.has(e.packageFiles[name]) || digest(artifacts.get(e.packageFiles[name])) !== hash)
      throw Error("Live test package differs from frozen criteria");
  const receipt = read(e.optimizerReceipt), argv = receipt.argv || [];
  if (receipt.exitCode !== 0 || argv[0] !== "relai" || argv[1] !== "optimize" ||
      argv[argv.indexOf("--total-rollouts") + 1] !== "6" ||
      argv[argv.indexOf("--batch-size") + 1] !== "1" || !argv.includes("--no-pr"))
    throw Error("Live demo requires completed bounded RELAI optimization");
  const history = e.optimizerHistory || [{ receipt: e.optimizerReceipt, result: e.optimizerResult, report: e.optimizerReport, budget: 6 }];
  if (history.length !== p.totalRollouts / 6 || history.some(run => run.budget !== 6) ||
      new Set(history.map(run => run.result)).size !== history.length ||
      new Set(history.map(run => run.receipt)).size !== history.length ||
      history.at(-1).receipt !== e.optimizerReceipt || history.at(-1).result !== e.optimizerResult ||
      history.at(-1).report !== e.optimizerReport)
    throw Error("Optimizer history differs from the approved total budget");
  let accepted = false;
  for (const run of history) {
    const r = read(run.receipt), args = r.argv || [], result = read(run.result), report = read(run.report);
    if (r.exitCode !== 0 || args[0] !== "relai" || args[1] !== "optimize" ||
        args[args.indexOf("--total-rollouts") + 1] !== String(run.budget) ||
        args[args.indexOf("--batch-size") + 1] !== "1" || !args.includes("--no-pr") ||
        !result.final_evaluation_summary || result.repair_blocker)
      throw Error("Optimizer history has an incomplete run");
    accepted ||= result.accepted_updates > 0 && result.accepted_turn_indices?.length > 0 && report.changes?.length > 0;
  }
  if (!accepted) throw Error("Optimizer did not produce a verified accepted change");
  const final = read(e.optimizerResult).final_evaluation_summary;
  const finalPasses = Number.isFinite(final.aggregate_score_before) && final.aggregate_score_after === 1 &&
      final.aggregate_score_after >= final.aggregate_score_before && final.updated_agent_evaluated &&
      !final.terminated_early && final.environment_summaries?.length && final.environment_summaries.every(item =>
        Number.isFinite(item.score_before) && item.score_after === 1 && item.score_after >= item.score_before);
  if (manifest.verificationStatus === "verified" && !finalPasses)
    throw Error("Optimizer final evaluation does not establish an improvement");
  const mixedHistory = history.some(run => {
    const summary = read(run.result).final_evaluation_summary;
    return summary.aggregate_score_after < summary.aggregate_score_before ||
      summary.environment_summaries?.some(item => item.score_after < 1 || item.score_before < 1);
  });
  if (manifest.verificationStatus === "mixed" &&
      (!mixedHistory || typeof manifest.reliabilityNote !== "string" || !manifest.reliabilityNote.trim()))
    throw Error("Mixed results require their actual evaluation history and an explicit reliability note");
  const outcome = read(e.outcome), verification = read(e.after.receipt);
  if (verification.exitCode !== 0 || verification.argv?.[0] !== "relai" || verification.argv[1] !== "simulate" ||
      outcome.schema_version !== "relai.agent_simulation_outcome.v1" ||
      outcome.invocation_id !== verification.outcomeInvocationId || outcome.execution?.status !== "completed" ||
      outcome.execution.failures?.length || outcome.execution.runs?.length !== 1 ||
      outcome.execution.runs[0].evaluator_errors?.length || outcome.execution.runs[0].failure ||
      outcome.execution.runs[0].run_id !== read(e.after.result).runs[0].result.run_id ||
      read(e.before.result).runs[0].result.run_id === read(e.after.result).runs[0].result.run_id)
    throw Error("Live independent verification is incomplete");
  const apply = read(manifest.exactApplyResponse?.path);
  if (digest(artifacts.get(manifest.exactApplyResponse.path)) !== manifest.exactApplyResponse.sha256 ||
      apply.engine !== "codex-cli" || apply.turnStatus !== "completed" || apply.threadId !== p.threadId ||
      apply.prompt !== livePrompts[3] || apply.response !== manifest.applyMessage ||
      digest(apply.response) !== apply.responseSha256)
    throw Error("Apply reply must match its exact native Codex capture");
}
// Recorder probes use deterministic SDK fixtures rather than ten-turn model-quality
// trials. Keep their evidence contract explicit and separate from legacy recordings.
async function validateRecorderEvidence(root, manifest) {
  const p = manifest.provenance, e = manifest.recorderEvidence;
  if (manifest.evidenceKind !== "deterministic-recorder" ||
      manifest.verificationStatus !== "verified" ||
      p?.orchestrator !== "Codex" || !/^[a-f0-9-]{36}$/.test(p.threadId || "") ||
      !/^[a-f0-9]{40}$/.test(p.sourceRevision || "") || p.totalRollouts !== 0 ||
      !manifest.steps.every(step => step.exactResponse) || !e)
    throw Error("Recorder evidence provenance is incomplete");
  const artifacts = new Map();
  for (const ref of p.artifacts || []) {
    if (artifacts.has(ref.path)) throw Error("Duplicate recorder evidence");
    const bytes = await regular(root, ref.path);
    if (digest(bytes) !== ref.sha256) throw Error("Recorder evidence integrity check failed");
    artifacts.set(ref.path, bytes);
  }
  const read = name => {
    if (!artifacts.has(name)) throw Error("Missing recorder evidence");
    return JSON.parse(artifacts.get(name));
  };
  for (const target of Object.values(manifest.savedLinks || {}))
    if (!artifacts.has(target)) throw Error("Saved link is not a verified artifact");
  const expected = ["snapshot-one-redaction", "snapshot-two-redaction", "cumulative-prefix",
    "user-steps-and-ids", "history-and-exhaustion", "session-isolation"];
  for (const phase of ["before", "after"]) {
    const suite = read(e[phase].result);
    const result = suite.runs?.[0]?.result;
    if (suite.schema_version !== "relai.simulation_suite_result.v1" || suite.total_count !== 1 ||
        suite.success_count !== 1 || suite.failure_count !== 0 || suite.runs?.length !== 1 ||
        suite.failures?.length || result?.evaluation_errors?.length ||
        result?.learning_environment_id !== e.testId || result.evaluations?.length !== expected.length)
      throw Error("Recorder simulation did not complete cleanly");
    for (const [index, id] of expected.entries()) {
      const score = result.evaluations.find(item => item.evaluator_id === id);
      if (score?.evaluator_type !== "code" || score.max_score !== 1 || score.min_score !== 0 ||
          score.score !== (phase === "before" && index < 2 ? 0 : 1))
        throw Error("Recorder scores do not prove the reported improvement");
    }
    const snapshots = e[phase].snapshots.map(read);
    if (snapshots.length !== 2 || snapshots[0].steps?.length !== 2 || snapshots[1].steps?.length !== 4 ||
        JSON.stringify(snapshots[0].steps) !== JSON.stringify(snapshots[1].steps.slice(0, 2)))
      throw Error("Recorder snapshots lost cumulative evidence");
    for (const snapshot of snapshots) {
      if (!e.syntheticSentinel || JSON.stringify(snapshot).includes(e.syntheticSentinel) !== (phase === "before") ||
          (phase === "after" && !snapshot.steps[0].message.includes("[REDACTED]")) ||
          snapshot.steps.some((step, index) => step.step_id !== index + 1))
        throw Error("Recorder snapshot redaction or step IDs differ from the report");
    }
    const trajectory = read(e[phase].trajectory);
    if (JSON.stringify(trajectory.steps) !== JSON.stringify(snapshots[1].steps))
      throw Error("Recorder trajectory differs from completed snapshots");
    if (phase === "before") {
      const turns = [];
      for (const step of trajectory.steps) {
        if (step.source === "user") turns.push({ user: step.message, agent: "" });
        else if (step.source === "agent" && !step.tool_calls?.length && turns.length) turns.at(-1).agent = step.message;
      }
      if (JSON.stringify(turns) !== JSON.stringify(manifest.turns))
        throw Error("Displayed recorder exchanges differ from the actual trajectory");
    }
    const receipt = read(e[phase].receipt);
    const argv = receipt.argv || receipt.command;
    if ((receipt.exitCode ?? receipt.exit_code) !== 0 || argv?.[0] !== "relai" ||
        argv[1] !== (phase === "before" ? "test" : "simulate"))
      throw Error("Recorder command receipt is incomplete");
  }
  const frozen = read(e.criteriaBefore), verified = read(e.criteriaAfter);
  if (!Object.keys(frozen).length || JSON.stringify(frozen) !== JSON.stringify(verified))
    throw Error("Recorder criteria changed during verification");
  if (Object.keys(frozen).length !== Object.keys(e.packageFiles || {}).length)
    throw Error("Recorder test package is incomplete");
  for (const [name, hash] of Object.entries(frozen))
    if (!artifacts.has(e.packageFiles[name]) || digest(artifacts.get(e.packageFiles[name])) !== hash)
      throw Error("Recorder test package differs from frozen criteria");
  const outcome = read(e.outcome), receipt = read(e.after.receipt);
  const before = read(e.before.result).runs[0].result, after = read(e.after.result).runs[0].result;
  if (outcome.schema_version !== "relai.agent_simulation_outcome.v1" ||
      outcome.invocation_id !== receipt.outcome_invocation_id ||
      outcome.execution?.status !== "completed" || outcome.execution.failures?.length ||
      outcome.execution.runs?.length !== 1 || outcome.execution.runs[0].run_id !== after.run_id ||
      before.run_id === after.run_id || outcome.execution.runs[0].evaluator_errors?.length ||
      outcome.execution.runs[0].failure || outcome.execution.runs[0].repair?.attempts !== 0)
    throw Error("Recorder independent verification outcome is invalid");
}
async function applyRecording(root, manifest) {
  if (manifest.verificationStatus !== "verified" && !(manifest.schemaVersion === 3 && manifest.verificationStatus === "mixed"))
    throw Error(
      "Independent verification is pending. The recorded patch cannot be applied yet.",
    );
  const patch = await regular(root, "demo/recorded/verified.patch");
  if (digest(patch) !== manifest.patchSha256)
    throw Error("Recorded patch integrity check failed");
  let before = true,
    after = true;
  for (const file of manifest.files) {
    if (!/^(?:src\/airline_support\/[a-zA-Z0-9_-]+\.py|tests\/test_[a-zA-Z0-9_-]+\.py)$/.test(file.path))
      throw Error("Only recorded agent code can be applied");
    let hash;
    try {
      hash = digest(await regular(root, file.path));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.join(await fs.realpath(root), path.dirname(file.path));
      if ((await fs.realpath(parent)) !== parent)
        throw Error("Recorded artifacts cannot use symlinks");
      hash = null;
    }
    before &&= hash === file.before;
    after &&= hash === file.after;
  }
  if (after)
    return manifest.verificationStatus === "mixed"
      ? "The recorded candidate is already applied; evaluation results remain mixed."
      : "The verified changes are already applied to this workspace.";
  if (!before)
    throw Error(
      "These files have changed since the recorded baseline. Your edits were preserved; review the diff before applying.",
    );
  const patchPaths = [
    ...patch.toString().matchAll(/^diff --git a\/(.+) b\/(.+)$/gm),
  ];
  if (
    !patchPaths.length ||
    patchPaths.some(
      (m) => m[1] !== m[2] || !manifest.files.some((f) => f.path === m[1]),
    )
  )
    throw Error("Recorded patch contains an unexpected file");
  const patchFile = path.join(root, "demo/recorded/verified.patch");
  await exec("git", ["apply", "--check", "--", patchFile], { cwd: root });
  await exec("git", ["apply", "--", patchFile], { cwd: root });
  for (const file of manifest.files)
    if (digest(await regular(root, file.path)) !== file.after)
      throw Error("Applied file does not match verified evidence");
  return manifest.verificationStatus === "mixed"
    ? "Applied the recorded candidate to this workspace. Evaluation results remain mixed; review the recorded limitations."
    : "Applied the recorded, verified improvement to this workspace. New requests now use these files.";
}
function reviewFile(manifest, name) {
  const file = manifest.files.find((item) => item.path === name);
  if (!file || !/^(?:src\/airline_support\/[a-zA-Z0-9_-]+\.py|tests\/test_[a-zA-Z0-9_-]+\.py)$/.test(name))
    throw Error("This file is not part of the recorded change");
  if (
    typeof file.beforeContent !== "string" ||
    typeof file.afterContent !== "string"
  )
    throw Error("Recorded diff snapshots are unavailable");
  if (
    (file.before === null
      ? file.beforeContent !== ""
      : digest(file.beforeContent) !== file.before) ||
    digest(file.afterContent) !== file.after
  )
    throw Error("Recorded diff snapshots do not match the measured source");
  return { before: file.beforeContent, after: file.afterContent };
}
async function artifactContent(root, manifest, name) {
  const references = [...(manifest.provenance?.artifacts || [])];
  for (const step of manifest.steps || [])
    if (step.exactResponse) references.push(step.exactResponse);
  if (manifest.riskInventory)
    references.push({ path: manifest.riskInventory.snapshot, sha256: manifest.riskInventory.sha256 });
  const reference = references.find((item) => item.path === name);
  if (!reference) throw Error("This file is not a saved walkthrough artifact");
  const bytes = await regular(root, name);
  if (digest(bytes) !== reference.sha256) throw Error("Saved artifact integrity check failed");
  return bytes.toString();
}
module.exports = { prompts, loadRecording, applyRecording, reviewFile, artifactContent, digest };
