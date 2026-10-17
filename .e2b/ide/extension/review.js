const crypto = require("node:crypto");
const { reviewFile, digest } = require("./recorded");

const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// Render only the hash-verified recording. No editor worker or remote asset is needed.
function reviewHtml(recording, name) {
  const content = reviewFile(recording, name);
  if (digest(recording.diff) !== recording.patchSha256)
    throw Error("Recorded patch does not match its verified hash");
  const patch = recording.diff.split(/(?=^diff --git )/m)
    .find(section => section.startsWith(`diff --git a/${name} b/${name}\n`));
  if (!patch) throw Error("This file has no recorded patch");
  const removed = new Set(), added = new Set();
  let beforeLine, afterLine;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      beforeLine = Number(hunk[1]);
      afterLine = Number(hunk[2]);
    } else if (beforeLine !== undefined) {
      if (line.startsWith("-")) removed.add(beforeLine++);
      else if (line.startsWith("+")) added.add(afterLine++);
      else if (line.startsWith(" ")) { beforeLine++; afterLine++; }
    }
  }
  function source(text, changes, kind) {
    if (!text) return '<p class="empty">File did not exist.</p>';
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const first = changes.size ? Math.max(1, Math.min(...changes) - 3) : 1;
    const last = changes.size ? Math.min(lines.length, Math.max(...changes) + 3) : lines.length;
    return '<pre>' + lines.map((line, index) => ({ line, number: index + 1 }))
      .filter(({ number }) => number >= first && number <= last)
      .map(({ line, number }) =>
        `<span class="line${changes.has(number) ? " " + kind : ""}"><span class="number">${number}</span>${escapeHtml(line)}</span>`).join("") + '</pre>';
  }
  const nonce = crypto.randomBytes(24).toString("hex");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'">
<style nonce="${nonce}">
body{font:14px/1.5 var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:16px;margin:0}
h1{font-size:16px;overflow-wrap:anywhere}p{color:var(--vscode-descriptionForeground)}
.sources{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}section{min-width:0;border:1px solid var(--vscode-panel-border)}h2{font-size:14px;padding:8px 12px;margin:0;border-bottom:1px solid var(--vscode-panel-border)}
pre{font:12px/1.6 var(--vscode-editor-font-family,monospace);overflow:auto;margin:0;padding:8px 0}.line{display:block;min-height:1.6em;width:max-content;min-width:100%;padding-right:12px;box-sizing:border-box}.number{display:inline-block;width:4em;text-align:right;padding-right:16px;color:var(--vscode-editorLineNumber-foreground);user-select:none}
.removed{background:var(--vscode-diffEditor-removedTextBackground,rgba(220,60,60,.2))}.added{background:var(--vscode-diffEditor-insertedTextBackground,rgba(40,180,80,.2))}.empty{padding:12px}
@media(max-width:600px){.sources{grid-template-columns:minmax(0,1fr)}}
</style></head><body><h1>${escapeHtml(name)}</h1><p>Recorded code changes · read-only. Showing changed lines with surrounding context. Removed lines are red; added lines are green.</p>
<div class="sources"><section aria-label="Before"><h2>Before</h2>${source(content.before, removed, "removed")}</section><section aria-label="After"><h2>After</h2>${source(content.after, added, "added")}</section></div></body></html>`;
}
module.exports = { reviewHtml };
