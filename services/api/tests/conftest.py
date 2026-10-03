"""Hermetic test configuration, applied before application imports.

Never load developer dotenv, connect to a runtime DB, or inherit provider keys.
"""
import os

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["SUPABASE_URL"] = "https://test-ref.supabase.co"
os.environ["SUPABASE_JWT_AUDIENCE"] = "authenticated"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
for name in (
    "OPERATOR_USER_IDS", "OPERATOR_EMAILS", "SARVAM_API_KEY", "GROQ_API_KEY",
    "N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET", "SHAKTIOS_INGESTION_KEY",
    "DB_POOL_SIZE", "DB_MAX_OVERFLOW", "INCIDENT_CORRELATION_WINDOW_SECONDS",
):
    os.environ.pop(name, None)
