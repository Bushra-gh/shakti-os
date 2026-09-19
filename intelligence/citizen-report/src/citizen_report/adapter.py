from collections.abc import Mapping
from typing import Any


def _confidence(value: object) -> float:
    try:
        return round(max(0.0, min(1.0, float(value))), 4)
    except (TypeError, ValueError):
        return 0.5


class CitizenReportAdapter:
    """Normalizes a public report into a ShaktiOS citizen_report event."""

    source = "citizen_report"

    def to_event(self, report: Mapping[str, Any]) -> dict[str, Any]:
        location = report.get("location") or report.get("location_name")
        if not isinstance(location, str) or not location.strip():
            raise ValueError("Citizen report requires location or location_name")

        text = report.get("text") or report.get("description")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Citizen report requires text or description")

        payload: dict[str, Any] = {
            "description": text.strip(),
            "category": report.get("category", "other"),
            "urgency": report.get("urgency", "unknown"),
        }
        for key in ("media_count", "submitted_at", "language"):
            if report.get(key) is not None:
                payload[key] = report[key]

        return {
            "type": "citizen_report",
            "source": self.source,
            "location": location.strip(),
            "confidence": _confidence(report.get("confidence")),
            "payload": payload,
        }
