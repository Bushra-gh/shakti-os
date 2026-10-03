"""Print labelled synthetic machine events. Use --apply only on a development API.

No citizen reports/accounts are fabricated. For registered venues and repeatable
fixtures use seed_supabase.py instead. Never point demo scripts at production.
"""
import argparse
import json
import os
import random

import httpx

from demo_safety import machine_headers

API_URL = os.getenv("SHAKTIOS_API_URL", "http://localhost:8000").rstrip("/")
LOCATIONS = ("gate_1", "gate_2", "gate_3", "gate_4", "gate_9")
EVENT_TEMPLATES = (
    ("crowd_density", "seed_crowd_sensor", "density"),
    ("abnormal_movement", "seed_movement_sensor", "score"),
    ("social_concern", "seed_civic_shield", "velocity"),
)


def make_event() -> dict:
    kind, source, factor = random.choice(EVENT_TEMPLATES)
    return {
        "type": kind, "source": source, "location": random.choice(LOCATIONS),
        "confidence": 0.8,
        "payload": {factor: round(random.uniform(0.4, 0.9), 3), "is_seeded": True},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Confirm storing synthetic machine events")
    parser.add_argument("--count", type=int, default=25)
    args = parser.parse_args()
    if not 1 <= args.count <= 100:
        parser.error("--count must be between 1 and 100")
    random.seed(42)
    events = [make_event() for _ in range(args.count)]
    if not args.apply:
        print(json.dumps(events, indent=2))
        print("Dry run. No events sent; --apply opts in to development writes.")
        return
    try:
        headers = machine_headers(API_URL)
        with httpx.Client(timeout=10.0, follow_redirects=False, trust_env=False) as client:
            for event in events:
                response = client.post(f"{API_URL}/events", json=event, headers=headers)
                response.raise_for_status()
    except RuntimeError as error:
        parser.error(str(error))
    except httpx.HTTPError:
        parser.error("Seed stopped after a failed request; earlier events may have been stored. No automatic retries.")
    print(f"Stored {len(events)} labelled synthetic machine events.")


if __name__ == "__main__":
    main()
