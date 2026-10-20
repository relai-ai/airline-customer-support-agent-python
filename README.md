# Airline Support Agent

A terminal airline customer support agent built with the OpenAI Agents SDK for Python.

The sample agent lives in `src/airline_support/agent.py` and supports booking lookups, baggage policy, and simulated paid-seat upgrades. The active playground demonstrates a deliberately injected payment-consent bug; its recorded walkthrough tests and fixes that bug. Three additional deliberate live-mode problems cover cancellation without consent, refunds for the wrong booking, and false success after a failed refund. See [live challenges](demo/scenarios/live-challenges/README.md) for multi-turn scenarios, positive controls, and state-based criteria. No real payment provider is connected. Each terminal conversation is saved as JSONL with an ATIF trajectory under `logs/`.

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

The active walkthrough demonstrates a paid-seat purchase without consent. Its
six-turn baseline and independent verification use real model/tool exchanges.
The recorded optimizer comparison improves from **0.50 to 1.00**; both recorded
consent/ledger and response/state evaluators pass independently. Review opens
the measured snapshots and Apply verifies and changes the exact payment
component, `src/airline_support/payment_agent.py`.

The opening result also includes three new real-agent diagnostic baselines:
unauthorized cancellation, a refund to the wrong booking, and false success
after a refund outage. These deliberately flawed policies live in
`live_challenges.py` and remain active after applying the saved payment fix.
Their diagnostic traces do not carry RELAI evaluator scores; discover and
approve a test in live mode before claiming a scored improvement.

The older booking-grounding walkthrough remains archived under `demo/recorded`.
Its 0.792-to-1.000 comparison and 14-turn verification describe that historical
scenario, rather than the additional cancellation/refund challenges. No saved
walkthrough uses scripted SDK responses as measured evidence.

### Live optimization limits

After the recorded guide, the optimization suggestions propose 30 total rollouts with batch size one and no automatic PR. This is an upper bound: the hosted session spending limit and one-hour expiry still apply, and the selected tests and regression capacity are reviewed before execution. Historical recorded results keep their original rollout counts.
