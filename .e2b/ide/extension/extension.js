const vscode = require("vscode");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const recorded = require("./recorded");
const { CodexBridge } = require("./codex-bridge");
function activate(context) {
  let panel, terminal;
  const reviewDocuments = new Map();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "relai-recorded-change",
      {
        provideTextDocumentContent(uri) {
          return reviewDocuments.get(uri.toString()) ?? "";
        },
      },
    ),
  );
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closed) => {
      if (closed === terminal) terminal = undefined;
    }),
  );
  const open = async () => {
    if (panel) {
      panel.reveal();
      return;
    }
    panel = vscode.window.createWebviewPanel(
      "relai",
      "Codex + RELAI",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(context.extensionPath)],
      },
    );
    const current = panel;
    current.onDidDispose(() => {
      panel = undefined;
    });
    const nonce = crypto.randomBytes(24).toString("hex");
    const env = JSON.parse(
      await fs.readFile("/home/user/.playground/environment.json", "utf8"),
    );
    const recordingKey =
      "relai.playground.recording." + env.PLAYGROUND_SESSION_ID;
    const root = "/home/user/airline";
    if (env.PLAYGROUND_ASSISTANT_ENGINE !== "codex")
      throw Error("This Python playground requires the Codex runtime. Start a newly configured session.");
    const codex = new CodexBridge(env, root, (investigation) =>
      current.webview.postMessage({ type: "state", investigation }));
    if (codex) {
      context.subscriptions.push({ dispose: () => codex.close() });
      current.onDidDispose(() => codex.close());
    }
    let recording,
      recordingBusy = false;
    const reviewChange = async (name) => {
      const content = recorded.reviewFile(recording, name);
      const before = vscode.Uri.from({
        scheme: "relai-recorded-change",
        path: "/before/" + name,
        query: recording.patchSha256,
      });
      const after = vscode.Uri.from({
        scheme: "relai-recorded-change",
        path: "/after/" + name,
        query: recording.patchSha256,
      });
      reviewDocuments.set(before.toString(), content.before);
      reviewDocuments.set(after.toString(), content.after);
      await vscode.commands.executeCommand(
        "vscode.diff",
        before,
        after,
        name + " · RELAI proposed change",
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
      );
    };
    current.webview.onDidReceiveMessage(async (msg) => {
      try {
        // Explicit action allowlist. Webview cannot choose URLs, paths or credentials.
        if (msg.action === "load") {
          recording = await recorded.loadRecording(root);
          await codex.restore();
          const investigation = { investigation: codex.snapshot() };
          current.webview.postMessage({
            type: "loaded",
            recording,
            recordedProgress: context.workspaceState.get(recordingKey, 0),
            ...investigation,
          });
        } else if (msg.action === "recorded" && Number.isInteger(msg.step)) {
          if (recordingBusy) return;
          recordingBusy = true;
          try {
            const progress = context.workspaceState.get(recordingKey, 0);
            if (!recording || msg.step !== progress || progress > 3)
              throw Error("Refresh to resume the recorded walkthrough.");
            let applied;
            if (progress === 3)
              applied = await recorded.applyRecording(root, recording);
            await context.workspaceState.update(recordingKey, progress + 1);
            current.webview.postMessage({
              type: "recorded",
              recordedProgress: progress + 1,
              applied,
            });
          } finally {
            recordingBusy = false;
          }
        } else if (msg.action === "artifact" && typeof msg.file === "string" && recording) {
          const content = await recorded.artifactContent(root, recording, msg.file);
          const uri = vscode.Uri.from({ scheme: "relai-recorded-change", path: "/artifact/" + msg.file });
          reviewDocuments.set(uri.toString(), content);
          await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside });
        } else if (
          msg.action === "folder" &&
          ["source", "relai", "project", "wiki", "tests"].includes(msg.folder)
        ) {
          const folders = {
            source: "src/airline_support",
            relai: ".relai",
            project: ".",
            wiki: ".relai/evals-wiki",
            tests: ".relai/harbor/agent-tests",
          };
          await vscode.commands.executeCommand(
            "revealInExplorer",
            vscode.Uri.file(path.join(root, folders[msg.folder])),
          );
          current.webview.postMessage({
            type: "folder-opened",
            folder: msg.folder,
            path: folders[msg.folder],
          });
        } else if (msg.action === "source") {
          await vscode.window.showTextDocument(
            vscode.Uri.file(
              path.join(
                root,
                "src/airline_support/agent.py",
              ),
            ),
            { viewColumn: vscode.ViewColumn.Beside },
          );
        } else if (msg.action === "send" && typeof msg.prompt === "string" && msg.prompt.trim()) {
          await codex.send(msg.prompt);
          current.webview.postMessage({ type: "state", investigation: codex.snapshot() });
        } else if (msg.action === "approve" && typeof msg.approved === "boolean") {
          await codex.approve(msg.id, msg.approved);
        } else if (["continue", "refresh"].includes(msg.action)) {
          current.webview.postMessage({ type: "state", investigation: codex.snapshot() });
        } else if (["stop", "cancel"].includes(msg.action)) {
          await codex.stop();
        } else if (msg.action === "assistant") {
          await vscode.commands.executeCommand("workbench.action.closePanel");
          await vscode.commands.executeCommand("workbench.action.closeSidebar");
          await vscode.commands.executeCommand(
            "workbench.action.closeAuxiliaryBar",
          );
        } else if (msg.action === "terminal") {
          if (!terminal)
            terminal = vscode.window.createTerminal({
              name: "RELAI · Terminal",
              cwd: "/home/user/airline",
            });
          terminal.show();
        } else if (msg.action === "evidence") {
          await vscode.commands.executeCommand(
            "markdown.showPreview",
            vscode.Uri.file("/home/user/airline/demo/recorded/README.md"),
          );
        } else if (
          msg.action === "review-change" &&
          typeof msg.file === "string"
        ) {
          await reviewChange(msg.file);
        } else if (msg.action === "changes") {
          if (msg.recorded === true && recording) {
            const selected = await vscode.window.showQuickPick(
              recording.files.map((file) => ({
                label: file.path,
                description: file.before === null ? "Added" : "Modified",
              })),
              {
                title: "RELAI optimized changes",
                placeHolder: "Choose a file to compare before and after",
              },
            );
            if (selected) await reviewChange(selected.label);
          } else await vscode.commands.executeCommand("workbench.view.scm");
        }
      } catch (error) {
        current.webview.postMessage({ type: "error", message: error.message });
      }
    });
    current.webview.html = (
      await fs.readFile(path.join(context.extensionPath, "panel.html"), "utf8")
    )
      .replace(
        "WORKFLOW_HELPERS",
        await fs.readFile(
          path.join(context.extensionPath, "workflow.js"),
          "utf8",
        ),
      )
      .replaceAll("NONCE", nonce);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("relai.playground", open),
  );
  void open().catch(() =>
    vscode.window.showErrorMessage(
      "RELAI playground could not open. Check session provisioning.",
    ),
  );
}
module.exports = { activate };
