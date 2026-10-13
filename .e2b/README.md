# Python airline playground

The image packages the Python SkyServe source, initialized RELAI EvalsWiki,
adaptive off-topic test, saved real command artifacts, and a pinned Codex
app-server. Tool installation and image validation make no model calls.
The Docker copy allowlist excludes host credentials and private CLI state.

The four prefilled requests replay the measured wiki, baseline simulation,
optimization, and explicit apply workflow. The original source remains in the
image; review uses read-only before/after documents. Applying checks every source
hash and preserves visitor edits on mismatch. Edited or custom requests run the
real Codex process with actual commands, approvals, Stop, and persistent history.

The companion dashboard service must set `PLAYGROUND_ASSISTANT_ENGINE=codex`
and issue a pinned native Responses model profile with scoped session access.
Deploy backend native Responses support before enabling this template. Python
agent calls use the same session gateway through the OpenAI Agents SDK; shared
provider keys remain on the backend. A complete native provider response is
translated into SDK events after inference, without fabricated token timing.

## Verification

```sh
uv run --no-sync pytest
bash -n start.sh .e2b/setup.sh .e2b/start.sh
node --test .e2b/ide/extension/*.test.js
python3 -m unittest discover -s .e2b/ide -p 'test_*.py'
node .e2b/ide/extension/validate-recording.js .
docker build -f .e2b/Dockerfile -t relai-python-playground:local .
```

The final image requires a verified manifest, authentic trajectories and receipt
hashes, and the exact measured original source. A toolchain-only build is not a
release or proof of live Codex connectivity. Fresh private sandbox probes must
check Docker, IDE startup, a genuine Codex turn, saved wiki access, explicit apply,
reload/Stop/approval handling, and session isolation before deployment.

Build a distinct E2B alias and pin its verified source revision and template ID.
Existing visitors retain their sessions; new launches receive the new template.
