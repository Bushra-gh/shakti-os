"""Shared guards for opt-in demo writes; no dotenv or database access."""
import os
from urllib.parse import urlsplit


def require_demo_environment() -> None:
    if os.getenv("APP_ENV", "development").strip().lower() != "development":
        raise RuntimeError("Demo writes are allowed only with APP_ENV=development; never target production")


def machine_headers(api_url: str) -> dict[str, str]:
    require_demo_environment()
    parsed = urlsplit(api_url)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.hostname or not (
        parsed.scheme == "https" or parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    ):
        raise RuntimeError("Use an HTTPS API URL (HTTP is allowed only for loopback development)")
    key = os.getenv("SHAKTIOS_INGESTION_KEY", "").strip()
    if not key:
        raise RuntimeError("SHAKTIOS_INGESTION_KEY is required for demo machine ingestion")
    return {"X-ShaktiOS-Ingestion-Key": key}
