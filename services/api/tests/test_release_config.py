import pytest

from shaktios_api import config, database


def production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:unused@db.test-ref.supabase.co/postgres?sslmode=require")
    monkeypatch.setenv("SUPABASE_URL", "https://test-ref.supabase.co")
    monkeypatch.setenv("CORS_ORIGINS", "https://dashboard.example.com,https://app.example.com")
    monkeypatch.setenv("SHAKTIOS_INGESTION_KEY", "test-only-machine-key-at-least-32-characters")


def test_production_preflight_accepts_safe_explicit_settings(monkeypatch):
    production(monkeypatch)
    config.validate_config()
    with pytest.raises(RuntimeError, match="migrations"):
        database.create_tables()


@pytest.mark.parametrize("name,value", [
    ("APP_ENV", "prod"), ("DATABASE_URL", "sqlite:///:memory:"),
    ("DATABASE_URL", "postgresql://u:p@db.test-ref.supabase.co/postgres"),
    ("DATABASE_URL", "postgresql://u:p@localhost/db?sslmode=require"),
    ("SUPABASE_URL", "http://auth.example.com"), ("SUPABASE_URL", "https://auth.example.com/auth/v1"),
    ("CORS_ORIGINS", "*"), ("CORS_ORIGINS", ""),
    ("CORS_ORIGINS", "http://localhost:3000"), ("CORS_ORIGINS", "https://example.com/path"),
    ("SHAKTIOS_INGESTION_KEY", ""), ("SHAKTIOS_INGESTION_KEY", "short"),
    ("N8N_WEBHOOK_URL", "https://n8n.example.com/webhook"),
    ("N8N_WEBHOOK_SECRET", "secret-without-url"),
    ("DB_POOL_SIZE", "0"), ("DB_MAX_OVERFLOW", "-1"),
    ("INCIDENT_CORRELATION_WINDOW_SECONDS", "not-an-int"),
])
def test_production_preflight_fails_closed_without_leaking_values(monkeypatch, name, value):
    production(monkeypatch)
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError):
        config.validate_config()


def test_production_webhook_requires_https_and_secret(monkeypatch):
    production(monkeypatch)
    monkeypatch.setenv("N8N_WEBHOOK_URL", "http://n8n.example.com/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "test-only-webhook-secret-at-least-32-characters")
    with pytest.raises(RuntimeError, match="n8n"):
        config.validate_config()
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://n8n.example.com/webhook")
    config.validate_config()


def test_missing_database_has_no_sqlite_fallback(monkeypatch):
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        database.database_url()
