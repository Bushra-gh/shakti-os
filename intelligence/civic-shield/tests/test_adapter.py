import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from civic_shield.adapter import CivicShieldAdapter


def test_civic_shield_signal_maps_to_social_concern_event() -> None:
    event = CivicShieldAdapter().to_event(
        {
            "region": "Delhi",
            "mention_count": 42,
            "avg_tone": -3.2,
            "sentiment": "negative",
            "emotion": "anger",
            "velocity": 0.84,
            "sample_headline": "Coverage sample",
        }
    )

    assert event == {
        "type": "social_concern",
        "source": "civic_shield",
        "location": "Delhi",
        "confidence": 0.42,
        "payload": {
            "sentiment": "negative",
            "emotion": "anger",
            "velocity": 0.84,
            "mention_count": 42,
            "tone": -3.2,
            "headline": "Coverage sample",
        },
    }


def test_civic_shield_adapter_prefers_explicit_confidence() -> None:
    event = CivicShieldAdapter().to_event(
        {"location_name": "Gate 4", "mention_count": 500, "confidence": 1.4}
    )

    assert event["location"] == "Gate 4"
    assert event["confidence"] == 1.0
    assert event["payload"]["mention_count"] == 500


def test_civic_shield_adapter_requires_location() -> None:
    with pytest.raises(ValueError, match="requires location"):
        CivicShieldAdapter().to_event({"mention_count": 2})


def test_civic_shield_adapter_sends_normalized_event(monkeypatch) -> None:
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-machine-key")
    response = MagicMock()
    response.json.return_value = {"id": "event-1"}
    client = AsyncMock()
    client.__aenter__.return_value.post.return_value = response
    signal = {"region": "Delhi", "mention_count": 42}

    with patch("civic_shield.adapter.httpx.AsyncClient", return_value=client):
        result = asyncio.run(CivicShieldAdapter().send_event(signal, "http://localhost:8000/"))

    client.__aenter__.return_value.post.assert_awaited_once_with(
        "http://localhost:8000/events", json=CivicShieldAdapter().to_event(signal), headers={"X-ShaktiOS-Ingestion-Key": "test-machine-key"}
    )
    assert result == {"id": "event-1"}


def test_send_requires_machine_key_before_network(monkeypatch):
    monkeypatch.delenv("SHAKTIOS_INGESTION_KEY", raising=False)
    with patch("civic_shield.adapter.httpx.AsyncClient") as client:
        with pytest.raises(RuntimeError, match="SHAKTIOS_INGESTION_KEY"):
            asyncio.run(CivicShieldAdapter().send_event({"location": "gate_4"}, "https://api.example.com"))
    client.assert_not_called()


@pytest.mark.parametrize("url", ["http://remote.example.com", "https://user:secret@api.example.com", "https://api.example.com?secret=x"])
def test_unsafe_destinations_rejected_before_credentials_sent(monkeypatch, url):
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-machine-key")
    with patch("civic_shield.adapter.httpx.AsyncClient") as client:
        with pytest.raises(ValueError, match="HTTPS"):
            asyncio.run(CivicShieldAdapter().send_event({"location": "gate_4"}, url))
    client.assert_not_called()
