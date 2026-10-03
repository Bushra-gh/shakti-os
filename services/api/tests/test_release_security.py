"""Release regressions use isolated SQLite and mocked boundaries only."""
import pytest

from test_auth import client, _citizen_payload
from shaktios_api import auth, main
from shaktios_api.auth import AuthUser
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord

MACHINE_EVENT = {"type": "crowd_density", "source": "crowd_simulator", "location": "gate_4", "confidence": 0.9, "payload": {"density": 0.7}}
KEY = "test-only-ingestion-key-at-least-32-characters"


def test_machine_ingestion_fails_closed(client, monkeypatch):
    assert client.post("/events", json=MACHINE_EVENT).status_code == 503
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    for headers in ({}, {"X-ShaktiOS-Ingestion-Key": "wrong"}):
        assert client.post("/events", json=MACHINE_EVENT, headers=headers).status_code == 401
    response = client.post("/events", json=MACHINE_EVENT, headers={"X-ShaktiOS-Ingestion-Key": KEY})
    assert response.status_code == 201
    assert response.json()["reporter_id"] is None


def test_citizen_jwt_does_not_grant_machine_ingestion(client, monkeypatch):
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="citizen"))
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    assert client.post("/events", json=MACHINE_EVENT, headers={"Authorization": "Bearer valid"}).status_code == 403


@pytest.mark.parametrize("source", ["civic_shield", "iot_sensor", "seed_citizen_report", " Dashboard_Observation "])
def test_citizen_cannot_spoof_trusted_sources(client, monkeypatch, source):
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="citizen"))
    response = client.post("/events", json=_citizen_payload(source=source), headers={"Authorization": "Bearer valid"})
    if "dashboard" in source.lower():
        assert response.status_code == 403
    else:
        assert response.status_code == 201
        assert response.json()["source"] == "citizen_app"


def test_ingestion_rolls_back_event_when_correlation_fails(client, monkeypatch):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    def fail(*_):
        raise RuntimeError("simulated correlation failure")
    monkeypatch.setattr(main, "correlate_event", fail)
    with pytest.raises(RuntimeError, match="simulated"):
        client.post("/events", json=MACHINE_EVENT, headers={"X-ShaktiOS-Ingestion-Key": KEY})
    with SessionLocal() as db:
        assert db.query(EventRecord).count() == 0
        assert db.query(IncidentRecord).count() == 0
        assert db.query(TimelineEntryRecord).count() == 0


def test_inactive_venue_rejects_report(client, monkeypatch):
    from shaktios_api.venue_store import VenueRecord
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="citizen"))
    with SessionLocal.begin() as db:
        db.get(VenueRecord, "venue-test").status = "ended"
    assert client.post("/events", json=_citizen_payload(), headers={"Authorization": "Bearer valid"}).status_code == 422


@pytest.mark.parametrize("authorization", ["Basic invalid", "Bearer", ""])
def test_malformed_authorization_never_falls_back_to_machine_key(client, monkeypatch, authorization):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    response = client.post("/events", json=MACHINE_EVENT, headers={"Authorization": authorization, "X-ShaktiOS-Ingestion-Key": KEY})
    assert response.status_code == 401


def test_machine_key_cannot_create_citizen_or_dashboard_events(client, monkeypatch):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    headers = {"X-ShaktiOS-Ingestion-Key": KEY}
    assert client.post("/events", json=_citizen_payload(), headers=headers).status_code == 401
    assert client.post("/events", json={**MACHINE_EVENT, "source": "dashboard_observation"}, headers=headers).status_code == 403
    assert client.post("/events", json={**MACHINE_EVENT, "source": "citizen_app"}, headers=headers).status_code == 422


@pytest.mark.parametrize("name,value", [("id", "x" * 37), ("source", " " ), ("type", "x" * 256), ("location", " ")])
def test_event_bounds_fail_validation_before_persistence(client, monkeypatch, name, value):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", KEY)
    response = client.post("/events", json={**MACHINE_EVENT, name: value}, headers={"X-ShaktiOS-Ingestion-Key": KEY})
    assert response.status_code == 422
