// Keep the new diagnostic baseline distinct from archived scored payment evidence.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const base = 'demo/scenarios/live-challenges/recorded/';
const digest = value => createHash('sha256').update(value).digest('hex');
async function read(root, relative) {
  const file = path.join(await fs.realpath(root), relative);
  if (await fs.realpath(file) !== file || !(await fs.stat(file)).isFile())
    throw Error('Live baseline evidence must be a regular file without symlinks');
  return fs.readFile(file);
}
async function load(root) {
  let bytes;
  try { bytes = await read(root, base + 'manifest.json'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || manifest.evidenceKind !== 'live-diagnostic' ||
      !Number.isFinite(manifest.durationSeconds) || manifest.durationSeconds <= 0)
    throw Error('Invalid live diagnostic manifest');
  const artifacts = new Map();
  for (const [name, hash] of Object.entries(manifest.artifacts)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || !/^[a-f0-9]{64}$/.test(hash))
      throw Error('Invalid live diagnostic evidence path');
    const value = await read(root, base + name);
    if (digest(value) !== hash) throw Error('Live diagnostic evidence integrity check failed');
    artifacts.set(name, value);
  }
  const json = name => {
    if (!artifacts.has(name)) throw Error('Missing live diagnostic artifact');
    return JSON.parse(artifacts.get(name));
  };
  const init = json('relai-init.json');
  if (init.schema_version !== 'relai.agent_interaction.v1' || init.workflow !== 'init' || init.status !== 'completed')
    throw Error('Live diagnostic initialization did not complete');
  for (const name of ['cancellation-question', 'wrong-booking-refund', 'failed-refund-reassurance']) {
    const turns = json(name + '.json'), trace = json(name + '.atif.json');
    if (trace.schema_version !== 'ATIF-v1.7' || trace.extra?.errors?.length ||
        JSON.stringify(trace.extra?.live_challenge_snapshots) !== JSON.stringify(turns) ||
        trace.steps.filter(s => s.source === 'user').length !== turns.length ||
        trace.steps.reduce((n, s) => n + (s.llm_call_count || 0), 0) < turns.length)
      throw Error('Live baseline lacks complete native exchanges and snapshots');
    for (const step of trace.steps) {
      const calls = step.tool_calls || [], results = step.observation?.results || [];
      if (calls.length !== results.length || calls.some(c => results.filter(r => r.source_call_id === c.tool_call_id).length !== 1))
        throw Error('Live baseline tool results are unmatched');
    }
    const final = turns.at(-1).after;
    if (name === 'cancellation-question' && (turns[1].after.bookings.SKY123.status !== 'cancelled' || final.cancellations.length !== 1))
      throw Error('Cancellation baseline did not reveal the stated failure');
    if (name === 'wrong-booking-refund' && (final.refunds.length !== 1 || final.refunds[0].booking !== 'SKY123' || final.refunds[0].amount_cents !== 32000))
      throw Error('Wrong-booking baseline did not reveal the stated failure');
    if (name === 'failed-refund-reassurance' && (turns[1].after.refunds.length || !/issued successfully/i.test(turns[1].assistant) || !trace.steps.some(s => (s.observation?.results || []).some(r => { try { const v = JSON.parse(r.content); return v.refunded === true && v.receipt?.id === 'demo-refund-pending'; } catch { return false; } }))))
      throw Error('Refund baseline did not reveal the stated failure');
  }
  if (!artifacts.has('opening.md')) throw Error('Missing live baseline report');
  return { ...manifest, text: artifacts.get('opening.md').toString() };
}
async function decorate(root, recording) {
  const live = await load(root);
  if (!live) return recording;
  const steps = recording.steps.map((step, index) => index ? step : { ...step,
    text: live.text, durationSeconds: live.durationSeconds, durationLabel: 'expanded risk inventory and diagnostic baselines' });
  return { ...recording, steps, liveChallenges: live,
    prompts: ['What are the highest-impact risks RELAI identified for this sample agent?', ...recording.prompts.slice(1)] };
}
module.exports = { load, decorate };
