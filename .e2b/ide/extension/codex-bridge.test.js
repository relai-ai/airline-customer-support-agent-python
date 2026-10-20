const test = require("node:test");
const assert = require("node:assert/strict");
const { CodexBridge } = require("./codex-bridge");
function fixture() {
  const updates = [];
  const bridge = new CodexBridge({}, "/tmp", (state) => updates.push(state));
  bridge.restore = async () => {};
  bridge.save = async () => {};
  return { bridge, updates };
}
test("submission publishes the prompt and pending state before runtime startup; Stop cancels startup", async () => {
  const { bridge, updates } = fixture();
  let finish;
  bridge.start = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  bridge.rpc = async () =>
    assert.fail("Cancelled startup must not start a turn");
  const sending = bridge.send("Inspect this repository");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updates[0].pendingTurn, true);
  assert.equal(updates[0].messages[0].content, "Inspect this repository");
  await bridge.stop();
  finish();
  await sending;
  assert.equal(bridge.snapshot().pendingTurn, false);
});
test("Stop during turn acknowledgement interrupts once the turn is known", async () => {
  const { bridge } = fixture();
  bridge.start = async () => {};
  const calls = [];
  let acknowledge;
  bridge.rpc = (method, params) => {
    calls.push({ method, params });
    return method === "turn/start"
      ? new Promise((resolve) => {
          acknowledge = resolve;
        })
      : Promise.resolve({});
  };
  const sending = bridge.send("Inspect this repository");
  await new Promise((resolve) => setImmediate(resolve));
  await bridge.stop();
  acknowledge({ turn: { id: "turn-1" } });
  await sending;
  assert.equal(calls[1].method, "turn/interrupt");
  assert.equal(calls[1].params.turnId, "turn-1");
  bridge.receive({
    method: "turn/completed",
    params: { turn: { id: "turn-1", status: "interrupted" } },
  });
  assert.equal(bridge.snapshot().pendingTurn, false);
});

test("approval decline and file-change receipts are real app-server events", async () => {
  const { bridge } = fixture();
  const replies = [];
  bridge.child = { stdin: { write: (line) => replies.push(JSON.parse(line)) } };
  bridge.receive({
    id: 7,
    method: "item/commandExecution/requestApproval",
    params: { command: "go test ./..." },
  });
  const approvalId = bridge.snapshot().messages.at(-1).tool_calls[0].id;
  await bridge.approve(approvalId, false);
  assert.deepEqual(replies[0], { id: 7, result: { decision: "decline" } });
  assert.equal(bridge.snapshot().messages.at(-1).result.status, "denied");
  await assert.rejects(
    bridge.approve(approvalId, true),
    /no longer pending/,
  );
  bridge.receive({
    method: "item/completed",
    params: {
      item: { type: "fileChange", changes: [{ path: "airline/tools.go" }] },
    },
  });
  assert.deepEqual(bridge.snapshot().changedFiles, ["airline/tools.go"]);
});

test("restored approval receipts cannot hide a new runtime's reused RPC id", async () => {
  const { bridge: original } = fixture();
  original.child = { stdin: { write() {} } };
  original.receive({ id: 1, method: "item/commandExecution/requestApproval",
    params: { command: "relai runs list" } });
  const oldId = original.snapshot().messages.at(-1).tool_calls[0].id;
  await original.approve(oldId, true);

  const { bridge: restarted } = fixture();
  restarted.state.messages = original.snapshot().messages;
  const replies = [];
  restarted.child = { stdin: { write: line => replies.push(JSON.parse(line)) } };
  restarted.receive({ id: 1, method: "item/commandExecution/requestApproval",
    params: { command: "docker info" } });
  const currentId = restarted.snapshot().messages.at(-1).tool_calls[0].id;
  assert.notEqual(currentId, oldId);
  assert.equal(restarted.snapshot().messages.some(m => m.result?.call_id === currentId), false);
  await assert.rejects(restarted.approve(oldId, true), /no longer pending/);
  await restarted.approve(currentId, false);
  assert.deepEqual(replies, [{ id: 1, result: { decision: "decline" } }]);
});

function questionFixture(handler) {
  const bridge = new CodexBridge({}, "/tmp", () => {}, handler);
  bridge.save = async () => {};
  const replies = [];
  bridge.child = { stdin: { write: (line) => replies.push(JSON.parse(line)) } };
  const event = { id: 41, method: "item/tool/requestUserInput", params: {
    threadId: "thread-1", turnId: "turn-1", itemId: "item-1", isBlocking: true,
    questions: [{ id: "review", header: "Review", question: "Build the proposed test?" }],
  } };
  return { bridge, replies, event };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test("concurrent saves retain the latest receipt and restore it atomically", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "codex-receipt-"));
  try {
    const bridge = new CodexBridge({}, directory, () => {});
    bridge.file = path.join(directory, "history.json");
    bridge.state.messages = [{ content: "older" }];
    const older = bridge.save();
    bridge.state.messages.push({ content: "Review selection — Review: Approve", reviewSelection: { selections: [{ answers: ["Approve"] }] } });
    const newer = bridge.save();
    await Promise.all([older, newer]);
    const restored = new CodexBridge({}, directory, () => {});
    restored.file = bridge.file;
    await restored.restore();
    assert.deepEqual(restored.state.messages.at(-1).reviewSelection.selections[0].answers, ["Approve"]);
    assert.deepEqual(await fs.readdir(directory), ["history.json"]);
    assert.equal((await fs.stat(bridge.file)).mode & 0o777, 0o600);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("user input stays pending until an actual answer and returns on the original RPC id", async () => {
  let answer;
  const { bridge, replies, event } = questionFixture(() => new Promise((resolve) => { answer = resolve; }));
  bridge.receive(event);
  await flush();
  assert.equal(replies.length, 0);
  answer({ review: { answers: ["build"] } });
  await flush();
  assert.deepEqual(replies, [{ id: 41, result: { answers: { review: { answers: ["build"] } } } }]);
  assert.equal(bridge.userInputs.size, 0);
  assert.equal(bridge.state.messages.at(-1).reviewSelection.selections[0].answers[0], "build");
  assert.match(bridge.state.messages.at(-1).content, /Review selection.*build/);
});

test("opposite review choices survive a failed turn without inversion or implicit decline", async () => {
  for (const selected of ["Approve scoped criteria", "Do not approve"]) {
    const { bridge, replies, event } = questionFixture(async () => ({ review: { answers: [selected] } }));
    bridge.receive(event);
    await flush();
    bridge.receive({ method: "turn/completed", params: { turn: { status: "failed", error: { message: "HTTP 429" } } } });
    assert.deepEqual(replies[0].result.answers.review.answers, [selected]);
    assert.deepEqual(bridge.state.messages.find(m => m.reviewSelection).reviewSelection.selections[0].answers, [selected]);
    assert.equal(replies.length, 1);
  }
});

test("an unsaved selection is not sent to Codex as approval or decline", async () => {
  const { bridge, replies, event } = questionFixture(async () => ({ review: { answers: ["Approve"] } }));
  bridge.save = async () => { throw Error("disk full"); };
  bridge.receive(event);
  await flush();
  assert.equal(replies[0].error.code, -32603);
  assert.equal(replies[0].result, undefined);
  assert.match(bridge.state.messages.at(-1).content, /No answer was submitted/);
});

test("budget rejection displays the gateway reason instead of a generic retry-limit error", () => {
  const { bridge } = fixture();
  bridge.provider = { takeFailure: () => ({ code: "playground_budget_exceeded", message: "Insufficient remaining budget." }) };
  bridge.receive({ method: "turn/completed", params: { turn: { status: "failed", error: { message: "exceeded retry limit" } } } });
  assert.match(bridge.state.messages.at(-1).content, /Insufficient remaining budget/);
  assert.match(bridge.state.messages.at(-1).content, /review selections are preserved/);
});
test("server resolution and turn completion cancel stale prompts without sending their later answers", async () => {
  for (const ending of [
    { method: "serverRequest/resolved", params: { threadId: "thread-1", requestId: 41 } },
    { method: "turn/completed", params: { turn: { id: "turn-1", status: "completed" } } },
  ]) {
    let answer, signal;
    const { bridge, replies, event } = questionFixture((_, s) => {
      signal = s;
      return new Promise((resolve) => { answer = resolve; });
    });
    bridge.receive(event);
    await flush();
    bridge.receive(ending);
    assert.equal(signal.aborted, true);
    answer({ review: { answers: ["build"] } });
    await flush();
    assert.equal(replies.length, 0);
  }
});
test("Stop cancels a pending question even before the turn id arrives", async () => {
  let signal;
  const { bridge, event } = questionFixture((_, s) => { signal = s; return new Promise(() => {}); });
  bridge.receive(event);
  await flush();
  await bridge.stop();
  assert.equal(signal.aborted, true);
});
test("question UI failure returns a protocol error instead of granting approval", async () => {
  const { bridge, replies, event } = questionFixture(async () => { throw Error("UI unavailable"); });
  bridge.receive(event);
  await flush();
  assert.equal(replies[0].id, 41);
  assert.equal(replies[0].error.code, -32603);
  assert.equal(replies[0].result, undefined);
});

function completedReceiptEvent(overrides = {}) {
  const session = 'optimizer-123-example';
  return { method: 'item/completed', params: { turnId: 'current-turn', item: {
    type: 'commandExecution', status: 'completed', exitCode: 0,
    command: 'relai runs wait run-1', aggregatedOutput: JSON.stringify({
      schema_version: 'relai.agent_interaction.v1', status: 'completed', workflow: 'optimize',
      session_id: session, result_path: `.relai/.internal/runs/optimizer/${session}/optimizer-result.json`,
      summary: { items: [ {label:'Status',value:'accepted'}, {label:'Accepted changes',value:'1'},
        {label:'Final evaluation',value:'score 0.00 → 0.50'},
        {label:'Report summary',value:'Unverified patch-writer narrative must not replace measured results.'} ] },
    }), ...overrides,
  } } };
}
function budgetFailure(bridge) {
  bridge.provider = { takeFailure: () => ({code:'playground_budget_exceeded',message:'Insufficient remaining budget.'}) };
  bridge.receive({method:'turn/completed',params:{turn:{status:'failed',error:{message:'retry limit'}}}});
  return bridge.state.messages.at(-1).content;
}
test('a budget-limited chat preserves a completed optimizer receipt from this turn without another model call', () => {
  const {bridge}=fixture(); bridge.state.pendingTurn=true; bridge.turn='current-turn';
  bridge.receive(completedReceiptEvent());
  const result=budgetFailure(bridge);
  assert.match(result,/RELAI completed the optimization/);
  assert.match(result,/score 0.00 → 0.50/);
  assert.match(result,/chat could not add a final explanation/);
  assert.match(result,/review selections are preserved/);
  assert.doesNotMatch(result,/Unverified patch-writer/);
  assert.equal(bridge.state.pendingTurn,false);
});
test('progress, failed commands and unrelated output cannot become a successful optimizer receipt', () => {
  for(const change of [
    {exitCode:1}, {status:'failed'}, {command:'cat old-report.json'},
    {aggregatedOutput:JSON.stringify({schema_version:'relai.agent_interaction.v1',workflow:'optimize',status:'running'})},
    {aggregatedOutput:'malformed JSON'},
  ]) {
    const {bridge}=fixture();bridge.state.pendingTurn=true;bridge.turn='current-turn';
    bridge.receive(completedReceiptEvent(change));
    assert.doesNotMatch(budgetFailure(bridge),/RELAI completed/);
  }
});
test('old-turn receipts and invalid report paths are never reused after a budget rejection', () => {
  for(const mode of ['old-turn','new-turn','bad-path']) {
    const {bridge}=fixture();bridge.state.pendingTurn=true;bridge.turn='current-turn';
    const event=completedReceiptEvent();
    if(mode==='old-turn') event.params.turnId='old-turn';
    if(mode==='bad-path') {const value=JSON.parse(event.params.item.aggregatedOutput);value.result_path='/private/secrets';event.params.item.aggregatedOutput=JSON.stringify(value);}
    bridge.receive(event);
    if(mode==='new-turn') bridge.receive({method:'turn/started',params:{turn:{id:'next-turn'}}});
    assert.doesNotMatch(budgetFailure(bridge),/RELAI completed/);
  }
});
