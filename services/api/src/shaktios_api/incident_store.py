import os
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import DateTime, Float, JSON, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from shaktios_api.database import Base
from shaktios_api.event_store import EventRecord
from shaktios_api.incident_models import (
    Incident,
    IncidentSeverity,
    IncidentStatus,
)
from shaktios_api.models import Event
from shaktios_api.risk import calculate_risk
from shaktios_api.timeline_store import add_timeline_entry
from shaktios_api.venue_store import zone_coordinates

RELEVANT_EVENT_TYPES = {
    "crowd_density",
    "abnormal_movement",
    "social_concern",
    "citizen_report",
}


def correlation_window() -> timedelta:
    seconds = int(os.getenv("INCIDENT_CORRELATION_WINDOW_SECONDS", "300"))
    return timedelta(seconds=max(seconds, 1))


class IncidentRecord(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    type: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    risk: Mapped[float] = mapped_column(Float, nullable=False)
    factors: Mapped[dict[str, float | int]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def to_incident(record: IncidentRecord) -> Incident:
    return Incident.model_validate(record, from_attributes=True)


def correlate_event(db: Session, event: Event, event_record: EventRecord) -> Incident | None:
    if event.type not in RELEVANT_EVENT_TYPES:
        return None

    window_start = event.timestamp - correlation_window()
    incident = (
        db.query(IncidentRecord)
        .filter(
            IncidentRecord.type == "crowd_risk",
            IncidentRecord.location == event.location,
            IncidentRecord.status != IncidentStatus.RESOLVED.value,
            IncidentRecord.updated_at >= window_start,
            IncidentRecord.updated_at <= event.timestamp,
        )
        .order_by(IncidentRecord.updated_at.desc())
        .with_for_update()
        .first()
    )

    coordinates = zone_coordinates(db, event.location)
    if incident is None:
        incident = IncidentRecord(
            id=str(uuid4()),
            type="crowd_risk",
            location=event.location,
            latitude=coordinates[0] if coordinates else None,
            longitude=coordinates[1] if coordinates else None,
            status=IncidentStatus.DETECTED.value,
            severity=IncidentSeverity.MEDIUM.value,
            confidence=event.confidence,
            risk=0.0,
            factors={},
            created_at=event.timestamp,
            updated_at=event.timestamp,
        )
        db.add(incident)
        # Flush the INSERT now: events.incident_id references this row, and
        # databases with enforced foreign keys (PostgreSQL/Supabase) reject
        # a flush that UPDATEs events before the incident row exists.
        # (SQLite silently tolerates it with FK enforcement off, which hid
        # this ordering bug in local testing.)
        db.flush()
    else:
        incident.updated_at = max(incident.updated_at, event.timestamp)
        incident.confidence = max(incident.confidence, event.confidence)
        if coordinates:
            incident.latitude, incident.longitude = coordinates

    incident.risk, severity, incident.factors = calculate_risk(incident.factors, event)
    incident.severity = severity.value

    event_record.incident_id = incident.id
    add_timeline_entry(
        db,
        incident.id,
        "event.correlated",
        event.timestamp,
        {
            "event_id": event.id,
            "event_type": event.type,
            "source": event.source,
            "risk": incident.risk,
            "severity": incident.severity,
        },
    )
    db.flush()
    db.refresh(incident)
    return to_incident(incident)


def list_incidents(db: Session, limit: int) -> list[Incident]:
    records = (
        db.query(IncidentRecord)
        .order_by(IncidentRecord.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [to_incident(record) for record in records]


def get_incident(db: Session, incident_id: str) -> Incident | None:
    record = db.get(IncidentRecord, incident_id)
    return to_incident(record) if record else None
