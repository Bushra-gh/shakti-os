# ShaktiOS on Supabase

Supabase provides **PostgreSQL + Auth + Storage**. FastAPI remains the
ShaktiOS brain (event ingestion, correlation, risk, timeline, approval,
n8n handoff). Next.js remains the operator dashboard. The Expo citizen app
lives in its separate repo and talks to FastAPI, never to the database.

```text
Supabase
├── Auth ───────────── identity for Expo (Supabase-issued JWT)
├── PostgreSQL ─────── sole runtime database (via DATABASE_URL)
└── Storage ────────── private `citizen-evidence` bucket (reserved)
        │
        ▼
FastAPI ShaktiOS Core
├── Event ingestion (POST /events)
├── Event persistence (events table)
├── Correlation (crowd_risk incidents)
├── Explainable Risk (risk.py — unchanged)
├── Timeline (incident_timeline table)
├── Civic-Shield / vision / citizen adapters (signal sources)
└── n8n action handoff (human approval required)
        │
        ├── Next.js operator dashboard
        └── Expo citizen application
```

## 1. Initial setup

```powershell
Copy-Item .env.example .env
# Fill in: DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
#          SUPABASE_PROJECT_REF (see .env.example for formats)

supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

`supabase db push` applies `supabase/migrations/` — the single
authoritative schema. There is no Alembic and no competing migration
system. Never make undocumented production schema changes in the
Supabase dashboard.

## 2. Database workflow

```powershell
supabase db push                          # apply pending migrations
supabase migration list                   # check migration status
supabase db diff -f <name>                # create a migration from diff
supabase migration new <name>             # create an empty migration
```

Seed deterministic demo data against a running API (no direct DB writes):

```powershell
$env:SHAKTIOS_API_URL = "http://localhost:8000"
python scripts/seed.py
```

## 3. Run the system

```powershell
# Backend (from services/api)
uvicorn shaktios_api.main:app --app-dir src --reload --port 8000

# Dashboard (repo root)
pnpm --filter @shaktios/dashboard dev
```

Required server env: `DATABASE_URL` (Supabase pooler URL with
`sslmode=require`). Optional tuning: `DB_POOL_SIZE` (default 5),
`DB_MAX_OVERFLOW` (default 10), `CORS_ORIGINS` (default
`http://localhost:3000`). SQLite `DATABASE_URL` values are accepted for
the test suite and offline smoke tests only.

## 4. Authentication flow

1. Expo signs the citizen in with Supabase Auth (`NEXT_PUBLIC_SUPABASE_URL`
   + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key only).
2. Expo sends `Authorization: Bearer <supabase_access_token>` with report
   requests to FastAPI.
3. FastAPI (`services/api/src/shaktios_api/auth.py`) fetches the project
   JWKS from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, verifies the
   RS256/ES256 signature, issuer (`<SUPABASE_URL>/auth/v1`), audience
   (`authenticated` by default), and expiry, then uses the JWT `sub` as
   the user id.
4. Invalid/expired tokens → `401`. `GET /me` returns the verified identity
   (useful for client auth checks).

Machine signal sources (crowd simulator, civic-shield bridge) send no
token and stay anonymous. A present-but-invalid token is rejected with
401 rather than silently treated as anonymous.

## 5. Citizen reports and identity

`citizen_report` events carry **no client-supplied identity**. The citizen
adapters already strip `reporter_id`/`user_id` from payloads, and FastAPI
additionally:

- strips `reporter_id`, `user_id`, `reporter`, `userId` from
  `citizen_report` payloads,
- ignores any top-level `reporter_id` sent by the client,
- stamps `events.reporter_id` server-side with the verified JWT `sub`
  (or `NULL` for anonymous reports).

A client cannot submit `"user_id": "someone-else"` and have it trusted.

## 6. Row Level Security

`anon` and `authenticated` roles have **deny-all** policies on `events`,
`incidents`, and `incident_timeline` (see the initial migration). The Expo
app must go through FastAPI for all operational data. FastAPI connects
with a privileged role that bypasses RLS. Do not grant direct table
access to clients; do not put a service-role key in any client.

## 7. Storage boundary (not yet implemented)

The initial migration creates a **private** `citizen-evidence` bucket.
There is currently **no backend media endpoint** — the mobile
PhotoPicker has nothing to upload to yet. Claiming photo integration
before that endpoint exists would be false. The intended design is:

```text
Expo → FastAPI (authorized) → Supabase Storage (signed upload)
```

Photos must never be publicly accessible by default.

## 8. Data migration (local → Supabase)

The pre-migration local database (`services/api/shaktios-local.db`,
SQLite; 28 events / 7 incidents from seed runs) contains disposable
demo data and is **not migrated**. Deterministic demo data is produced
with `scripts/seed.py` (seeded RNG) or the civic-shield bridge
(`python -m civic_shield.ingest`).

If a future local Postgres holds data worth keeping, export/import it
explicitly while preserving ids, timestamps, and relationships:

```powershell
# Export from local PostgreSQL
pg_dump --data-only --column-inserts `
  --table=public.incidents --table=public.events --table=public.incident_timeline `
  postgresql://shaktios:shaktios_dev@localhost:5432/shaktios > seed_data.sql

# Import into Supabase (psql with the direct connection string)
psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require" `
  -f seed_data.sql
```

Never hardcode production secrets into seed files.

## 9. What remains

- Hosted verification completed: migration pushed with `supabase db push`,
  schema confirmed on the live project (3 tables, RLS, deny-all policies,
  private `citizen-evidence` bucket), and `scripts/e2e_check.py` passes
  19/19 against the Supabase-backed API (social + crowd + citizen fusion,
  spoof rejection, timeline, `/me` 401).
- Live end-to-end check with a **real Supabase Auth user token**
  (authenticated `citizen_report` stamping `reporter_id`) — needs a test
  user in the project Auth; JWT verification itself is covered by
  `services/api/tests/test_auth.py` with real RSA signatures.
- Supabase Storage upload endpoint for citizen evidence (Phase 8
  boundary only at this stage).
- Optional: direct Supabase Realtime for the dashboard (existing
  FastAPI WebSockets are preserved and unchanged).
