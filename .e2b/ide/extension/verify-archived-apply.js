// Exercise the old recording without replacing the current workspace agent.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const recorded = require('./recorded');
async function verify(root) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'booking-recording-archive-'));
  try {
    await fs.cp(path.join(root, 'demo/recorded'), path.join(temp, 'demo/recorded'), { recursive: true });
    await fs.mkdir(path.join(temp, 'src/airline_support'), { recursive: true });
    await fs.mkdir(path.join(temp, 'tests'), { recursive: true });
    const manifest = await recorded.loadRecording(temp, 'booking');
    for (const file of manifest.files) {
      if (file.before === null) continue;
      const target = path.join(temp, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.beforeContent);
    }
    await exec('git', ['init', '-q'], { cwd: temp });
    console.log(await recorded.applyRecording(temp, manifest));
    for (const file of manifest.files) {
      if (recorded.digest(await fs.readFile(path.join(temp, file.path))) !== file.after)
        throw Error('Archived booking Apply differs from its accepted source');
    }
    console.log('Preserved booking recording applies cleanly in its archive checkout.');
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
if (require.main === module) verify(process.argv[2] || process.cwd()).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { verify };
