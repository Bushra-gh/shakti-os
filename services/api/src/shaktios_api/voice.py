"""Authenticated, ephemeral voice drafts; deliberately no event/action write imports."""

import asyncio
from collections import deque
from contextlib import asynccontextmanager, contextmanager
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from python_multipart.exceptions import MultipartParseError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.requests import ClientDisconnect

from shaktios_api.auth import AuthUser, get_current_user
from shaktios_api.api_models import VoiceConfig
from shaktios_api.database import get_db
from shaktios_api.venue_store import get_venue
from shaktios_api.voice_provider import ProviderError, VoiceDraft, api_key, create_draft

router = APIRouter(prefix="/voice", tags=["voice"])
MAX_AUDIO_SECONDS = 25  # Recorder limit; Sarvam's synchronous endpoint accepts at most 30 s.
MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_MULTIPART_OVERHEAD = 16 * 1024
MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + MAX_MULTIPART_OVERHEAD
UPLOAD_TIMEOUT_SECONDS = 20
LANGUAGES = [
    {"code": code, "label": label} for code, label in (
        ("unknown", "Auto detect"), ("en-IN", "English"), ("hi-IN", "Hindi"),
        ("bn-IN", "Bengali"), ("kn-IN", "Kannada"), ("ml-IN", "Malayalam"),
        ("mr-IN", "Marathi"), ("od-IN", "Odia"), ("pa-IN", "Punjabi"),
        ("ta-IN", "Tamil"), ("te-IN", "Telugu"), ("gu-IN", "Gujarati"),
        ("as-IN", "Assamese"), ("ur-IN", "Urdu"), ("ne-IN", "Nepali"),
        ("kok-IN", "Konkani"), ("ks-IN", "Kashmiri"), ("sd-IN", "Sindhi"),
        ("sa-IN", "Sanskrit"), ("sat-IN", "Santali"), ("mni-IN", "Manipuri"),
        ("brx-IN", "Bodo"), ("mai-IN", "Maithili"), ("doi-IN", "Dogri"),
    )
]
LANGUAGE_CODES = {language["code"] for language in LANGUAGES}
AUDIO_TYPES = {
    "audio/mp4": "recording.m4a", "audio/m4a": "recording.m4a", "audio/x-m4a": "recording.m4a",
    "audio/webm": "recording.webm", "audio/wav": "recording.wav", "audio/x-wav": "recording.wav",
    "audio/mpeg": "recording.mp3", "audio/aac": "recording.aac", "audio/ogg": "recording.ogg",
    "audio/flac": "recording.flac",
}


class VoiceLimiter:
    """Process-local MVP guard: 3 starts/min/user, 1 in-flight/user, 8 globally.

    Bounded bookkeeping; expired identities are removed. Multi-worker deployments
    need a gateway/shared limiter, not an assumption that this is distributed.
    """

    def __init__(self):
        self._lock = Lock()
        self._starts: dict[str, deque[float]] = {}
        self._active: set[str] = set()

    @contextmanager
    def lease(self, user_id: str):
        now = monotonic()
        with self._lock:
            for identity in list(self._starts):
                starts = self._starts[identity]
                while starts and starts[0] <= now - 60:
                    starts.popleft()
                if not starts and identity not in self._active:
                    del self._starts[identity]
            starts = self._starts.get(user_id)
            if (user_id in self._active or len(self._active) >= 8
                    or (starts is not None and len(starts) >= 3)
                    or (starts is None and len(self._starts) >= 2048)):
                raise HTTPException(429, "Voice request limit reached. Try later or enter the report manually.", headers={"Retry-After": "60"})
            self._starts.setdefault(user_id, deque()).append(now)
            self._active.add(user_id)
        try:
            yield
        finally:
            with self._lock:
                self._active.discard(user_id)


limiter = VoiceLimiter()


class _BoundedParser(MultiPartParser):
    # Never roll valid audio to disk. All file handles are closed in bounded_form,
    # including incomplete multipart, disconnect, timeout, cancellation and errors.
    spool_max_size = MAX_REQUEST_BYTES
    max_file_size = MAX_REQUEST_BYTES  # Older Starlette's spool threshold name.

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._header_bytes = 0

    def _check_header(self, start: int, end: int):
        self._header_bytes += end - start
        if self._header_bytes > MAX_MULTIPART_OVERHEAD:
            raise MultiPartException("Multipart headers too large")

    def on_header_field(self, data: bytes, start: int, end: int):
        self._check_header(start, end)
        super().on_header_field(data, start, end)

    def on_header_value(self, data: bytes, start: int, end: int):
        self._check_header(start, end)
        super().on_header_value(data, start, end)


@asynccontextmanager
async def bounded_form(request: Request):
    content_type = request.headers.get("content-type", "")
    if len(content_type) > 256 or content_type.split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise HTTPException(415, "Send audio using multipart/form-data.")
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_length = int(content_length)
            if declared_length < 0:
                raise ValueError
        except ValueError:
            raise HTTPException(400, "Invalid upload length.") from None
        if declared_length > MAX_REQUEST_BYTES:
            raise HTTPException(413, "Audio upload exceeds the 5 MiB limit.")
    size = 0

    async def stream():
        nonlocal size
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_REQUEST_BYTES:
                raise HTTPException(413, "Audio upload exceeds the 5 MiB limit.")
            yield chunk

    parser = _BoundedParser(request.headers, stream(), max_files=1, max_fields=3, max_part_size=512)
    try:
        try:
            async with asyncio.timeout(UPLOAD_TIMEOUT_SECONDS):
                form = await parser.parse()
        except TimeoutError:
            raise HTTPException(408, "Audio upload timed out. Try again or enter the report manually.") from None
        except (MultiPartException, MultipartParseError, ValueError, UnicodeError, ClientDisconnect):
            raise HTTPException(422, "Invalid multipart upload. Send one audio file and the required fields.") from None
        yield form, size
    finally:
        # Starlette owns these spooled handles. Closing even partially parsed files
        # also supports older Starlette versions that only clean up MultiPartException.
        for file in parser._files_to_close_on_error:
            file.close()


def _validate_form(form, total_bytes: int):
    allowed = {"audio", "venue_id", "language_code", "consent"}
    seen = set()
    for name, _ in form.multi_items():
        if name not in allowed or name in seen:
            raise HTTPException(422, "Only one audio, venue_id, language_code and consent field is allowed.")
        seen.add(name)
    if form.get("consent") != "true":
        raise HTTPException(422, "Explicit consent is required to send audio and transcript to Sarvam.")
    venue_id = form.get("venue_id")
    if not isinstance(venue_id, str) or not venue_id.strip() or len(venue_id) > 100:
        raise HTTPException(422, "Select a registered active or upcoming venue.")
    language_code = form.get("language_code", "unknown")
    if not isinstance(language_code, str) or language_code not in LANGUAGE_CODES:
        raise HTTPException(422, "Unsupported language. Select a listed language or Auto detect.")
    audio = form.get("audio")
    if not isinstance(audio, UploadFile):
        raise HTTPException(422, "One audio file is required.")
    if not audio.size:
        raise HTTPException(422, "Audio file is empty. Record a clip or enter the report manually.")
    if audio.size > MAX_AUDIO_BYTES or total_bytes - audio.size > MAX_MULTIPART_OVERHEAD:
        raise HTTPException(413, "Audio or multipart overhead exceeds the upload limit.")
    mime = (audio.content_type or "").split(";", 1)[0].strip().lower()
    if mime not in AUDIO_TYPES:
        raise HTTPException(415, "Unsupported audio type. Use M4A, WebM, WAV, MP3, AAC, Ogg or FLAC.")
    return audio, AUDIO_TYPES[mime], venue_id, language_code


@router.get("/config", response_model=VoiceConfig)
def voice_config(response: Response, _: AuthUser = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return {
        "configured": bool(api_key()), "provider": "sarvam",
        "max_audio_seconds": MAX_AUDIO_SECONDS, "max_audio_bytes": MAX_AUDIO_BYTES,
        "languages": LANGUAGES,
    }


@router.post("/draft", response_model=VoiceDraft, openapi_extra={
    "requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
        "type": "object", "required": ["audio", "venue_id", "consent"],
        "properties": {
            "audio": {"type": "string", "format": "binary"},
            "venue_id": {"type": "string", "maxLength": 100},
            "language_code": {"type": "string", "enum": sorted(LANGUAGE_CODES), "default": "unknown"},
            "consent": {"type": "string", "enum": ["true"]},
        }, "additionalProperties": False,
    }}}},
})
async def voice_draft(
    request: Request, response: Response,
    user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db),
) -> VoiceDraft:
    # No FastAPI File/Form parameters: dependencies authenticate before the first
    # body byte is consumed or any multipart temporary file can be allocated.
    response.headers["Cache-Control"] = "no-store"
    key = api_key()
    if not key:
        raise HTTPException(503, "Voice reporting is not configured. Enter the report manually.")
    with limiter.lease(user.id):
        async with bounded_form(request) as (form, size):
            audio, filename, venue_id, language_code = _validate_form(form, size)
            venue = get_venue(db, venue_id)
            if venue is None or venue.status not in {"active", "upcoming"} or not venue.zones:
                raise HTTPException(422, "Select a registered active or upcoming venue with available zones.")
            # Release the read transaction/connection before waiting on the provider.
            db.rollback()
            try:
                return await create_draft(audio, filename, venue, language_code, LANGUAGE_CODES, key)
            except ProviderError as error:
                raise HTTPException(error.status, error.detail) from None
