"""
Seed Kolkata Durga Puja 2026 dummy data into a running ShaktiOS API.

Posts curated Ashtami/Saptami/Navami/Dashami pandal moments from
scripts/kolkata_durga_puja_events.json to POST /events so each pandal
location correlates into its own crowd_risk incident.

Usage:
    python scripts/seed_kolkata_durga_puja.py [--dry-run] [--limit N]

Env:
    SHAKTIOS_API_URL (default http://localhost:8000)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

FIXTURE = Path(__file__).with_name("kolkata_durga_puja_events.json")
API_URL = os.getenv("SHAKTIOS_API_URL", "http://localhost:8000").rstrip("/")


def load_events() -> list[dict]:
    with open(FIXTURE, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("Fixture must be a list of events")
    return data


def to_api_event(entry: dict) -> tuple[str, dict]:
    """Strip the human-readable moment label into payload for the API."""
    moment = entry.pop("moment", "")
    payload = dict(entry.get("payload", {}))
    if moment and "moment" not in payload:
        payload["moment"] = moment
    return moment, {**entry, "payload": payload}


def seed_events(limit: int = 0, dry_run: bool = False) -> int:
    entries = load_events()
    if limit > 0:
        entries = entries[:limit]
    print(f"Kolkata Durga Puja seed: {len(entries)} events -> {API_URL} ...")
    posted = 0
    if dry_run:
        for entry in entries:
            moment, event = to_api_event(dict(entry))
            print(f"  [dry-run] {event['type']} @ {event['location']} :: {moment}")
        return len(entries)
    with httpx.Client(timeout=10.0) as client:
        for i, entry in enumerate(entries):
            moment, event = to_api_event(dict(entry))
            try:
                resp = client.post(f"{API_URL}/events", json=event)
                resp.raise_for_status()
                posted += 1
                print(f"  [{i + 1}/{len(entries)}] {event['type']} @ {event['location']} :: {moment}")
            except httpx.HTTPError as exc:
                print(f"  [{i + 1}/{len(entries)}] FAILED {event.get('location')}: {exc}")
            time.sleep(0.1)
    print(f"Done. Posted {posted}/{len(entries)} Kolkata events.")
    return posted


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Kolkata Durga Puja dummy events")
    parser.add_argument("--dry-run", action="store_true", help="Print events without sending")
    parser.add_argument("--limit", type=int, default=0, help="Only post first N events (0 = all)")
    args = parser.parse_args()
    try:
        seed_events(limit=args.limit, dry_run=args.dry_run)
    except (OSError, ValueError) as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
