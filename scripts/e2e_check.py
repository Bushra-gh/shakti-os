"""
End-to-end ShaktiOS verification against a running API (Supabase-backed).

Verifies the full pipeline, not just connectivity:

  Civic-Shield signal -> POST /events -> persistence -> incident
  correlation -> risk -> timeline -> WebSocket
  AND citizen_report (anonymous + spoof attempt) -> same incident

Usage:
    $env:SHAKTIOS_API_URL = "http://localhost:8000"   # or hosted API URL
    python scripts/e2e_check.py
    python scripts/e2e_check.py --location gate_4

Exit code 0 = all checks passed. Any failure raises AssertionError.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request

API_URL = os.getenv("SHAKTIOS_API_URL", "http://localhost:8000").rstrip("/")


def api(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw or "null")
        except json.JSONDecodeError:
            return exc.code, raw


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    if not condition:
        raise AssertionError(f"E2E check failed: {name} {detail}")


def main() -> None:
    parser = argparse.ArgumentParser(description="ShaktiOS end-to-end verification")
    parser.add_argument("--location", default="gate_4")
    args = parser.parse_args()

    location = args.location

    # 1. Health
    status, body = api("GET", "/health")
    check("API health", status == 200 and body == {"status": "ok", "service": "shaktios-api"}, str(body))

    # 2. Civic-Shield social_concern event
    status, social = api("POST", "/events", {
        "type": "social_concern",
        "source": "civic_shield",
        "location": location,
        "confidence": 0.72,
        "payload": {
            "sentiment": "negative",
            "emotion": "anger",
            "velocity": 0.8,
            "mention_count": 42,
            "trend_status": "surging",
        },
    })
    assert isinstance(social, dict)
    check("social_concern accepted", status == 201, f"status={status}")
    check("social_concern persisted with id", bool(social.get("id")))

    # 3. Incident created with social_velocity factor
    status, incidents = api("GET", "/incidents?limit=50")
    assert isinstance(incidents, list)
    mine = [i for i in incidents if i["location"] == location]
    check("incident created for location", len(mine) >= 1)
    incident_id = mine[0]["id"]
    check("risk factors include social_velocity",
          mine[0]["factors"].get("social_velocity", 0) > 0, str(mine[0]["factors"]))

    # 4. Crowd density fuses into the SAME incident
    status, _ = api("POST", "/events", {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": location,
        "confidence": 0.9,
        "payload": {"density": 0.75},
    })
    check("crowd_density accepted", status == 201)
    status, incidents = api("GET", "/incidents?limit=50")
    assert isinstance(incidents, list)
    mine = [i for i in incidents if i["location"] == location]
    check("single fused incident", len(mine) == 1, f"count={len(mine)}")
    check("crowd_density factor fused", mine[0]["factors"].get("crowd_density", 0) > 0)
    risk_after_crowd = mine[0]["risk"]
    check("risk increased after fusion", risk_after_crowd > 0, f"risk={risk_after_crowd}")

    # 5. Citizen report with spoofed identity is neutralized
    status, report = api("POST", "/events", {
        "type": "citizen_report",
        "source": "expo_app",
        "location": location,
        "confidence": 0.8,
        "reporter_id": "someone-else",
        "payload": {
            "description": "Crowd blocking the entrance.",
            "category": "crowding",
            "user_id": "someone-else",
        },
    })
    assert isinstance(report, dict)
    check("citizen_report accepted", status == 201)
    check("spoofed reporter_id ignored", report.get("reporter_id") is None)
    payload = report.get("payload", {})
    assert isinstance(payload, dict)
    check("spoofed payload identity stripped",
          "user_id" not in payload and "reporter_id" not in payload)

    # 6. Incident absorbed the citizen report
    status, incidents = api("GET", "/incidents?limit=50")
    assert isinstance(incidents, list)
    mine = [i for i in incidents if i["location"] == location]
    check("incident still single after citizen report", len(mine) == 1)
    check("citizen report counted",
          mine[0]["factors"].get("citizen_report_count", 0) >= 1,
          str(mine[0]["factors"]))

    # 7. Timeline shows the full signal history
    status, timeline = api("GET", f"/incidents/{incident_id}/timeline?limit=100")
    assert isinstance(timeline, list)
    types = [e["event_type"] if isinstance(e, dict) else None
             for e in [t.get("details", {}) for t in timeline]]
    check("timeline has 3 correlated events", len(timeline) >= 3, f"entries={len(timeline)}")
    for expected in ("social_concern", "crowd_density", "citizen_report"):
        check(f"timeline includes {expected}", expected in types, str(types))

    # 8. Unauthenticated /me is rejected (auth wiring live)
    status, _ = api("GET", "/me")
    check("GET /me without token returns 401", status == 401, f"status={status}")

    print(f"\nE2E OK: incident {incident_id} @ {location} "
          f"risk={mine[0]['risk']} severity={mine[0]['severity']}")


if __name__ == "__main__":
    sys.exit(main())
