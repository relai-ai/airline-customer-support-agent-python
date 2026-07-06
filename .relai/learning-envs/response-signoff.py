"""RELAI learning environment for the required response signoff behavior."""

from relai import CodeEvaluator, EvaluationResult, FixedInput, FixedTurn, RELAIEnvironment


REQUIRED_SUFFIX = "please let me know if you have any questions"
TAGS = ["end-to-end", "reply-ends-with-required-signoff"]


def mock_change_seat_tool(*args, **kwargs):
    """Mock the mutable seat-change tool with a production-shaped string result."""
    confirmation_code = str(kwargs.get("confirmation_code", "SKY123")).strip().upper() or "SKY123"
    requested_seat = str(kwargs.get("requested_seat", "14C")).strip().upper() or "14C"
    return f"Seat updated to {requested_seat} for booking {confirmation_code}."


def evaluate_required_signoff(simulation_result):
    final_output = str(getattr(simulation_result, "final_output", "") or "").rstrip()
    if not final_output:
        return EvaluationResult(
            score=0.0,
            feedback=(
                f"The assistant produced no final output, so it could not end with the required "
                f"exact suffix '{REQUIRED_SUFFIX}'."
            ),
        )

    if final_output.endswith(REQUIRED_SUFFIX):
        return EvaluationResult(
            score=1.0,
            feedback="The assistant's final response ends with the required exact suffix.",
        )

    if REQUIRED_SUFFIX.lower() in final_output.lower():
        return EvaluationResult(
            score=0.0,
            feedback=(
                f"The required signoff must be the exact final suffix '{REQUIRED_SUFFIX}', but the "
                f"reply included altered wording, casing, or extra trailing text: '{final_output}'."
            ),
        )

    observed_ending = final_output[-len(REQUIRED_SUFFIX) :] if len(final_output) >= len(REQUIRED_SUFFIX) else final_output
    return EvaluationResult(
        score=0.0,
        feedback=(
            f"The final response is missing the required exact suffix '{REQUIRED_SUFFIX}'. "
            f"Observed ending: '{observed_ending}'."
        ),
    )


environment = RELAIEnvironment(
    schema_version="relai.learning_environment.v1",
    id="response-signoff",
    name="Required response signoff",
    description="Checks that the agent ends a routine airline-support reply with the exact required signoff sentence.",
    tags=TAGS,
    input=FixedInput(
        turns=[
            FixedTurn(content="What is the baggage policy for a standard ticket?"),
        ],
    ),
    mocks={
        "airline_support.agent:change_seat": mock_change_seat_tool,
    },
    evaluators=[
        CodeEvaluator(
            id="required-signoff-suffix",
            description="Checks that the assistant's final response ends with the exact required signoff suffix.",
            evaluate=evaluate_required_signoff,
        ),
    ],
)
