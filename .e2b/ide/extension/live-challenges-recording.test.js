const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { load, decorate } = require('./live-challenges-recording');
const root = path.resolve(__dirname, '../../..');

test('opening report requires real diagnostic traces and retains historical payment results', async () => {
  const live = await load(root);
  assert.match(live.text, /SKY123 receives a \$320 refund/);
  const original = { prompts: ['payment', 'test', 'optimize', 'apply'], steps: [{text:'old'}, {text:'measured test'}, {text:'measured fix'}] };
  const result = await decorate(root, original);
  assert.equal(result.steps[1], original.steps[1]);
  assert.equal(result.steps[2], original.steps[2]);
  assert.match(result.steps[0].text, /not scored RELAI test results/);
  assert.equal(result.prompts[0], 'What are the highest-impact risks RELAI identified for this sample agent?');
});

test('altered diagnostic evidence cannot be displayed as a recorded result', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'live-baseline-integrity-'));
  t.after(() => fs.rm(temp, {recursive:true,force:true}));
  const relative='demo/scenarios/live-challenges/recorded';
  await fs.cp(path.join(root,relative),path.join(temp,relative),{recursive:true});
  await fs.appendFile(path.join(temp,relative,'wrong-booking-refund.json'),' ');
  await assert.rejects(load(temp),/integrity check/);
});
