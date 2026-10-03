from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, Session, joinedload, mapped_column, relationship

from shaktios_api.database import Base
from shaktios_api.venue_models import Venue, VenueZone


class VenueRecord(Base):
    __tablename__ = "venues"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    venue: Mapped[str] = mapped_column(String(255), nullable=False)
    location_label: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    helpline: Mapped[str | None] = mapped_column(String(64), nullable=True)
    zones: Mapped[list["VenueZoneRecord"]] = relationship(
        back_populates="venue", cascade="all, delete-orphan", order_by="VenueZoneRecord.label"
    )


class VenueZoneRecord(Base):
    __tablename__ = "venue_zones"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    venue_id: Mapped[str] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(nullable=False)
    longitude: Mapped[float] = mapped_column(nullable=False)
    venue: Mapped[VenueRecord] = relationship(back_populates="zones")


def to_venue(record: VenueRecord) -> Venue:
    return Venue(
        id=record.id,
        name=record.name,
        description=record.description,
        venue=record.venue,
        location_label=record.location_label,
        status=record.status,
        start_time=record.start_time,
        end_time=record.end_time,
        helpline=record.helpline,
        zones=[VenueZone.model_validate(zone, from_attributes=True) for zone in record.zones],
    )


def list_venues(db: Session) -> list[Venue]:
    records = db.query(VenueRecord).options(joinedload(VenueRecord.zones)).order_by(VenueRecord.name).all()
    return [to_venue(record) for record in records]


def get_venue(db: Session, venue_id: str) -> Venue | None:
    record = (
        db.query(VenueRecord)
        .options(joinedload(VenueRecord.zones))
        .filter(VenueRecord.id == venue_id)
        .one_or_none()
    )
    return to_venue(record) if record else None


def zone_coordinates(db: Session, zone_id: str) -> tuple[float, float] | None:
    zone = db.get(VenueZoneRecord, zone_id)
    return (zone.latitude, zone.longitude) if zone else None
