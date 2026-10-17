// Verify actual app-server startup and installed skills without starting a model turn.
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const child = spawn('codex', ['app-server', '--listen', 'stdio://',
  '-c', 'features.default_mode_request_user_input=true'], {
  cwd: '/home/user/airline',
  stdio: ['pipe', 'pipe', 'pipe'],
});
const pending = new Map();
let nextId = 1;
let stderr = '';
child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1800); });
function fail(error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}
child.on('error', fail);
child.on('exit', () => fail(Error('Codex app-server exited before replying')));
readline.createInterface({ input: child.stdout }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
const timer = setTimeout(() => {
  fail(Error('Codex setup probe timed out'));
  child.kill();
}, 45000);
async function verify() {
  try {
    const initialized = await rpc('initialize', {
      clientInfo: { name: 'relai_setup_probe', version: '1.0' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    console.log('Real Codex app-server initialized:', initialized.userAgent);
    const { config } = await rpc('config/read', {});
    if (config.features?.default_mode_request_user_input !== true)
      throw Error('Native questions are disabled in Codex app-server');
    console.log('Native user questions enabled');
    const result = await rpc('skills/list', {
      cwds: ['/home/user/airline'], forceReload: true,
    });
    const skills = (result.data || []).flatMap(entry => entry.skills || []);
    for (const name of [
      'relai:relai-cli', 'relai:relai-agent-test', 'relai:relai-simulate',
      'relai:relai-optimize', 'relai:relai-wiki',
    ]) {
      if (!skills.some(skill => skill.name === name))
        throw Error('Missing required skill: ' + name);
    }
    if ((result.data || []).some(entry => entry.errors?.length))
      throw Error('Codex reported skill discovery errors');
    console.log('RELAI skills:', skills.filter(skill => skill.name.startsWith('relai:')).map(skill => skill.name).join(', '));
    console.log('CODEX_SETUP_PASSED_NO_MODEL_CALLS');
  } catch (error) {
    console.error(error.message);
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    child.kill();
  }
}
verify();
