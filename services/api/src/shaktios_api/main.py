import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from shaktios_api.database import create_tables, get_db
from shaktios_api.event_store import EventRecord, list_events, save_event
from shaktios_api.incident_models import Incident
from shaktios_api.incident_store import correlate_event, get_incident, list_incidents
from shaktios_api.models import Event
from shaktios_api.realtime import event_connections, incident_connections

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="ShaktiOS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shaktios-api"}


@app.post("/events", response_model=Event, status_code=201)
async def ingest_event(event: Event, db: Session = Depends(get_db)) -> Event:
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
