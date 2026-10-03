"""Release preflight; never print values of credentials or connection URLs."""

import os
from urllib.parse import urlsplit

from sqlalchemy.engine import make_url


def app_env() -> str:
    value = os.getenv("APP_ENV", "development").strip().lower()
    if value not in {"development", "test", "production"}:
        raise RuntimeError("APP_ENV must be development, test or production")
    return value


def _https_url(value: str, *, origin: bool = False) -> bool:
    try:
        parsed = urlsplit(value)
        return bool(
            parsed.scheme == "https" and parsed.hostname
            and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
            and not parsed.username and not parsed.password
            and not parsed.query and not parsed.fragment
            and (not origin or not parsed.path)
            and "*" not in value
        )
    except ValueError:
        return False


def validate_config() -> None:
    environment = app_env()
    for name, minimum in (("INCIDENT_CORRELATION_WINDOW_SECONDS", 1), ("DB_POOL_SIZE", 1), ("DB_MAX_OVERFLOW", 0)):
        raw = os.getenv(name)
        if raw is not None:
            try:
                valid = int(raw) >= minimum
            except ValueError:
                valid = False
            if not valid:
                raise RuntimeError(f"{name} must be an integer >= {minimum}")
    if environment != "production":
        return
    try:
        database = make_url(os.getenv("DATABASE_URL", ""))
        valid_database = (
            database.drivername in {"postgresql", "postgresql+psycopg"}
            and bool(database.host) and database.host.endswith((".supabase.com", ".supabase.co"))
            and bool(database.username) and bool(database.password) and bool(database.database)
        )
        valid_database = valid_database and database.query.get("sslmode") in {"require", "verify-ca", "verify-full"}
    except Exception:
        valid_database = False
    if not valid_database:
        raise RuntimeError("Production DATABASE_URL requires Supabase PostgreSQL and sslmode=require (or verify-ca/verify-full)")
    base = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    if not _https_url(base, origin=True):
        raise RuntimeError("Production SUPABASE_URL requires an HTTPS Auth origin")
    origins = [value.strip() for value in os.getenv("CORS_ORIGINS", "").split(",") if value.strip()]
    if not origins or not all(_https_url(value, origin=True) for value in origins):
        raise RuntimeError("Production CORS_ORIGINS requires explicit HTTPS origins, without paths or wildcards")
    if len(os.getenv("SHAKTIOS_INGESTION_KEY", "").strip()) < 32:
        raise RuntimeError("Production SHAKTIOS_INGESTION_KEY requires at least 32 characters")
    webhook = os.getenv("N8N_WEBHOOK_URL", "").strip()
    secret = os.getenv("N8N_WEBHOOK_SECRET", "").strip()
    if webhook or secret:
        if not _https_url(webhook) or len(secret) < 32:
            raise RuntimeError("Production n8n requires an HTTPS N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET of at least 32 characters")
