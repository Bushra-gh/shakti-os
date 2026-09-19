import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from shaktios_crowd_simulator.main import build_event, send_event


def test_build_event_is_deterministic() -> None:
    assert build_event() == {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": "gate_4",
        "confidence": 0.95,
        "payload": {"density": 0.42},
    }


def test_send_event_posts_to_api() -> None:
    response = MagicMock()
    response.json.return_value = {"id": "event-1", "type": "crowd_density"}
    client = AsyncMock()
    client.__aenter__.return_value.post.return_value = response

    with patch("shaktios_crowd_simulator.main.httpx.AsyncClient", return_value=client):
        result = asyncio.run(send_event(build_event(), "http://localhost:8000/"))

    client.__aenter__.return_value.post.assert_awaited_once_with(
        "http://localhost:8000/events", json=build_event()
    )
    response.raise_for_status.assert_called_once_with()
    assert result == {"id": "event-1", "type": "crowd_density"}
