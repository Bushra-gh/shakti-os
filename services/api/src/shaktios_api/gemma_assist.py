"""Authenticated, ephemeral Gemma 4 assistance; deliberately no event/action write imports."""

from fastapi import APIRouter, Depends, HTTPException, Response

from shaktios_api.auth import AuthUser, get_current_user
from shaktios_api.gemma_models import (
    GemmaConfig,
    IncidentBrief,
    IncidentBriefRequest,
    PhotoTriageRequest,
    PhotoTriageResponse,
)
from shaktios_api.gemma_provider import (
    ProviderError,
    analyze_photo,
    api_key,
    model_name,
    summarize_incident,
)
from shaktios_api.report_contracts import CATEGORIES
from shaktios_api.voice import VoiceLimiter

router = APIRouter(prefix="/assist", tags=["assist"])
limiter = VoiceLimiter()
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


@router.get("/config", response_model=GemmaConfig)
def assist_config(response: Response, _: AuthUser = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return {
        "configured": bool(api_key()),
        "provider": "gemini-api",
        "model": model_name(),
        "multimodal": True,
    }


@router.post("/photo-triage", response_model=PhotoTriageResponse)
async def photo_triage(
    body: PhotoTriageRequest, response: Response, user: AuthUser = Depends(get_current_user),
) -> PhotoTriageResponse:
    response.headers["Cache-Control"] = "no-store"
    if body.category not in CATEGORIES:
        raise HTTPException(422, "Unknown category. Select a listed category.")
    if body.mime_type not in ALLOWED_MIME:
        raise HTTPException(422, "Unsupported image type. Use JPEG, PNG or WebP.")
    try:
        body.description.encode("utf-8")
    except UnicodeError:
        raise HTTPException(422, "Description must be valid text.") from None
    key = api_key()
    if not key:
        raise HTTPException(503, "Gemma assist is not configured. Continue manually.")
    model = model_name()
    with limiter.lease(user.id):
        try:
            return await analyze_photo(
                body.category, body.description.strip(),
                body.image_base64, body.mime_type, key, model,
            )
        except ValueError as error:
            detail = str(error)
            if "Image" in detail or "image" in detail:
                raise HTTPException(422, "Image could not be processed. Send JPEG/PNG/WebP under 1.5 MB or retry text-only.") from None
            raise HTTPException(502, "Gemma assist returned an invalid response. Continue manually.") from None
        except ProviderError as error:
            raise HTTPException(error.status, error.detail) from None


@router.post("/incident-brief", response_model=IncidentBrief)
async def incident_brief(
    body: IncidentBriefRequest, response: Response, user: AuthUser = Depends(get_current_user),
) -> IncidentBrief:
    response.headers["Cache-Control"] = "no-store"
    try:
        body.location.encode("utf-8")
        for item in body.evidence:
            item.encode("utf-8")
    except UnicodeError:
        raise HTTPException(422, "Brief inputs must be valid text.") from None
    key = api_key()
    if not key:
        raise HTTPException(503, "Gemma assist is not configured. Continue manually.")
    model = model_name()
    with limiter.lease(user.id):
        try:
            return await summarize_incident(
                body.location.strip(), body.status.strip(), body.severity.strip(),
                body.risk, body.evidence, key, model,
            )
        except ProviderError as error:
            raise HTTPException(error.status, error.detail) from None
