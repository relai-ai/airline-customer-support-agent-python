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
