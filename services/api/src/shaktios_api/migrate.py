"""Apply additive ShaktiOS schema changes using SQLAlchemy metadata."""

from shaktios_api import event_store, incident_store, timeline_store  # noqa: F401
from shaktios_api.database import create_tables


def main() -> None:
    create_tables()
    print("ShaktiOS additive schema ensured.")


if __name__ == "__main__":
    main()
