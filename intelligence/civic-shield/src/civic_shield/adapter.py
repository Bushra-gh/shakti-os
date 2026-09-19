from collections.abc import Mapping
from typing import Any

import httpx


def _bounded_confidence(value: object) -> float:
    try:
        return round(max(0.0, min(1.0, float(value))), 4)
    except (TypeError, ValueError):
        return 0.0


def _first_value(signal: Mapping[str, Any], *names: str) -> object:
    for name in names:
        if signal.get(name) not in (None, ""):
            return signal[name]
    return None


class CivicShieldAdapter:
    """Normalizes Civic-Shield social analysis into a ShaktiOS Event payload."""

    source = "civic_shield"

    def to_event(self, signal: Mapping[str, Any]) -> dict[str, Any]:
        location = _first_value(signal, "location", "region", "location_name")
        if not isinstance(location, str) or not location.strip():
            raise ValueError("Civic-Shield signal requires location, region, or location_name")

        mention_count = signal.get("mention_count", 0)
        try:
            normalized_mentions = max(0, int(mention_count))
        except (TypeError, ValueError):
            normalized_mentions = 0

        confidence = _first_value(signal, "confidence", "analysis_confidence")
        if confidence is None:
            confidence = min(1.0, normalized_mentions / 100.0)

        payload = {
            "sentiment": signal.get("sentiment"),
            "emotion": signal.get("emotion"),
            "velocity": signal.get("velocity", signal.get("velocity_score")),
            "mention_count": normalized_mentions,
            "tone": signal.get("avg_tone", signal.get("tone")),
            "headline": signal.get("sample_headline"),
        }
        payload.update({
            key: signal[key]
            for key in ("query_used", "platform", "trend_status")
            if signal.get(key) is not None
        })

        return {
            "type": "social_concern",
            "source": self.source,
            "location": location.strip(),
            "confidence": _bounded_confidence(confidence),
            "payload": payload,
        }

    async def send_event(self, signal: Mapping[str, Any], api_url: str) -> dict[str, Any]:
        event = self.to_event(signal)
        endpoint = f"{api_url.rstrip('/')}/events"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(endpoint, json=event)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as error:
            raise RuntimeError(f"Could not deliver Civic-Shield event to {endpoint}: {error}") from error
