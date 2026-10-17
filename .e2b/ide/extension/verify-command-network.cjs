// Run inside the Linux playground image. No model/provider credentials needed.
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { commandNetworkConfig, configValue } = require('./codex-network');

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['sandbox', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    const timer = setTimeout(() => child.kill(), 30000);
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
(async () => {
  const server = http.createServer((req, res) => { res.end('gateway-ok'); });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  try {
    const port = server.address().port;
    const python = `import urllib.request,urllib.error,json
results={}
for name,host,direct in [('gateway','127.0.0.1',False),('unrelated','127.0.0.2',False),('bypass','127.0.0.1',True)]:
 try:
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({})) if direct else urllib.request.build_opener()
  with opener.open('http://'+host+':${port}/',timeout=3) as response: results[name]=response.read().decode()
 except Exception as error: results[name]=type(error).__name__
print(json.dumps(results))`;
    const config = { sandbox_mode: 'workspace-write',
      ...commandNetworkConfig({ RELAI_API_BASE: `http://127.0.0.1:${port}/` }) };
    const args = Object.entries(config).flatMap(([key, value]) => ['-c', key + '=' + configValue(value)]);
    const result = await run([...args, '--', 'python3', '-c', python]);
    assert.equal(result.code, 0, result.stderr);
    const outcomes = JSON.parse(result.stdout);
    assert.equal(outcomes.gateway, 'gateway-ok');
    assert.equal(outcomes.unrelated, 'HTTPError', 'Unlisted destinations must be denied');
    assert.notEqual(outcomes.bypass, 'gateway-ok', 'Direct traffic must not bypass the proxy');
    console.log('COMMAND_NETWORK_PASSED', JSON.stringify(outcomes));
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
