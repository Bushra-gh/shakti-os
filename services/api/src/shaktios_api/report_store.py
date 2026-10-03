from sqlalchemy.orm import Session

from shaktios_api.event_store import EventRecord
from shaktios_api.incident_store import IncidentRecord
from shaktios_api.models import Event
from shaktios_api.report_models import ReportEvent
from shaktios_api.venue_store import VenueRecord


def _status(incident: IncidentRecord | None) -> str:
    if incident is None:
        return "submitted"
    return {
        "DETECTED": "received",
        "ASSESSING": "under_review",
        "RESPONDING": "action_initiated",
        "RESOLVED": "resolved",
    }.get(incident.status, "submitted")


def to_report(record: EventRecord, incident: IncidentRecord | None, venue: VenueRecord | None) -> ReportEvent:
    return ReportEvent(
        **Event.model_validate(record, from_attributes=True).model_dump(),
        incident_status=incident.status if incident else None,
        report_status=_status(incident),
        venue_name=venue.name if venue else None,
    )


def list_my_reports(db: Session, reporter_id: str, limit: int, offset: int) -> list[ReportEvent]:
    rows = (
        db.query(EventRecord, IncidentRecord, VenueRecord)
        .outerjoin(IncidentRecord, EventRecord.incident_id == IncidentRecord.id)
        .outerjoin(VenueRecord, EventRecord.payload["venue_event_id"].as_string() == VenueRecord.id)
        .filter(EventRecord.reporter_id == reporter_id, EventRecord.type == "citizen_report")
        .order_by(EventRecord.timestamp.desc(), EventRecord.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [to_report(event, incident, venue) for event, incident, venue in rows]


def get_my_report(db: Session, reporter_id: str, report_id: str) -> ReportEvent | None:
    row = (
        db.query(EventRecord, IncidentRecord, VenueRecord)
        .outerjoin(IncidentRecord, EventRecord.incident_id == IncidentRecord.id)
        .outerjoin(VenueRecord, EventRecord.payload["venue_event_id"].as_string() == VenueRecord.id)
        .filter(
            EventRecord.id == report_id,
            EventRecord.reporter_id == reporter_id,
            EventRecord.type == "citizen_report",
        )
        .one_or_none()
    )
    if row is None:
        return None
    return to_report(*row)
