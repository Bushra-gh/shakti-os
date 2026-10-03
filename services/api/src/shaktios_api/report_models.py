from typing import Literal

from shaktios_api.models import Event


ReportStatus = Literal["submitted", "received", "under_review", "action_initiated", "resolved"]


class ReportEvent(Event):
    incident_status: str | None = None
    report_status: ReportStatus
    venue_name: str | None = None
