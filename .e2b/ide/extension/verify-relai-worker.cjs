// Real Linux Codex + Docker proof, using a deterministic fake RELAI CLI. No
// model calls, credentials, registry pulls, or host Docker socket mounts.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { startRelaiWorker } = require('./relai-worker');
const { commandNetworkConfig, configValue } = require('./codex-network');
const { CodexBridge } = require('./codex-bridge');

function sandbox(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['sandbox', ...args], { cwd: '/home/user/airline',
      env: { PATH: process.env.PATH, HOME: '/home/user', USER: 'user', LANG: 'C.UTF-8',
        DOCKER_CONFIG: '/tmp/playground-docker-config', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
(async () => {
  // Exercise the exact web-dialog runtime startup, without submitting a turn.
  await fs.mkdir('/home/user/.playground', { recursive: true, mode: 0o700 });
  const bridge = new CodexBridge({ RELAI_API_BASE: 'https://gateway.invalid/runtime/',
    RELAI_SESSION_MODEL: 'openai/gpt-5.4', RELAI_TEAM_API_KEY: 'fixture-not-a-real-key' }, '/home/user/airline', () => {});
  bridge.file = '/tmp/relai-worker-startup-proof.json';
  const startupTimer = setTimeout(() => { bridge.close(); }, 45000);
  try {
    await bridge.start();
    const { config } = await bridge.rpc('config/read', {});
    assert.equal(config.features.network_proxy.domains['127.0.0.1'], 'allow');
    assert.equal(config.features.default_mode_request_user_input, true);
    assert.equal((await fetch(bridge.worker.url + '/run', { method: 'POST' })).status, 401);
    console.log('RELAI_WORKER_STARTUP_PASSED: real dialog bridge and Codex app-server initialized; no turn submitted');
  } finally {
    clearTimeout(startupTimer); bridge.close(); await fs.rm(bridge.file, { force: true });
  }
  let daemon;
  try { execFileSync('docker', ['info'], { stdio: 'ignore' }); }
  catch {
    daemon = spawn('sudo', ['dockerd', '--storage-driver=vfs'], { stdio: 'ignore' });
    const deadline = Date.now() + 20000;
    while (true) {
      try { execFileSync('docker', ['info'], { stdio: 'ignore' }); break; }
      catch { if (Date.now() > deadline) throw Error('Fixture Docker daemon did not start'); }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  const dir = await fs.mkdtemp('/tmp/relai-worker-proof-');
  let worker;
  let cancellationWorker;
  try {
    // Construct a tiny executable verifier image entirely from local files.
    const libraries = execFileSync('ldd', ['/bin/echo'], { encoding: 'utf8' }).match(/\/[^\s()]+/g) || [];
    for (const file of ['/bin/echo', ...libraries]) {
      const dest = path.join(dir, 'rootfs', file);
      await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.copyFile(file, dest);
    }
    await fs.writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch\nCOPY rootfs/ /\nCMD ["/bin/echo", "worker-verifier-ok"]\n');
    const fixture = path.join(dir, 'cli.cjs');
    await fs.writeFile(fixture, `const {execFileSync}=require('node:child_process');
const tag=process.env.WORKER_PROOF_TAG;
try { execFileSync('docker',['build','--network=none','-q','-t',tag,process.env.WORKER_PROOF_CONTEXT],{stdio:'pipe'});
const output=execFileSync('docker',['run','--rm','--network=none',tag],{encoding:'utf8'});
process.stdout.write(JSON.stringify({schema_version:'relai.agent_interaction.v1',status:'completed',verifier:output.trim()})+'\\n');
}finally{execFileSync('docker',['image','rm','-f',tag],{stdio:'ignore'});}`);
    const env = { RELAI_API_BASE: 'https://gateway.invalid/runtime/', WORKER_PROOF_CONTEXT: dir,
      WORKER_PROOF_TAG: 'relai-worker-proof:' + path.basename(dir) };
    worker = await startRelaiWorker(env, { cli: process.execPath, prefix: [fixture] });
    const config = { sandbox_mode: 'workspace-write', ...commandNetworkConfig(env, worker.url) };
    const args = Object.entries(config).flatMap(([k, v]) => ['-c', k + '=' + configValue(v)]);
    const direct = await sandbox([...args, '--', 'docker', 'info']);
    assert.notEqual(direct.code, 0, 'Direct Docker access must remain sandboxed');
    assert.match(direct.stderr, /permission denied|operation not permitted/i);
    const result = await sandbox([...args, '--', 'python3', '/opt/playground/relai-hosted.py',
      'test', 'create', '--agent-interaction'], { RELAI_WORKER_URL: worker.url, RELAI_WORKER_TOKEN: worker.token });
    assert.equal(result.code, 0, result.stderr);
    const outcome = JSON.parse(result.stdout);
    assert.equal(outcome.verifier, 'worker-verifier-ok');
    // A detached fake RELAI background worker must not survive a client Stop.
    const background = path.join(dir, 'detached.cjs');
    const heartbeat = path.join(dir, 'heartbeat');
    await fs.writeFile(background, `const {spawn}=require('node:child_process');
spawn(process.execPath,['-e',${JSON.stringify(`setInterval(()=>require('fs').appendFileSync(${JSON.stringify(heartbeat)},'x'),40)`)}],{detached:true,stdio:'ignore'}).unref();
console.log('started'); setInterval(()=>{},100);`);
    cancellationWorker = await startRelaiWorker({}, { cli: process.execPath, prefix: [background] });
    const response = await fetch(cancellationWorker.url + '/run', { method: 'POST', headers: {
      Authorization: 'Bearer ' + cancellationWorker.token, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ argv: ['test', 'create', '--agent-interaction'] }) });
    const reader = response.body.getReader(); await reader.read();
    await new Promise(resolve => setTimeout(resolve, 250));
    assert((await fs.readFile(heartbeat)).length > 0);
    await reader.cancel();
    await new Promise(resolve => setTimeout(resolve, 3500));
    const stopped = (await fs.readFile(heartbeat)).length;
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal((await fs.readFile(heartbeat)).length, stopped, 'Detached RELAI worker survived cancellation');
    console.log('RELAI_WORKER_PASSED: sandboxed client -> typed worker -> Docker build and isolated verifier; direct Docker stays denied');
    console.log('RELAI_WORKER_CANCELLATION_PASSED: detached child stops with its job namespace');
  } finally {
    worker?.close(); cancellationWorker?.close(); await fs.rm(dir, { recursive: true, force: true });
    daemon?.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
