import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, event as sa_event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from shaktios_api.config import app_env, validate_config

# Only local development may load private dotenv. Tests and production must
# supply their environment explicitly, never inherit a developer's credentials.
if app_env() == "development":
    load_dotenv(Path(__file__).resolve().parents[4] / ".env")
validate_config()


def database_url() -> str:
    """Resolve the database URL.

    Supabase PostgreSQL is the sole runtime database. DATABASE_URL must be
    set (Supabase pooler URL with ``sslmode=require``, e.g.
    ``postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require``).

    SQLite is accepted only when explicitly configured (test suite and
    documented offline smoke tests). There is no silent fallback to a local
    PostgreSQL instance.
    """
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Set it to the Supabase PostgreSQL "
            "connection string (see .env.example). "
            "SQLite URLs are accepted for tests/offline smoke tests only."
        )
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _pool_size(default: int) -> int:
    try:
        return max(1, int(os.getenv("DB_POOL_SIZE", str(default))))
    except ValueError:
        return default


def _max_overflow(default: int) -> int:
    try:
        return max(0, int(os.getenv("DB_MAX_OVERFLOW", str(default))))
    except ValueError:
        return default


def build_engine() -> Engine:
    url = database_url()
    engine_options: dict[str, object] = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        engine_options["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url:
            engine_options["poolclass"] = StaticPool
    else:
        # Supabase's transaction pooler cannot preserve named prepared
        # statements between transactions. Disable psycopg auto-prepare to
        # avoid DuplicatePreparedStatement / prepared statement missing.
        if url.startswith("postgresql+psycopg://"):
            engine_options["connect_args"] = {"prepare_threshold": None}
        # Conservative pool sizing suitable for the Supabase shared pooler.
        engine_options["pool_size"] = _pool_size(5)
        engine_options["max_overflow"] = _max_overflow(10)
    return create_engine(url, **engine_options)


url = database_url()
engine = build_engine()
if url.startswith("sqlite"):
    # Match Supabase/PostgreSQL semantics: enforce foreign keys so
    # ordering bugs surface in tests and smoke runs, not in production.
    sa_event.listen(
        engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON")
    )
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def create_tables() -> None:
    if app_env() == "production":
        raise RuntimeError("Apply Supabase SQL migrations separately; metadata creation is disabled in production")
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
