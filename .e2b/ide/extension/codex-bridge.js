const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { commandNetworkConfig, configValue } = require("./codex-network");
const fs = require("node:fs/promises");
const readline = require("node:readline");
const { startProvider } = require("./codex-provider");
const { startRelaiWorker } = require("./relai-worker");
// A completed CLI receipt can still be shown when the next chat call cannot fit
// the session budget. Never infer completion from progress, old turns or errors.
function completedOptimizationReceipt(item) {
  if (item?.type !== "commandExecution" || item.status !== "completed" || item.exitCode !== 0 ||
      !/\brelai\s+(?:optimize\b|runs\s+(?:wait|status)\b)/.test(item.command || "")) return null;
  let receipt = null;
  for (const line of String(item.aggregatedOutput || "").slice(-1048576).split(/\r?\n/)) {
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (value.schema_version !== "relai.agent_interaction.v1" || value.workflow !== "optimize" ||
        value.status !== "completed" || !Array.isArray(value.summary?.items) ||
        !/^optimizer-[a-zA-Z0-9_-]+$/.test(value.session_id || "") ||
        value.result_path !== `.relai/.internal/runs/optimizer/${value.session_id}/optimizer-result.json`) continue;
    const labels = ["Status", "Accepted changes", "Final evaluation"];
    const items = labels.flatMap(label => {
      const item = value.summary.items.find(item => item.label === label);
      return typeof item?.value === "string" && item.value.length <= 1000
        ? [`- ${label}: ${item.value.replace(/[\r\n]+/g, " ")}`] : [];
    });
    if (items.length === labels.length) receipt =
      "RELAI completed the optimization run. Saved result:\n\n" + items.join("\n") +
      "\n\nReport: `" + value.result_path + "`. Scope warnings and details remain in that report.";
  }
  return receipt;
}
class CodexBridge {
  constructor(env, root, changed, askUser) {
    this.env = env;
    this.root = root;
    this.changed = changed;
    this.askUser = askUser;
    this.userInputs = new Map();
    this.state = {
      messages: [],
      jobs: [],
      pendingTurn: false,
      runWorkflow: false,
      engine: "codex",
    };
    this.requests = new Map();
    this.approvals = new Map();
    this.approvalScope = randomUUID();
    this.sequence = 0;
    this.saving = Promise.resolve();
    this.file = env.PLAYGROUND_EXAMPLE === "unauthorized-payment"
      ? "/home/user/.playground/payment-codex-thread.json"
      : "/home/user/.playground/codex-thread.json";
  }
  async restore() {
    if (this.restored) return;
    try {
      const saved = JSON.parse(await fs.readFile(this.file, "utf8"));
      this.thread = saved.thread;
      this.state.messages = saved.messages || [];
      this.state.changedFiles = saved.changedFiles || [];
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    this.restored = true;
  }
  snapshot() {
    return structuredClone(this.state);
  }
  publish() {
    this.changed(this.snapshot());
  }
  rpc(method, params) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(Error("Codex did not acknowledge " + method + "."));
      }, 30000);
      this.requests.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  async start() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      await this.restore();
      await fs.mkdir("/tmp/playground-docker-config", { recursive: true, mode: 0o700 });
      this.worker = await startRelaiWorker(this.env);
      const networkConfig = commandNetworkConfig(this.env, this.worker.url);
      this.provider = await startProvider(this.env);
      const config = {
        model_provider: "relai_playground",
        model: this.env.RELAI_SESSION_MODEL.split("/").at(-1),
        "model_providers.relai_playground.name": "RELAI scoped session gateway",
        "model_providers.relai_playground.base_url": this.provider.url,
        "model_providers.relai_playground.env_key": "RELAI_CODEX_TOKEN",
        "model_providers.relai_playground.wire_api": "responses",
        "model_providers.relai_playground.requires_openai_auth": false,
        "model_providers.relai_playground.supports_websockets": false,
        model_reasoning_effort:
          this.env.RELAI_SESSION_REASONING_EFFORT || "medium",
        developer_instructions: require("./hosted-runtime").developerInstructions.replaceAll("/home/user/.playground/codex-thread.json", this.file),
        approval_policy: "on-request",
        sandbox_mode: "workspace-write",
        web_search: "disabled",
        "features.default_mode_request_user_input": true,
        ...networkConfig,
      };
      const args = ["app-server", "--listen", "stdio://"];
      for (const [k, v] of Object.entries(config))
        args.push("-c", k + "=" + configValue(v));
      // Never inherit host/provider keys. The guest has only scoped playground access.
      const childEnv = {
        PATH: process.env.PATH,
        HOME: "/home/user",
        USER: "user",
        LANG: "C.UTF-8",
        RELAI_CODEX_TOKEN: this.provider.token,
        ...this.env,
        // Optional crash telemetry must not trigger command escalation outside
        // the session gateway allowlist.
        RELAI_DISABLE_TELEMETRY: "1",
        DOCKER_CONFIG: "/tmp/playground-docker-config",
        RELAI_WORKER_URL: this.worker.url,
        RELAI_WORKER_TOKEN: this.worker.token,
      };
      this.child = spawn("codex", args, {
        cwd: this.root,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const child = this.child;
      const worker = this.worker;
      const provider = this.provider;
      this.child.stderr.on("data", () => {});
      this.child.on("error", (error) => this.fail(error.message));
      this.child.on("exit", () => {
        worker.close();
        provider.close();
        if (this.child !== child) return;
        this.clearUserInputs();
        this.ready = null;
        if (this.state.pendingTurn)
          this.fail("Codex stopped before completing this request.");
        for (const pending of this.requests.values()) {
          clearTimeout(pending.timer);
          pending.reject(Error("Codex process exited."));
        }
        this.requests.clear();
      });
      readline
        .createInterface({ input: this.child.stdout })
        .on("line", (line) => {
          try {
            this.receive(JSON.parse(line));
          } catch {
            this.fail("Codex returned an unreadable event.");
          }
        });
      await this.rpc("initialize", {
        capabilities: { experimentalApi: true },
        clientInfo: {
          name: "relai_playground",
          title: "Codex + RELAI",
          version: "0.1.0",
        },
      });
      this.child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
      const response = await this.rpc(
        this.thread ? "thread/resume" : "thread/start",
        { ...(this.thread ? { threadId: this.thread } : {}), cwd: this.root },
      );
      this.thread = response.thread.id;
      await this.save();
    })().catch((error) => {
      this.close();
      this.ready = null;
      throw error;
    });
    return this.ready;
  }
  async save() {
    const saved = JSON.stringify({
      thread: this.thread,
      messages: this.state.messages,
      changedFiles: this.state.changedFiles,
    });
    // Serialize snapshots and atomically replace history: a late older write
    // must not erase a newer selection, and interruption must not truncate it.
    this.saving = this.saving.catch(() => {}).then(async () => {
      const temporary = this.file + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, saved, { mode: 0o600 });
        await fs.rename(temporary, this.file);
      } finally {
        await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
      }
    });
    return this.saving;
  }
  async send(prompt) {
    await this.restore();
    if (this.state.pendingTurn)
      throw Error(
        "Stop the current Codex turn before sending another request.",
      );
    this.state.messages.push({ role: "user", content: prompt });
    this.completedRelaiReceipt = null;
    this.cancelRequested = false;
    this.state.pendingTurn = true;
    this.publish();
    const handoff =
      this.state.messages.filter((m) => m.role === "user").length === 1
        ? "You are the real Codex coding assistant in this Python airline repository. RELAI is initialized and its Codex plugin is installed. Use its CLI/skills when requested; inspect actual files and receipts. The UI walkthrough was prerecorded, and its patch may have been explicitly applied. Read README.md for the prepared example and its recorded scope; do not claim you ran recorded tests. Do not commit, push, deploy, or expose credentials. Present concise real findings and reviewable changes; commands need not be repeated in your prose.\n\n"
        : "";
    try {
      await this.start();
      this.provider?.clearFailure?.();
      if (this.cancelRequested) {
        this.fail("Codex stopped before starting this request.");
        await this.save();
        return;
      }
      await this.save();
      const r = await this.rpc("turn/start", {
        threadId: this.thread,
        input: [{ type: "text", text: handoff + (handoff && this.env.PLAYGROUND_EXAMPLE === "unauthorized-payment"
          ? "The active prepared example is payment without confirmation. Its target is src/airline_support/agent.py; read demo/scenarios/unauthorized-payment/README.md and its recorded/workspace-layout.json for the preserved recording provenance. Use skyserve-payment-consent-dialogue for relevant evaluation. The active source uses the familiar src/airline_support layout. Preserve demo/recorded and all archived evidence; Git history and the saved recording snapshots preserve the original booking example. The payments are synthetic ledger entries, with no real payment provider.\n\n"
          : "") + prompt }],
      });
      if (this.state.pendingTurn) this.turn = r.turn.id;
      if (this.cancelRequested && this.turn) await this.stop();
    } catch (e) {
      this.fail(e.message);
      throw e;
    }
  }
  receive(event) {
    if (event.id !== undefined && !event.method) {
      const p = this.requests.get(event.id);
      if (p) {
        clearTimeout(p.timer);
        this.requests.delete(event.id);
        event.error
          ? p.reject(Error(event.error.message))
          : p.resolve(event.result);
      }
      return;
    }
    const p = event.params || {};
    if (event.method === "serverRequest/resolved") {
      this.userInputs.get(p.requestId)?.abort();
      this.userInputs.delete(p.requestId);
      return;
    }
    if (event.id !== undefined && event.method === "item/tool/requestUserInput" && this.askUser) {
      const controller = new AbortController();
      this.userInputs.set(event.id, controller);
      void Promise.resolve().then(() => this.askUser(p.questions, controller.signal))
        .then(async (answers) => {
          if (controller.signal.aborted) return;
          // Keep the exact selected label independently of the model's later
          // translation into a RELAI response. A failed turn must not erase
          // which choice the user actually made or turn a skip into decline.
          const selections = (p.questions || []).flatMap(question => {
            const selected = answers[question.id]?.answers;
            if (!Array.isArray(selected)) return [];
            return [{ questionId: question.id, header: question.header || "Review", answers: selected }];
          });
          this.state.messages.push({
            role: "assistant",
            content: selections.map(s => "Review selection — " + s.header + ": " +
              (s.answers.length ? s.answers.join("; ") : "Skipped (no answer)")).join("\n"),
            reviewSelection: { id: this.approvalScope + ":" + event.id, selections },
          });
          try { await this.save(); }
          catch {
            this.child.stdin.write(JSON.stringify({ id: event.id, error: {
              code: -32603, message: "Could not save the review selection. No answer was submitted.",
            } }) + "\n");
            this.fail("The review selection could not be saved. No answer was submitted; retry this review.");
            return;
          }
          if (controller.signal.aborted) return;
          this.publish();
          this.child.stdin.write(JSON.stringify({ id: event.id, result: { answers } }) + "\n");
        }, () => {
          if (controller.signal.aborted) return;
          this.child.stdin.write(JSON.stringify({
            id: event.id,
            error: { code: -32603, message: "Could not present the user question. No answer was submitted." },
          }) + "\n");
        }).catch(() => {
          if (!controller.signal.aborted) this.fail("Codex could not receive the user answer.");
        }).finally(() => {
          if (this.userInputs.get(event.id) === controller) this.userInputs.delete(event.id);
        });
      return;
    }
    if (event.id !== undefined && event.method?.includes("requestApproval")) {
      // App-server request IDs restart at zero; saved chat receipts must never
      // resolve or hide approvals from a later runtime instance.
      const id = "codex-approval-" + this.approvalScope + "-" + event.id;
      this.approvals.set(id, event.id);
      this.state.messages.push({
        role: "assistant",
        tool_calls: [
          {
            id,
            name: "run_command",
            arguments: {
              command: Array.isArray(p.command)
                ? p.command.join(" ")
                : typeof p.command === "string"
                  ? p.command
                  : p.reason || "Review proposed workspace changes.",
            },
          },
        ],
      });
      this.publish();
      return;
    }
    if (event.id !== undefined) {
      this.child.stdin.write(
        JSON.stringify({
          id: event.id,
          error: {
            code: -32601,
            message: "This playground does not support this interaction yet.",
          },
        }) + "\n",
      );
      return;
    }
    if (event.method === "item/agentMessage/delta") {
      let message = this.state.messages.find((m) => m.codexId === p.itemId);
      if (!message) {
        message = { role: "assistant", content: "", codexId: p.itemId };
        this.state.messages.push(message);
      }
      message.content += p.delta;
      this.publish();
    }
    if (event.method === "item/completed" && p.item?.type === "agentMessage") {
      let message = this.state.messages.find((m) => m.codexId === p.item.id);
      if (!message) {
        message = { role: "assistant", codexId: p.item.id };
        this.state.messages.push(message);
      }
      message.content = p.item.text;
      this.publish();
    }
    if (event.method === "turn/started") {
      this.turn = p.turn.id;
      this.completedRelaiReceipt = null;
    }
    if (event.method === "item/completed" && this.state.pendingTurn && this.turn && p.turnId === this.turn) {
      const receipt = completedOptimizationReceipt(p.item);
      if (receipt) this.completedRelaiReceipt = receipt;
    }
    if (event.method === "item/completed" && p.item?.type === "fileChange") {
      this.state.changedFiles = [
        ...new Set([
          ...(this.state.changedFiles || []),
          ...p.item.changes.map((c) => c.path),
        ]),
      ];
      this.publish();
    }
    if (event.method === "turn/completed") {
      this.clearUserInputs();
      this.state.pendingTurn = false;
      this.turn = null;
      if (p.turn.status === "failed") {
        const failure = this.provider?.takeFailure?.();
        this.state.messages.push({
          role: "assistant",
          content:
            (failure?.code === "playground_budget_exceeded" && this.completedRelaiReceipt
              ? this.completedRelaiReceipt + "\n\nThe chat could not add a final explanation: "
              : "Codex could not complete this request: ") +
            (failure?.message || p.turn.error?.message || "runtime error") +
            (failure?.code === "playground_budget_exceeded"
              ? " Your workspace and recorded review selections are preserved. A new call must fit the remaining session budget."
              : ""),
        });
      }
      if (p.turn.status === "interrupted")
        this.state.messages.push({
          role: "assistant",
          content:
            "Codex stopped. Completed workspace changes remain available for review.",
        });
      for (const id of this.approvals.keys())
        this.state.messages.push({
          role: "tool",
          result: {
            call_id: id,
            status: "denied",
            content: "The Codex turn ended.",
          },
        });
      this.approvals.clear();
      this.publish();
      void this.save().catch(() =>
        this.fail(
          "Codex history could not be saved. Workspace files remain available.",
        ),
      );
    }
  }
  async approve(id, approved) {
    const rpcId = this.approvals.get(id);
    if (rpcId === undefined) throw Error("This approval is no longer pending.");
    this.approvals.delete(id);
    this.child.stdin.write(
      JSON.stringify({
        id: rpcId,
        result: { decision: approved ? "accept" : "decline" },
      }) + "\n",
    );
    this.state.messages.push({
      role: "tool",
      result: {
        call_id: id,
        status: approved ? "success" : "denied",
        content: approved ? "Approved." : "Declined.",
      },
    });
    this.publish();
  }
  async stop() {
    this.cancelRequested = true;
    this.clearUserInputs();
    if (this.turn)
      await this.rpc("turn/interrupt", {
        threadId: this.thread,
        turnId: this.turn,
      });
  }
  fail(message) {
    this.clearUserInputs();
    this.state.pendingTurn = false;
    this.state.messages.push({ role: "assistant", content: message });
    this.publish();
  }
  close() {
    this.clearUserInputs();
    this.child?.kill("SIGTERM");
    this.provider?.close();
    this.worker?.close();
  }
  clearUserInputs() {
    for (const controller of this.userInputs.values()) controller.abort();
    this.userInputs.clear();
  }
}
module.exports = { CodexBridge };
