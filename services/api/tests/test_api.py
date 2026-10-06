import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord
from shaktios_api.auth import AuthUser, get_operator_user
import shaktios_api.main as main_module
from shaktios_api.main import app
from shaktios_api.venue_store import VenueRecord, VenueZoneRecord


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(
        main_module,
        "verify_token",
        lambda token: AuthUser(id="operator-test", email="operator@example.com", role="operator"),
    )
    app.dependency_overrides[get_operator_user] = lambda: AuthUser(
        id="operator-test", email="operator@example.com", role="operator"
    )
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-only-ingestion-key-at-least-32-characters")
    with TestClient(app, headers={"X-ShaktiOS-Ingestion-Key": "test-only-ingestion-key-at-least-32-characters"}) as test_client:
        with SessionLocal() as db:
            db.query(EventRecord).delete()
            db.query(IncidentRecord).delete()
            db.query(TimelineEntryRecord).delete()
            db.query(VenueZoneRecord).delete()
            db.query(VenueRecord).delete()
            db.add(VenueRecord(
                id="venue-test",
                name="Test Venue",
                description="Test venue",
                venue="Test venue",
                location_label="Gate 4",
                status="active",
            ))
            db.add(VenueZoneRecord(
                id="gate_4",
                venue_id="venue-test",
                label="Gate 4",
                latitude=23.3441,
                longitude=85.3096,
            ))
            db.commit()
        yield test_client
    app.dependency_overrides.pop(get_operator_user, None)


def event_payload(
    event_type: str = "crowd_density",
    location: str = "gate_4",
    timestamp: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "type": event_type,
        "source": "crowd_simulator",
        "location": location,
        "confidence": 0.95,
        "payload": {"density": 0.42},
    }
    if timestamp is not None:
        payload["timestamp"] = timestamp
    return payload


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "shaktios-api"}


def test_public_venues_and_overview_are_real_backend_data(client: TestClient) -> None:
    venues = client.get("/venues")
    overview = client.get("/public/overview")

    assert venues.status_code == 200
    assert venues.json()[0]["zones"]
    assert overview.status_code == 200
    assert "recent_events" in overview.json()
    assert "payload" not in overview.json()["recent_events"][0] if overview.json()["recent_events"] else True


def test_event_is_persisted(client: TestClient) -> None:
    response = client.post("/events", json=event_payload())

    assert response.status_code == 201
    persisted = response.json()
    assert persisted["id"]
    assert persisted["timestamp"]

    with SessionLocal() as db:
        record = db.get(EventRecord, persisted["id"])

    assert record is not None
    assert record.type == "crowd_density"
    assert record.payload == {"density": 0.42}


def test_operator_camera_detection_uses_normal_event_pipeline(client: TestClient) -> None:
    response = client.post(
        "/camera/detections",
        json={
            "camera_id": "camera-gate-4",
            "camera_name": "Gate 4 camera",
            "location": "gate_4",
            "change_score": 0.42,
            "threshold": 0.12,
            "confidence": 0.75,
        },
    )

    assert response.status_code == 201
    event = response.json()
    assert event["type"] == "abnormal_movement"
    assert event["source"] == "camera_analytics"
    assert event["location"] == "gate_4"
    assert event["payload"]["analysis"] == "frame_difference"
    assert event["payload"]["camera_id"] == "camera-gate-4"


def test_camera_detection_requires_registered_zone(client: TestClient) -> None:
    response = client.post(
        "/camera/detections",
        json={
            "camera_id": "camera-unknown",
            "camera_name": "Unknown camera",
            "location": "unknown-zone",
            "change_score": 0.42,
            "threshold": 0.12,
            "confidence": 0.75,
        },
    )

    assert response.status_code == 422


def test_event_creates_incident(client: TestClient) -> None:
    response = client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:00:00Z"),
    )

    assert response.status_code == 201
    incidents = client.get("/incidents").json()
    assert len(incidents) == 1
    assert incidents[0]["type"] == "crowd_risk"
    assert incidents[0]["location"] == "gate_4"
    assert incidents[0]["status"] == "DETECTED"
    assert incidents[0]["risk"] == 0.168
    assert incidents[0]["severity"] == "LOW"
    assert incidents[0]["factors"]["crowd_density"] == 0.42


def test_incident_websocket_receives_created_incident(client: TestClient) -> None:
    with client.websocket_connect("/ws/incidents") as websocket:
        websocket.send_json({"type": "authenticate", "token": "test-operator-token"})
        assert websocket.receive_json() == {"type": "authenticated"}
        response = client.post(
            "/events",
            json=event_payload(timestamp="2026-09-19T12:00:00Z"),
        )

        message = websocket.receive_json()

    assert response.status_code == 201
    assert message["type"] == "incident.updated"
    assert message["incident"]["location"] == "gate_4"
    assert message["incident"]["risk"] == 0.168


def test_event_websocket_receives_persisted_event(client: TestClient) -> None:
    with client.websocket_connect("/ws/events") as websocket:
        websocket.send_json({"type": "authenticate", "token": "test-operator-token"})
        assert websocket.receive_json() == {"type": "authenticated"}
        response = client.post(
            "/events",
            json=event_payload(timestamp="2026-09-19T12:00:00Z"),
        )

        message = websocket.receive_json()

    assert response.status_code == 201
    assert message["type"] == "event.created"
    assert message["event"]["type"] == "crowd_density"
    assert message["event"]["location"] == "gate_4"


def test_incident_websocket_receives_updates_to_existing_incident(client: TestClient) -> None:
    with client.websocket_connect("/ws/incidents") as websocket:
        websocket.send_json({"type": "authenticate", "token": "test-operator-token"})
        assert websocket.receive_json() == {"type": "authenticated"}
        client.post(
            "/events",
            json=event_payload(timestamp="2026-09-19T12:00:00Z"),
        )
        websocket.receive_json()

        social_event = event_payload(
            event_type="social_concern",
            timestamp="2026-09-19T12:01:00Z",
        )
        social_event["payload"] = {"velocity": 0.8}
        client.post("/events", json=social_event)
        message = websocket.receive_json()

    assert message["type"] == "incident.updated"
    assert message["incident"]["risk"] == 0.408
    assert message["incident"]["severity"] == "MEDIUM"


def test_related_event_updates_existing_incident(client: TestClient) -> None:
    first = client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:00:00Z"),
    )
    first_incident = client.get("/incidents").json()[0]

    second_payload = event_payload(
        event_type="abnormal_movement",
        timestamp="2026-09-19T12:02:00Z",
    )
    second_payload["confidence"] = 0.99
    second = client.post("/events", json=second_payload)

    assert first.status_code == 201
    assert second.status_code == 201
    incidents = client.get("/incidents").json()
    assert len(incidents) == 1
    assert incidents[0]["id"] == first_incident["id"]
    assert incidents[0]["confidence"] == 0.99


def test_risk_keeps_explainable_contributing_factors(client: TestClient) -> None:
    client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:00:00Z"),
    )
    social_event = event_payload(
        event_type="social_concern",
        timestamp="2026-09-19T12:01:00Z",
    )
    social_event["payload"] = {"velocity": 0.8}
    client.post("/events", json=social_event)

    incident = client.get("/incidents").json()[0]

    assert incident["factors"] == {
        "crowd_density": 0.42,
        "social_velocity": 0.8,
        "abnormal_movement": 0.0,
        "citizen_reports": 0.0,
        "citizen_report_count": 0,
    }
    assert incident["risk"] == 0.408
    assert incident["severity"] == "MEDIUM"


def test_unrelated_location_does_not_affect_incident(client: TestClient) -> None:
    client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:00:00Z"),
    )
    client.post(
        "/events",
        json=event_payload(location="gate_9", timestamp="2026-09-19T12:01:00Z"),
    )

    incidents = client.get("/incidents").json()
    assert len(incidents) == 2
    assert {incident["location"] for incident in incidents} == {"gate_4", "gate_9"}


def test_old_event_does_not_attach_to_active_incident(client: TestClient) -> None:
    first = client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:10:00Z"),
    )
    old_event = client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T11:00:00Z"),
    )

    assert old_event.status_code == 201
    incidents = client.get("/incidents").json()
    assert len(incidents) == 2
    first_incident = next(
        incident for incident in incidents if incident["location"] == "gate_4"
    )
    assert first.status_code == 201
    assert first_incident["updated_at"].startswith("2026-09-19T12:10:00")


def test_get_incident_by_id(client: TestClient) -> None:
    client.post("/events", json=event_payload())
    incident = client.get("/incidents").json()[0]

    response = client.get(f"/incidents/{incident['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == incident["id"]


def test_incident_timeline_records_correlated_events(client: TestClient) -> None:
    client.post(
        "/events",
        json=event_payload(timestamp="2026-09-19T12:00:00Z"),
    )
    social_event = event_payload(
        event_type="social_concern",
        timestamp="2026-09-19T12:01:00Z",
    )
    social_event["payload"] = {"velocity": 0.8}
    client.post("/events", json=social_event)
    incident = client.get("/incidents").json()[0]

    response = client.get(f"/incidents/{incident['id']}/timeline")

    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 2
    assert [entry["type"] for entry in entries] == ["event.correlated", "event.correlated"]
    assert entries[0]["timestamp"].startswith("2026-09-19T12:00:00")
    assert entries[1]["details"]["event_type"] == "social_concern"


def test_missing_incident_timeline_returns_not_found(client: TestClient) -> None:
    response = client.get("/incidents/missing/timeline")

    assert response.status_code == 404


def test_operator_can_advance_incident_status_and_records_decision(client: TestClient) -> None:
    client.post("/events", json=event_payload(timestamp="2026-09-19T12:00:00Z"))
    incident = client.get("/incidents").json()[0]

    response = client.post(
        f"/incidents/{incident['id']}/status",
        json={"status": "ASSESSING", "note": "Operator is reviewing evidence."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ASSESSING"
    timeline = client.get(f"/incidents/{incident['id']}/timeline").json()
    status_entry = timeline[-1]
    assert status_entry["type"] == "status.changed"
    assert status_entry["details"] == {
        "from_status": "DETECTED",
        "to_status": "ASSESSING",
        "note": "Operator is reviewing evidence.",
        "operator_id": "operator-test",
        "operator_email": "operator@example.com",
    }


def test_invalid_incident_status_transition_is_rejected(client: TestClient) -> None:
    client.post("/events", json=event_payload())
    incident = client.get("/incidents").json()[0]

    response = client.post(
        f"/incidents/{incident['id']}/status",
        json={"status": "RESOLVED"},
    )

    assert response.status_code == 409


def test_missing_incident_status_update_returns_not_found(client: TestClient) -> None:
    response = client.post("/incidents/missing/status", json={"status": "ASSESSING"})

    assert response.status_code == 404


def prepare_responding_incident(client: TestClient) -> dict[str, object]:
    client.post("/events", json=event_payload())
    incident = client.get("/incidents").json()[0]
    client.post(f"/incidents/{incident['id']}/status", json={"status": "ASSESSING"})
    client.post(f"/incidents/{incident['id']}/status", json={"status": "RESPONDING"})
    return incident


def test_action_requires_responding_incident(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "http://n8n.test/webhook")
    client.post("/events", json=event_payload())
    incident = client.get("/incidents").json()[0]

    response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})

    assert response.status_code == 409


def test_action_requires_webhook_configuration(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("N8N_WEBHOOK_URL", raising=False)
    incident = prepare_responding_incident(client)

    response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})

    assert response.status_code == 503


def test_action_posts_to_n8n_and_records_timeline(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "http://n8n.test/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "demo-shared-secret")
    incident = prepare_responding_incident(client)
    response_mock = MagicMock()
    response_mock.raise_for_status.return_value = None
    client_mock = AsyncMock()
    async def acknowledge(*args, **kwargs):
        sent = kwargs["json"]
        response_mock.json.return_value = {"ok": True, "status": "accepted", "action_id": sent["action_id"], "incident_id": sent["incident"]["id"]}
        return response_mock
    client_mock.__aenter__.return_value.post.side_effect = acknowledge

    with patch("shaktios_api.main.httpx.AsyncClient", return_value=client_mock):
        response = client.post(
            f"/incidents/{incident['id']}/actions",
            json={"type": "notify_operator", "note": "Send the approved response."},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    client_mock.__aenter__.return_value.post.assert_awaited_once()
    request_kwargs = client_mock.__aenter__.return_value.post.await_args.kwargs
    assert request_kwargs["headers"]["X-ShaktiOS-Webhook-Secret"] == "demo-shared-secret"
    timeline = client.get(f"/incidents/{incident['id']}/timeline").json()
    assert timeline[-1]["type"] == "action.requested"
    assert timeline[-1]["details"]["action_type"] == "notify_operator"


def test_get_missing_incident_returns_not_found(client: TestClient) -> None:
    response = client.get("/incidents/missing")

    assert response.status_code == 404


def test_get_events_returns_persisted_events(client: TestClient) -> None:
    client.post("/events", json=event_payload("first_event"))
    client.post("/events", json=event_payload("second_event"))

    response = client.get("/events?limit=1")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_event_rejects_invalid_confidence(client: TestClient) -> None:
    payload = event_payload()
    payload["confidence"] = 1.1

    response = client.post("/events", json=payload)

    assert response.status_code == 422


def test_event_rejects_missing_required_fields(client: TestClient) -> None:
    payload = event_payload()
    del payload["source"]

    response = client.post("/events", json=payload)

    assert response.status_code == 422
