const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { startRelaiWorker } = require('./relai-worker');

async function fixture(t, source) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'relai-worker-test-'));
  const script = path.join(dir, 'cli.js');
  await fs.writeFile(script, source);
  const worker = await startRelaiWorker({}, { cli: process.execPath, prefix: [script], cwd: dir, timeoutMs: 10000, isolate: false });
  t.after(async () => { worker.close(); await fs.rm(dir, { recursive: true, force: true }); });
  return { worker, dir };
}
const argv = ['test', 'discover', '--agent-interaction'];
function run(worker, args = argv) {
  return fetch(worker.url + '/run', { method: 'POST', headers: {
    Authorization: 'Bearer ' + worker.token, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ argv: args }) });
}

test('only authenticated typed RELAI invocations run; arguments never become shell commands', async t => {
  const { worker } = await fixture(t, `console.log(JSON.stringify(process.argv.slice(2)));`);
  assert.equal((await fetch(worker.url + '/run', { method: 'POST' })).status, 401);
  for (const args of [['bash', '-c', 'touch /tmp/bad'], ['test', 'discover'], ['--help'], ['runs']])
    assert.equal((await run(worker, args)).status, 400);
  const args = [...argv, '--prompt', 'literal; $(touch /tmp/not-a-shell)'];
  const response = await run(worker, args);
  const events = (await response.text()).trim().split('\n').map(JSON.parse);
  const output = events.filter(e => e.stream === 'stdout').map(e => Buffer.from(e.data, 'base64').toString()).join('');
  assert.deepEqual(JSON.parse(output), args);
  assert.equal(events.at(-1).exitCode, 0);
});

test('canonical test suggestion and update workflows reach the CLI', async t => {
  const { worker } = await fixture(t, `console.log(JSON.stringify(process.argv.slice(2)));`);
  for (const command of [
    ['test', 'suggestion', 'generate', '--count', '1'],
    ['test', 'suggestion', 'review'],
    ['test', 'suggestion', 'accept', 'fixture-id'],
    ['test', 'suggestion', 'reject', 'fixture-id'],
    ['test', 'update', 'fixture-id'],
  ]) {
    const args = [...command, '--agent-interaction'];
    const response = await run(worker, args);
    assert.equal(response.status, 200, command.join(' '));
    const events = (await response.text()).trim().split('\n').map(JSON.parse);
    const output = events.filter(e => e.stream === 'stdout').map(e => Buffer.from(e.data, 'base64').toString()).join('');
    assert.deepEqual(JSON.parse(output), args);
    assert.equal(events.at(-1).exitCode, 0);
  }
  for (const command of [['test', 'suggestion', 'clear-memory'], ['test', 'suggestion', 'unknown']])
    assert.equal((await run(worker, [...command, '--agent-interaction'])).status, 400);
});

test('Python wrapper preserves CLI protocol, stderr, review exit status and input without a model', async t => {
  const response = { schema_version: 'relai.agent_interaction.v1', status: 'action_required', request: { kind: 'choice' } };
  const { worker } = await fixture(t, `process.stdout.write(${JSON.stringify(JSON.stringify(response) + '\n')}); process.stderr.write('progress ✓\\n'); process.exitCode=3;`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn('python3', [path.resolve(__dirname, '../relai_hosted.py'), ...argv], {
      env: { PATH: process.env.PATH, RELAI_WORKER_URL: worker.url, RELAI_WORKER_TOKEN: worker.token },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
  assert.equal(result.code, 3);
  assert.deepEqual(JSON.parse(result.stdout), response);
  assert.equal(result.stderr, 'progress ✓\n');
});

test('disconnect cancels the workflow and rejects concurrent invocations', async t => {
  const { worker, dir } = await fixture(t, `require('fs').writeFileSync('started', String(process.pid)); console.log('started'); process.on('SIGTERM',()=>{require('fs').writeFileSync('cancelled','yes'); process.exit(0)}); setInterval(()=>{},100);`);
  const response = await run(worker);
  const reader = response.body.getReader();
  await reader.read();
  assert.equal((await run(worker)).status, 409);
  await reader.cancel();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await fs.readFile(path.join(dir, 'cancelled'), 'utf8').catch(() => '') === 'yes') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('The disconnected workflow was not cancelled');
});

test('Python wrapper reports HTTP rejection without exposing the worker credential', async t => {
  const { worker } = await fixture(t, `console.log('must-not-run');`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn('python3', [path.resolve(__dirname, '../relai_hosted.py'),
      'test', 'suggestion', 'clear-memory', '--agent-interaction'], {
      env: { PATH: process.env.PATH, RELAI_WORKER_URL: worker.url, RELAI_WORKER_TOKEN: worker.token },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /request rejected \(HTTP 400\)/);
  assert.doesNotMatch(result.stderr, /worker unavailable|must-not-run/);
  assert(!result.stderr.includes(worker.token));
});

test('worker does not forward its credential or ambient provider keys to the CLI', async t => {
  const { worker } = await fixture(t, `console.log(JSON.stringify({worker:!!process.env.RELAI_WORKER_TOKEN,openai:!!process.env.OPENAI_API_KEY,anthropic:!!process.env.ANTHROPIC_API_KEY}));`);
  const events = (await (await run(worker)).text()).trim().split('\n').map(JSON.parse);
  const output = events.filter(e => e.stream === 'stdout').map(e => Buffer.from(e.data, 'base64').toString()).join('');
  assert.deepEqual(JSON.parse(output), { worker: false, openai: false, anthropic: false });
});
