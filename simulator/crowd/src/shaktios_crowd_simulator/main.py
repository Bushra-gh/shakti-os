import argparse
import asyncio
import json
import os

import httpx


KOLKATA_PANDALS: dict[str, dict[str, object]] = {
    # Durga Puja 2026 dummy locations (match scripts/kolkata_durga_puja_events.json).
    "kol_sreebhumi": {"density": 0.94},
    "kol_santosh_mitra": {"density": 0.89},
    "kol_bagbazar": {"density": 0.82},
    "kol_suruchi_sangha": {"density": 0.90},
    "kol_ekdalia": {"density": 0.84},
}


def build_event(location: str = "gate_4", density: float = 0.42) -> dict[str, object]:
    return {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": location,
        "confidence": 0.95,
        "payload": {"density": density},
    }


async def send_event(event: dict[str, object], api_url: str) -> dict[str, object]:
    endpoint = f"{api_url.rstrip('/')}/events"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(endpoint, json=event)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as error:
        raise RuntimeError(f"Could not deliver event to {endpoint}: {error}") from error


def main() -> None:
    parser = argparse.ArgumentParser(description="Send one deterministic crowd event to ShaktiOS")
    parser.add_argument(
        "--api-url",
        default=os.getenv("SHAKTIOS_API_URL", "http://localhost:8000"),
        help="ShaktiOS API base URL",
    )
    parser.add_argument(
        "--location",
        default="gate_4",
        help="Event location (e.g. gate_4 or kol_sreebhumi)",
    )
    parser.add_argument(
        "--density",
        type=float,
        default=None,
        help="Crowd density 0-1 (defaults to scenario value or 0.42)",
    )
    parser.add_argument(
        "--scenario",
        default="",
        help="Preset scenario: 'kolkata-ashtami' sends an Ashtami crush event from Sree Bhumi",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the event without sending it",
    )
    args = parser.parse_args()
    location = args.location
    density = args.density
    if args.scenario == "kolkata-ashtami":
        location = "kol_sreebhumi"
        density = 0.94 if density is None else density
    if density is None:
        preset = KOLKATA_PANDALS.get(location)
        density = float(preset["density"]) if preset else 0.42
    event = build_event(location, density)
    if args.dry_run:
        print(json.dumps(event, indent=2))
        return

    try:
        persisted = asyncio.run(send_event(event, args.api_url))
    except RuntimeError as error:
        parser.error(str(error))
    print(json.dumps(persisted, indent=2))


if __name__ == "__main__":
    main()
