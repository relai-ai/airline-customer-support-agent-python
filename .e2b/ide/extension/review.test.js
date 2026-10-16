const test = require("node:test");
const assert = require("node:assert/strict");
const { reviewHtml } = require("./review");
const { digest } = require("./recorded");
function fixture() {
  const before = 'unchanged\nold <script>alert("bad")</script>\nlast\n';
  const after = 'unchanged\nnew & useful\nextra\nlast\n';
  const diff = 'diff --git a/src/airline_support/agent.py b/src/airline_support/agent.py\n--- a/src/airline_support/agent.py\n+++ b/src/airline_support/agent.py\n@@ -1,3 +1,4 @@\n unchanged\n-old <script>alert("bad")</script>\n+new & useful\n+extra\n last\n';
  return { diff, patchSha256: digest(diff), files: [{ path: 'src/airline_support/agent.py', before: digest(before), after: digest(after), beforeContent: before, afterContent: after }] };
}
test("review shows verified before/after sources and highlights changed line numbers without editor workers", () => {
  const html = reviewHtml(fixture(), 'src/airline_support/agent.py');
  assert.match(html, /aria-label="Before"/);
  assert.match(html, /aria-label="After"/);
  assert.match(html, /class="line removed"><span class="number">2<\/span>/);
  assert.match(html, /class="line added"><span class="number">2<\/span>new &amp; useful/);
  assert.match(html, /class="line added"><span class="number">3<\/span>extra/);
  assert.match(html, /class="line"><span class="number">4<\/span>last/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!/<script\b|\bsrc=|\bhref=/.test(html));
  assert.match(html, /default-src 'none'/);
});
test("review rejects tampered sources, patch bytes and files outside the accepted recording", () => {
  const recording = fixture();
  recording.files[0].afterContent = 'invented';
  assert.throws(() => reviewHtml(recording, recording.files[0].path), /do not match/);
  const patch = fixture(); patch.diff += '\n';
  assert.throws(() => reviewHtml(patch, patch.files[0].path), /verified hash/);
  assert.throws(() => reviewHtml(fixture(), '.relai/config.toml'), /not part/);
});
test("added files have an empty baseline and all added lines highlighted", () => {
  const recording = fixture(), name = 'tests/test_agent_instructions.py';
  recording.files = [{ path: name, before: null, beforeContent: '', after: digest('test\n'), afterContent: 'test\n' }];
  recording.diff = `diff --git a/${name} b/${name}\nnew file mode 100644\n--- /dev/null\n+++ b/${name}\n@@ -0,0 +1 @@\n+test\n`;
  recording.patchSha256 = digest(recording.diff);
  const html = reviewHtml(recording, name);
  assert.match(html, /File did not exist/);
  assert.match(html, /class="line added"><span class="number">1<\/span>test/);
});
