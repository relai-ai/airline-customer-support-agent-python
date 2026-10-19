const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const recorded = require('./recorded');

async function sources(root) {
  const files = new Map();
  async function walk(dir, prefix = '') {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      if (item.name === '__pycache__') continue;
      if (item.isSymbolicLink()) throw Error('Sample source snapshots cannot contain symlinks.');
      const name = path.join(prefix, item.name);
      if (item.isDirectory()) await walk(path.join(dir, item.name), name);
      else if (item.name.endsWith('.py')) files.set(name, await fs.readFile(path.join(dir, item.name)));
    }
  }
  await walk(path.join(root, 'src'));
  return files;
}
function fingerprint(files) {
  const hash = crypto.createHash('sha256');
  for (const [name, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update('\0').update(data).update('\0');
  return hash.digest('hex');
}
function exchanges(trajectory) {
  const turns = [];
  for (const step of trajectory.steps || []) {
    if (step.source === 'user') turns.push({ user: step.message, agent: '' });
    else if (step.source === 'agent' && !step.tool_calls?.length && turns.length) turns.at(-1).agent = step.message;
  }
  return turns;
}
async function recordedExample(root, manifest) {
  if (!manifest.liveEvidence) return null;
  const result = {};
  for (const phase of ['before', 'after']) {
    const data = await recorded.artifactContent(root, manifest, manifest.liveEvidence[phase].trajectory);
    const turns = exchanges(JSON.parse(data));
    const turn = turns[manifest.baselineExample?.turnIndex ?? 1];
    if (!turn?.agent || !turn.user) throw Error('Recorded comparison is unavailable.');
    result[phase] = turn;
  }
  return result;
}
function runTurn({ root, source, env, request, signal }) {
  return new Promise((resolve, reject) => {
    // Do not inherit host/provider keys. Only the existing scoped guest session is used.
    const childEnv = { PATH: process.env.PATH, HOME: '/home/user', USER: 'user', LANG: 'C.UTF-8',
      PYTHONPATH: source, PYTHONDONTWRITEBYTECODE: '1', AIRLINE_MODEL_PROVIDER: 'relai',
      RELAI_API_BASE: env.RELAI_API_BASE, RELAI_TEAM_API_KEY: env.RELAI_TEAM_API_KEY,
      RELAI_SESSION_MODEL: env.RELAI_SESSION_MODEL };
    const child = spawn(path.join(root, '.venv/bin/python'), [path.join(__dirname, 'sample-runner.py')],
      { cwd: root, env: childEnv, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', failure, force, stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      failure = Error('Comparison stopped. Start a new comparison before retrying.');
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 2000);
    };
    const timer = setTimeout(stop, 390000);
    signal.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', bytes => { output += bytes; if (output.length > 1024 * 1024) stop(); });
    child.stderr.on('data', () => {}); // Never forward provider diagnostics/credentials to the UI.
    child.on('error', error => { failure = error; });
    child.on('close', code => {
      clearTimeout(timer); clearTimeout(force); signal.removeEventListener('abort', stop);
      if (failure || code !== 0) return reject(Error(failure ? failure.message : 'Sample agent could not respond. Check session model access and start a new comparison.'));
      try {
        const value = JSON.parse(output);
        if (typeof value.reply !== 'string' || !value.bookings || Array.isArray(value.bookings)) throw Error();
        resolve(value);
      } catch { reject(Error('Sample agent returned an unreadable result. Start a new comparison.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(request));
    if (signal.aborted) stop();
  });
}
class SampleComparison {
  constructor(root, env, manifest, changed = () => {}, execute = runTurn) {
    Object.assign(this, { root, env, manifest, changed, execute });
    this.state = { busy: false, ready: false, disabled: env.PLAYGROUND_SAMPLE_LIVE_DISABLED === '1', messages: { before: [], after: [] }, error: '', needsReset: false };
  }
  snapshot() { return structuredClone(this.state); }
  publish() { if (!this.closed) this.changed(this.snapshot()); }
  async reset() {
    if (this.closed) throw Error('This comparison is closed.');
    if (this.state.busy) throw Error('Stop the current comparison first.');
    this.state.busy = true; this.state.ready = false; this.state.needsReset = true; this.publish();
    this.resetting = (async () => {
    if (this.dir) await fs.rm(this.dir, { recursive: true, force: true });
    const current = await sources(this.root), original = new Map(current);
    for (const file of this.manifest.files) if (file.path.startsWith('src/')) {
      const content = recorded.reviewFile(this.manifest, file.path);
      if (file.before === null) original.delete(file.path.slice(4));
      else original.set(file.path.slice(4), Buffer.from(content.before));
    }
    this.dir = await fs.mkdtemp(path.join(os.tmpdir(), 'relai-sample-comparison-'));
    for (const [lane, files] of [['before', original], ['after', current]]) for (const [name, data] of files) {
      const target = path.join(this.dir, lane, name);
      await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, data);
    }
    this.version = fingerprint(current);
    this.bookings = { before: undefined, after: undefined };
    this.state = { ...this.state, ready: fingerprint(original) !== this.version,
      messages: { before: [], after: [] }, error: '', needsReset: false, example: await recordedExample(this.root, this.manifest) };
    })();
    try { await this.resetting; } finally { this.resetting = null; this.state.busy = false; this.publish(); }
  }
  async send(prompt) {
    if (this.closed || this.state.busy) return;
    if (this.state.disabled) throw Error('Live comparisons are disabled in this local preview. The recorded example is available.');
    if (this.state.needsReset) throw Error('Start a new comparison before sending another request.');
    if (!this.state.ready) throw Error('Apply the walkthrough changes before comparing the original and current agent.');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw Error('Enter a message of at most 4,000 characters.');
    if (fingerprint(await sources(this.root)) !== this.version) throw Error('Agent source changed. Start a new comparison to use the latest workspace.');
    if (Object.values(this.state.messages).some(history => JSON.stringify(history).length > 100000)) throw Error('This conversation is long. Start a new comparison.');
    this.state.busy = true; this.state.error = ''; this.abort = new AbortController(); this.publish();
    const pending = Promise.allSettled(['before', 'after'].map(async lane => {
      const history = this.state.messages[lane];
      const value = await this.execute({ root: this.root, source: path.join(this.dir, lane), env: this.env,
        request: { prompt: prompt.trim(), history: structuredClone(history), bookings: this.bookings[lane] }, signal: this.abort.signal });
      return { lane, value };
    }));
    this.pending = pending;
    try {
      const results = await pending;
      if (this.abort.signal.aborted || results.some(r => r.status === 'rejected')) {
        this.state.ready = false; this.state.needsReset = true;
        throw Error('The comparison did not finish for both agents. No partial turn was kept. Start a new comparison to retry.');
      }
      for (const result of results) {
        const { lane, value } = result.value;
        this.state.messages[lane].push({ role: 'user', content: prompt.trim() }, { role: 'assistant', content: value.reply });
        this.bookings[lane] = value.bookings;
      }
    } catch (error) { this.state.error = error.message; }
    finally { this.state.busy = false; this.pending = null; this.publish(); }
  }
  stop() { this.abort?.abort(); }
  async close() { this.closed = true; this.stop(); await this.pending; await this.resetting?.catch(() => {}); if (this.dir) await fs.rm(this.dir, { recursive: true, force: true }); }
}
module.exports = { SampleComparison, recordedExample, exchanges, fingerprint, runTurn };
