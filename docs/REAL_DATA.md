# Real-data MVP and seed runbook

## What is connected

The dashboard and citizen app read the same FastAPI service and Supabase PostgreSQL database. Supabase Auth supplies identity; operational table access goes through FastAPI.

- Landing page: always-populated static demo metrics, illustrative venue map, incident queue and activity feed. These marketing fixtures are labelled as sample data and never call or poll the API. The real operator dashboard remains database-backed.
- Operator dashboard: authenticated incident/event reads, venue-zone coordinates, incident-linked evidence, real risk factors, timeline entries, status transitions, and n8n handoff requests. Profile display names are saved through Supabase Auth. Failed/unconfigured integrations are not presented as successful actions.
- Citizen app: database venue picker, QR/manual joining, email/password Auth, zone-based reports with optional GPS, ownership-filtered report lists/details, backend-derived statuses and native selected-venue persistence. Unsupported photo-upload, notification and login controls were removed rather than simulated.
- Realtime: operator JWT is sent as the first WebSocket message; the server acknowledges successful authorization before clients display LIVE. No token is placed in the URL. Reconnection reloads authoritative HTTP data.

The dashboard operates on a recent snapshot of up to 200 incidents/events; per-incident evidence and timeline reads are bounded. This is an MVP, not an unbounded reporting/export system. The public overview counts the full database.

## Setup

1. Configure the root `.env` with the existing Supabase PostgreSQL `DATABASE_URL`, `SUPABASE_URL` and any n8n webhook settings. Keep database/service credentials out of frontend environment variables.
2. Set dashboard `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` and its publishable key. Set the mobile `EXPO_PUBLIC_*` equivalents. Android emulator API host: `http://10.0.2.2:8000`; browser: `http://localhost:8000`.
3. Apply migrations:
   ```powershell
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. Install the API, then seed from `shakti-os`:
   ```powershell
   services/api/.venv/Scripts/python.exe scripts/seed_supabase.py --dry-run
   services/api/.venv/Scripts/python.exe scripts/seed_supabase.py --apply
   ```
5. Grant **a specific trusted existing account** operator capability via root `OPERATOR_USER_IDS` or `OPERATOR_EMAILS`, then restart FastAPI. Alternatively use trusted Supabase `app_metadata.role=operator|admin`. Citizen sign-up must not grant this role.
6. Start the API and dashboard, then restart Expo/Metro after changing mobile environment variables.

## Seed properties

`scripts/seed_supabase.py` defaults to dry-run without a database connection. Applying requires a PostgreSQL connection and performs one transaction:

- 3 seed scenario venues, 9 canonical zones.
- 9 isolated incidents across several severities and lifecycle stages.
- 63 multi-source events and 74 evidence/status timeline entries.
- UUID5 deterministic IDs, `seed_*` sources, payload `seed_batch=shaktios-seed-v2` and `is_seeded=true`.
- No truncation, overwriting existing IDs, Auth users, fake citizen identity, phone contacts, attachment URLs, or webhook side effects.

Existing deterministic IDs are skipped. Re-running is a no-op, not a timestamp refresh. Scenario coordinates are illustrative. Replace/register actual venues through an appropriate reviewed database workflow before real operations; an admin venue editor is not part of this MVP.

### Verification performed against the configured Supabase project

- Applied `20260923000000_real_venues_and_coordinates.sql`.
- Applied the seed and repeated it; the second v2 application inserted zero records.
- Retained existing database records. The initial seven seed events from this implementation also remain, explicitly labelled `shaktios-seed-v1`; the initial synthetic reporter ID was cleared and initial invented venue helplines were removed. Only records created by this implementation were corrected.
- At verification: **3 venues, 9 zones, 98 total events, 28 total incidents**, including **70 seed events**. Totals can change when new reports arrive.
- Confirmed the HTTP venue contract, seed-labelled venue names, null helplines and absence of payloads/reporter identity from public event summaries.

## Smoke test

1. Open the landing page with the API stopped: its demo dashboard and sample pulse remain fully populated, with no API-status errors or polling. Open the real dashboard separately to verify authenticated operational data.
2. Sign in to the dashboard as the authorized operator. `/me` must return `is_operator: true`. Unauthorized citizen sessions must not load operator pages.
3. Sign in on mobile as a citizen, choose a venue and zone, submit an observation and note its returned ID.
4. Check My Reports and report detail. A different citizen must receive `404` for that ID and must not see it in their list.
5. In the dashboard, locate the report's actual `incident_id`, review evidence, then move Detected → Assessing → Responding/Resolved. Refresh the mobile list and verify status follows the database.
6. If explicitly testing n8n, use a controlled test destination. A successful handoff means workflow acknowledgement, **not notification delivery or emergency dispatch**.
7. Reload both clients and interrupt/reconnect the API. Verify session restoration, error/retry states and refreshed snapshots.

## Checks and boundaries

Automated checks cover API ownership/access rules, public redaction, venue/report serialization, coordinate correlation, seed rerun safety, status/action flows, frontend API/session/WebSocket boundaries, TypeScript, lint, Next production build and Expo Android export.

Still requires runtime verification/configuration:

- The chosen operator account's role/allowlist. No account was silently promoted.
- Authenticated Android login/reload, camera and GPS flows on an actual running device. An Android export alone does not prove these flows.
- Live camera/social sources, verified event/helpline registration and real notification-provider nodes. Existing n8n workflow is an acknowledgement-only handoff until extended.
- Production hardening: machine signal ingestion is still unauthenticated for local integrations; WebSockets are single-process without replay; rate limiting and action idempotency are not implemented. Protect ingestion and use HTTPS before public deployment.
