# Python airline playground

The image packages the Python SkyServe source in the familiar
`src/airline_support/` layout, initialized RELAI EvalsWiki, a frozen six-turn
payment-consent test, saved real command artifacts, and a pinned Codex app-server.
The active source deliberately contains a synthetic $25 purchase-consent bug.
The four prepared requests replay risk, test, measured optimization, and Apply.
Final optimizer comparison improved 0.50 to 1.00; separate verification passed
both evaluators. No image-build or recorded-playback operation calls a model.

The payment agent's source bytes match the recorded baseline; Apply uses the
identical measured fix with only the patch path relocated to
`src/airline_support/agent.py`. The original reports and native evidence remain
unchanged. `recorded/workspace-layout.json` records this relocation, and validation
rejects any source or patch-content change beyond the path mapping. Git history
and `demo/recorded/` preserve the previous booking example. Its patch is checked
in a separate disposable archive checkout, never against the active agent.

Review uses read-only before/after documents. Apply checks source hashes and
preserves visitor edits on mismatch. Edited or custom requests use the real
Codex process with actual commands, approvals, Stop, and persistent history.
Provisioned live sessions need a compatible RELAI CLI; local previews explicitly
disable live comparisons. The Docker allowlist excludes host credentials.

The build explicitly installs `relai@relai-codex` through Codex's plugin command,
then initializes a real app-server and verifies RELAI skill discovery. These
startup checks make no model calls; a model-backed staging turn is a separate
verification requiring the caller's authorization.

Image setup enables `default_mode_request_user_input` for the template user.
The IDE also passes `features.default_mode_request_user_input=true` when starting
Codex, opts into the experimental app-server protocol, and presents native
choice/text questions through the IDE. Answers return on the original request
ID; dismissing a question skips it and never approves work. Stop, turn completion,
and runtime shutdown dismiss pending questions. Credentials must use the terminal.
Rebuild and verify a new template revision, then release it through the normal
template rollout; existing sandboxes keep their current image and configuration.

Codex command execution keeps the workspace-write filesystem sandbox and enables
its enforced network proxy for the provisioned session gateway hostname and the
session-local RELAI worker on loopback.
This lets RELAI discovery contact its model service without granting arbitrary
outbound access. Upstream proxy inheritance is disabled. Local verification may
use a loopback HTTP gateway; hosted gateways require HTTPS.

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
docker run --rm --privileged --entrypoint node relai-python-playground:local /opt/playground/extensions/relai.relai-playground-0.1.0/verify-command-network.cjs
docker run --rm --privileged --entrypoint node relai-python-playground:local /opt/playground/extensions/relai.relai-playground-0.1.0/verify-relai-worker.cjs
```

The final image requires a verified manifest, authentic trajectories and receipt
hashes, and the exact measured original source. A toolchain-only build is not a
release or proof of live Codex connectivity. Fresh private sandbox probes must
check Docker, IDE startup, a genuine Codex turn, saved wiki access, explicit apply,
reload/Stop/approval handling, and session isolation before deployment.

Build a distinct E2B alias and pin its verified source revision and template ID.
Existing visitors retain their sessions; new launches receive the new template.

## Hosted workflow lifetime

The image wraps typed RELAI workflows and `relai runs wait` with a 24-hour CLI
wait. This is a blocking wait, not a workflow timeout or a budget increase: the
real CLI returns immediately on completion or a native review checkpoint. The
underlying binary, signal handling, protocol output and exit status are preserved.
Codex must give the command a one-hour tool timeout and poll its execution session;
Stop and the sandbox/session lifetime still bound execution. Short CLI waits could
otherwise return before detached work finishes and lose it when the command PID
namespace closes. Inspection, help, malformed arguments, and cancellation commands
retain the real CLI's normal behavior.

## Session-local RELAI worker

Linux Codex's managed network sandbox denies creating Unix sockets, including
`/var/run/docker.sock`. Unix-socket allowlist entries do not make Docker usable
in the pinned runtime. The web-dialog bridge therefore starts an authenticated
HTTP worker on `127.0.0.1` outside that inner command sandbox, inside the same
disposable E2B guest. The inner filesystem sandbox remains enabled; it receives
no Docker socket. The provider's one-hour kill timeout and session-model budget
are unchanged.

The hosted `relai` wrapper forwards typed CLI workflows and `runs wait` to the
worker. It invokes only the fixed real RELAI executable with an argument array,
not a shell or arbitrary executable. CLI output, review protocol, checkpoint
handling and exit status remain real. The worker accepts one invocation at a
time, never retries ambiguous starts, rejects unauthenticated/browser-origin
requests, and kills the workflow's PID namespace on disconnect, runtime shutdown
or its one-hour ceiling, including detached RELAI background workers. A per-runtime random bearer credential protects the
loopback endpoint. No provider or E2B management key is supplied to the worker.

RELAI workflow code now has the E2B guest's Docker authority: the isolation
boundary for validation is the disposable guest, not Codex's inner sandbox.
This is an intentional trusted execution boundary and requires a reviewed
template rollout. Ordinary Codex commands still cannot connect to Docker.
The model-free worker smoke boots the exact dialog bridge, then uses a fake CLI
to build and execute a verifier image from local files through a real sandboxed
client. It establishes Docker transport and runtime startup, not the success of
a live RELAI model workflow.

Model-request deadlines are ordered around the backend's 300-second inference
budget: the session service allows 360 seconds, the Codex provider 390 seconds,
and the inner Docker relay 400 seconds. Stop still aborts requests. The Codex
provider preserves upstream reasons rather than calling every rejection a
generic 502. Genuine rate limits remain HTTP 429; a hard session-budget rejection
becomes a non-retryable local HTTP 400 so Codex does not obscure it behind a
retry-limit error. Exact native review selections are shown and atomically saved
before forwarding them to Codex, including explicit skips; failed turns retain
those receipts without manufacturing a decline. Docker commands use a writable temporary config
directory rather than requiring an out-of-sandbox home-directory write.

The CLI build installed in a candidate must include the container-log ownership
handoff (upstream commit `7502c5ef`) and current-working-tree adapter review.
Installing the current extension over an older base template does not update
that binary. Verify the CLI source revision as well as its version before live
validation. These fixes preserve native trajectories and existing user edits;
they do not require a broad socket chmod or a source-baseline commit.
