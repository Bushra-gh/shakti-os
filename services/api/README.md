# ShaktiOS API

FastAPI service for venue-backed reports, verified identity/ownership, Event persistence, Incident correlation, explainable Risk, timelines, operator decisions, authenticated realtime and optional voice/n8n integrations.

## Setup and run

Use the [monorepo setup](../../README.md#local-setup) for virtual-environment creation, dependency installation, client configuration and process startup. From `services/api` with its virtual environment active:

```bash
python -m uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
```

- Health: `http://localhost:8000/health`.
- HTTP API explorer: `http://localhost:8000/docs`.
- Root `.env` is loaded only for `APP_ENV=development`; explicit process variables take precedence. Tests and production never automatically load it.
- Supabase PostgreSQL is the shared runtime database. Apply `supabase/migrations` using `supabase db push` before using it.
- SQLite is accepted when explicitly configured for isolated tests/offline API smoke tests. It does not supply a complete offline Auth/client environment.

## Release trust/configuration contract

- Set `APP_ENV=production` explicitly. Startup requires a Supabase PostgreSQL URL with `sslmode=require` (or verified TLS), an HTTPS Auth origin, exact HTTPS `CORS_ORIGINS`, and server-only `SHAKTIOS_INGESTION_KEY` of at least 32 characters. No SQLite/implicit dotenv fallback. Production startup never runs `create_all`; apply reviewed SQL migrations separately. `python -m shaktios_api.migrate` is SQLite-only, not a Supabase migration command.
- Non-citizen/non-dashboard `POST /events` requires `X-ShaktiOS-Ingestion-Key` matching `SHAKTIOS_INGESTION_KEY` in **every environment**. Unconfigured →503; missing/incorrect →401. A user JWT is not a machine credential. Keep this shared trusted-producer key out of dashboard/mobile builds. It authenticates the trusted producer boundary, not individual sensor provenance; holders can label machine sources.
- Dashboard-prefixed sources require a verified operator. All other authenticated citizen-report sources normalize to `citizen_app`; server-owned identity/correlation remain authoritative. Citizens need a registered active/upcoming venue and matching zone. Machine credentials cannot create citizen reports or dashboard observations.
- Event storage/correlation/risk/timeline use one transaction. Duplicate event IDs return409. Timeline limit is1–200.
- n8n actions require **both** URL and secret. Production requires HTTPS and a secret of at least32 characters. The response must echo `{ok:true,status:"accepted",action_id,incident_id}` matching the request. A durable `action.attempted` precedes sending; `action.requested` means matching acknowledgement only. An unconfirmed attempt or502 requires inspection before retrying, not automatic resend.
- Use one API worker/replica for the MVP's process-local WebSockets and voice limiter. A TLS reverse proxy/gateway must supply public HTTPS and request/rate limits; this preflight does not prove connectivity, RLS, provider delivery or distributed readiness.

## References

- [API contract](../../docs/API.md): routes, access, response shapes and WS authentication.
- [Domain](../../docs/DOMAIN.md): correlation, scoring and operator lifecycle.
- [Supabase](../../docs/SUPABASE.md): environment, JWT verification, operator grants, ownership, migrations and RLS.
- [Voice drafts](../../docs/VOICE_REPORTING.md), [n8n](../../n8n/README.md): optional provider boundaries.
- [Architecture](../../docs/ARCHITECTURE.md): source-file navigation.

Run `python -m pytest` from this directory after installing `.[test]`. The tests use isolated SQLite/mocked providers, not live Supabase/Sarvam/n8n acceptance. See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for the other package checks.
