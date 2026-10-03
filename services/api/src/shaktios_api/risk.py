import math
from typing import Any

from shaktios_api.incident_models import IncidentSeverity
from shaktios_api.models import Event

WEIGHTS = {
    "crowd_density": 0.4,
    "social_velocity": 0.3,
    "abnormal_movement": 0.2,
    "citizen_reports": 0.1,
}


def bounded(value: float) -> float:
    return max(0.0, min(value, 1.0))


def numeric(value: object, fallback: float = 0.0) -> float:
    try:
        result = float(value)
        return result if math.isfinite(result) else fallback
    except (TypeError, ValueError):
        return fallback


def event_factor(event: Event, factor: str) -> float:
    if factor == "crowd_density" and event.type == "crowd_density":
        return bounded(numeric(event.payload.get("density")))
    if factor == "social_velocity" and event.type == "social_concern":
        return bounded(numeric(event.payload.get("velocity", event.confidence)))
    if factor == "abnormal_movement" and event.type == "abnormal_movement":
        return bounded(numeric(event.payload.get("score", event.confidence)))
    if factor == "citizen_reports" and event.type == "citizen_report":
        return 1.0
    return 0.0


def calculate_risk(existing: dict[str, Any], event: Event) -> tuple[float, IncidentSeverity, dict[str, Any]]:
    factors = {
        factor: bounded(numeric(existing.get(factor, 0.0)))
        for factor in WEIGHTS
    }
    factors["citizen_report_count"] = int(existing.get("citizen_report_count", 0))

    for factor in WEIGHTS:
        contribution = event_factor(event, factor)
        if factor == "citizen_reports" and contribution:
            factors["citizen_report_count"] += 1
            factors[factor] = bounded(factors["citizen_report_count"] / 5)
        else:
            factors[factor] = max(factors[factor], contribution)

    risk = round(
        bounded(sum(WEIGHTS[factor] * factors[factor] for factor in WEIGHTS)),
        4,
    )
    if risk >= 0.85:
        severity = IncidentSeverity.CRITICAL
    elif risk >= 0.70:
        severity = IncidentSeverity.HIGH
    elif risk >= 0.40:
        severity = IncidentSeverity.MEDIUM
    else:
        severity = IncidentSeverity.LOW

    return risk, severity, factors
