# Supabase: configuration, identity and schema

Supabase supplies PostgreSQL and Auth for both the dashboard and citizen app. FastAPI owns operational reads/writes, correlation, risk and access checks. A private Storage bucket is reserved for future evidence attachments; it is not a working photo-upload feature.

Use the [root README](../README.md) for dependency installation and process startup. This guide owns database/Auth configuration and migration workflow.

## Environment boundaries

| Consumer / local file | Variables | Notes |
| --- | --- | --- |
| FastAPI / root `.env` | `DATABASE_URL`, `SUPABASE_URL`, optional `SUPABASE_JWT_AUDIENCE` | Database URL must include `sslmode=require`; audience defaults to `authenticated` |
| FastAPI / root `.env` | `OPERATOR_USER_IDS`, `OPERATOR_EMAILS` | Comma-separated trusted operator allowlists; leave citizens unprivileged |
| Dashboard / `apps/dashboard/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client values only; root `.env` is not automatically loaded by Next.js |
| Sibling Expo app / its `.env` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client values only; do not use `NEXT_PUBLIC_*` for Expo |
| Supabase CLI | Project reference passed to `supabase link` | `SUPABASE_PROJECT_REF` in the template is a reference value; substitute it explicitly in the command |

All three runtimes must target the same Supabase project. The API verifies JWTs from `SUPABASE_URL`; client Auth uses the corresponding public project URL/key. FastAPI's JWT verifier does not need a service-role key or a server-side publishable key.

`database.py` loads the monorepo root `.env` for local API/seed use without overriding explicit process variables. Production should inject secrets through its process manager. Never expose database credentials, service-role credentials, n8n secrets or Sarvam keys as `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.

Pool settings are `DB_POOL_SIZE=5` and `DB_MAX_OVERFLOW=10` by default. The API disables psycopg named statement preparation for Supabase transaction pooling (`prepare_threshold=None`). There is no silent local-database fallback. Explicit SQLite URLs are for isolated tests/offline API smoke tests, not the shared runtime.

`CORS_ORIGINS` is a comma-separated browser-origin allowlist, defaulting to `http://localhost:3000`. Include the actual Expo web origin when needed. Review HTTPS and explicit production origins before deployment; CORS is not machine-ingestion authentication.

## Apply and evolve the schema

From `shakti-os`, after confirming the intended project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase migration list
```

[`supabase/migrations/`](../supabase/migrations) is the only authoritative migration set. There is no Alembic workflow.

| Migration | Purpose |
| --- | --- |
| `20260922000000_initial_shaktios_schema.sql` | Events, incidents, timeline, ownership column/indexes, deny-all client RLS policies and private evidence bucket |
| `20260923000000_real_venues_and_coordinates.sql` | Venues, canonical zones, incident coordinates, registry indexes and RLS |

Operational tables:

- `events`: observations, nullable incident association and verified reporter identity.
- `incidents`: lifecycle, score/factors, confidence and nullable coordinates.
- `incident_timeline`: evidence and operator-decision history.
- `venues`: registered gathering metadata and optional dates/helpline.
- `venue_zones`: canonical location IDs, venue association and coordinates.

The SQL uses text IDs, `JSONB` and timezone-aware timestamps. Consult the migrations for exact types, constraints and indexes instead of maintaining another column-by-column schema in Markdown.

For a new schema change:

1. Create a reviewed additive migration with `supabase migration new <name>` (or review a generated diff in an appropriately configured development database).
2. Update API models and both clients when their contract changes.
3. Test against an isolated database, then apply pending migrations to the intended project.

Do not use a project reset or `shaktios_api.migrate` to upgrade a shared deployment. The latter is a legacy SQLAlchemy table-creation helper; `create_all` does not alter existing columns, create Supabase policies or replace migration history. Do not make undocumented production schema edits in the Supabase dashboard.

## Auth and operator authorization

1. Dashboard and Expo users sign in through Supabase email/password Auth. Sign-up confirmation depends on project settings.
2. Clients send the current access token to FastAPI.
3. `auth.py` fetches `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and verifies RS256/ES256 signature, issuer, audience, expiry and nonempty subject.
4. `GET /me` returns `{id, email, role, is_operator}`. Missing/invalid credentials on protected routes produce `401`; unauthorized operator access produces `403`.

Grant operator access to specific existing users via server-managed `OPERATOR_USER_IDS` or `OPERATOR_EMAILS`, or trusted `app_metadata.role=operator|admin`. Restart FastAPI after environment changes. Editable profile metadata is not a role grant. The verifier also recognizes privileged trusted token roles; this is **not** a reason to put service-role credentials in a client.

Machine sources currently need no token for non-dashboard, non-citizen signals. A supplied invalid bearer token is rejected. This local-MVP exception must be secured before public exposure.

## Report ownership and RLS

Citizen reports require authentication and a registered venue/zone. FastAPI strips supplied identity keys, stamps `events.reporter_id` from verified JWT `sub` and computes the incident association. New anonymous citizen submissions are rejected; machine and synthetic seed records can have null reporter identity.

`/me/reports` filters ownership before pagination; report detail returns `404` for missing or unowned IDs. Citizens must not fetch the operator event feed and filter it themselves. See [API.md](API.md) for the contract.

The migrations enable RLS and deny direct `anon`/`authenticated` access on all five operational tables. Clients use FastAPI, even for public venue reads. Its privileged database connection bypasses RLS, so API authorization remains essential; RLS alone does not protect an incorrectly exposed server endpoint.

## Storage and transient audio

The initial migration reserves a private `citizen-evidence` bucket. There is no persisted photo/evidence attachment endpoint and no current mobile photo picker. A future upload flow needs its own authorization, ownership, retention and signed-access design.

Optional voice **does** upload multipart audio to FastAPI for transient processing by Sarvam; it is not uploaded to this bucket or stored as a report attachment. Local non-persistence does not establish the provider's retention policy. See [VOICE_REPORTING.md](VOICE_REPORTING.md).

## Seed and verification

Use [REAL_DATA.md](REAL_DATA.md) for the supported, labelled, additive seed. Local SQLite files are not automatically migrated or imported. Do not use legacy seed/reset scripts on shared data.

Validate a deployment with [DEMO.md](DEMO.md): real operator capability, an authenticated citizen submission, cross-account isolation, linked status and client reconnection. Unit tests and prior hosted checks do not prove the currently configured project is ready. Native-device and provider validation remain separate from an Expo export or mocked backend test.
