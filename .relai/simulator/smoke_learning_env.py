# The RELAI backend generator must replace this placeholder with one
# representative, project-valid fixed turn. Add only mocks needed to keep this
# smoke test deterministic and non-destructive.
from relai import FixedInput, FixedTurn, RELAIEnvironment


environment = RELAIEnvironment(
    schema_version="relai.learning_environment.v1",
    id="relai-init-smoke",
    name="RELAI init smoke",
    description="Checks that the generated simulator can run one representative turn.",
    input=FixedInput(
        turns=[
            FixedTurn(content="My confirmation code is SKY123. Please confirm my route and current seat."),
        ],
    ),
    mocks={},
    evaluators=[],
)
