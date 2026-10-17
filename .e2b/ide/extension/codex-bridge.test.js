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
  await bridge.approve("codex-approval-7", false);
  assert.deepEqual(replies[0], { id: 7, result: { decision: "decline" } });
  assert.equal(bridge.snapshot().messages.at(-1).result.status, "denied");
  await assert.rejects(
    bridge.approve("codex-approval-7", true),
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
  assert.equal(JSON.stringify(bridge.state).includes("build"), false);
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
