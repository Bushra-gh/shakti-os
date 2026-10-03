import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from citizen_report import CitizenReportAdapter


def test_citizen_report_maps_to_event_without_reporter_identity() -> None:
    event = CitizenReportAdapter().to_event(
        {
            "location": "gate_4",
            "venue_event_id": "venue-test",
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
            "venue_event_id": "venue-test",
            "description": "Crowd is blocking the south entrance.",
            "category": "crowding",
            "urgency": "high",
        },
    }


def test_citizen_report_defaults_confidence_and_optional_fields() -> None:
    event = CitizenReportAdapter().to_event(
        {"location_name": "gate_9", "text": "Unusual movement near the plaza.", "venue_event_id": "venue-test"}
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
    report = {"location": "gate_4", "text": "Crowd at entrance.", "venue_event_id": "venue-test"}

    with patch("citizen_report.adapter.httpx.AsyncClient", return_value=client):
        result = asyncio.run(CitizenReportAdapter().send_event(report, "http://localhost:8000", access_token="test-citizen-token"))

    client.__aenter__.return_value.post.assert_awaited_once_with(
        "http://localhost:8000/events", json=CitizenReportAdapter().to_event(report), headers={"Authorization": "Bearer test-citizen-token"}
    )
    assert result == {"id": "event-2"}


def test_venue_is_required_for_a_submittable_event():
    with pytest.raises(ValueError, match="venue_event_id"):
        CitizenReportAdapter().to_event({"location": "zone", "text": "Observation"})


@pytest.mark.parametrize("token,url", [("", "https://api.example.com"), ("token", "http://remote.example.com"), ("token", "https://user:password@api.example.com")])
def test_token_and_safe_destination_are_required_before_network(token, url):
    report = {"location": "zone", "text": "Observation", "venue_event_id": "venue-test"}
    with patch("citizen_report.adapter.httpx.AsyncClient") as client:
        with pytest.raises(ValueError):
            asyncio.run(CitizenReportAdapter().send_event(report, url, access_token=token))
    client.assert_not_called()
