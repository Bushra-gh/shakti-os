from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class IncidentStatus(StrEnum):
    DETECTED = "DETECTED"
    ASSESSING = "ASSESSING"
    RESPONDING = "RESPONDING"
    RESOLVED = "RESOLVED"


class IncidentSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    note: str | None = Field(default=None, max_length=500)


class IncidentAction(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=500)


class Incident(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str = Field(min_length=1)
    location: str = Field(min_length=1)
    latitude: float | None = None
    longitude: float | None = None
    status: IncidentStatus = IncidentStatus.DETECTED
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    confidence: float = Field(ge=0.0, le=1.0)
    risk: float = Field(ge=0.0, le=1.0)
    factors: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ActionDelivery(BaseModel):
    action_id: str
    status: str
    incident: Incident
