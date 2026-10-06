"""Response contracts for routes that previously returned untyped dictionaries."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from shaktios_api.incident_models import IncidentSeverity, IncidentStatus


class Health(BaseModel):
    status: Literal["ok"]
    service: Literal["shaktios-api"]


class Me(BaseModel):
    id: str
    email: str | None
    role: str | None
    is_operator: bool


class N8nIntegration(BaseModel):
    configured: bool
    authenticated: bool


class Integrations(BaseModel):
    n8n: N8nIntegration


class PublicOverviewIncident(BaseModel):
    id: str
    type: str
    location: str
    status: IncidentStatus
    severity: IncidentSeverity
    risk: float
    updated_at: datetime
    latitude: float | None
    longitude: float | None


class PublicOverviewEvent(BaseModel):
    id: str
    type: str
    source: str
    location: str
    timestamp: datetime


class PublicOverview(BaseModel):
    incident_count: int
    active_count: int
    elevated_count: int
    event_count: int
    source_count: int
    last_event_at: datetime | None
    incidents: list[PublicOverviewIncident]
    recent_events: list[PublicOverviewEvent]
    seeded_event_count: int


class VoiceLanguage(BaseModel):
    code: str
    label: str


class VoiceConfig(BaseModel):
    configured: bool
    provider: Literal["sarvam"]
    max_audio_seconds: int = Field(gt=0)
    max_audio_bytes: int = Field(gt=0)
    languages: list[VoiceLanguage]
