from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, JSON, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from shaktios_api.database import Base
from shaktios_api.timeline_models import TimelineEntry


class TimelineEntryRecord(Base):
    __tablename__ = "incident_timeline"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    details: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)


def add_timeline_entry(
    db: Session,
    incident_id: str,
    entry_type: str,
    timestamp: datetime,
    details: dict[str, object],
) -> TimelineEntry:
    record = TimelineEntryRecord(
        id=str(uuid4()),
        incident_id=incident_id,
        type=entry_type,
        timestamp=timestamp,
        details=details,
    )
    db.add(record)
    db.flush()
    return TimelineEntry.model_validate(record, from_attributes=True)


def list_timeline_entries(db: Session, incident_id: str, limit: int) -> list[TimelineEntry]:
    records = (
        db.query(TimelineEntryRecord)
        .filter(TimelineEntryRecord.incident_id == incident_id)
        .order_by(TimelineEntryRecord.timestamp.asc(), TimelineEntryRecord.id.asc())
        .limit(limit)
        .all()
    )
    return [TimelineEntry.model_validate(record, from_attributes=True) for record in records]
