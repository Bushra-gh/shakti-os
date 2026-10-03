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

from demo_safety import machine_headers

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
    entry = dict(entry)
    if entry.get("type") == "citizen_report":
        raise ValueError("Legacy citizen fixtures cannot be submitted as authenticated users; use seed_supabase.py")
    moment = entry.pop("moment", "")
    payload = dict(entry.get("payload", {}))
    if moment and "moment" not in payload:
        payload["moment"] = moment
    payload["is_seeded"] = True
    return moment, {**entry, "source": f"seed_{entry['source']}", "payload": payload}


def seed_events(limit: int = 0, dry_run: bool = True) -> int:
    if limit < 0:
        raise ValueError("limit cannot be negative")
    entries = load_events()
    skipped = sum(entry.get("type") == "citizen_report" for entry in entries)
    entries = [entry for entry in entries if entry.get("type") != "citizen_report"]
    print(f"Skipping {skipped} legacy citizen fixtures: never impersonate a citizen.")
    if limit > 0:
        entries = entries[:limit]
    print(f"Kolkata Durga Puja seed: {len(entries)} labelled machine events ...")
    posted = 0
    if dry_run:
        for entry in entries:
            moment, event = to_api_event(dict(entry))
            print(f"  [dry-run] {event['type']} @ {event['location']} :: {moment}")
        return len(entries)
    headers = machine_headers(API_URL)
    with httpx.Client(timeout=10.0, follow_redirects=False, trust_env=False) as client:
        for i, entry in enumerate(entries):
            moment, event = to_api_event(dict(entry))
            try:
                resp = client.post(f"{API_URL}/events", json=event, headers=headers)
                resp.raise_for_status()
                posted += 1
                print(f"  [{i + 1}/{len(entries)}] {event['type']} @ {event['location']} :: {moment}")
            except httpx.HTTPError:
                raise RuntimeError("Seed stopped after a failed request; earlier events may be stored. No automatic retries.") from None
            time.sleep(0.1)
    print(f"Done. Posted {posted}/{len(entries)} Kolkata events.")
    return posted


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Kolkata Durga Puja dummy events")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Print events without sending (default)")
    mode.add_argument("--apply", action="store_true", help="Explicitly store synthetic machine fixtures")
    parser.add_argument("--limit", type=int, default=0, help="Only post first N events (0 = all)")
    args = parser.parse_args()
    try:
        seed_events(limit=args.limit, dry_run=not args.apply)
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
