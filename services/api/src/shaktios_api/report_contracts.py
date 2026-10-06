"""Shared literals for voice/priority assistance and citizen report status."""

from typing import Literal, get_args

Category = Literal[
    "crowd", "medical", "lost_person", "fire_smoke", "suspicious", "violence",
    "infrastructure", "other",
]
Urgency = Literal["low", "medium", "high"]
ReportStatus = Literal["submitted", "received", "under_review", "action_initiated", "resolved"]

CATEGORIES = get_args(Category)
URGENCIES = get_args(Urgency)
