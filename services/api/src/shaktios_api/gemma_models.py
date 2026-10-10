"""Pydantic wire contracts for Gemma 4 assistance.

Additive only: existing Priority/Voice contracts are untouched. These models
are the runtime source for scripts/generate_contracts.py.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from shaktios_api.report_contracts import Category, Urgency

GemmaMime = Literal["image/jpeg", "image/png", "image/webp"]


class GemmaConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    configured: bool
    provider: Literal["gemini-api"]
    model: str
    multimodal: Literal[True] = True


class PhotoTriageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    category: Category
    description: str = Field(min_length=1, max_length=500)
    # Optional inline image for multimodal triage. Base64 without data: prefix.
    # Omitted/None means text-only triage (still via Gemma).
    image_base64: str | None = Field(default=None, max_length=2_000_000)
    mime_type: GemmaMime = "image/jpeg"


class PhotoTriageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    suggested_urgency: Urgency
    priority: bool
    reasons: list[str] = Field(max_length=3)
    visual_findings: list[str] = Field(default_factory=list, max_length=3)
    model: str


class IncidentBriefRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    location: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)
    severity: str = Field(min_length=1, max_length=50)
    risk: float = Field(ge=0, le=1)
    evidence: list[str] = Field(default_factory=list, max_length=10)


class IncidentBrief(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    brief: str = Field(max_length=1000)
    bullets: list[str] = Field(max_length=5)
    suggested_actions: list[str] = Field(default_factory=list, max_length=3)
    model: str
