"""Non-destructive, repeatable Supabase seed for the dashboard and venue picker.

All inserted operational records are labelled seed data, not live observations.
No real citizen accounts, passwords, contacts, photos, or webhook calls are used.

From shakti-os (after `supabase db push`):
    services/api/.venv/Scripts/python.exe scripts/seed_supabase.py --dry-run
    services/api/.venv/Scripts/python.exe scripts/seed_supabase.py --apply
    services/api/.venv/Scripts/python.exe scripts/seed_supabase.py --venue venue-hackspire26-sonarpur --apply

The default is dry-run. Existing records are skipped, never truncated. The v2
batch uses deterministic UUIDs and a single transaction so reruns cannot create
duplicates. Coordinates and venue schedules are explicitly scenario fixtures.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_URL, uuid5

BATCH = "shaktios-seed-v2"
VENUES = [
    {
        "id": "venue-techfest-2026",
        "name": "TechFest — Seed Scenario",
        "description": "Seeded technology-festival scenario. Venue zones and coordinates are illustrative, not an operational event registration.",
        "venue": "Delhi · Seed Site",
        "location_label": "techfest_gate_3",
        "status": "active",
        "helpline": None,
        "zones": [
            ("techfest_gate_3", "Gate 3", 28.6139, 77.2090),
            ("techfest_food_court", "Food Court", 28.6145, 77.2098),
            ("techfest_main_stage", "Main Stage", 28.6151, 77.2085),
        ],
    },
    {
        "id": "venue-riverfest-2026",
        "name": "Riverfest — Seed Scenario",
        "description": "Seeded cultural-festival scenario for testing multi-source correlation and human-approved response. Coordinates are illustrative.",
        "venue": "Ranchi · Seed Site",
        "location_label": "riverfest_gate_4",
        "status": "active",
        "helpline": None,
        "zones": [
            ("riverfest_gate_4", "Gate 4", 23.3441, 85.3096),
            ("riverfest_gate_2", "Gate 2", 23.3450, 85.3110),
            ("riverfest_gate_9", "Gate 9", 23.3429, 85.3079),
        ],
    },
    {
        "id": "venue-durga-puja-2026",
        "name": "Kolkata Puja Circuit — Seed Scenario",
        "description": "Seeded pandal-monitoring scenario. These are illustrative records, not current crowd reports or an official event schedule.",
        "venue": "Kolkata · Seed Circuit",
        "location_label": "kol_sreebhumi",
        "status": "active",
        "helpline": None,
        "zones": [
            ("kol_sreebhumi", "Sreebhumi", 22.6026, 88.4011),
            ("kol_college_square", "College Square", 22.5737, 88.3650),
            ("kol_bagbazar", "Bagbazar", 22.6030, 88.3683),
        ],
    },
    {
        "id": "venue-hackspire26-sonarpur",
        "name": "Hackspire26 — Sonarpur Seed Scenario",
        "description": "Demo-only scenario inspired by HackSpire'26 at FIEM, Sonarpur. The five zones and coordinates are illustrative, not an official campus layout, event registration, or live safety report.",
        "venue": "FIEM area, Sonarpur, Greater Kolkata · Demo Site",
        "location_label": "hackspire26_sonarpur_registration",
        "status": "active",
        "helpline": None,
        "zones": [
            ("hackspire26_sonarpur_registration", "Hackspire26 · Registration & Entry", 22.4498, 88.4205),
            ("hackspire26_sonarpur_hacking_arena", "Hackspire26 · Hacking Arena", 22.4506, 88.4220),
            ("hackspire26_sonarpur_demo_stage", "Hackspire26 · Judging & Demo Stage", 22.4515, 88.4235),
            ("hackspire26_sonarpur_food_rest", "Hackspire26 · Food & Rest Zone", 22.4507, 88.4188),
            ("hackspire26_sonarpur_shuttle", "Hackspire26 · Shuttle Arrival", 22.4484, 88.4232),
        ],
    },
]

# Key profiles by canonical zone ID so filtering/reordering venues cannot
# accidentally assign another scenario's risk or lifecycle state.
SCENARIOS = {
    "techfest_gate_3": (0.95, "DETECTED"),
    "techfest_food_court": (0.72, "ASSESSING"),
    "techfest_main_stage": (0.34, "RESOLVED"),
    "riverfest_gate_4": (0.88, "RESPONDING"),
    "riverfest_gate_2": (0.51, "ASSESSING"),
    "riverfest_gate_9": (0.21, "DETECTED"),
    "kol_sreebhumi": (0.91, "RESPONDING"),
    "kol_college_square": (0.65, "ASSESSING"),
    "kol_bagbazar": (0.28, "RESOLVED"),
    "hackspire26_sonarpur_registration": (0.82, "ASSESSING"),
    "hackspire26_sonarpur_hacking_arena": (0.59, "DETECTED"),
    "hackspire26_sonarpur_demo_stage": (0.76, "RESPONDING"),
    "hackspire26_sonarpur_food_rest": (0.31, "ASSESSING"),
    "hackspire26_sonarpur_shuttle": (0.66, "DETECTED"),
}
TRANSITIONS = {
    "DETECTED": [], "ASSESSING": ["ASSESSING"],
    "RESPONDING": ["ASSESSING", "RESPONDING"],
    "RESOLVED": ["ASSESSING", "RESOLVED"],
}
HACKSPIRE_DETAILS = {
    "hackspire26_sonarpur_registration": "arrival queue at the registration and badge-check desks",
    "hackspire26_sonarpur_hacking_arena": "pedestrian congestion near the team workspace entrance",
    "hackspire26_sonarpur_demo_stage": "waiting teams near the judging and project-demo area",
    "hackspire26_sonarpur_food_rest": "a small refreshment queue beside the rest area",
    "hackspire26_sonarpur_shuttle": "participants waiting at the Sonarpur shuttle arrival point",
}


def selected_venues(venue_id: str | None = None) -> list[dict]:
    fixtures = [fixture for fixture in VENUES if venue_id is None or fixture["id"] == venue_id]
    if not fixtures:
        raise ValueError("Unknown seed venue")
    return fixtures


def seed_plan(venue_id: str | None = None) -> dict[str, int]:
    fixtures = selected_venues(venue_id)
    zones = [zone for fixture in fixtures for zone in fixture["zones"]]
    return {
        "venues": len(fixtures), "zones": len(zones), "incidents": len(zones),
        "events": len(zones) * 7,
        "timeline": sum(7 + len(TRANSITIONS[SCENARIOS[zone[0]][1]]) for zone in zones),
    }


def stable_id(key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"{BATCH}/{key}"))


def seed(db, now: datetime | None = None, venue_id: str | None = None) -> dict[str, int]:
    from shaktios_api.event_store import EventRecord
    from shaktios_api.incident_store import IncidentRecord
    from shaktios_api.models import Event
    from shaktios_api.risk import calculate_risk
    from shaktios_api.timeline_store import TimelineEntryRecord
    from shaktios_api.venue_store import VenueRecord, VenueZoneRecord

    now = now or datetime.now(timezone.utc).replace(microsecond=0)
    counts = {"venues": 0, "zones": 0, "incidents": 0, "events": 0, "timeline": 0}
    zone_index = 0
    for fixture in selected_venues(venue_id):
        venue = db.get(VenueRecord, fixture["id"])
        if venue is None:
            venue = VenueRecord(**{k: v for k, v in fixture.items() if k != "zones"})
            db.add(venue)
            db.flush()
            counts["venues"] += 1
        for zone_id, label, latitude, longitude in fixture["zones"]:
            if db.get(VenueZoneRecord, zone_id) is None:
                db.add(VenueZoneRecord(id=zone_id, venue_id=venue.id, label=label, latitude=latitude, longitude=longitude))
                counts["zones"] += 1
            incident_id = stable_id(zone_id)
            level, final_status = SCENARIOS[zone_id]
            zone_index += 1
            if db.get(IncidentRecord, incident_id) is not None:
                continue
            # An isolated incident per scenario; never correlate into user data.
            start = now - timedelta(minutes=30 + zone_index * 4)
            incident = IncidentRecord(
                id=incident_id, type="crowd_risk", location=zone_id,
                latitude=latitude, longitude=longitude,
                status="DETECTED", severity="LOW", confidence=0.9,
                risk=0, factors={}, created_at=start, updated_at=start,
            )
            db.add(incident)
            db.flush()
            counts["incidents"] += 1
            observations = [
                ("crowd_density", "seed_crowd_sensor", {"density": level, "description": f"Seed scenario: queue density at {label}."}),
                ("social_concern", "seed_civic_shield", {"velocity": level, "mention_count": round(level * 40), "description": f"Seed scenario: access concerns around {label}."}),
                ("abnormal_movement", "seed_movement_sensor", {"score": level, "description": f"Seed scenario: movement slows near {label}."}),
                *[("citizen_report", "seed_citizen_report", {"category": "crowd", "urgency": "normal", "description": f"Seed observation {n + 1}: pedestrian queue near {label}."}) for n in range(4)],
            ]
            if zone_id in HACKSPIRE_DETAILS:
                observations = [
                    (event_type, source, {**payload, "description": f"Hackspire26 seed observation {index + 1}: {HACKSPIRE_DETAILS[zone_id]}. Illustrative data only."})
                    for index, (event_type, source, payload) in enumerate(observations)
                ]
            for index, (event_type, source, payload) in enumerate(observations):
                timestamp = start + timedelta(seconds=20 * index)
                event = Event(
                    id=stable_id(f"{zone_id}/event/{index}"), type=event_type,
                    source=source, location=zone_id, confidence=0.9,
                    timestamp=timestamp, incident_id=incident_id, reporter_id=None,
                    payload={**payload, "seed_batch": BATCH, "is_seeded": True, "venue_event_id": venue.id, "location_label": label},
                )
                incident.risk, severity, incident.factors = calculate_risk(incident.factors, event)
                incident.severity = severity.value
                incident.updated_at = timestamp
                db.add(EventRecord(**event.model_dump()))
                db.add(TimelineEntryRecord(
                    id=stable_id(f"{zone_id}/timeline/event/{index}"), incident_id=incident_id,
                    type="event.correlated", timestamp=timestamp,
                    details={"event_id": event.id, "event_type": event.type, "source": event.source,
                             "risk": incident.risk, "severity": incident.severity, "seed_batch": BATCH},
                ))
                counts["events"] += 1
                counts["timeline"] += 1
            transitions = TRANSITIONS[final_status]
            for index, state in enumerate(transitions):
                timestamp = start + timedelta(minutes=3, seconds=20 * index)
                db.add(TimelineEntryRecord(
                    id=stable_id(f"{zone_id}/timeline/status/{index}"), incident_id=incident_id,
                    type="status.changed", timestamp=timestamp,
                    details={"from_status": incident.status, "to_status": state,
                             "note": "Seeded lifecycle example; no real operator action or dispatch occurred.",
                             "seed_batch": BATCH},
                ))
                incident.status, incident.updated_at = state, timestamp
                counts["timeline"] += 1
    db.flush()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Insert missing records into DATABASE_URL")
    mode.add_argument("--dry-run", action="store_true", help="Show the plan without a DB connection")
    parser.add_argument("--venue", choices=[fixture["id"] for fixture in VENUES], help="Seed only this venue (default: all scenarios)")
    args = parser.parse_args()
    if not args.apply:
        planned = seed_plan(args.venue)
        print("Plan (before skipping existing IDs): " + ", ".join(f"{value} {key}" for key, value in planned.items()))
        print("Existing deterministic IDs are skipped. No Auth users, private reports, contacts, or webhook calls.")
        return
    from shaktios_api.database import SessionLocal, engine
    if engine.dialect.name != "postgresql":
        raise SystemExit("Use the configured Supabase PostgreSQL DATABASE_URL to apply this seed.")
    try:
        with SessionLocal.begin() as db:
            counts = seed(db, venue_id=args.venue)
        print("Seed committed: " + ", ".join(f"{value} new {key}" for key, value in counts.items()))
    except Exception as error:
        # DB exceptions can include credentials/SQL parameters; never echo them.
        raise SystemExit(f"Seed rolled back ({type(error).__name__}). Check DATABASE_URL and apply migrations first.") from None


if __name__ == "__main__":
    main()
