from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from shaktios_api.database import Base
from shaktios_api.models import Event


class EventRecord(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    type: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    incident_id: Mapped[str | None] = mapped_column(
        ForeignKey("incidents.id"), nullable=True
    )
    reporter_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


def save_event(db: Session, event: Event) -> Event:
    record = EventRecord(**event.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return Event.model_validate(record, from_attributes=True)


def list_events(db: Session, limit: int) -> list[Event]:
    records = (
        db.query(EventRecord)
        .order_by(EventRecord.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [Event.model_validate(record, from_attributes=True) for record in records]
