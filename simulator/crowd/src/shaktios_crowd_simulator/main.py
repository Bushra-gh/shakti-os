import argparse
import asyncio
import json
import os

import httpx


def build_event() -> dict[str, object]:
    return {
        "type": "crowd_density",
        "source": "crowd_simulator",
        "location": "gate_4",
        "confidence": 0.95,
        "payload": {"density": 0.42},
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
        "--dry-run",
        action="store_true",
        help="Print the event without sending it",
    )
    args = parser.parse_args()
    event = build_event()
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
