# ShaktiOS API

FastAPI service for venue-backed reports, verified identity/ownership, Event persistence, Incident correlation, explainable Risk, timelines, operator decisions, authenticated realtime and optional voice/n8n integrations.

## Setup and run

Use the [monorepo setup](../../README.md#local-setup) for virtual-environment creation, dependency installation, client configuration and process startup. From `services/api` with its virtual environment active:

```bash
python -m uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
```

- Health: `http://localhost:8000/health`.
- HTTP API explorer: `http://localhost:8000/docs`.
- Root `.env` is loaded for local database configuration; explicit process variables take precedence.
- Supabase PostgreSQL is the shared runtime database. Apply `supabase/migrations` using `supabase db push` before using it.
- SQLite is accepted when explicitly configured for isolated tests/offline API smoke tests. It does not supply a complete offline Auth/client environment.

## References

- [API contract](../../docs/API.md): routes, access, response shapes and WS authentication.
- [Domain](../../docs/DOMAIN.md): correlation, scoring and operator lifecycle.
- [Supabase](../../docs/SUPABASE.md): environment, JWT verification, operator grants, ownership, migrations and RLS.
- [Voice drafts](../../docs/VOICE_REPORTING.md), [n8n](../../n8n/README.md): optional provider boundaries.
- [Architecture](../../docs/ARCHITECTURE.md): source-file navigation.

Run `python -m pytest` from this directory after installing `.[test]`. The tests use isolated SQLite/mocked providers, not live Supabase/Sarvam/n8n acceptance. See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for the other package checks.
