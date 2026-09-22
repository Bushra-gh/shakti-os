import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from shaktios_api.auth import AuthUser, get_current_user, get_optional_user
from shaktios_api.database import create_tables, get_db
from shaktios_api.event_store import EventRecord, list_events, save_event
from shaktios_api.incident_models import ActionDelivery, Incident, IncidentAction, IncidentStatus, IncidentStatusUpdate
from shaktios_api.incident_store import IncidentRecord, correlate_event, get_incident, list_incidents
from shaktios_api.models import Event
from shaktios_api.realtime import event_connections, incident_connections
from shaktios_api.timeline_models import TimelineEntry
from shaktios_api.timeline_store import add_timeline_entry, list_timeline_entries

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="ShaktiOS API", version="0.1.0", lifespan=lifespan)

def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shaktios-api"}


@app.get("/me")
def me(user: AuthUser = Depends(get_current_user)) -> dict[str, str | None]:
    """Return the verified Supabase identity (auth check for clients)."""
    return {"id": user.id, "email": user.email, "role": user.role}


# Client-supplied identity keys are never trusted. They are stripped from
# citizen_report payloads; the verified JWT sub is stamped server-side.
_UNTRUSTED_IDENTITY_KEYS = {"reporter_id", "user_id", "reporter", "userId"}


@app.post("/events", response_model=Event, status_code=201)
async def ingest_event(
    event: Event,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> Event:
    if event.type == "citizen_report":
        sanitized = {k: v for k, v in event.payload.items() if k not in _UNTRUSTED_IDENTITY_KEYS}
        event.payload = sanitized
        # Server-authoritative attribution: verified JWT sub or anonymous.
        event.reporter_id = user.id if user is not None else None
    else:
        event.reporter_id = None
    persisted_event = save_event(db, event)
    event_record = db.get(EventRecord, persisted_event.id)
    incident = None
    if event_record is not None:
        incident = correlate_event(db, persisted_event, event_record)
    if incident is not None:
        await incident_connections.broadcast(incident)
    await event_connections.broadcast(persisted_event)
    normalized_event = persisted_event.model_dump(mode="json")
    logger.info("event_received", extra={"event": normalized_event})
    return persisted_event


@app.websocket("/ws/incidents")
async def incident_updates(websocket: WebSocket) -> None:
    await incident_connections.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        incident_connections.disconnect(websocket)


@app.websocket("/ws/events")
async def event_updates(websocket: WebSocket) -> None:
    await event_connections.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_connections.disconnect(websocket)


@app.get("/events", response_model=list[Event])
def get_events(
    limit: int = Query(default=50, ge=1),
    db: Session = Depends(get_db),
) -> list[Event]:
    return list_events(db, limit)


@app.get("/incidents", response_model=list[Incident])
def get_incidents(
    limit: int = Query(default=50, ge=1),
    db: Session = Depends(get_db),
) -> list[Incident]:
    return list_incidents(db, limit)


@app.get("/incidents/{incident_id}", response_model=Incident)
def get_incident_by_id(incident_id: str, db: Session = Depends(get_db)) -> Incident:
    incident = get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@app.get("/incidents/{incident_id}/timeline", response_model=list[TimelineEntry])
def get_incident_timeline(
    incident_id: str,
    limit: int = Query(default=100, ge=1),
    db: Session = Depends(get_db),
) -> list[TimelineEntry]:
    if get_incident(db, incident_id) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return list_timeline_entries(db, incident_id, limit)


ALLOWED_STATUS_TRANSITIONS = {
    IncidentStatus.DETECTED: {IncidentStatus.ASSESSING},
    IncidentStatus.ASSESSING: {IncidentStatus.RESPONDING, IncidentStatus.RESOLVED},
    IncidentStatus.RESPONDING: {IncidentStatus.RESOLVED},
    IncidentStatus.RESOLVED: set(),
}


@app.post("/incidents/{incident_id}/status", response_model=Incident)
async def update_incident_status(
    incident_id: str,
    update: IncidentStatusUpdate,
    db: Session = Depends(get_db),
) -> Incident:
    record = db.get(IncidentRecord, incident_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    current_status = IncidentStatus(record.status)
    if update.status not in ALLOWED_STATUS_TRANSITIONS[current_status]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition incident from {current_status} to {update.status}",
        )

    record.status = update.status.value
    record.updated_at = datetime.now(timezone.utc)
    details: dict[str, object] = {
        "from_status": current_status.value,
        "to_status": update.status.value,
    }
    if update.note:
        details["note"] = update.note
    add_timeline_entry(
        db,
        incident_id,
        "status.changed",
        record.updated_at,
        details,
    )
    db.commit()
    db.refresh(record)
    incident = get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    await incident_connections.broadcast(incident)
    return incident


@app.post("/incidents/{incident_id}/actions", response_model=ActionDelivery)
async def request_incident_action(
    incident_id: str,
    action: IncidentAction,
    db: Session = Depends(get_db),
) -> ActionDelivery:
    record = db.get(IncidentRecord, incident_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if record.status != IncidentStatus.RESPONDING.value:
        raise HTTPException(status_code=409, detail="Incident must be RESPONDING before requesting an action")

    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    if not webhook_url:
        raise HTTPException(status_code=503, detail="N8N_WEBHOOK_URL is not configured")

    action_id = str(uuid4())
    incident = get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    payload = {
        "action_id": action_id,
        "action_type": action.type,
        "note": action.note,
        "incident": incident.model_dump(mode="json"),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
    except httpx.HTTPError as error:
        logger.warning("action_webhook_failed", extra={"incident_id": incident_id, "error": str(error)})
        raise HTTPException(status_code=502, detail="Action webhook delivery failed") from error

    details: dict[str, object] = {
        "action_id": action_id,
        "action_type": action.type,
        "delivery": "accepted",
    }
    if action.note:
        details["note"] = action.note
    add_timeline_entry(db, incident_id, "action.requested", datetime.now(timezone.utc), details)
    db.commit()
    return ActionDelivery(action_id=action_id, status="accepted", incident=incident)
