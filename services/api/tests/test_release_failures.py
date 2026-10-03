import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy.exc import OperationalError

from test_api import client, prepare_responding_incident, event_payload
from shaktios_api import main
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord
from shaktios_api.realtime import EventConnectionManager
from shaktios_api.models import Event

WEBHOOK = "https://n8n.example.invalid/webhook/test"


@pytest.mark.parametrize("ack", [None, {}, {"ok": True}, {"ok": True, "status": "accepted", "action_id": "other", "incident_id": "other"}])
def test_invalid_action_ack_never_becomes_accepted(client, monkeypatch, ack):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "test-webhook-key")
    incident = prepare_responding_incident(client)
    remote = AsyncMock()
    remote.__aenter__.return_value.post.return_value = httpx.Response(
        200, request=httpx.Request("POST", WEBHOOK), json=ack,
    )
    with patch("shaktios_api.main.httpx.AsyncClient", return_value=remote):
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert response.status_code == 502
    assert "before retrying" in response.json()["detail"]
    timeline = client.get(f"/incidents/{incident['id']}/timeline").json()
    assert timeline[-1]["type"] == "action.attempted"
    assert not any(row["type"] == "action.requested" for row in timeline)


def test_action_secret_is_mandatory(client, monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.delenv("N8N_WEBHOOK_SECRET", raising=False)
    incident = prepare_responding_incident(client)
    with patch("shaktios_api.main.httpx.AsyncClient") as remote:
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert response.status_code == 503
    remote.assert_not_called()


def test_action_is_not_sent_if_audit_cannot_be_persisted(client, monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "test-webhook-key")
    incident = prepare_responding_incident(client)
    def fail(*_):
        raise OperationalError("private SQL", {}, Exception("private connection string"))
    monkeypatch.setattr(main, "add_timeline_entry", fail)
    with patch("shaktios_api.main.httpx.AsyncClient") as remote:
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert response.status_code == 503
    assert "no webhook was sent" in response.json()["detail"]
    assert "private" not in response.text
    remote.assert_not_called()


def test_accepted_webhook_with_failed_final_db_write_has_durable_attempt(client, monkeypatch):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "test-webhook-key")
    incident = prepare_responding_incident(client)
    real_add = main.add_timeline_entry
    def add(db, incident_id, kind, *rest):
        if kind == "action.requested":
            raise OperationalError("private SQL", {}, Exception("private connection string"))
        return real_add(db, incident_id, kind, *rest)
    monkeypatch.setattr(main, "add_timeline_entry", add)
    remote = AsyncMock()
    async def accepted(*_, **kwargs):
        payload = kwargs["json"]
        with SessionLocal() as db:
            assert db.query(TimelineEntryRecord).filter(TimelineEntryRecord.type == "action.attempted").count() == 1
        return httpx.Response(200, request=httpx.Request("POST", WEBHOOK), json={
            "ok": True, "status": "accepted", "action_id": payload["action_id"], "incident_id": incident["id"],
        })
    remote.__aenter__.return_value.post.side_effect = accepted
    with patch("shaktios_api.main.httpx.AsyncClient", return_value=remote):
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert response.status_code == 502
    assert "accepted" in response.json()["detail"] and "before retrying" in response.json()["detail"]
    assert "private" not in response.text
    remote.__aenter__.return_value.post.assert_awaited_once()


def test_status_and_timeline_roll_back_together(client, monkeypatch):
    event = client.post("/events", json=event_payload()).json()
    def fail(*_):
        raise RuntimeError("simulated audit failure")
    monkeypatch.setattr(main, "add_timeline_entry", fail)
    with pytest.raises(RuntimeError):
        client.post(f"/incidents/{event['incident_id']}/status", json={"status": "ASSESSING"})
    with SessionLocal() as db:
        assert db.get(IncidentRecord, event["incident_id"]).status == "DETECTED"
        assert db.query(TimelineEntryRecord).count() == 1


def test_duplicate_event_is_conflict_without_extra_risk_or_timeline(client):
    event = client.post("/events", json=event_payload()).json()
    assert client.post("/events", json=event).status_code == 409
    with SessionLocal() as db:
        assert db.query(EventRecord).count() == db.query(TimelineEntryRecord).count() == 1


def test_websocket_disconnect_during_broadcast_does_not_fail_committed_event():
    manager = EventConnectionManager()
    class Socket:
        async def send_json(self, _):
            manager.disconnect(self)
    socket = Socket()
    manager.connections.add(socket)
    asyncio.run(manager.broadcast(Event(**event_payload())))
    assert not manager.connections


def test_database_error_is_sanitized_and_rolls_back_status(client, monkeypatch, caplog):
    event = client.post("/events", json=event_payload()).json()
    def fail(*_):
        raise OperationalError("private SQL report", {}, Exception("private database URL"))
    monkeypatch.setattr(main, "add_timeline_entry", fail)
    response = client.post(f"/incidents/{event['incident_id']}/status", json={"status": "ASSESSING"})
    assert response.status_code == 503
    assert "private" not in response.text + caplog.text
    with SessionLocal() as db:
        assert db.get(IncidentRecord, event["incident_id"]).status == "DETECTED"


def test_timeline_limit_is_bounded(client):
    event = client.post("/events", json=event_payload()).json()
    assert client.get(f"/incidents/{event['incident_id']}/timeline?limit=201").status_code == 422
