# Architecture

## Runtime flow

```text
Crowd simulator / Civic-Shield output        Expo citizen app (shaktios-app)
                    │                          │ manual / reviewed voice report
                    └──────── POST /events ────┘
                                      │
                               FastAPI service
                       validate access, identity and venue
                                      │
                           Event → correlate → Incident
                                      │             │
                                  Timeline ← deterministic Risk
                                      │
                             Supabase PostgreSQL
                                      │
                 HTTP snapshots + authenticated operator WebSockets
                                      │
                           Next.js operator dashboard
                                      │
                      status decision / explicit action approval
                                      │
                      optional n8n validation + acknowledgement
```

Supabase Auth issues sessions to **both** clients; FastAPI verifies their JWTs. Operational table access stays behind FastAPI. The citizen app reads only its owned reports and public venue data, not the operator streams.

Voice is a separate draft-only branch: authenticated audio + consent → FastAPI → Sarvam transcription/extraction → editable fields. It joins the core flow only when the citizen confirms the normal report submission.

## Code navigation

| Path                                                                     | Responsibility                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `services/api/src/shaktios_api/main.py`                                  | HTTP/WS routes, access dependencies, ingestion, operator transitions and webhook delivery |
| `auth.py`                                                                | Supabase JWKS verification, verified identity and operator capability                     |
| `models.py`, `incident_models.py`, `report_models.py`, `venue_models.py` | API models                                                                                |
| `event_store.py`, `incident_store.py`, `risk.py`                         | Persistence, deterministic correlation and factor calculation                             |
| `report_store.py`, `venue_store.py`, `timeline_store.py`                 | Ownership-filtered reports, venue/zone registry and incident history                      |
| `database.py`                                                            | SQLAlchemy engine/session, local root environment loading and SQLite test support         |
| `voice.py`, `voice_provider.py`                                          | Bounded voice upload, consent, provider requests and draft validation                     |
| `realtime.py`                                                            | In-memory event/incident connection managers                                              |
| `apps/dashboard/lib/api.ts`, `lib/realtime.ts`                           | Authenticated HTTP client and reconnecting WebSockets                                     |
| `apps/dashboard/components/dashboard/operator-session.tsx`               | Operator route gate                                                                       |
| `apps/dashboard/hooks/`, `components/situation-map.tsx`                  | Snapshots, timeline refresh and coordinate-based map                                      |
| `intelligence/`, `simulator/crowd/`                                      | Source normalization and synthetic inputs; see [Events](EVENTS.md)                        |
| `supabase/migrations/`                                                   | Authoritative SQL schema, indexes, RLS and reserved storage bucket                        |
| `n8n/shaktios-action-handoff.json`                                       | Importable acknowledgement-only workflow                                                  |
| Sibling `shaktios-app/src/api/`, `src/store/`, `app/`                    | Citizen API client, session/draft/venue state and Expo Router screens                     |

Bare Python filenames in the table are relative to `services/api/src/shaktios_api/`. `packages/types` shares the TypeScript Event shape; it is not a generated cross-repository SDK. Dashboard and mobile also maintain their own API types, so contract changes need caller checks in both repos.

## Storage and consistency

The five operational tables are `events`, `incidents`, `incident_timeline`, `venues` and `venue_zones`. Reports are citizen-report Events with verified ownership, not a separate report table. Actions are webhook handoffs represented in the timeline, not a persisted delivery-state service.

Apply [Supabase migrations](SUPABASE.md) before using a shared database. Startup `create_all` supports isolated SQLite tests but does not upgrade existing columns or establish the Supabase RLS/storage setup.

The API correlates an event with at most one incident. See [DOMAIN.md](DOMAIN.md) for the exact time window, factors and lifecycle. GPS in a report payload does not determine incident coordinates; registered zone coordinates do.

## Realtime and refresh

- The operator first loads an authoritative HTTP snapshot, then authenticates each WebSocket with a first-message token. `LIVE` means server acknowledgement, not simply an open socket.
- The dashboard reconnects and reloads HTTP snapshots. Incident detail/timeline views also use periodic refresh; WebSockets do not replace every HTTP request.
- Subscribers live in one API process. There is no shared broker, durable replay or cross-worker delivery.
- Direct SQL seeding does not broadcast WebSocket events. Refresh the dashboard afterward.
- Citizen history reloads on screen focus; it does not subscribe to operator feeds.

Protocol details belong in [API.md](API.md).

## Trust and integration boundaries

- Client keys are publishable Auth keys only. Database, n8n and Sarvam credentials stay on the server.
- Operator routes enforce capability; citizen report detail/list enforce ownership before returning data. RLS denies direct client operational-table access, but the privileged API connection still needs its own checks.
- Machine-signal ingestion is deliberately still open for local integration. This is a deployment gap, not a production security design.
- Human approval is required before requesting an action. A successful webhook response is not notification delivery; failures may occur after n8n has started. See the [n8n runbook](../n8n/README.md).
- Source labels and seeded maps are not proof of live sensors. The public landing is static sample content; stored synthetic fixtures remain labelled as such.

See [Decisions](DECISIONS.md) for rationale, [Supabase](SUPABASE.md) for configuration and [Tasks](TASKS.md) for hardening work.
