"""Tests for Supabase Auth integration (auth.py + citizen identity stamping)."""

import os
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SUPABASE_URL"] = "https://test-ref.supabase.co"

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from shaktios_api import auth as auth_module
from shaktios_api.auth import AuthError, AuthUser, verify_token
from shaktios_api.database import SessionLocal
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.main import app
from shaktios_api.timeline_store import TimelineEntryRecord


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        with SessionLocal() as db:
            db.query(EventRecord).delete()
            db.query(IncidentRecord).delete()
            db.query(TimelineEntryRecord).delete()
            db.commit()
        yield test_client


@pytest.fixture
def rsa_keys() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


class _FakeSigningKey:
    def __init__(self, key: str) -> None:
        self.key = key


class _FakeJwksClient:
    def __init__(self, public_pem: str) -> None:
        self._public_pem = public_pem

    def get_signing_key_from_jwt(self, token: str) -> _FakeSigningKey:
        return _FakeSigningKey(self._public_pem)


def _sign(private_pem: str, **claims: object) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": "https://test-ref.supabase.co/auth/v1",
        "aud": "authenticated",
        "sub": "user-123",
        "exp": now + timedelta(hours=1),
        "iat": now,
        **claims,
    }
    return pyjwt.encode(payload, private_pem, algorithm="RS256")


def test_verify_token_accepts_valid_supabase_jwt(
    rsa_keys: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    private_pem, public_pem = rsa_keys
    monkeypatch.setattr(auth_module, "_jwks_client", lambda: _FakeJwksClient(public_pem))
    user = verify_token(_sign(private_pem, email="citizen@example.com"))
    assert isinstance(user, AuthUser)
    assert user.id == "user-123"
    assert user.email == "citizen@example.com"


def test_verify_token_rejects_wrong_issuer(
    rsa_keys: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    private_pem, public_pem = rsa_keys
    monkeypatch.setattr(auth_module, "_jwks_client", lambda: _FakeJwksClient(public_pem))
    with pytest.raises(AuthError):
        verify_token(_sign(private_pem, iss="https://evil.example.com/auth/v1"))


def test_verify_token_rejects_expired_token(
    rsa_keys: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    private_pem, public_pem = rsa_keys
    monkeypatch.setattr(auth_module, "_jwks_client", lambda: _FakeJwksClient(public_pem))
    now = datetime.now(timezone.utc)
    token = _sign(private_pem, exp=now - timedelta(hours=1))
    with pytest.raises(AuthError):
        verify_token(token)


def test_verify_token_rejects_wrong_signature(
    rsa_keys: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    _, public_pem = rsa_keys
    monkeypatch.setattr(auth_module, "_jwks_client", lambda: _FakeJwksClient(public_pem))
    with pytest.raises(AuthError):
        verify_token(_sign(other_pem))


def _citizen_payload(**extra: object) -> dict[str, object]:
    return {
        "type": "citizen_report",
        "source": "expo_app",
        "location": "gate_4",
        "confidence": 0.8,
        "payload": {"description": "Crowd blocking entrance.", "category": "crowding"},
        **extra,
    }


def test_anonymous_citizen_report_has_no_reporter(client: TestClient) -> None:
    response = client.post("/events", json=_citizen_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["reporter_id"] is None


def test_client_supplied_identity_is_stripped_and_ignored(client: TestClient) -> None:
    payload = _citizen_payload()
    assert isinstance(payload["payload"], dict)
    payload["payload"] = {
        **payload["payload"],  # type: ignore[dict-item]
        "user_id": "someone-else",
        "reporter_id": "someone-else",
    }
    payload["reporter_id"] = "someone-else"
    response = client.post("/events", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["reporter_id"] is None
    assert "user_id" not in body["payload"]
    assert "reporter_id" not in body["payload"]


def test_authenticated_citizen_report_is_stamped_with_jwt_sub(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth_module, "verify_token", lambda token: AuthUser(id="citizen-abc")
    )
    payload = _citizen_payload()
    payload["reporter_id"] = "spoofed-id"
    response = client.post(
        "/events", json=payload, headers={"Authorization": "Bearer valid.token.here"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reporter_id"] == "citizen-abc"


def test_invalid_bearer_token_returns_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(token: str) -> AuthUser:
        raise AuthError("Invalid or expired credentials")

    monkeypatch.setattr(auth_module, "verify_token", _boom)
    response = client.post(
        "/events", json=_citizen_payload(), headers={"Authorization": "Bearer bad"}
    )
    assert response.status_code == 401


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get("/me").status_code == 401


def test_me_returns_verified_identity(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth_module,
        "verify_token",
        lambda token: AuthUser(id="citizen-abc", email="c@example.com"),
    )
    response = client.get("/me", headers={"Authorization": "Bearer valid.token"})
    assert response.status_code == 200
    assert response.json()["id"] == "citizen-abc"


def test_machine_sources_stay_anonymous_and_unaffected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth_module, "verify_token", lambda token: AuthUser(id="citizen-abc")
    )
    response = client.post(
        "/events",
        json={
            "type": "social_concern",
            "source": "civic_shield",
            "location": "gate_4",
            "confidence": 0.7,
            "payload": {"velocity": 0.8},
        },
        headers={"Authorization": "Bearer valid.token"},
    )
    assert response.status_code == 201
    assert response.json()["reporter_id"] is None
