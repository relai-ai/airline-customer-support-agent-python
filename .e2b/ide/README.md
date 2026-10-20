The live playground conversation runs real Codex app-server. Python agent trials and `try-agent.py` use the real sample with temporary RELAI session credentials supplied by the service. No provider key or personal login is needed. CLI preferences are initialized with the supported `relai setup --theme light` command; credentials stay in its child environment.

`optimizer-scope.json` is the unmodified nonsecret output of an interactive `relai optimize` scope selection approved for this prepared sample. It allows prompt/code/tool changes, keeps models fixed, prohibits additional paid tools, and disables cost optimization. Do not hand-edit CLI-owned scope state. Reconfigure it through RELAI's interactive terminal if the prepared sample's scope changes.

IDE startup also writes the issued temporary session settings into the ignored
CLI config and simulator environment with mode 0600. Nested test validation can
therefore run without asking users to configure keys. On local Docker Desktop,
persona trials remap the host alias to the inner Docker host; a bridge bound only
to the private inner Docker gateway preserves local model routing. It publishes
no workstation port. Hosted HTTPS gateways do not start this bridge.

Checks: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .e2b/ide -p 'test_*.py'`.

The prepared walkthrough replays saved native Codex replies and actual
model-backed agent conversations; clicking a prefilled step does not spend new
model tokens. The sample begins with a deliberately conflicting booking-authority
instruction so the saved failure can be reproduced. Review shows the measured
before/after source snapshots, and Apply uses the hashed accepted patch.

The new agent test uses an explicit task-owned adapter with an agent import
path. Its recording used CLI 0.2.10 plus the metadata-validation repair in
https://github.com/relai-ai/relai-cli/pull/642. Running this task with an
unpatched CLI 0.2.10 can fail validation before simulation. The saved replay
requires no CLI execution; live RELAI runs require that repair and configured
runtime credentials. No private CLI binary or credentials are shipped here.

## Try SkyServe beside Codex

Temporarily hidden: the main-panel link and comparison pane are disabled by
`SHOW_SAMPLE_COMPARISON` in `extension.js` and `panel.html`. The implementation
and saved examples remain available for re-enabling. The tour skips this pane.
The payment optimization badge displays 14m 22.0s as a presentation override;
the original 1462-second measurement and recording remain unchanged.

The sample panel opens beside the coding conversation. Its default Recorded example
shows the measured booking-grounding failure and independently verified reply,
read from the hash-checked trajectories. It makes no new model calls.

Try live is available before and after Apply. It sends the same request to two
independent real sample-agent conversations: the recorded original source and a snapshot of the current workspace.
Before any source change both snapshots are identical, and the panel says so.
Each keeps separate history and booking state. New comparison takes a fresh source
snapshot; source changes require a reset. Stop/disposal terminate the child process
groups, and partial failures never commit a turn to either conversation. These live
requests use the existing scoped session model gateway and budget; no provider keys
are inherited. A comparison runs both agents and can produce different results from
the recorded example.

Local UI previews may set `PLAYGROUND_SAMPLE_LIVE_DISABLED=1` in their synthetic
session environment. The panel then keeps recorded examples available and disables
model requests. This flag is for local fixtures, not a replacement for gateway
authorization or spending enforcement.
