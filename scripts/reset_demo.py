"""
Reset disposable SQLite test data ONLY. Never reset a shared/Supabase database.

Deletes all rows in FK-safe order: incident_timeline -> events -> incidents.
Tables are preserved. Requires APP_ENV=test and an explicit SQLite DATABASE_URL.
This deletes ALL local test rows, not merely labelled seed data.

Usage (from services/api with its venv):
    .\\.venv\\Scripts\\python.exe ..\\..\\scripts\\reset_demo.py --yes

Then reseed Kolkata-only:
    .\\.venv\\Scripts\\python.exe ..\\..\\scripts\\seed_kolkata_durga_puja.py

Env:
    DATABASE_URL (same value the API uses)
"""

from __future__ import annotations

import argparse
import os

from sqlalchemy import text


def main() -> int:
    parser = argparse.ArgumentParser(description="Wipe ShaktiOS demo rows (keeps schema)")
    parser.add_argument("--yes", action="store_true", help="Confirm destructive wipe")
    args = parser.parse_args()
    if not args.yes:
        print("Refusing to wipe without --yes. Re-run with --yes to confirm.")
        return 2

    if os.getenv("APP_ENV", "").strip().lower() != "test" or not os.getenv("DATABASE_URL", "").startswith("sqlite"):
        print("Refusing: reset is restricted to APP_ENV=test with an explicit disposable SQLite DATABASE_URL.")
        return 2

    from shaktios_api.database import build_engine, database_url

    url = database_url()
    scheme = url.split(":")[0]
    print(f"Wiping demo rows on {scheme} ...")
    engine = build_engine()
    # Child tables first: incident_timeline + events reference incidents.id.
    tables = ("incident_timeline", "events", "incidents")
    with engine.begin() as conn:
        before = {t: conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in tables}
        for table in tables:
            conn.execute(text(f"DELETE FROM {table}"))
        after = {t: conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in tables}
    for table in tables:
        print(f"  {table}: {before[table]} -> {after[table]} rows")
    print("Done. Schema kept; post seed data to rebuild the demo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
