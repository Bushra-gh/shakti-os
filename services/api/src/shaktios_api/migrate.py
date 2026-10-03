"""Create isolated SQLite test tables, NOT a production migration tool.

Supabase schema/RLS changes are managed only by supabase/migrations SQL.
"""

from shaktios_api import event_store, incident_store, timeline_store  # noqa: F401
from shaktios_api.database import create_tables, engine


def main() -> None:
    if engine.dialect.name != "sqlite":
        raise SystemExit("Use the reviewed Supabase SQL migrations for PostgreSQL; metadata cannot migrate existing tables or RLS")
    create_tables()
    print("Isolated SQLite tables created; no Supabase migrations were applied.")


if __name__ == "__main__":
    main()
