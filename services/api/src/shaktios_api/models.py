from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class Event(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: str = Field(default_factory=lambda: str(uuid4()), min_length=1, max_length=36)
    type: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=255)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    location: str = Field(min_length=1, max_length=255)
    confidence: float = Field(ge=0.0, le=1.0)
    payload: dict[str, Any]
    incident_id: str | None = None
    # Verified Supabase Auth user id (JWT sub) that submitted a
    # citizen_report. Set server-side only — never from client input.
    # None for trusted machine signals and explicitly labelled direct-SQL fixtures.
    reporter_id: str | None = Field(default=None, max_length=255)
