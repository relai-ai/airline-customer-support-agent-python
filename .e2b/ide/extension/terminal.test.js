const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('activation disposes existing and newly opened IDE terminals', async () => {
  const disposed = [], subscriptions = [];
  let onOpen;
  const terminal = name => ({ dispose: () => disposed.push(name) });
  const vscode = {
    window: {
      terminals: [terminal('restored')],
      onDidOpenTerminal: handler => { onOpen = handler; return { dispose() {} }; },
      createWebviewPanel: () => { throw Error('No UI in this test'); },
      showErrorMessage: () => {},
    },
    workspace: { registerTextDocumentContentProvider: () => ({ dispose() {} }) },
    commands: { registerCommand: () => ({ dispose() {} }) },
    ViewColumn: { One: 1 },
  };
  const sandbox = {
    module: { exports: {} },
    require: name => name === 'vscode' ? vscode : require(name.startsWith('./') ? path.join(__dirname, name) : name),
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, 'extension.js'), 'utf8'), sandbox);
  sandbox.module.exports.activate({ subscriptions });
  assert.deepEqual(disposed, ['restored']);
  onOpen(terminal('keyboard shortcut'));
  onOpen(terminal('menu'));
  assert.deepEqual(disposed, ['restored', 'keyboard shortcut', 'menu']);
  assert.ok(subscriptions.length >= 2);
});
