"""
Seed script for ShaktiOS dashboard demo.
Posts realistic events from Ranchi, Jharkhand locations to the running API.
"""

import random
import time
import httpx

API_URL = "http://localhost:8000"

LOCATIONS = {
    "gate_1": "Kanke Road Gate",
    "gate_2": "Ranchi University Gate",
    "gate_3": "Doranda Main Gate",
    "gate_4": "Lalpur Gate",
    "gate_9": "Circular Road Central",
}

EVENT_TEMPLATES = [
    {
        "type": "crowd_density",
        "source": "iot_sensor",
        "base_confidence": 0.85,
        "payload_range": {"density": (0.4, 0.95)},
    },
    {
        "type": "abnormal_movement",
        "source": "camera_analytics",
        "base_confidence": 0.80,
        "payload_range": {"score": (0.5, 0.9), "velocity": (0.3, 0.8)},
    },
    {
        "type": "social_concern",
        "source": "civic_shield",
        "base_confidence": 0.75,
        "payload_range": {"velocity": (0.4, 0.85)},
    },
    {
        "type": "citizen_report",
        "source": "public_app",
        "base_confidence": 0.70,
        "payload_range": {},
    },
]


def make_event(location: str, template: dict) -> dict:
    payload = {}
    for key, (lo, hi) in template["payload_range"].items():
        payload[key] = round(random.uniform(lo, hi), 3)
    return {
        "type": template["type"],
        "source": template["source"],
        "location": location,
        "confidence": round(template["base_confidence"] + random.uniform(-0.1, 0.1), 3),
        "payload": payload,
    }


def seed_events(count: int = 25) -> None:
    print(f"Seeding {count} events to {API_URL} ...")
    with httpx.Client(timeout=10.0) as client:
        for i in range(count):
            location = random.choice(list(LOCATIONS.keys()))
            template = random.choice(EVENT_TEMPLATES)
            event = make_event(location, template)
            try:
                resp = client.post(f"{API_URL}/events", json=event)
                resp.raise_for_status()
                created = resp.json()
                print(f"  [{i+1}/{count}] {created['type']} @ {LOCATIONS[location]} -> incident created")
            except httpx.HTTPError as exc:
                print(f"  [{i+1}/{count}] FAILED: {exc}")
            time.sleep(0.1)
    print("Done.")


if __name__ == "__main__":
    random.seed(42)
    seed_events()
