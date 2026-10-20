const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const visible of [false, true]) test(`comparison visibility ${visible} preserves its implementation and state`, async () => {
  const panels = [], comparisons = [], commands = [];
  let open, tabsChanged;
  class Comparison {
    constructor() { this.state = { busy: false, messages: { before: [], after: [] } }; comparisons.push(this); }
    async reset() { this.dir = 'snapshot'; this.resets = (this.resets || 0) + 1; }
    publish() { this.publishes = (this.publishes || 0) + 1; }
    async close() { this.closed = true; }
  }
  const vscode = {
    Uri: { file: value => value }, ViewColumn: { One: 1, Beside: -2 },
    workspace: { registerTextDocumentContentProvider: () => ({}) },
    window: {
      terminals: [], onDidOpenTerminal: () => ({}),
      tabGroups: { all: [{ tabs: [{ label: 'Codex + RELAI' }] }], onDidChangeTabs: fn => { tabsChanged = fn; return { dispose() {} }; } },
      showErrorMessage: message => { throw Error(message); },
      createWebviewPanel: (_type, title) => {
        const dispose = [];
        const panel = { title, onDidDispose: fn => dispose.push(fn), reveal() {},
          dispose() { for (const fn of dispose) fn(); },
          webview: { postMessage() {}, onDidReceiveMessage(fn) { panel.receive = fn; } } };
        panels.push(panel); return panel;
      },
    },
    commands: {
      registerCommand: (_id, fn) => { open = fn; return {}; },
      executeCommand: async (...args) => { commands.push(args);
        if (args[0] === "workbench.action.closeAuxiliaryBar") return new Promise(() => {});
      },
    },
  };
  const context = { subscriptions: [], extensionPath: __dirname, workspaceState: { get: () => 0 } };
  const sandbox = { module: { exports: {} }, require: name => {
    if (name === 'vscode') return vscode;
    if (name === 'node:fs/promises') return { readFile: async (file, encoding) =>
      file === '/home/user/.playground/environment.json' ? '{"PLAYGROUND_ASSISTANT_ENGINE":"codex","PLAYGROUND_SESSION_ID":"offline-test"}' : fs.promises.readFile(file, encoding) };
    if (name === './sample-agent') return { SampleComparison: Comparison };
    if (name === './recorded') return { loadRecording: async () => ({}) };
    if (name === './codex-bridge') return { CodexBridge: class { async restore() {} snapshot() { return {}; } close() {} } };
    if (name === './native-questions') return { InlineQuestions: class { publish() {} close() {} } };
    return require(name.startsWith('./') ? path.join(__dirname, name) : name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'extension.js'), 'utf8').replace('const SHOW_SAMPLE_COMPARISON = false;', `const SHOW_SAMPLE_COMPARISON = ${visible};`), sandbox);
  sandbox.module.exports.activate(context);
  // Let activation finish its file reads; open() reuses its main panel.
  const deadline = Date.now() + 5000;
  while (!panels[0]?.webview.html && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(panels[0]?.webview.html, 'Main panel must initialize');
  const main = panels[0];
  await main.receive({ action: 'load' });
  assert.equal(commands.filter(c => c[0] === 'vscode.setEditorLayout').length, 0);
  if (!visible) {
    await main.receive({ action: 'sample' });
    assert.equal(panels.length, 1, 'Hidden comparison must not open on load or message');
    assert.equal(comparisons.length, 0, 'No live comparison processes initialized');
    return;
  }
  vscode.window.tabGroups.all.push({ tabs: [{ label: 'Try SkyServe' }] });
  tabsChanged();
  tabsChanged();
  await panels[1].receive({ action: 'load' });
  comparisons[0].state.messages.before.push({ role: 'assistant', content: 'Kept reply' });
  assert.equal(commands.filter(c => c[0] === 'vscode.setEditorLayout').length, 1);
  assert.equal(commands.find(c => c[0] === 'vscode.setEditorLayout')[1].groups[1].size, 0.25);
  await panels[1].receive({ action: 'hide' });
  assert.equal(comparisons[0].closed, undefined);
  vscode.window.tabGroups.all.push({ tabs: [{ label: 'User file.py' }] });
  await main.receive({ action: 'sample' });
  await panels[2].receive({ action: 'load' });
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].resets, 1);
  assert.equal(comparisons[0].state.messages.before[0].content, 'Kept reply');
  assert.equal(commands.filter(c => c[0] === 'vscode.setEditorLayout').length, 1);
  main.dispose();
  assert.equal(comparisons[0].closed, true);
  await open();
  await panels[3].receive({ action: 'load' });
  assert.equal(comparisons.length, 2, 'Closing the main workspace must create a fresh comparison on reopening');
});

test('Try live enables chat before Apply and exposes reset after a failed turn', () => {
  const elements = new Map(), handlers = {}, sent = [];
  const element = () => ({ value: '', children: [], setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }, focus() {} });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const html = fs.readFileSync(path.join(__dirname, 'sample-panel.html'), 'utf8');
  const script = html.match(/<script nonce="NONCE">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    acquireVsCodeApi: () => ({ postMessage: message => sent.push(message) }),
    document: { getElementById: get, createElement: element },
    window: { addEventListener: (name, handler) => { handlers[name] = handler; } },
  });
  const state = { exampleId: 'unauthorized-payment', ready: true, hasChanges: false, disabled: false, busy: false, needsReset: false, messages: { before: [], after: [] } };
  handlers.message({ data: { type: 'sample-state', state } });
  get('live-mode').onclick();
  assert.equal(get('live-controls').hidden, false);
  assert.equal(get('sample-prompt').disabled, false);
  assert.match(get('notice').textContent, /both agents currently use the original code/);
  get('sample-prompt').value = 'Quote only'; get('sample-prompt').oninput();
  assert.equal(get('sample-send').disabled, false);
  get('sample-send').onclick();
  assert.equal(sent.at(-1).action, 'send'); assert.equal(sent.at(-1).prompt, 'Quote only');
  handlers.message({ data: { type: 'sample-state', state: { ...state, ready: false, needsReset: true, error: 'Start a new comparison to retry.' } } });
  assert.equal(get('sample-reset').disabled, false);
  get('sample-reset').onclick(); assert.equal(sent.at(-1).action, 'reset');
});
