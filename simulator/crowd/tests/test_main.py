import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from shaktios_crowd_simulator.main import build_event, send_event


def test_build_event_is_deterministic() -> None:
    assert build_event() == {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": "gate_4",
        "confidence": 0.95,
        "payload": {"density": 0.42, "is_seeded": True},
    }


def test_send_event_posts_to_api(monkeypatch) -> None:
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-machine-key")
    response = MagicMock()
    response.json.return_value = {"id": "event-1", "type": "crowd_density"}
    client = AsyncMock()
    client.__aenter__.return_value.post.return_value = response

    with patch("shaktios_crowd_simulator.main.httpx.AsyncClient", return_value=client):
        result = asyncio.run(send_event(build_event(), "http://localhost:8000/"))

    client.__aenter__.return_value.post.assert_awaited_once_with(
        "http://localhost:8000/events", json=build_event(), headers={"X-ShaktiOS-Ingestion-Key": "test-machine-key"}
    )
    response.raise_for_status.assert_called_once_with()
    assert result == {"id": "event-1", "type": "crowd_density"}


@pytest.mark.parametrize("density", [-0.1, 1.1, float("nan"), float("inf")])
def test_invalid_density_cannot_be_sent(density):
    with pytest.raises(ValueError):
        build_event(density=density)


def test_missing_ingestion_key_never_calls_network(monkeypatch):
    monkeypatch.delenv("SHAKTIOS_INGESTION_KEY", raising=False)
    with patch("shaktios_crowd_simulator.main.httpx.AsyncClient") as client:
        with pytest.raises(RuntimeError, match="SHAKTIOS_INGESTION_KEY"):
            asyncio.run(send_event(build_event(), "http://localhost:8000"))
    client.assert_not_called()


def test_remote_http_never_receives_credential(monkeypatch):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-machine-key")
    with patch("shaktios_crowd_simulator.main.httpx.AsyncClient") as client:
        with pytest.raises(ValueError, match="HTTPS"):
            asyncio.run(send_event(build_event(), "http://remote.example.com"))
    client.assert_not_called()
