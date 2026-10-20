const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('hiding and reopening preserves comparison state and only resizes owned panes', async () => {
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
      executeCommand: async (...args) => { commands.push(args); },
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
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'extension.js'), 'utf8'), sandbox);
  sandbox.module.exports.activate(context);
  // Let activation finish its file reads; open() reuses its main panel.
  const deadline = Date.now() + 5000;
  while (!panels[0]?.webview.html && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(panels[0]?.webview.html, 'Main panel must initialize');
  const main = panels[0];
  await main.receive({ action: 'load' });
  assert.equal(commands.filter(c => c[0] === 'workbench.action.setEditorLayout').length, 0);
  vscode.window.tabGroups.all.push({ tabs: [{ label: 'Try SkyServe' }] });
  tabsChanged();
  tabsChanged();
  await panels[1].receive({ action: 'load' });
  comparisons[0].state.messages.before.push({ role: 'assistant', content: 'Kept reply' });
  assert.equal(commands.filter(c => c[0] === 'workbench.action.setEditorLayout').length, 1);
  assert.equal(commands.find(c => c[0] === 'workbench.action.setEditorLayout')[1].groups[1].size, 0.25);
  await panels[1].receive({ action: 'hide' });
  assert.equal(comparisons[0].closed, undefined);
  vscode.window.tabGroups.all.push({ tabs: [{ label: 'User file.py' }] });
  await main.receive({ action: 'sample' });
  await panels[2].receive({ action: 'load' });
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].resets, 1);
  assert.equal(comparisons[0].state.messages.before[0].content, 'Kept reply');
  assert.equal(commands.filter(c => c[0] === 'workbench.action.setEditorLayout').length, 1);
  main.dispose();
  assert.equal(comparisons[0].closed, true);
  await open();
  await panels[3].receive({ action: 'load' });
  assert.equal(comparisons.length, 2, 'Closing the main workspace must create a fresh comparison on reopening');
});
