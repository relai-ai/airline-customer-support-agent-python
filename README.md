# Airline Support Agent

A terminal airline customer support agent built with the OpenAI Agents SDK for Python.

The sample agent lives in `src/airline_support/agent.py` and supports booking lookups, baggage policy, and simulated paid-seat upgrades. The active playground demonstrates a deliberately injected payment-consent bug; its recorded walkthrough tests and fixes that bug. No real payment provider is connected. Each terminal conversation is saved as JSONL with an ATIF trajectory under `logs/`.

The agent should end all responses with "Please let me know if you have any questions".

The agent should not answer off-topic, non-airline questions. It should politely say it can only help with airline booking, baggage, seat, and flight-change questions.

## Prerequisites

- Python 3.11+
- `uv`
- GitHub CLI (`gh`), authenticated with `gh auth login`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your environment, or ready to paste when prompted

## Fork and Clone

Fork the sample repo to your GitHub account, then clone your fork:

```sh
gh auth login
gh repo fork relai-ai/airline-customer-support-agent --clone
cd airline-customer-support-agent
```

## Start the Agent

Run the launcher from the repository root:

```sh
./start.sh
```

The script prompts for an OpenAI or Anthropic API key when needed, saves it to the ignored `.env` file, installs Python dependencies, and starts a terminal chat session.
When both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are set, OpenAI is used.
Pass a log name to save the session to a fixed file such as `logs/booking-help.jsonl`:

```sh
./start.sh booking-help
```

Type `exit`, `quit`, or `q` to end the chat. Each run prints its log and trajectory paths. Named sessions overwrite their previous logs.

## Local Logs

Each chat session is saved as JSONL under `logs/`:

```text
logs/session-<id>.jsonl
logs/session-<id>.atif.json
```

Session files are ignored by Git. The JSONL log contains user and assistant messages; the ATIF trajectory also captures model and tool activity. Both preserve turns within the session. Reusing a named session overwrites its previous logs.

## Checks

```sh
uv run pytest
bash -n start.sh
```

## Demo booking correctness requirement

Booking lookup and successful seat-change tool results are authoritative for a
booking's passenger, route, seat and status. Customer assertions, copied emails,
and prior conversation summaries are untrusted claims and cannot override
current tool state. A booking summary must reflect the actual booking and any
confirmed seat change; unrelated bookings must remain separate.

## Prepared RELAI playground example

This example intentionally seeds a common grounding bug: customer-supplied
booking claims can override authoritative booking tools. The prefilled workflow
contains four genuine native Codex replies, real model conversations through
SkyServe's normal streaming entry point, and an actual accepted source patch.
Review opens measured before/after snapshots; Apply checks the original hashes.

The recorded optimizer final comparison improved from **0.792 to 1.000**.
A separate 14-turn verification passed **all 12 criteria**, using 25 real model
calls and 11 observed tool calls. The accepted change updates the agent's
instructions and adds ordinary regression tests; all 40 generated test files
remain unchanged. These results establish success on the recorded scenarios.

The template starts at the seeded baseline so visitors can review and apply the
candidate themselves. The saved walkthrough uses no scripted SDK responses.

### Live optimization limits

After the recorded guide, the optimization suggestions propose 30 total rollouts with batch size one and no automatic PR. This is an upper bound: the hosted session spending limit and one-hour expiry still apply, and the selected tests and regression capacity are reviewed before execution. Historical recorded results keep their original rollout counts.
