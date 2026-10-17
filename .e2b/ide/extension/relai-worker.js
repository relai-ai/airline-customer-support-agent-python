// Trusted executor inside the disposable E2B guest, outside Codex's command
// sandbox. Only typed RELAI workflows are accepted; never a shell or Docker API.
const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { spawn } = require('node:child_process');

function workflowAllowed(argv) {
  if (!Array.isArray(argv) || !argv.length || argv.length > 256 ||
      argv.some(a => typeof a !== 'string' || a.includes('\0')) ||
      argv.some(a => ['--help', '-h', '--version', '-V'].includes(a))) return false;
  if (argv[0] === 'runs' && argv[1] === 'wait') return true;
  return argv.includes('--agent-interaction') && (
    (argv[0] === 'test' && ['create', 'discover'].includes(argv[1])) ||
    ['simulate', 'optimize', 'init', 'ingest', 'wiki', 'evaluator', 'benchmark'].includes(argv[0])
  );
}

async function startRelaiWorker(env, options = {}) {
  const token = randomBytes(32).toString('hex');
  const cli = options.cli || '/opt/playground/relai-real';
  const cwd = options.cwd || '/home/user/airline';
  const timeoutMs = options.timeoutMs || 3600000;
  const prefix = options.prefix || [];
  let active;
  let closing = false;
  const connections = new Set();
  const server = http.createServer(async (req, res) => {
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + token);
    if (req.headers.origin || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.writeHead(401).end(); return;
    }
    if (req.method !== 'POST' || req.url !== '/run') { res.writeHead(404).end(); return; }
    if (closing || active) { res.writeHead(409).end('A RELAI workflow is already active.'); return; }
    // Reserve before reading: concurrent requests cannot launch duplicate jobs.
    const job = {};
    active = job;
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const { argv } = JSON.parse(Buffer.concat(chunks).toString());
      if (!workflowAllowed(argv)) { res.writeHead(400).end('Unsupported RELAI workflow.'); return; }
      if (closing || req.aborted) return;
      // Do not inherit provider keys or worker credentials. The worker receives
      // the same provisioned session-scoped environment as Codex's adapter.
      const childEnv = {
        PATH: process.env.PATH, HOME: '/home/user', USER: 'user', LANG: 'C.UTF-8',
        ...env, RELAI_DISABLE_TELEMETRY: '1', DOCKER_CONFIG: '/tmp/playground-docker-config',
      };
      delete childEnv.RELAI_WORKER_URL;
      delete childEnv.RELAI_WORKER_TOKEN;
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' });
      // RELAI can start detached workers. A process group alone cannot contain
      // those: killing the namespace supervisor also reaps detached descendants.
      // This namespace retains the guest's filesystem/network/Docker authority;
      // it is lifecycle containment, not Codex's restrictive command sandbox.
      const isolated = options.isolate !== false;
      const child = spawn(isolated ? 'bwrap' : cli, isolated
        ? ['--die-with-parent', '--unshare-pid', '--dev-bind', '/', '/', '--proc', '/proc', '--', cli, ...prefix, ...argv]
        : [...prefix, ...argv], {
        cwd, env: childEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let killTimer;
      const cancel = () => {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        killTimer ||= setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 3000);
        killTimer.unref();
      };
      job.cancel = cancel;
      const deadline = setTimeout(cancel, timeoutMs);
      deadline.unref();
      res.on('close', cancel);
      const emit = value => {
        if (!res.destroyed && !res.write(JSON.stringify(value) + '\n')) {
          child.stdout.pause(); child.stderr.pause();
        }
      };
      res.on('drain', () => { child.stdout.resume(); child.stderr.resume(); });
      for (const stream of ['stdout', 'stderr']) child[stream].on('data', data => {
        emit({ stream, data: data.toString('base64') });
      });
      child.on('error', () => emit({ stream: 'stderr', data: Buffer.from('RELAI worker could not start the CLI.\n').toString('base64') }));
      await new Promise(resolve => child.once('close', (code, signal) => {
        clearTimeout(deadline);
        res.removeListener('close', cancel);
        emit({ exitCode: code ?? (signal ? 130 : 1) });
        res.end(); resolve();
      }));
    } catch {
      if (!res.headersSent) res.writeHead(400);
      res.end();
    } finally {
      if (active === job) active = undefined;
    }
  });
  // A paused/long-running workflow is bounded by its CLI deadline, this ceiling,
  // and the provider's unchanged session expiry, rather than Node's request timer.
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}`, token,
    close() {
      closing = true;
      active?.cancel?.();
      server.close();
      for (const socket of connections) socket.destroy();
    },
  };
}
module.exports = { startRelaiWorker, workflowAllowed };
