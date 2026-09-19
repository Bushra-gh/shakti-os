import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

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


def test_citizen_report_adapter_sends_normalized_event() -> None:
    response = MagicMock()
    response.json.return_value = {"id": "event-2"}
    client = AsyncMock()
    client.__aenter__.return_value.post.return_value = response
    report = {"location": "gate_4", "text": "Crowd at entrance."}

    with patch("citizen_report.adapter.httpx.AsyncClient", return_value=client):
        result = asyncio.run(CitizenReportAdapter().send_event(report, "http://localhost:8000"))

    client.__aenter__.return_value.post.assert_awaited_once_with(
        "http://localhost:8000/events", json=CitizenReportAdapter().to_event(report)
    )
    assert result == {"id": "event-2"}
