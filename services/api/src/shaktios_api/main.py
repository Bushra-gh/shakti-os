import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from shaktios_api.auth import AuthUser, AuthError, get_current_user, get_operator_user, get_optional_user, is_operator, require_machine_key, verify_token
from shaktios_api.config import app_env, validate_config
from shaktios_api.database import create_tables, get_db
from shaktios_api.event_store import EventRecord, list_events, save_event
from shaktios_api.incident_models import ActionDelivery, Incident, IncidentAction, IncidentStatus, IncidentStatusUpdate
from shaktios_api.incident_store import IncidentRecord, correlate_event, get_incident, list_incidents
from shaktios_api.models import Event
from shaktios_api.report_models import ReportEvent
from shaktios_api.report_store import get_my_report, list_my_reports
from shaktios_api.realtime import event_connections, incident_connections
from shaktios_api.timeline_models import TimelineEntry
from shaktios_api.timeline_store import add_timeline_entry, list_timeline_entries
from shaktios_api.venue_models import Venue
from shaktios_api.venue_store import get_venue, list_venues
from shaktios_api.voice import router as voice_router

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_config()
    if app_env() != "production":
        create_tables()
    yield


app = FastAPI(title="ShaktiOS API", version="0.1.0", lifespan=lifespan)
app.include_router(voice_router)


@app.exception_handler(SQLAlchemyError)
async def database_failure(_, error: SQLAlchemyError) -> JSONResponse:
    # DB exceptions can contain SQL parameters/private reports/connection URLs.
    logger.warning("database_operation_failed: kind=%s", type(error).__name__)
    return JSONResponse(status_code=503, content={"detail": "Database operation failed; no success was confirmed"})


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
def me(user: AuthUser = Depends(get_current_user)) -> dict[str, str | bool | None]:
    """Return the verified Supabase identity and operator capability."""
    return {"id": user.id, "email": user.email, "role": user.role, "is_operator": is_operator(user)}


# Client-supplied identity keys are never trusted. They are stripped from
# citizen_report payloads; the verified JWT sub is stamped server-side.
_UNTRUSTED_IDENTITY_KEYS = {"reporter_id", "user_id", "reporter", "userId"}


@app.post("/events", response_model=Event, status_code=201)
async def ingest_event(
    event: Event,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
    machine_key: str | None = Header(default=None, alias="X-ShaktiOS-Ingestion-Key"),
) -> Event:
    dashboard_source = event.source.strip().lower().startswith("dashboard")
    if dashboard_source:
        if user is None or not is_operator(user):
            raise HTTPException(status_code=403, detail="Operator access required")
        event.source = "dashboard_observation"
    if event.type == "citizen_report":
        if user is None:
            raise HTTPException(status_code=401, detail="Authentication required for citizen reports")
        venue_id = event.payload.get("venue_event_id")
        if not isinstance(venue_id, str) or not venue_id:
            raise HTTPException(status_code=422, detail="venue_event_id is required for citizen reports")
        venue = get_venue(db, venue_id)
        if venue is None or venue.status not in {"active", "upcoming"} or event.location not in {zone.id for zone in venue.zones}:
            raise HTTPException(status_code=422, detail="Report location must be a zone in an active or upcoming venue")
        if not dashboard_source:
            event.source = "citizen_app"
        sanitized = {k: v for k, v in event.payload.items() if k not in _UNTRUSTED_IDENTITY_KEYS}
        event.payload = sanitized
        # Server-authoritative attribution from the verified JWT subject.
        event.reporter_id = user.id
    else:
        if not dashboard_source:
            if user is not None:
                raise HTTPException(status_code=403, detail="Use an operator dashboard source or machine ingestion credentials without a user token")
            require_machine_key(machine_key)
            if event.source.strip().lower() in {"citizen_app", "citizen_report", "expo_app", "public_app", "seed_citizen_report"}:
                raise HTTPException(status_code=422, detail="Citizen sources require citizen_report type and user authentication")
        event.reporter_id = None
    # Correlation is server-owned; a client cannot link to a chosen incident.
    event.incident_id = None
    if db.get(EventRecord, event.id) is not None:
        raise HTTPException(status_code=409, detail="Event ID already exists")
    try:
        persisted_event = save_event(db, event)
        event_record = db.get(EventRecord, persisted_event.id)
        incident = correlate_event(db, persisted_event, event_record) if event_record is not None else None
        if incident is not None:
            persisted_event.incident_id = incident.id
        # Event, risk, correlation and timeline succeed or roll back together.
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.get(EventRecord, event.id) is not None:
            raise HTTPException(status_code=409, detail="Event ID already exists") from None
        raise HTTPException(status_code=503, detail="Event could not be stored") from None
    if incident is not None:
        await incident_connections.broadcast(incident)
    await event_connections.broadcast(persisted_event)
    logger.info("event_received", extra={"event_id": persisted_event.id, "event_type": persisted_event.type})
    return persisted_event


async def authenticate_websocket(websocket: WebSocket) -> AuthUser:
    await websocket.accept()
    try:
        message = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = message.get("token") if isinstance(message, dict) and message.get("type") == "authenticate" else None
        if not isinstance(token, str) or not token:
            raise AuthError("WebSocket authentication required")
        user = verify_token(token)
        if not is_operator(user):
            raise HTTPException(status_code=403, detail="Operator access required")
        return user
    except (asyncio.TimeoutError, AuthError, HTTPException, ValueError, TypeError) as error:
        await websocket.close(code=1008, reason="Authentication required")
        raise WebSocketDisconnect(code=1008) from error


@app.websocket("/ws/incidents")
async def incident_updates(websocket: WebSocket) -> None:
    try:
        await authenticate_websocket(websocket)
        await incident_connections.connect_after_accept(websocket)
        await websocket.send_json({"type": "authenticated"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        incident_connections.disconnect(websocket)


@app.websocket("/ws/events")
async def event_updates(websocket: WebSocket) -> None:
    try:
        await authenticate_websocket(websocket)
        await event_connections.connect_after_accept(websocket)
        await websocket.send_json({"type": "authenticated"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        event_connections.disconnect(websocket)


@app.get("/venues", response_model=list[Venue])
def get_venues(db: Session = Depends(get_db)) -> list[Venue]:
    return list_venues(db)


@app.get("/venues/{venue_id}", response_model=Venue)
def get_venue_by_id(venue_id: str, db: Session = Depends(get_db)) -> Venue:
    venue = get_venue(db, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@app.get("/me/reports", response_model=list[ReportEvent])
def get_my_reports(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportEvent]:
    return list_my_reports(db, user.id, limit, offset)


@app.get("/me/reports/{report_id}", response_model=ReportEvent)
def get_my_report_by_id(
    report_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportEvent:
    report = get_my_report(db, user.id, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/incidents/{incident_id}/events", response_model=list[Event])
def get_incident_events(
    incident_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    _: AuthUser = Depends(get_operator_user),
    db: Session = Depends(get_db),
) -> list[Event]:
    if get_incident(db, incident_id) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    records = (
        db.query(EventRecord)
        .filter(EventRecord.incident_id == incident_id)
        .order_by(EventRecord.timestamp.asc(), EventRecord.id.asc())
        .limit(limit)
        .all()
    )
    return [Event.model_validate(record, from_attributes=True) for record in records]


@app.get("/public/overview")
def public_overview(db: Session = Depends(get_db)) -> dict[str, object]:
    incidents = list_incidents(db, 100)
    events = list_events(db, 100)
    active = db.query(IncidentRecord).filter(IncidentRecord.status != IncidentStatus.RESOLVED.value)
    return {
        "incident_count": db.query(IncidentRecord).count(),
        "active_count": active.count(),
        "elevated_count": active.filter(IncidentRecord.severity.in_(["HIGH", "CRITICAL"])).count(),
        "event_count": db.query(EventRecord).count(),
        "source_count": db.query(func.count(func.distinct(EventRecord.source))).scalar(),
        "last_event_at": events[0].timestamp if events else None,
        "incidents": [
            item.model_dump(include={"id", "type", "location", "status", "severity", "risk", "updated_at", "latitude", "longitude"})
            for item in incidents
        ],
        "recent_events": [
            {
                "id": event.id,
                "type": event.type,
                "source": event.source,
                "location": event.location,
                "timestamp": event.timestamp,
            }
            for event in events[:12]
        ],
        "seeded_event_count": db.query(EventRecord).filter(EventRecord.source.startswith("seed_")).count(),
    }


@app.get("/integrations")
def integrations(_: AuthUser = Depends(get_operator_user)) -> dict[str, dict[str, bool]]:
    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    secret = os.getenv("N8N_WEBHOOK_SECRET", "").strip()
    return {"n8n": {"configured": bool(webhook_url), "authenticated": bool(webhook_url and secret)}}


@app.get("/events", response_model=list[Event])
def get_events(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_operator_user),
) -> list[Event]:
    return list_events(db, limit)


@app.get("/incidents", response_model=list[Incident])
def get_incidents(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_operator_user),
) -> list[Incident]:
    return list_incidents(db, limit)


@app.get("/incidents/{incident_id}", response_model=Incident)
def get_incident_by_id(
    incident_id: str,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_operator_user),
) -> Incident:
    incident = get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@app.get("/incidents/{incident_id}/timeline", response_model=list[TimelineEntry])
def get_incident_timeline(
    incident_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    _: AuthUser = Depends(get_operator_user),
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
    operator: AuthUser = Depends(get_operator_user),
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

    changed_at = datetime.now(timezone.utc)
    changed = db.query(IncidentRecord).filter(
        IncidentRecord.id == incident_id, IncidentRecord.status == current_status.value,
    ).update({"status": update.status.value, "updated_at": changed_at}, synchronize_session=False)
    if changed != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="Incident changed concurrently; refresh before retrying")
    details: dict[str, object] = {
        "from_status": current_status.value,
        "to_status": update.status.value,
    }
    if update.note:
        details["note"] = update.note
    details["operator_id"] = operator.id
    if operator.email:
        details["operator_email"] = operator.email
    add_timeline_entry(
        db,
        incident_id,
        "status.changed",
        changed_at,
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
    operator: AuthUser = Depends(get_operator_user),
) -> ActionDelivery:
    record = db.get(IncidentRecord, incident_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if record.status != IncidentStatus.RESPONDING.value:
        raise HTTPException(status_code=409, detail="Incident must be RESPONDING before requesting an action")

    webhook_url = os.getenv("N8N_WEBHOOK_URL", "").strip()
    webhook_secret = os.getenv("N8N_WEBHOOK_SECRET", "").strip()
    if not webhook_url or not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET must both be configured. Start FastAPI with "
                "--env-file ../../.env or export the variable in the API process."
            ),
        )

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
    webhook_headers = {"Content-Type": "application/json", "X-ShaktiOS-Webhook-Secret": webhook_secret}
    # A durable attempt exists even if the remote side accepts and the response
    # or final DB write is lost. This is an audit trail, not exactly-once delivery.
    try:
        add_timeline_entry(db, incident_id, "action.attempted", datetime.now(timezone.utc), {
            "action_id": action_id, "action_type": action.type,
            "operator_id": operator.id, "delivery": "unconfirmed",
        })
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not record the action attempt; no webhook was sent") from None
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False, trust_env=False) as client:
            response = await client.post(webhook_url, json=payload, headers=webhook_headers)
            response.raise_for_status()
            try:
                webhook_result = response.json()
            except ValueError:
                webhook_result = None
            if isinstance(webhook_result, dict) and webhook_result.get("ok") is False:
                raise HTTPException(status_code=502, detail="Action webhook rejected the payload; check n8n Executions before retrying")
            if not (
                isinstance(webhook_result, dict) and webhook_result.get("ok") is True
                and webhook_result.get("status") == "accepted"
                and webhook_result.get("action_id") == action_id
                and webhook_result.get("incident_id") == incident_id
            ):
                raise HTTPException(status_code=502, detail="Action acknowledgement is invalid or mismatched. Check n8n Executions before retrying; the workflow may already have executed")
    except HTTPException:
        raise
    except httpx.HTTPError as error:
        upstream_status = None
        if isinstance(error, httpx.HTTPStatusError):
            upstream_status = error.response.status_code
            if upstream_status in {401, 403}:
                detail = (
                    f"n8n rejected webhook access (HTTP {upstream_status}). Check the Webhook node's "
                    "Header Auth credential: X-ShaktiOS-Webhook-Secret must match N8N_WEBHOOK_SECRET. "
                    "Also check n8n access restrictions. Restart FastAPI after changing its secret."
                )
            elif upstream_status == 404:
                detail = (
                    "n8n webhook was not found (HTTP 404). Activate/publish the workflow and copy "
                    "the Webhook node's Production URL into N8N_WEBHOOK_URL, then restart FastAPI."
                )
            elif upstream_status == 405:
                detail = "n8n rejected the request method (HTTP 405). Set the Webhook node's HTTP Method to POST."
            elif upstream_status == 429:
                detail = (
                    "n8n returned a rate limit error (HTTP 429). Check n8n Executions before retrying, "
                    "and wait for the rate limit to clear."
                )
            else:
                detail = (
                    f"n8n returned HTTP {upstream_status}. Check the workflow's Executions and "
                    "Webhook response configuration before retrying; an execution may already have started."
                )
        elif isinstance(error, httpx.TimeoutException):
            detail = (
                "The n8n webhook timed out after 10 seconds. Check n8n Executions before retrying: "
                "the workflow may already have executed even though FastAPI received no acknowledgement."
            )
        elif isinstance(error, httpx.ConnectError):
            detail = (
                "FastAPI could not connect to n8n. Check N8N_WEBHOOK_URL, n8n availability, "
                "and network/TLS configuration."
            )
        else:
            detail = (
                "A network error interrupted the n8n acknowledgement. Check n8n Executions before retrying: "
                "the workflow may already have executed."
            )
        # Exception strings and upstream bodies may contain webhook URLs,
        # credentials or private payloads. Log only safe diagnostic fields.
        logger.warning(
            "action_webhook_failed: kind=%s upstream_status=%s",
            type(error).__name__, upstream_status,
            extra={"incident_id": incident_id},
        )
        raise HTTPException(status_code=502, detail=detail) from None

    details: dict[str, object] = {
        "action_id": action_id,
        "action_type": action.type,
        "delivery": "accepted",
        "operator_id": operator.id,
    }
    if operator.email:
        details["operator_email"] = operator.email
    if action.note:
        details["note"] = action.note
    try:
        add_timeline_entry(db, incident_id, "action.requested", datetime.now(timezone.utc), details)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=502, detail="n8n accepted the action but its acknowledgement could not be recorded. Check n8n Executions and the action.attempted timeline entry before retrying") from None
    await incident_connections.broadcast(incident)
    return ActionDelivery(action_id=action_id, status="accepted", incident=incident)
