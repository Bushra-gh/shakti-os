"""Opt-in development API smoke check, not a production readiness claim.

Default: read /health only. --apply stores two labelled synthetic machine events
at a unique location and checks operator persistence/correlation/timeline reads.
Requires SHAKTIOS_INGESTION_KEY and SHAKTIOS_OPERATOR_ACCESS_TOKEN. Never calls
n8n, providers, creates accounts or submits a report as an invented citizen.
Citizen ownership and WebSockets are covered by isolated API pytest tests.
"""
import argparse
import os
from uuid import uuid4

import httpx

from demo_safety import machine_headers


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Store two labelled test events on a development API")
    args = parser.parse_args()
    base = os.getenv("SHAKTIOS_API_URL", "http://localhost:8000").rstrip("/")
    headers = machine_headers(base) if args.apply else {}
    token = os.getenv("SHAKTIOS_OPERATOR_ACCESS_TOKEN", "").strip()
    if args.apply and not token:
        parser.error("SHAKTIOS_OPERATOR_ACCESS_TOKEN is required for operator reads")
    try:
        with httpx.Client(timeout=15.0, follow_redirects=False, trust_env=False) as client:
            response = client.get(f"{base}/health")
            response.raise_for_status()
            assert response.json() == {"status": "ok", "service": "shaktios-api"}
            print("PASS /health (not a DB/Auth/provider readiness check)")
            if not args.apply:
                print("No writes. Use --apply only on an intentionally configured development API.")
                return
            location = f"smoke-{uuid4()}"
            created = []
            for kind, factor in (("social_concern", "velocity"), ("crowd_density", "density")):
                response = client.post(f"{base}/events", headers=headers, json={
                    "type": kind, "source": "seed_e2e", "location": location,
                    "confidence": 0.8, "payload": {factor: 0.75, "is_seeded": True},
                })
                response.raise_for_status()
                created.append(response.json())
            assert created[0]["incident_id"] == created[1]["incident_id"]
            incident_id = created[0]["incident_id"]
            operator = {"Authorization": f"Bearer {token}"}
            response = client.get(f"{base}/incidents/{incident_id}", headers=operator)
            response.raise_for_status()
            assert response.json()["risk"] == 0.525
            response = client.get(f"{base}/incidents/{incident_id}/timeline", headers=operator)
            response.raise_for_status()
            assert len(response.json()) == 2
            assert client.get(f"{base}/me").status_code == 401
            print(f"PASS persistence/correlation/risk/timeline/auth; retained labelled fixture incident {incident_id}")
    except (httpx.HTTPError, ValueError, AssertionError):
        parser.error("Smoke check failed; any accepted test events remain stored. Inspect server diagnostics; no automatic retries.")


if __name__ == "__main__":
    main()
