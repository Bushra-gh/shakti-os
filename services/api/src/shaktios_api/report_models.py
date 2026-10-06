from shaktios_api.incident_models import IncidentStatus
from shaktios_api.models import Event
from shaktios_api.report_contracts import ReportStatus


class ReportEvent(Event):
    incident_status: IncidentStatus | None = None
    report_status: ReportStatus
    venue_name: str | None = None
