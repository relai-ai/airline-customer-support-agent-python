const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const { loadRecording, applyRecording, digest } = require('./recorded');
const { base, candidate } = require('./scenario-recording');
const initial = { bookings: {
  SKY123: { passenger: 'Maya Chen', route: 'JFK to SFO', departure: '2026-07-14 09:30', seat: '12A', status: 'confirmed' },
  BAY777: { passenger: 'Noah Patel', route: 'LAX to SEA', departure: '2026-07-18 16:45', seat: '18C', status: 'confirmed' },
}, payments: [] };
const purchased = () => {
  const state = structuredClone(initial);
  state.bookings.SKY123.seat = '14C';
  state.payments = [{ id: 'demo-payment-1', booking: 'SKY123', seat: '14C', amount_cents: 2500, currency: 'USD', status: 'charged' }];
  return state;
};
// Synthetic unit fixture only; published recordings must contain measured runs.
function trajectory(after) {
  const value = { schema_version: 'ATIF-v1.7', steps: [], extra: { paid_seat_snapshots: [] } };
  let state = structuredClone(initial);
  for (let index = 0; index < 6; index++) {
    if (index === 3) state = structuredClone(initial);
    const before = structuredClone(state), start = value.steps.length;
    const charge = index === 3 || (!after && index === 1);
    value.steps.push({ step_id: value.steps.length + 1, source: 'user', message: 'Turn ' + index });
    if (charge) {
      state = purchased();
      value.steps.push({ step_id: value.steps.length + 1, source: 'agent', llm_call_count: 1,
        tool_calls: [{ tool_call_id: 'call-' + index, function_name: 'purchase_seat_upgrade' }],
        observation: { results: [{ source_call_id: 'call-' + index, content: '{"charged":true}' }] } });
    }
    value.steps.push({ step_id: value.steps.length + 1, source: 'agent', message: 'Reply ' + index, llm_call_count: 1 });
    value.extra.paid_seat_snapshots.push({ turn_index: index, reset_before_turn: index === 0 || index === 3,
      before, after: structuredClone(state), step_start: start, step_end: value.steps.length, assistant_message: 'Reply ' + index });
  }
  return value;
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'payment-recording-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, base), { recursive: true });
  await fs.mkdir(path.join(root, 'src/airline_support'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/airline_support/agent.py'), '# original agent\n');
  await fs.writeFile(path.join(root, candidate), '# payment before\n');
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['add', '.'], { cwd: root });
  await fs.writeFile(path.join(root, candidate), '# payment after\n');
  const { stdout: patch } = await exec('git', ['diff', '--', candidate], { cwd: root });
  await fs.writeFile(path.join(root, candidate), '# payment before\n');
  const manifest = { schemaVersion: 4, exampleId: 'unauthorized-payment', evidenceKind: 'live-agent', verificationStatus: 'verified',
    provenance: { artifacts: [] }, steps: [], prompts: ['Inspect risk', 'Build test', 'Fix failure', 'Apply'], receipts: {},
    files: [{ path: candidate, beforeContent: '# payment before\n', afterContent: '# payment after\n',
      before: digest('# payment before\n'), after: digest('# payment after\n') }],
    patchPath: base + 'verified.patch', patchSha256: digest(patch), diff: patch,
    turns: Array.from({ length: 6 }, (_, i) => ({ user: 'Turn ' + i, agent: 'Reply ' + i })) };
  const write = async (name, value) => {
    const bytes = typeof value === 'string' ? value : JSON.stringify(value);
    const file = base + name;
    await fs.writeFile(path.join(root, file), bytes);
    manifest.provenance.artifacts = manifest.provenance.artifacts.filter(ref => ref.path !== file);
    manifest.provenance.artifacts.push({ path: file, sha256: digest(bytes) });
    return file;
  };
  await write('verified.patch', patch);
  for (const [phase, command] of [['grounding', 'wiki'], ['test', 'test'], ['baseline', 'simulate'], ['optimize', 'optimize'], ['verify', 'simulate']]) {
    const protocolPath = await write(phase + '-protocol.json', { schema_version: 'relai.agent_interaction.v1', status: 'completed', workflow: { grounding: 'wiki_update', test: 'learning_env_create', baseline: 'simulate', optimize: 'optimize', verify: 'simulate' }[phase] });
    manifest.receipts[phase] = await write(phase + '-receipt.json', { exitCode: 0, argv: ['relai', command, '--tests', 'skyserve-payment-consent-dialogue', '--total-rollouts', '30'], durationSeconds: 1, protocolPath, candidateSha256: digest(phase === 'baseline' ? '# payment before\n' : '# payment after\n'), independentCheckout: phase === 'verify' });
  }
  for (let i = 0; i < 3; i++) {
    const text = ['Summary', 'Action taken', 'Results', 'Evidence', 'Next step'].map(h => '### ' + h + '\nFixture').join('\n');
    manifest.steps.push({ text, reportPath: await write('step-' + i + '.md', text), durationSeconds: 1 });
  }
  manifest.liveEvidence = {};
  for (const [phase, after] of [['before', false], ['after', true]]) {
    const result = { schema_version: 'relai.simulation_suite_result.v1', total_count: 1, success_count: 1, failure_count: 0, failures: [],
      runs: [{ learning_env: 'skyserve-payment-consent-dialogue', result: { run_id: phase, evaluation_errors: [],
        evaluations: [{ evaluator_id: 'paid-seat-ledger', score: after ? 1 : 0 }, { evaluator_id: 'paid-seat-response-state', score: 1 }] } }] };
    manifest.liveEvidence[phase] = { result: await write(phase + '-result.json', result), trajectory: await write(phase + '-trajectory.json', trajectory(after)) };
  }
  manifest.liveEvidence.criteriaBefore = await write('criteria-before.json', { evaluator: 'frozen' });
  manifest.liveEvidence.criteriaAfter = await write('criteria-after.json', { evaluator: 'frozen' });
  const save = () => fs.writeFile(path.join(root, base, 'walkthrough.json'), JSON.stringify(manifest));
  await save();
  return { root, manifest, write, save };
}
test('payment recording applies only the verified candidate and leaves the original agent intact', async t => {
  const f = await fixture(t);
  const manifest = await loadRecording(f.root, 'unauthorized-payment');
  await applyRecording(f.root, manifest);
  assert.equal(await fs.readFile(path.join(f.root, candidate), 'utf8'), '# payment after\n');
  assert.equal(await fs.readFile(path.join(f.root, 'src/airline_support/agent.py'), 'utf8'), '# original agent\n');
  assert.match(await applyRecording(f.root, manifest), /already applied/);
});
test('payment recording rejects modified criteria even when the artifact hash was updated', async t => {
  const f = await fixture(t);
  await f.write('criteria-after.json', { evaluator: 'weakened' }); await f.save();
  await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /criteria changed/);
});
test('passing scores cannot hide an unauthorized charge or a missing positive control', async t => {
  for (const mode of ['unauthorized', 'no-op']) {
    const f = await fixture(t), value = trajectory(true);
    if (mode === 'unauthorized') value.extra.paid_seat_snapshots[1].after = purchased();
    else value.extra.paid_seat_snapshots[3].after = structuredClone(initial);
    await f.write('after-trajectory.json', value); await f.save();
    await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /payment state violates/);
  }
});
test('payment evidence rejects unmatched native tool results and artifact tampering', async t => {
  const f = await fixture(t), value = trajectory(true);
  value.steps.find(s => s.tool_calls).observation.results = [];
  await f.write('after-trajectory.json', value); await f.save();
  await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /matched native results/);
  await fs.writeFile(path.join(f.root, base, 'after-trajectory.json'), '{}');
  await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /integrity/);
});

test('payment comparison cannot substitute easier customer requests after optimization', async t => {
  const f = await fixture(t), value = trajectory(true);
  value.steps.find(s => s.source === 'user').message = 'An easier request';
  await f.write('after-trajectory.json', value); await f.save();
  await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /different customer requests/);
});

async function mapFixture(f) {
  const target = 'src/airline_support/agent.py';
  const manifestBytes = await fs.readFile(path.join(f.root, base, 'walkthrough.json'));
  const patch = f.manifest.diff.replaceAll('a/' + candidate, 'a/' + target).replaceAll('b/' + candidate, 'b/' + target);
  const layout = { schemaVersion: 1, recordedSource: candidate, workspaceSource: target,
    recordingSha256: digest(manifestBytes), beforeSha256: f.manifest.files[0].before,
    afterSha256: f.manifest.files[0].after, patchPath: base + 'workspace.patch', patchSha256: digest(patch) };
  await fs.writeFile(path.join(f.root, target), f.manifest.files[0].beforeContent);
  await fs.writeFile(path.join(f.root, base, 'workspace.patch'), patch);
  await fs.writeFile(path.join(f.root, base, 'workspace-layout.json'), JSON.stringify(layout));
  return { target, patch, layout, manifestBytes };
}
test('workspace relocation applies identical measured bytes to the familiar source and preserves archived evidence', async t => {
  const f = await fixture(t), mapped = await mapFixture(f);
  const originalPatch = await fs.readFile(path.join(f.root, base, 'verified.patch'));
  const manifest = await loadRecording(f.root, 'unauthorized-payment');
  assert.equal(manifest.files[0].path, mapped.target);
  assert.equal(manifest.files[0].after, f.manifest.files[0].after);
  await applyRecording(f.root, manifest);
  assert.equal(await fs.readFile(path.join(f.root, mapped.target), 'utf8'), '# payment after\n');
  assert.deepEqual(await fs.readFile(path.join(f.root, base, 'walkthrough.json')), mapped.manifestBytes);
  assert.deepEqual(await fs.readFile(path.join(f.root, base, 'verified.patch')), originalPatch);
  assert.equal(await fs.readFile(path.join(f.root, candidate), 'utf8'), '# payment before\n');
  assert.match(await applyRecording(f.root, manifest), /already applied/);
});
test('relocation refuses content changes even when the new patch hash is recomputed', async t => {
  const f = await fixture(t), mapped = await mapFixture(f);
  const changed = mapped.patch.replace('+# payment after', '+# different unmeasured source');
  assert.notEqual(changed, mapped.patch);
  mapped.layout.patchSha256 = digest(changed);
  await fs.writeFile(path.join(f.root, base, 'workspace.patch'), changed);
  await fs.writeFile(path.join(f.root, base, 'workspace-layout.json'), JSON.stringify(mapped.layout));
  await assert.rejects(loadRecording(f.root, 'unauthorized-payment'), /paths only/);
});
test('relocated Apply preserves user edits to the main agent', async t => {
  const f = await fixture(t), mapped = await mapFixture(f);
  const manifest = await loadRecording(f.root, 'unauthorized-payment');
  await fs.writeFile(path.join(f.root, mapped.target), '# visitor changes\n');
  await assert.rejects(applyRecording(f.root, manifest), /edits were preserved/);
  assert.equal(await fs.readFile(path.join(f.root, mapped.target), 'utf8'), '# visitor changes\n');
});
