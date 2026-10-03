"""Priority assessments: real auth/HTTP boundaries, mocked HTTPX Sarvam only, no paid calls."""

import json

import httpx
import pytest

from test_auth import client  # Existing isolated SQLite fixture, never the runtime DB.
from shaktios_api import auth, priority, voice_provider
from shaktios_api.auth import AuthUser
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.timeline_store import TimelineEntryRecord

HEADERS = {"Authorization": "Bearer citizen-token"}
SECRET = "test-only-sarvam-secret"
ASSESSMENT = {"suggested_urgency": "high", "priority": True, "reasons": ["Mentions injuries"]}
_REAL_ASYNC_CLIENT = httpx.AsyncClient


def chat(assessment=None):
    return httpx.Response(200, json={"choices": [{
        "finish_reason": "stop",
        "message": {"content": json.dumps(ASSESSMENT if assessment is None else assessment, ensure_ascii=False)},
    }]})


@pytest.fixture(autouse=True)
def safe_environment(monkeypatch):
    monkeypatch.setenv("SARVAM_API_KEY", SECRET)
    monkeypatch.delenv("SARVAM_CHAT_MODEL", raising=False)
    monkeypatch.setattr(priority, "limiter", priority.VoiceLimiter())
    monkeypatch.setattr(auth, "verify_token", lambda _: AuthUser(id="citizen-priority"))


@pytest.fixture
def provider(monkeypatch):
    requests = []
    responses = [chat()]

    async def handle(request):
        assert str(request.url) == voice_provider.CHAT_URL, "Unexpected network/action"
        await request.aread()
        requests.append(request)
        if not responses:
            pytest.fail("Unexpected provider request or automatic retry")
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def client_factory(**kwargs):
        assert kwargs["follow_redirects"] is False
        assert kwargs["trust_env"] is False
        return _REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handle), **kwargs)

    monkeypatch.setattr(voice_provider.httpx, "AsyncClient", client_factory)
    return requests, responses


def counts():
    with SessionLocal() as db:
        return tuple(db.query(model).count() for model in (EventRecord, IncidentRecord, TimelineEntryRecord))


def test_assess_returns_validated_suggestion(client, provider):
    before = counts()
    response = client.post("/priority/assess", json={
        "category": "medical", "description": "Someone collapsed near gate 2.", "has_photo": True,
    }, headers=HEADERS)
    assert response.status_code == 200, response.text
    assert response.json() == ASSESSMENT
    assert counts() == before, "Priority assessment must not write records"


def test_assess_rejects_unknown_category_without_provider_call(client, provider):
    requests, _ = provider
    response = client.post("/priority/assess", json={
        "category": "dispatch_police", "description": "Noise near the gate.",
    }, headers=HEADERS)
    assert response.status_code == 422
    assert requests == []


def test_assess_requires_authentication(client, provider):
    response = client.post("/priority/assess", json={"category": "crowd", "description": "Crowd."})
    assert response.status_code in (401, 403)


def test_assess_without_provider_key_is_actionable(client, monkeypatch, provider):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    response = client.post("/priority/assess", json={"category": "fire_smoke", "description": "Smoke near stall."}, headers=HEADERS)
    assert response.status_code == 503
    assert "manually" in response.json()["detail"]


def test_assess_invalid_provider_response_stays_manual(client, provider):
    _, responses = provider
    responses.clear()
    responses.append(chat({"suggested_urgency": "critical", "priority": "yes", "reasons": [{}]}))
    response = client.post("/priority/assess", json={"category": "violence", "description": "Fight near exit."}, headers=HEADERS)
    assert response.status_code == 502
    assert "manually" in response.json()["detail"]
