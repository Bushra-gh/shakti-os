import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shaktios_api.models import Event

logger = logging.getLogger(__name__)

app = FastAPI(title="ShaktiOS API", version="0.1.0")

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
def ingest_event(event: Event) -> Event:
    normalized_event = event.model_dump(mode="json")
    logger.info("event_received", extra={"event": normalized_event})
    return event
