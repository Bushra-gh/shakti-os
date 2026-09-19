import pytest

from citizen_report import CitizenReportAdapter


def test_citizen_report_maps_to_event_without_reporter_identity() -> None:
    event = CitizenReportAdapter().to_event(
        {
            "location": "gate_4",
            "description": "Crowd is blocking the south entrance.",
            "category": "crowding",
            "urgency": "high",
            "confidence": 0.9,
            "reporter_id": "should-not-be-forwarded",
        }
    )

    assert event == {
        "type": "citizen_report",
        "source": "citizen_report",
        "location": "gate_4",
        "confidence": 0.9,
        "payload": {
            "description": "Crowd is blocking the south entrance.",
            "category": "crowding",
            "urgency": "high",
        },
    }


def test_citizen_report_defaults_confidence_and_optional_fields() -> None:
    event = CitizenReportAdapter().to_event(
        {"location_name": "gate_9", "text": "Unusual movement near the plaza."}
    )

    assert event["confidence"] == 0.5
    assert event["payload"]["category"] == "other"
    assert event["payload"]["urgency"] == "unknown"


@pytest.mark.parametrize("report", [{"text": "Missing location"}, {"location": "gate_4"}])
def test_citizen_report_requires_location_and_text(report: dict[str, str]) -> None:
    with pytest.raises(ValueError):
        CitizenReportAdapter().to_event(report)
