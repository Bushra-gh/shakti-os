from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VenueZone(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    latitude: float
    longitude: float


class Venue(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    venue: str
    location_label: str = Field(serialization_alias="locationLabel")
    status: str
    start_time: datetime | None = Field(default=None, serialization_alias="startTime")
    end_time: datetime | None = Field(default=None, serialization_alias="endTime")
    helpline: str | None = None
    zones: list[VenueZone] = Field(default_factory=list)
