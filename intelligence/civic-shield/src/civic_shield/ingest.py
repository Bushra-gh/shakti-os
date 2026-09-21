#!/usr/bin/env python3
"""Demo script: Civic-Shield → ShaktiOS Event ingestion.

Generates a social concern scenario, analyzes it using the Civic-Shield
bridge, and sends the normalized Event to the ShaktiOS API.

Usage:
    python -m civic_shield.ingest                    # Use defaults
    python -m civic_shield.ingest --location "Gate 4" --api-url http://localhost:8000
    python -m civic_shield.ingest --local            # Print event without sending
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from civic_shield.adapter import CivicShieldAdapter
from civic_shield.bridge import build_social_signal, generate_demo_posts


def main() -> None:
    parser = argparse.ArgumentParser(description="Civic-Shield → ShaktiOS demo ingestion")
    parser.add_argument("--location", default="Gate 4", help="Location for the scenario")
    parser.add_argument("--count", type=int, default=12, help="Number of demo posts")
    parser.add_argument("--negative-ratio", type=float, default=0.5, help="Ratio of negative posts")
    parser.add_argument("--api-url", default="http://localhost:8000", help="ShaktiOS API base URL")
    parser.add_argument("--local", action="store_true", help="Print event JSON without sending")
    args = parser.parse_args()

    print(f"[bridge] Generating {args.count} demo posts for '{args.location}'...")
    posts = generate_demo_posts(
        location=args.location,
        count=args.count,
        negative_ratio=args.negative_ratio,
    )

    print("[bridge] Running sentiment, trend, credibility analysis...")
    signal = build_social_signal(posts=posts, location=args.location)

    print(f"[bridge] Dominant sentiment: {signal['sentiment']}  emotion: {signal['emotion']}")
    print(f"[bridge] Velocity: {signal['velocity']:.2f}  mentions: {signal['mention_count']}")
    print(f"[bridge] Trend status: {signal['trend_status']}")

    adapter = CivicShieldAdapter()
    event = adapter.to_event(signal)

    print("\n[normalized event]")
    print(json.dumps(event, indent=2))

    if args.local:
        print("\n[local mode] Event not sent. Use without --local to POST to ShaktiOS.")
        return

    print(f"\n[send] POSTing to {args.api_url}/events ...")
    result = asyncio.run(adapter.send_event(signal, args.api_url))
    print(f"[send] Response: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    main()
