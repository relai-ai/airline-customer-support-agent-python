const { test } = require("node:test");
const assert = require("node:assert/strict");
const { workflowView, shouldPrefill } = require("./workflow");
test("handoff advances only from persisted assistant completion and passes honest baselines to verification", () => {
  assert.equal(workflowView({}).step, "prepare");
  assert.equal(workflowView({ step: "evaluate" }).step, "evaluate");
  assert.equal(
    workflowView({ step: "evaluate", nextStep: "optimize" }).step,
    "optimize",
  );
  assert.equal(
    workflowView({ step: "evaluate", nextStep: "verify" }).step,
    "verify",
  );
  assert.equal(
    workflowView({ step: "verify", nextStep: "compare" }).step,
    "compare",
  );
  assert.equal(workflowView({ nextStep: "complete" }).prompt, "");
});
test("polling and step transitions preserve edited and unsent drafts", () => {
  assert.equal(shouldPrefill("My follow-up question", "Old suggestion"), false);
  assert.equal(shouldPrefill("Old suggestion", "Old suggestion"), true);
  assert.equal(shouldPrefill("", "Old suggestion"), true);
});
test("packaged webview script compiles after helper injection", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const html = fs
    .readFileSync(path.join(__dirname, "panel.html"), "utf8")
    .replace(
      "WORKFLOW_HELPERS",
      fs.readFileSync(path.join(__dirname, "workflow.js"), "utf8"),
    );
  const script = html.match(/<script nonce="NONCE">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
});
test("short editable requests cover real evaluation and verified retry, without a report prompt", () => {
  const { workflowSteps } = require("./workflow");
  assert.ok(workflowSteps.prepare.prompt.includes("check this behavior"));
  assert.ok(workflowSteps.evaluate.prompt.includes("Run the RELAI test"));
  assert.ok(workflowSteps.verify.prompt.includes("If verified, apply it here"));
  assert.ok(Object.values(workflowSteps).every((s) => s.prompt.length < 220));
});

test("live output follows new lines and completed output retains its reading position", () => {
  const { restoreOutputScroll } = require("./workflow");
  const output = { scrollTop: 0, scrollHeight: 900 };
  restoreOutputScroll(output, 120, true);
  assert.equal(output.scrollTop, 900);
  output.scrollHeight = 1200;
  restoreOutputScroll(output, 900, true);
  assert.equal(output.scrollTop, 1200);
  restoreOutputScroll(output, 120, false);
  assert.equal(output.scrollTop, 120);
});

test("guided prompts stay fixed until all saved steps finish, then live requests are explicit", () => {
  const fs = require("node:fs"),
    vm = require("node:vm"),
    path = require("node:path");
  const sent = [], savedStates = [],
    handlers = {};
  class Element {
    constructor(tag = "div") {
      this.tag = tag;
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.value = "";
      this.textContent = "";
      this.scrollHeight = 100;
      this.scrollTop = 0;
      this.clientHeight = 100;
      this.dataset = {};
      this.style = {};
      this.offsetWidth = 340;
      this.offsetHeight = 200;
      this.className = "";
    }
    append(...items) {
      this.children.push(...items);
    }
    prepend(...items) {
      this.children.unshift(...items);
    }
    replaceChildren(...items) {
      this.children = items;
    }
    querySelectorAll() {
      return [];
    }
    getBoundingClientRect() { return { left: 24, top: 500 }; }
    focus() {}
    scrollIntoView(options) { this.scrolledIntoView = options.block; }
    setAttribute(name, value) {
      this[name] = value;
    }
    click() {
      this.onclick?.();
    }
  }
  const elements = new Map();
  const doc = {
    addEventListener: () => {},
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
    querySelectorAll: () => [],
  };
  const html = fs
    .readFileSync(path.join(__dirname, "panel.html"), "utf8")
    .replace(
      "WORKFLOW_HELPERS",
      fs.readFileSync(path.join(__dirname, "workflow.js"), "utf8"),
    );
  const context = {
    document: doc,
    innerWidth: 800, innerHeight: 900,
    window: {
      addEventListener: (event, fn) => {
        handlers[event] = fn;
      },
    },
    acquireVsCodeApi: () => ({
      getState: () => ({ sessionId: "same-session", live: true, draft: "Edited saved prompt" }),
      setState: value => savedStates.push(value),
      postMessage: (value) => sent.push(value),
    }),
    setTimeout: () => 1,
    clearTimeout: () => {},
  };
  vm.runInNewContext(
    html.match(/<script nonce="NONCE">([\s\S]*?)<\/script>/)[1],
    context,
  );
  assert.equal(elements.get("quick-tour").hidden, false);
  assert.match(elements.get("tour-count").textContent, /1 OF 4/);
  elements.get("tour-next").click();
  assert.match(elements.get("tour-title").textContent, /coding agent/);
  assert.equal(elements.get("tour-location").textContent, "Conversation · center pane");
  elements.get("tour-back").click();
  assert.match(elements.get("tour-count").textContent, /1 OF 4/);
  elements.get("tour-next").click();
  elements.get("tour-next").click();
  assert.match(elements.get("tour-count").textContent, /3 OF 4/);
  assert.equal(elements.get("tour-next").disabled, true);
  elements.get("tour-next").click();
  assert.match(elements.get("tour-count").textContent, /3 OF 4/, "Cannot skip the three recorded results");
  assert.ok(sent.every(message => message.action === "load"));
  const flatten = (n) => [n, ...n.children.flatMap(flatten)];
  const formatted = flatten(
    context.formatted(
      "A test defines:\n- **Input:** a request\n- **Environment:** tools\n- **Evaluators:** `judge`\n\n<script>alert(1)</script>",
    ),
  );
  assert.equal(formatted.filter((n) => n.tag === "li").length, 3);
  assert.deepEqual(
    formatted.filter((n) => n.tag === "strong").map((n) => n.textContent),
    ["Input:", "Environment:", "Evaluators:"],
  );
  assert.equal(formatted.find((n) => n.tag === "code").textContent, "judge");
  assert.equal(
    formatted.some((n) => n.tag === "script"),
    false,
  );
  assert.ok(
    formatted.some((n) => n.textContent === "<script>alert(1)</script>"),
  );
  const { prompts } = require("./recorded");
  const recording = {
    verificationStatus: "verified",
    prompts: [prompts[0], "Use RELAI to build a multi-turn test for the highest-impact risk u found", "Use relai to fix the failures the test found", prompts[3]],
    steps: prompts
      .slice(0, 3)
      .map(() => ({ text: "Real evidence", durationSeconds: 60 })),
    turns: [
      { user: "First traveler", agent: "First answer" },
      { user: "Second traveler", agent: "Second answer" },
    ],
    comparison: {
      before: "baseline",
      after: "verified",
      regressions: "passed",
    },
    diff: "patch",
  };
  recording.initialization = { durationSeconds: 191.949 };
  recording.provenance = { orchestrator: "Codex", totalRollouts: 0 };
  recording.riskInventory = { risks: [{ id: "risk-one" }] };
  const exactRiskReply = "## Risks\n| Risk | Priority |\n| --- | --- |\n| Redaction | 63 |\n\n## Evidence\n[Receipt](/saved/receipt.json)\n\nNo baseline or risk-validation test has run during this walkthrough.\n\n## Suggested next steps\n1. Build a targeted test.";
  recording.steps[0] = { text: exactRiskReply, durationSeconds: 1, exactResponse: { path: "saved.json" } };
  handlers.message({
    data: { type: "loaded", recording, recordedProgress: 0, sessionId: "same-session" },
  });
  assert.equal(elements.get("mode").hidden, false);
  assert.match(elements.get("mode").textContent, /Recorded walkthrough/);
  assert.equal(elements.get("next-steps").hidden, true);
  assert.equal(elements.get("next-steps").children.length, 0);
  assert.equal(elements.get("prompt").value, prompts[0]);
  assert.equal(elements.get("prompt").readOnly, true);
  assert.equal(elements.get("run-notice").textContent, "These prompts replay saved Codex + RELAI responses. No live model calls are made.");
  elements.get("prompt").value = "Attempt to bypass the guided demo";
  elements.get("prompt").oninput();
  assert.equal(elements.get("prompt").value, prompts[0]);
  elements.get("prompt").value = "Attempt a custom send without an input event";
  elements.get("send").click();
  assert.equal(sent.at(-1).action, "recorded");
  assert.equal(sent.at(-1).step, 0);
  handlers.message({ data: { type: "recorded", recordedProgress: 1 } });
  assert.equal(elements.get("mode").textContent, "Recorded walkthrough · 3 steps to live mode");
  assert.equal(elements.get("next-steps").hidden, true);
  assert.equal(elements.get("next-steps").children.length, 0);
  assert.equal(elements.get("history").children[0].scrolledIntoView, "start");
  const riskNodes = flatten(elements.get("history"));
  assert.equal(riskNodes.filter(n => n.tag === "table").length, 1);
  assert.equal(riskNodes.filter(n => n.tag === "small" && n.textContent === "Codex + RELAI").length, 0);
  assert.ok(riskNodes.some(n => n.textContent === "Recorded result · Codex + RELAI · initialization: 3m 11.9s"));
  assert.ok(riskNodes.some(n => n.textContent === "Suggested next steps"));
  assert.ok(riskNodes.some(n => n.textContent === "Open saved wiki results ↗"));
  assert.ok(!riskNodes.some(n => /No baseline or risk-validation|^Evidence$/.test(n.textContent)));
  assert.equal(recording.steps[0].text, exactRiskReply);
  assert.equal(elements.get("prompt").value, "Use RELAI to build a multi-turn test for the highest-impact risk you found.");
  elements.get("send").click();
  assert.equal(sent.at(-1).action, "recorded");
  assert.equal(sent.at(-1).step, 1);
  assert.equal(recording.prompts[1], "Use RELAI to build a multi-turn test for the highest-impact risk u found");
  handlers.message({ data: { type: "recorded", recordedProgress: 2 } });
  assert.equal(elements.get("next-steps").hidden, true);
  assert.equal(elements.get("next-steps").children.length, 0);
  assert.equal(elements.get("prompt").value, "Use RELAI to fix the failures the test found.");
  assert.equal(elements.get("history").children[2].scrolledIntoView, "start");
  assert.equal(elements.get("tour-next").disabled, true, "Two completed results must not unlock step 4");
  assert.match(elements.get("tour-next").textContent, /2 of 3 results/);
  elements.get("tour-next").click();
  assert.match(elements.get("tour-count").textContent, /3 OF 4/);
  flatten(elements.get("history"))
    .find((n) => n.textContent === "▸ Explore the simulation")
    .click();
  assert.ok(
    flatten(elements.get("history")).some(
      (n) => n.textContent === "EXCHANGE 1 OF 2",
    ),
  );
  flatten(elements.get("history"))
    .find((n) => n.textContent === "Next exchange →")
    .click();
  assert.ok(
    flatten(elements.get("history")).some(
      (n) => n.textContent === "EXCHANGE 2 OF 2",
    ),
  );
  assert.equal(
    flatten(elements.get("history")).find(
      (n) => n.textContent === "Next exchange →",
    ).disabled,
    true,
  );
  recording.steps[1].exactResponse = { path: "saved-second.json" };
  handlers.message({ data: { type: "loaded", recording, recordedProgress: 2 } });
  assert.ok(!flatten(elements.get("history")).some(n => n.textContent === "▸ Explore the simulation"));
  assert.ok(flatten(elements.get("history")).some(n => n.textContent === "Recorded result · Codex + RELAI · validation: 1m 0.0s"));
  assert.equal(elements.get("prompt").readOnly, true);
  elements.get("send").click();
  assert.equal(sent.at(-1).step, 2);
  assert.equal(elements.get("tour-next").disabled, true, "Sending is not the same as receiving the result");
  handlers.message({ data: { type: "error", message: "Recorded result failed to load" } });
  assert.equal(elements.get("tour-next").disabled, true, "A failed replay must not unlock step 4");
  elements.get("send").click();
  handlers.message({ data: { type: "recorded", recordedProgress: 3 } });
  assert.equal(elements.get("tour-next").disabled, false);
  assert.equal(elements.get("tour-next").textContent, "Results ready · continue");
  assert.match(elements.get("tour-count").textContent, /3 OF 4/, "Keep the results visible until the user continues");
  elements.get("tour-next").click();
  assert.match(elements.get("tour-count").textContent, /4 OF 4/);
  elements.get("tour-next").click();
  assert.equal(elements.get("quick-tour").hidden, true);
  assert.equal(savedStates.at(-1).tourComplete, true);
  elements.get("open-tour").click();
  assert.equal(elements.get("quick-tour").hidden, false);
  elements.get("tour-skip").click();
  assert.equal(elements.get("quick-tour").hidden, true);
  assert.equal(elements.get("mode").textContent, "Recorded walkthrough · 1 step to live mode");
  assert.match(elements.get("run-notice").textContent, /Apply the recorded changes/);
  assert.equal(elements.get("prompt").readOnly, true);
  assert.equal(elements.get("next-steps").hidden, true);
  elements.get("send").click();
  assert.equal(sent.at(-1).action, "recorded");
  assert.equal(sent.at(-1).step, 3);
  assert.equal(elements.get("prompt").readOnly, true, "Apply must complete before live input unlocks");
  handlers.message({ data: { type: "recorded", recordedProgress: 4 } });
  assert.equal(elements.get("prompt").readOnly, false);
  assert.equal(elements.get("run-notice").className, "live");
  assert.equal(elements.get("mode").textContent, "Live mode · write your own prompt");
  assert.equal(elements.get("run-notice").textContent, "Live mode: write your own request. Sending starts a real Codex run in this workspace.");
  const beforeSuggestions = sent.length;
  for (const [label, expected] of [
    ["Create a test for your scenario", /proposal-only suggestion generation first.*wait for my explicit approval before accepting, building or running/],
    ["Investigate another risk", /highest-impact risk/],
    ["Run another optimization", /scope and a 30-total-rollout budget first/],
    ["Optimize for cost", /Compare cost and quality before and after/],
  ]) {
    flatten(elements.get("next-steps")).find(n => n.textContent === label).click();
    assert.match(elements.get("prompt").value, expected);
    assert.equal(elements.get("prompt").readOnly, false);
    assert.equal(sent.length, beforeSuggestions, "Suggestions must wait for the user's send");
  }
  elements.get("prompt").value = "My own question";
  elements.get("prompt").oninput();
  assert.equal(elements.get("send")["aria-label"], "Start live run");
  const previousCount = sent.length;
  elements.get("prompt").onkeydown({ key: "Enter", shiftKey: true, preventDefault() {} });
  assert.equal(sent.length, previousCount);
  elements.get("prompt").onkeydown({ key: "Enter", shiftKey: false, isComposing: false, preventDefault() {} });
  assert.equal(sent.at(-1).action, "send");
  assert.equal(sent.at(-1).prompt, "My own question");
  assert.equal(elements.get("prompt").value, "");
  assert.ok(flatten(elements.get("history")).some((n) => n.className === "spinner"));
  assert.equal(flatten(elements.get("history")).filter((n) => n.tag === "span" && n.textContent === "My own question").length, 1);
  assert.equal(elements.get("send")["aria-label"], "Stop");
  assert.equal(elements.get("send")["data-busy"], "true");
  handlers.message({ data: { type: "question", question: {
    id: "runtime-question", header: "Test review", question: "Build this proposal?", index: 1, total: 1,
    options: [{ label: "build", description: "Only this proposal" }], isOther: true,
  } } });
  assert.equal(elements.get("question-card").hidden, false);
  assert.ok(flatten(elements.get("history")).some(n => n.textContent.includes("Waiting for your review")));
  assert.equal(flatten(elements.get("history")).some(n => n.className === "spinner"), false);
  const input = flatten(elements.get("question-card")).find(n => n.tag === "textarea");
  input.value = "Keep the control turn"; input.oninput();
  handlers.message({ data: { type: "state", investigation: { pendingTurn: true, messages: [] } } });
  assert.equal(input.value, "Keep the control turn", "Polling must preserve unsent answers");
  const choice = flatten(elements.get("question-card")).find(n => n.textContent === "build");
  choice.click();
  assert.equal(sent.at(-1).action, "answer-question");
  assert.equal(sent.at(-1).id, "runtime-question");
  assert.equal(sent.at(-1).kind, "choice");
  assert.equal(sent.at(-1).value, "build");
  for (const selected of ["Approve scoped criteria", "Do not approve"]) {
    handlers.message({ data: { type: "question", question: {
      id: "scope-" + selected, header: "Scope Review", question: "Approve scoped criteria?", index: 1, total: 1,
      options: [{ label: "Approve scoped criteria", description: "Approve" }, { label: "Do not approve", description: "Decline" }],
    } } });
    flatten(elements.get("question-card")).find(n => n.textContent === selected).click();
    assert.equal(sent.at(-1).id, "scope-" + selected);
    assert.equal(sent.at(-1).value, selected);
  }
  handlers.message({ data: { type: "question", question: null } });
  assert.equal(elements.get("question-card").hidden, true);
  handlers.message({ data: { type: "state", investigation: { messages: [], jobs: [] } } });
  elements.get("prompt").value = "My next draft";
  elements.get("prompt").oninput();
  handlers.message({ data: { type: "error", message: "Runtime unavailable" } });
  assert.equal(elements.get("status").textContent, "Runtime unavailable");
  assert.equal(elements.get("prompt").value, "My next draft");
  assert.equal(flatten(elements.get("history")).filter((n) => n.className === "spinner").length, 0);
  const oldMessages = [{ role: "user", content: "My own question" }, { role: "assistant", content: "Old answer" }];
  handlers.message({ data: { type: "state", investigation: { messages: oldMessages, jobs: [] } } });
  elements.get("prompt").value = "My own question";
  elements.get("prompt").oninput();
  elements.get("send").click();
  handlers.message({ data: { type: "state", investigation: { messages: oldMessages, jobs: [] } } });
  assert.equal(elements.get("send")["aria-label"], "Stop");
  elements.get("prompt").value = "Keep this draft";
  elements.get("prompt").oninput();
  const acceptedMessages = [...oldMessages, { role: "user", content: "My own question" }];
  handlers.message({ data: { type: "state", investigation: { messages: acceptedMessages, pendingTurn: {}, jobs: [] } } });
  assert.equal(elements.get("prompt").value, "Keep this draft");
  assert.equal(flatten(elements.get("history")).filter((n) => n.tag === "span" && n.textContent === "My own question").length, 2);
  handlers.message({ data: { type: "state", investigation: { messages: [...acceptedMessages, { role: "assistant", content: "New answer" }], jobs: [] } } });
  assert.equal(flatten(elements.get("history")).filter((n) => n.className === "spinner").length, 0);
  assert.equal(elements.get("send")["data-busy"], "false");
  handlers.message({
    data: { type: "loaded", recording, recordedProgress: 3 },
  });
  flatten(elements.get("history")).find((n) => n.textContent === "Review code changes ↗").click();
  assert.equal(sent.at(-1).action, "changes");
  assert.equal(sent.at(-1).recorded, true);
  elements.get("send").click();
  assert.equal(sent.at(-1).action, "recorded");
  assert.equal(sent.at(-1).step, 3);
  assert.equal(elements.get("next-steps").hidden, true);
  assert.equal(elements.get("next-steps").children.length, 0, "Submitting Apply must not reveal suggestions before it succeeds");
  assert.ok(!flatten(elements.get("history")).some(n => n.className === "next-steps"));
  recording.evidenceKind = "deterministic-recorder";
  recording.fixedExample = { user: "Synthetic input", agent: "Fixture answer" };
  handlers.message({ data: { type: "loaded", recording, recordedProgress: 3 } });
  handlers.message({ data: { type: "recorded", recordedProgress: 4 } });
  flatten(elements.get("history")).find(n => n.textContent === "Review code changes ↗").click();
  assert.equal(sent.at(-1).action, "changes");
  assert.equal(sent.at(-1).recorded, true);
  assert.ok(!flatten(elements.get("history")).some(n => n.textContent === "Fixture answer"));
  assert.ok(flatten(elements.get("history")).some(n => n.textContent.includes("confirmation is generated by the playground")));
  assert.equal(elements.get("next-steps").hidden, false);
  assert.ok(!flatten(elements.get("history")).some(n => n.className === "next-steps"));
  const suggestions = flatten(elements.get("next-steps")).find(n => n.className === "next-steps");
  const choices = flatten(suggestions).filter(n => n.tag === "button");
  assert.equal(choices.length, 4);
  assert.ok(!flatten(suggestions).some(n => n.textContent.startsWith("Choose a suggestion")));
  const sentCount = sent.length;
  for (const choice of choices) {
    choice.click();
    assert.ok(elements.get("prompt").value.startsWith("Use RELAI to "));
    assert.equal(sent.length, sentCount, "Choosing a suggestion must not send it");
  }
  assert.match(elements.get("prompt").value, /Review the current optimization scope/);
  elements.get("prompt").value = "Use RELAI to reduce cost for my booking scenario.";
  elements.get("send").click();
  assert.equal(sent.at(-1).action, "send");
  assert.equal(sent.at(-1).prompt, "Use RELAI to reduce cost for my booking scenario.");
  assert.equal(sent.at(-1).runWorkflow, true);
});

test("command failures are human-readable and JSON-escaped logs become normal text", () => {
  const { commandResultView } = require("./workflow");
  const result = commandResultView({ status: "error", content: JSON.stringify({ status: "failed", exitCode: 1, output: "Optimizer\nPOST /api/v1/backend-agent/optimizer/review-anchor/ failed with HTTP 503 after 3 attempts" }) });
  assert.match(result.summary, /unavailable during optimization review/);
  assert.ok(!result.summary.includes('"status"'));
  assert.ok(result.details.includes("Optimizer\nPOST"));
  assert.ok(!result.details.includes('\\nPOST'));
  assert.match(commandResultView({ status: "error", content: { exitCode: 1, output: "HTTP 413 Payload Too Large" } }).summary, /payload limit/);
  assert.match(commandResultView({ status: "error", content: { timedOut: true, output: "waiting" } }).summary, /timed out/);
  assert.match(commandResultView({ status: "success", content: "Comparison recorded." }).summary, /Comparison recorded/);
});

test("recorded Markdown tables render score columns without interpreting output as HTML", () => {
  const fs = require("node:fs"), vm = require("node:vm");
  const html = fs.readFileSync(require("node:path").join(__dirname, "panel.html"), "utf8");
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; }
    append(...children) { this.children.push(...children); }
  }
  const context = { document: { createElement: tag => new Element(tag) } };
  vm.createContext(context);
  const functions = html.slice(html.indexOf("      function node(tag"), html.indexOf("      function message(role"));
  vm.runInContext(functions, context);
  const root = context.formatted("| Check | Before | After |\n| --- | --- | --- |\n| **Allowances** | 0.0 | 1.0 |\n| <script>bad()</script> | 0 | 1 |");
  const table = root.children[0].children[0];
  assert.equal(table.tagName, "TABLE");
  assert.equal(table.children[0].children[0].children.length, 3);
  assert.equal(table.children[1].children.length, 2);
  const literal = table.children[1].children[1].children[0].children[0];
  assert.equal(literal.tagName, "SPAN");
  assert.equal(literal.textContent, "<script>bad()</script>");
  const messages = [];
  context.recording = { savedLinks: { "/saved/result.json": "demo/recorded/after-result.json" } };
  context.post = (...args) => messages.push(args);
  const links = context.formatted("[Result](/saved/result.json) [Untrusted](https://example.com/collect)");
  const p = links.children[0];
  const action = p.children.find(n => n.tagName === "BUTTON");
  assert.equal(action.textContent, "Result ↗");
  action.onclick();
  assert.equal(messages[0][0], "artifact");
  assert.equal(messages[0][1].file, "demo/recorded/after-result.json");
  assert.equal(p.children.filter(n => n.tagName === "BUTTON").length, 1);
  const fenced = context.formatted("````text\n```json\n{\"password\":\"synthetic\"}\n```\n````");
  assert.equal(fenced.children[0].tagName, "PRE");
  assert.equal(fenced.children[0].textContent, '```json\n{"password":"synthetic"}\n```');
});

test("recorded presets use complete sentences without changing historical captures", () => {
  const { recordedPromptText, workflowSteps } = require("./workflow");
  const { prompts } = require("./recorded");
  assert.equal(recordedPromptText(prompts[3]), "These changes look great. Apply them.");
  for (const prompt of [...prompts.map(recordedPromptText), ...Object.values(workflowSteps).map(step => step.prompt)]) {
    assert.match(prompt, /[.?!]$/);
    assert.doesNotMatch(prompt, /\bu found\b|Use relai/);
  }
  assert.equal(recordedPromptText("My edited request"), "My edited request");
});

test("live recorded replies keep readable measured tables and original native text", () => {
  const { recordedReplyText } = require('./workflow');
  const fs = require('node:fs'), path = require('node:path');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../demo/recorded/walkthrough.json')));
  const original = manifest.steps[1].text;
  const reply = recordedReplyText(1, original, manifest.turns, false);
  assert.match(reply, /\| Turn \| User’s challenge \| Agent’s response \|/);
  assert.match(reply, /\| 14 \|/);
  assert.doesNotMatch(reply, /scripted SDK|## Validity checks|## Artifacts and export/);
  assert.match(reply, /Suggested next steps/);
  assert.doesNotMatch(reply, /Full recorded conversation and tools|Scores and evaluator feedback|Frozen package hashes/);
  assert.match(original, /Full recorded conversation and tools/);
  assert.equal(manifest.steps[1].text, original);
  const fixed = recordedReplyText(2, manifest.steps[2].text);
  assert.match(fixed, /Original baseline \| Independent after/);
  assert.match(fixed, /0\.7917.*1\.0000/);
  assert.doesNotMatch(fixed, /0\.667|scripted SDK/);
  assert.doesNotMatch(fixed, /Full conversation and observed tools|Scores and feedback|View code changes|separate Apply step|application receipt/);
  assert.match(manifest.steps[2].text, /View code changes/);
  const applied = recordedReplyText(3, manifest.applyMessage);
  assert.doesNotMatch(applied, /Application receipt/);
  assert.match(applied, /Applied the exact accepted change/);
  assert.match(manifest.applyMessage, /Application receipt/);
  const mixed = 'Recovery remains 0.67; final comparison 0.792 → 0.667.';
  assert.equal(recordedReplyText(2, mixed), mixed);
  assert.match(fixed, /Suggested next steps/);
  assert.doesNotMatch(recordedReplyText(0, manifest.steps[0].text), /^Public evidence:/m);
});

test("recorded durations match reply precision and patch labels stay readable", () => {
  const { recordedDuration, recordedReplyText } = require('./workflow');
  assert.equal(recordedDuration(185.80121062509716), '3m 5.8s');
  assert.equal(recordedDuration(59.96), '1m 0.0s');
  assert.equal(recordedDuration(24), '24.0s');
  const original = '[Combined patch](/saved/combined.patch)';
  assert.equal(recordedReplyText(2, original), '[View code changes](/saved/combined.patch)');
  assert.equal(original, '[Combined patch](/saved/combined.patch)');
});
