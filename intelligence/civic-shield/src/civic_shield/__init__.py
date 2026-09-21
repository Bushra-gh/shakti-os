"""Civic-Shield adapter and signal bridge for ShaktiOS."""

from civic_shield.adapter import CivicShieldAdapter
from civic_shield.bridge import build_social_signal, generate_demo_posts

__all__ = ["CivicShieldAdapter", "build_social_signal", "generate_demo_posts"]
