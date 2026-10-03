"""Diagnose failed handoffs without leaking credentials or retrying actions."""
import logging
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from test_api import client, prepare_responding_incident

WEBHOOK = "https://n8n.example.invalid/webhook/private-test-path"
SECRET = "test-secret-never-log"
PRIVATE_ERROR = "private upstream response containing test-secret-never-log"


def assert_failed_handoff(client, incident, response, caplog):
    assert response.status_code == 502
    entries = client.get(f"/incidents/{incident['id']}/timeline").json()
    assert not any(entry["type"] == "action.requested" for entry in entries)
    # Include structured log fields, not only the formatted message.
    diagnostics = response.text + str([vars(record) for record in caplog.records])
    for private_value in [WEBHOOK, SECRET, PRIVATE_ERROR]:
        assert private_value not in diagnostics


@pytest.mark.parametrize("status, hint", [
    (401, "Header Auth"),
    (403, "Header Auth"),
    (404, "Production URL"),
    (405, "POST"),
    (429, "rate limit"),
    (500, "Executions"),
    (302, "Executions"),
])
def test_webhook_status_has_actionable_safe_error(client, monkeypatch, caplog, status, hint):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", SECRET)
    incident = prepare_responding_incident(client)
    upstream = httpx.Response(status, request=httpx.Request("POST", WEBHOOK), json={"error": PRIVATE_ERROR})
    mock = AsyncMock()
    mock.__aenter__.return_value.post.return_value = upstream
    with caplog.at_level(logging.WARNING), patch("shaktios_api.main.httpx.AsyncClient", return_value=mock):
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert hint in response.json()["detail"]
    assert f"HTTP {status}" in response.json()["detail"]
    mock.__aenter__.return_value.post.assert_awaited_once()
    assert_failed_handoff(client, incident, response, caplog)


@pytest.mark.parametrize("error_type, hint", [
    (httpx.ConnectError, "could not connect"),
    (httpx.ReadTimeout, "timed out"),
    (httpx.ReadError, "network error"),
])
def test_webhook_transport_error_is_safe_and_never_retried(client, monkeypatch, caplog, error_type, hint):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", SECRET)
    incident = prepare_responding_incident(client)
    mock = AsyncMock()
    mock.__aenter__.return_value.post.side_effect = error_type(PRIVATE_ERROR, request=httpx.Request("POST", WEBHOOK))
    with caplog.at_level(logging.WARNING), patch("shaktios_api.main.httpx.AsyncClient", return_value=mock):
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert hint in response.json()["detail"]
    if error_type is not httpx.ConnectError:
        assert "before retrying" in response.json()["detail"]
    mock.__aenter__.return_value.post.assert_awaited_once()
    assert_failed_handoff(client, incident, response, caplog)


def test_negative_acknowledgement_is_not_recorded_as_accepted(client, monkeypatch, caplog):
    monkeypatch.setenv("N8N_WEBHOOK_URL", WEBHOOK)
    incident = prepare_responding_incident(client)
    mock = AsyncMock()
    mock.__aenter__.return_value.post.return_value = httpx.Response(
        200, request=httpx.Request("POST", WEBHOOK), json={"ok": False, "error": PRIVATE_ERROR},
    )
    with patch("shaktios_api.main.httpx.AsyncClient", return_value=mock):
        response = client.post(f"/incidents/{incident['id']}/actions", json={"type": "notify_operator"})
    assert "rejected" in response.json()["detail"]
    assert_failed_handoff(client, incident, response, caplog)
