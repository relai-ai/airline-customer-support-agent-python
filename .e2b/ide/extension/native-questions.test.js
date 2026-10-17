const test = require("node:test");
const assert = require("node:assert/strict");
const { askUser } = require("./native-questions");

function fixture({ pick, input } = {}) {
  const calls = [], tokens = [];
  class CancellationTokenSource {
    constructor() { this.token = { isCancellationRequested: false }; tokens.push(this); }
    cancel() { this.token.isCancellationRequested = true; }
    dispose() { this.disposed = true; }
  }
  const vscode = { CancellationTokenSource, window: {
    showQuickPick: async (items, options, token) => {
      calls.push({ items, options, token });
      return pick?.(items);
    },
    showInputBox: async (options, token) => {
      calls.push({ options, token });
      return input?.();
    },
  } };
  return { vscode, calls, tokens };
}
const question = { id: "retry", header: "Retry", question: "Retry the saved discovery?",
  options: [ { label: "retry", description: "Continue from saved progress" },
    { label: "cancel", description: "Keep it paused" } ], isOther: true };

test("native choice returns the exact selected label under the original question id", async () => {
  const { vscode, calls, tokens } = fixture({ pick: (items) => items[1] });
  const result = await askUser(vscode, [question], new AbortController().signal);
  assert.deepEqual(result.retry, { answers: ["cancel"] });
  assert.equal(calls[0].options.placeHolder, question.question);
  assert.equal(calls[0].items[0].description, question.options[0].description);
  assert.equal(tokens[0].disposed, true);
});
test("custom feedback and text questions preserve actual user text", async () => {
  const { vscode } = fixture({ pick: (items) => items.at(-1), input: () => "Revise the criteria first" });
  const result = await askUser(vscode, [question, { id: "criteria", question: "What should change?" }], new AbortController().signal);
  assert.deepEqual(result.retry, { answers: ["Revise the criteria first"] });
  assert.deepEqual(result.criteria, { answers: ["Revise the criteria first"] });
});
test("Escape skips the question without selecting or approving a default", async () => {
  const { vscode, calls } = fixture();
  const result = await askUser(vscode, [question, { id: "later", question: "Continue?" }], new AbortController().signal);
  assert.deepEqual(result.retry, { answers: [] });
  assert.equal(Object.hasOwn(result, "later"), false);
  assert.equal(calls.length, 1);
});
test("aborting the turn dismisses the native prompt and submits no answer", async () => {
  const controller = new AbortController();
  const { vscode, tokens } = fixture({ pick: () => { controller.abort(); } });
  const result = await askUser(vscode, [question], controller.signal);
  assert.equal(tokens[0].token.isCancellationRequested, true);
  assert.deepEqual(Object.keys(result), []);
});
test("credential questions are refused before showing a prompt", async () => {
  const { vscode, calls } = fixture();
  await assert.rejects(askUser(vscode, [{ ...question, isSecret: true }], new AbortController().signal), /terminal/);
  assert.equal(calls.length, 0);
});
