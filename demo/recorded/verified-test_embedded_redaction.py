import json

import pytest

from airline_support.trajectory import REDACTED, redact


@pytest.mark.parametrize(
    "diagnostic",
    [
        {"password": "opaque-example", "ticket_type": "standard"},
        {"nested": [{"api_key": 'opaque-"quoted"-value'}]},
        [{"access_token": "opaque-token"}, {"weight": 50}],
    ],
)
def test_fenced_json_uses_structured_redaction(diagnostic):
    message = "Baggage diagnostic:\n```json\n" + json.dumps(diagnostic) + "\n```\nThanks."
    result = redact(message, ())
    assert result.startswith("Baggage diagnostic:\n```json\n")
    assert result.endswith("\n```\nThanks.")
    assert json.loads(result.split("```json\n")[1].split("\n```")[0]) == redact(
        diagnostic, ()
    )
    assert REDACTED in result


def test_multiple_json_fragments_after_non_json_braces():
    message = 'Note {not JSON}; first {"password":"one"}; second {"secret":"two"}.'
    assert redact(message, ()) == (
        'Note {not JSON}; first {"password": "[REDACTED]"}; '
        'second {"secret": "[REDACTED]"}.'
    )


def test_benign_embedded_json_preserves_original_formatting():
    message = 'Baggage { "weight" : 50, "items": [1, 2] } and [ordinary prose].'
    assert redact(message, ()) == message
