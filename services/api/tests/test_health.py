from fastapi.testclient import TestClient

from shaktios_api.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "shaktios-api"}


def test_ingest_event_normalizes_generated_fields() -> None:
    response = client.post(
        "/events",
        json={
            "type": "crowd_density",
            "source": "crowd_simulator",
            "location": "gate_4",
            "confidence": 0.95,
            "payload": {"density": 0.42},
        },
    )

    assert response.status_code == 201
    event = response.json()
    assert event["id"]
    assert event["timestamp"]
    assert event["type"] == "crowd_density"
    assert event["payload"] == {"density": 0.42}


def test_ingest_event_rejects_invalid_confidence() -> None:
    response = client.post(
        "/events",
        json={
            "type": "crowd_density",
            "source": "crowd_simulator",
            "location": "gate_4",
            "confidence": 1.1,
            "payload": {"density": 0.42},
        },
    )

    assert response.status_code == 422
