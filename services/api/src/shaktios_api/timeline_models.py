from datetime import datetime
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class TimelineEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(default_factory=lambda: str(uuid4()))
    incident_id: str
    type: str
    timestamp: datetime
    details: dict[str, object]
