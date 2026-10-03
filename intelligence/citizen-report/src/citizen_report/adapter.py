import math
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

import httpx


def _confidence(value: object) -> float:
    try:
        number = float(value)
        return round(max(0.0, min(1.0, number)), 4) if math.isfinite(number) else 0.5
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

        venue_id = report.get("venue_event_id")
        if not isinstance(venue_id, str) or not venue_id.strip():
            raise ValueError("Citizen report requires venue_event_id")

        payload: dict[str, Any] = {
            "venue_event_id": venue_id.strip(),
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

    async def send_event(self, report: Mapping[str, Any], api_url: str, *, access_token: str) -> dict[str, Any]:
        event = self.to_event(report)
        if not access_token.strip():
            raise ValueError("A citizen Supabase access token is required")
        url = urlsplit(api_url)
        if url.username or url.password or url.query or url.fragment or not url.hostname or not (
            url.scheme == "https" or url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise ValueError("Use an HTTPS API URL (HTTP is allowed only for loopback development)")
        endpoint = f"{api_url.rstrip('/')}/events"
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False, trust_env=False) as client:
                response = await client.post(endpoint, json=event, headers={"Authorization": f"Bearer {access_token}"})
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError:
            raise RuntimeError("Could not deliver citizen report; check identity, venue and API availability") from None
