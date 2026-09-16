import os

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        with SessionLocal() as db:
            db.query(EventRecord).delete()
            db.commit()
        yield test_client


def event_payload(event_type: str = "crowd_density") -> dict[str, object]:
    return {
        "type": event_type,
        "source": "crowd_simulator",
        "location": "gate_4",
        "confidence": 0.95,
        "payload": {"density": 0.42},
    }


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "shaktios-api"}


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