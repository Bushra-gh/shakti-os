# Voice-to-report drafts: FastAPI + Sarvam

Voice is an optional input aid, **not an emergency dispatch or automatic submission path**. A signed-in citizen explicitly consents to send a short recording to Sarvam, receives a transcript and suggested fields, and must preview/edit/confirm through the existing citizen `POST /events` flow. A voice request never creates an Event, Incident, Action or Timeline entry, broadcasts an event, or calls n8n.

## Backend setup

1. Keep the existing Supabase database and Auth configuration (`DATABASE_URL`, `SUPABASE_URL`, JWT audience) described in [SUPABASE.md](SUPABASE.md). Have a registered venue whose status is exactly `active` or `upcoming`, with registered zones. Voice does not create or seed venues.
2. Install the backend dependencies, including the multipart parser:

   ```powershell
   cd services/api
   .\.venv\Scripts\python.exe -m pip install -e ".[test]"
   ```

   On POSIX, use `.venv/bin/python`. No Sarvam SDK or audio decoder is required; calls use the existing HTTPX dependency. `python-multipart>=0.0.32,<1.0` is declared in `services/api/pyproject.toml`.
3. Obtain your own Sarvam API key and set these **server-only** variables in your local, ignored root `.env` or deployment secret manager:

   ```dotenv
   SARVAM_API_KEY=<YOUR_SERVER_ONLY_SARVAM_KEY>
   SARVAM_STT_MODEL=saaras:v4
   SARVAM_CHAT_MODEL=sarvam-105b
   ```

   `.env.example` contains blank/placeholder configuration only. Never expose the key as `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, a client request field, or a committed value. Leaving the key blank disables voice while manual reporting remains available. The config endpoint checks key presence, **not validity or provider availability**, and makes no provider request.
4. When ready, manually start/restart the backend using its existing startup command:

   ```powershell
   # From services/api; only run when you intend to start your local API.
   .\.venv\Scripts\python.exe -m uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
   ```

   Restarting the API and sending real recordings are explicit runtime steps. Mocked tests do not verify the configured provider key or authorize uploading private audio.

## Mobile flow and build setup

The sibling Expo app implements **Report Incident → Describe by voice** alongside the existing manual form. It uses SDK-compatible `expo-audio` and `expo-file-system`, records at most 25 seconds, supports playback/re-record/discard, and requests microphone permission on demand. No background recording/playback mode is enabled.

1. Choose a real registered venue and open voice reporting. The client reads `/voice/config`; missing configuration leaves manual reporting available.
2. Record, listen if desired, explicitly consent to Sarvam processing, and tap **Process voice & preview**. Only this action uploads the multipart recording with the citizen's current JWT. The HTTP client lets fetch supply the multipart boundary.
3. Read the original transcript and edit category, description, zone and urgency. Missing/invalid suggestions stay unselected; the client rejects mismatched-venue results. No report is submitted during processing or preview.
4. Accept the edited preview, optionally capture device GPS, then inspect the complete review screen. A separate confirmation checkbox is required for voice-derived reports before **Submit Report**.
5. Submission uses the existing citizen `/events` path. Only final report fields are sent; raw audio and the reference transcript are not attached. Temporary audio is cleaned up after processing, discard or leaving the screen; client-side cleanup is best effort. Session/venue changes do not reuse the old voice draft.

No Sarvam credential belongs in `shaktios-app/.env`. Install dependencies with `pnpm install --frozen-lockfile` and restart Metro with `pnpm exec expo start -c`. Existing installed development/release binaries must be rebuilt to include the native audio module/permission plugin. The native config test checks that the camera plugin does not remove the audio microphone usage description.

See [MVP build readiness and native acceptance checklist](../../shaktios-app/BUILD_READINESS.md). EAS preview/production profiles are supplied, but owned application identifiers, project/signing setup, a reachable HTTPS API origin and actual native builds/device validation remain separate work. The interface remains English even though speech can be in a supported language.

## API contract

Both endpoints require `Authorization: Bearer <Supabase access token>`. Neither requires operator privileges. The verified JWT subject, never a client-provided user ID, keys the rate limit.

### `GET /voice/config`

```json
{
  "configured": true,
  "provider": "sarvam",
  "max_audio_seconds": 25,
  "max_audio_bytes": 5242880,
  "languages": [
    {"code": "unknown", "label": "Auto detect"},
    {"code": "en-IN", "label": "English"},
    {"code": "hi-IN", "label": "Hindi"}
  ]
}
```

The example abbreviates `languages`. The actual response includes Auto detect, English and all 22 Indic languages documented for Saaras: Hindi, Bengali, Kannada, Malayalam, Marathi, Odia (`od-IN`), Punjabi, Tamil, Telugu, Gujarati, Assamese, Urdu, Nepali, Konkani, Kashmiri, Sindhi, Sanskrit, Santali, Manipuri, Bodo, Maithili and Dogri. Clients should use the returned codes rather than inventing language codes.

### `POST /voice/draft`

Use multipart form data (let the client set its boundary):

| Field | Requirement |
| --- | --- |
| `audio` | Exactly one nonempty audio file; at most 5 MiB. Native M4A uses `audio/mp4` or `audio/x-m4a`; browser WebM uses `audio/webm`, including `;codecs=opus`. |
| `venue_id` | Explicitly selected registered venue ID, at most 100 characters. Venue must be active/upcoming and have zones. |
| `language_code` | Optional; defaults to `unknown` (auto detect). Must match a code from config. |
| `consent` | Required literal string `true`. The citizen must have explicitly consented to send audio and transcript to Sarvam. |

Duplicate fields, unknown fields (including identity/GPS), additional files, and invalid venue/language/consent are rejected before contacting Sarvam. Also accepted: `audio/m4a`, `audio/wav`, `audio/x-wav`, `audio/mpeg`, `audio/aac`, `audio/ogg`, `audio/flac`. Generic `application/octet-stream`, video and non-audio MIME types are rejected. This is MIME validation, not a trusted local codec decoder; invalid audio is ultimately rejected by transcription.

Response example:

```json
{
  "venue_id": "selected-registered-venue",
  "transcript": "There is a crowd blocking the entrance.",
  "language_code": "en-IN",
  "fields": {
    "category": "crowd",
    "description": "A crowd is blocking the entrance.",
    "zone_id": null,
    "urgency": null
  },
  "warnings": [
    "Review and edit this draft before confirming. No report has been submitted.",
    "Zone was missing, uncertain or invalid. Select it manually.",
    "Urgency was missing, uncertain or invalid. Select it manually."
  ],
  "requires_confirmation": true
}
```

- Categories: `crowd`, `medical`, `lost_person`, `fire_smoke`, `suspicious`, `violence`, `infrastructure`, `other`, or `null`. Missing category is **not** silently mapped to `other`.
- Urgency: `low`, `medium`, `high`, or `null`.
- Description: at most 500 characters. If extraction fails or produces an invalid description, use up to 500 transcript characters as an editable fallback, with a warning. The full accepted transcript is preserved separately (up to 8,000 characters).
- Zone: only an exact registered zone ID belonging to the selected venue, or `null`. A zone from another venue is invalid even if registered elsewhere. Missing, uncertain and invalid selections have warnings.
- Detected language: a supported provider code or `null` with a warning. The transcription remains in its original language.
- Unexpected model fields, malformed/truncated JSON, tool calls, and extraction provider failures are not trusted. Return HTTP 200 with the preserved transcript, manual-entry fields and warnings. All results still have `requires_confirmation: true`.
- No inferred GPS, reporter identity or venue is returned. Sarvam receives only the selected venue's ID/name and zone IDs/labels, not stored coordinates or the authenticated user's identity.
- Successful config/draft responses have `Cache-Control: no-store`.

### Errors and manual fallback

| HTTP status | Meaning |
| --- | --- |
| `401` | Missing/invalid/expired citizen authentication. Body is not parsed first. |
| `400` | Invalid upload Content-Length. |
| `408` | Upload exceeded its 20-second deadline. |
| `413` | Audio/total upload/multipart overhead too large. |
| `415` | Unsupported multipart or audio content type. |
| `422` | Consent/venue/language/file/form invalid, unsupported recording, or no speech detected. |
| `429` | Local per-user/concurrency guard, or Sarvam transcription quota/rate limit. Local guard includes `Retry-After: 60`. |
| `503` | Key absent or transcription provider authentication unavailable (including upstream 401/403). |
| `502` | Transcription network/provider error or malformed/oversized response. |
| `504` | Transcription provider timeout. |

Failures after a successful transcription normally return a **200 manual-entry draft**, not an error that discards the transcript. Clients should display all warnings, allow manual entry at every failure, and never automatically resubmit or retry a paid request. No raw upstream error body, key, private exception text or transcript is placed in server logs or error responses.

## Safety and limits

- The client recorder must stop at **25 seconds**. Sarvam's synchronous STT endpoint supports at most 30 seconds. The backend advertises the 25-second recording policy but **does not locally decode or independently measure audio duration**; its hard upload bounds are bytes, field counts and time. Do not represent the duration policy as server-side codec validation. A direct API client can send a longer compressed file within the byte limit; Sarvam applies its own synchronous duration limit.
- The request body is streamed with a hard total cap of `5 MiB + 16 KiB`, including requests with missing or misleading Content-Length. There is no unbounded `request.body()` call. Multipart permits one file and three small text fields (512 bytes each); headers and total non-audio overhead are bounded to 16 KiB.
- Authentication and configured-key checks precede upload parsing. Consent and venue/language validation precede any provider call. Multipart upload handles are closed on success, rejection, malformed data, disconnect, cancellation and timeout. Accepted recordings stay in bounded in-memory spools; no application audio/transcript persistence is added.
- MVP protection is **process-local**, with 3 draft starts per 60 seconds per authenticated user, one in-flight request per user, and eight in-flight requests per API process. Invalid uploads count too. Bookkeeping caps tracked users at 2,048 and removes expired entries. This is not a distributed quota or abuse-prevention system; multiple workers/replicas multiply these limits. Add a shared/gateway limiter and ingress request-size/time controls before exposing at scale.
- Each provider call has 5-second connect / 30-second network-operation timeouts and a 35-second wall-clock deadline. Provider JSON is capped at 128 KiB. At most one transcription request and one extraction request occur: **no automatic retries or redirects**.
- The provider uses fixed HTTPS Sarvam endpoints with `api-subscription-key`. Proxy environment forwarding is disabled for this client. Stable chat V1 uses JSON Schema `strict: true`, `reasoning_effort: null`, and `max_tokens: 1200`; deprecated Sarvam-M is not used.
- Transcripts and venue labels are untrusted model data, not instructions. Strict allowed fields/enums and server-side selected-venue checks constrain the draft. This cannot guarantee semantic accuracy or eliminate hallucinations; human review is mandatory.
- No new database table, storage bucket or migration is needed. Ensure your reverse proxy/APM does not capture request bodies, authorization/API-key headers or draft responses. Sarvam is a third-party processor; review its data-handling/retention terms before collecting sensitive recordings. Local non-persistence is not a promise about Sarvam's retention.

## Verification (mocked; no real audio/provider calls)

From `services/api`, with its installed virtual environment active:

```bash
python -m pytest -q tests/test_voice.py
python -m pytest -q
```

Record current results when running these commands rather than reusing a historical test count. See [CONTRIBUTING.md](CONTRIBUTING.md) for the other package checks and CI boundaries.

Tests mock the HTTPX transport and use the existing isolated in-memory SQLite fixture. Coverage includes multilingual M4A/WebM flow, provider request/schema contracts, auth before body consumption, consent, venue/language validation, field counts, 5 MiB boundaries, chunked/misleading uploads, temporary-file cleanup, upload/provider deadlines, malformed/silent responses, safe upstream 401/403/429/network failures, no retries, preserved transcripts on extraction failure, invented fields/zones, prompt-injection-shaped data, local rate/concurrency guards, absence of private error/key logging, and unchanged Event/Incident/Timeline rows. The happy path additionally asserts there are no SQL writes.

The mobile app additionally passed **12 local tests**, TypeScript, Expo SDK/peer checks and Android/production-web exports. **Six browser flow scenarios** passed against the production export with Chromium's fake microphone and intercepted Auth/API responses: consent gates multipart upload; multilingual suggestions remain editable; final confirmation submits exactly one edited report; the 25-second cap and leaving the screen release microphone tracks; permission denial and a missing key preserve the manual alternative. The browser harness is `shaktios-app/tests/voice.browser.cjs`; no real person was recorded and no external provider/database was contacted.

Real microphone permissions, actual native codec acceptance/transcription quality/latency, provider-key validity and the native mobile round trip still need a separately authorized device test. Passing mocked/backend/web checks does not claim those native/provider checks were performed.

## Official provider references

- [Speech-to-text overview](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview)
- [STT REST request fields, audio formats, languages and response](https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe)
- [Chat completion V1, model, structured outputs and reasoning controls](https://docs.sarvam.ai/api/api-guides-tutorials/chat-completion/overview)

Voice routes are in `services/api/src/shaktios_api/voice.py`; provider/extraction logic is in `voice_provider.py`. In sibling `shaktios-app`, the entry is `app/voice-report.tsx`, recording logic is in `src/hooks/useVoiceRecorder.ts`, and preview validation is in `src/utils/voice-draft.ts`.
