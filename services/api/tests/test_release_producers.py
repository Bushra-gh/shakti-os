"""Actual producer payloads against the current API, no external HTTP."""
from test_auth import client
from test_release_scripts import load
from shaktios_api import auth
from shaktios_api.auth import AuthUser


def test_machine_producer_payloads_use_the_authenticated_ingestion_contract(client, monkeypatch):
    adapter = load("intelligence/civic-shield/src/civic_shield/adapter.py", "release_civic")
    simulator = load("simulator/crowd/src/shaktios_crowd_simulator/main.py", "release_simulator")
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-ingestion-key")
    for payload in (adapter.CivicShieldAdapter().to_event({"location": "gate_4", "mention_count": 10}), simulator.build_event()):
        response = client.post("/events", json=payload, headers={"X-ShaktiOS-Ingestion-Key": "test-ingestion-key"})
        assert response.status_code == 201
        assert response.json()["reporter_id"] is None
        assert response.json()["incident_id"]


def test_citizen_adapter_payload_satisfies_venue_and_ownership_contract(client, monkeypatch):
    adapter = load("intelligence/citizen-report/src/citizen_report/adapter.py", "release_citizen")
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="adapter-citizen"))
    payload = adapter.CitizenReportAdapter().to_event({
        "location": "gate_4", "venue_event_id": "venue-test", "text": "Test observation",
        "reporter_id": "untrusted",
    })
    response = client.post("/events", json=payload, headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 201
    assert response.json()["source"] == "citizen_app"
    assert response.json()["reporter_id"] == "adapter-citizen"
