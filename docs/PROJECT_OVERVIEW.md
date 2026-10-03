# SHAKTIOS Project Overview

## 1. Project Summary

**SHAKTIOS** is an event-driven intelligence and response platform.

It fuses fragmented signals from the physical and digital world into evolving incidents, estimates explainable risk, and helps operators coordinate human-approved responses.

The core product loop is:

```text
Signals
  -> Events
  -> Signal Fusion / Correlation
  -> Incidents
  -> Explainable Risk
  -> Human Decision
  -> Approved Action
  -> Timeline / Audit
```

The platform is designed around one focused demonstration scenario: an emerging crowd incident around a named gate or location.

Example signal sources:

- Crowd density or simulated CCTV signals
- Abnormal movement signals
- Civic-Shield social concern signals
- Citizen reports

These signals are normalized into one Event model, correlated into an Incident, scored by an explainable Risk Engine, reviewed by an operator, and optionally forwarded to an n8n workflow after approval.

## 2. Evaluation Story

The system answers a question that isolated source systems cannot answer:

> What is happening across multiple sources, how serious is it, and what should happen next?

The intended operational flow is:

```text
Social concern increases near Gate 4
        +
Crowd density or abnormal movement increases
        +
Citizen reports arrive
        |
        v
ShaktiOS normalizes the signals as Events
        |
        v
Related Events become one Incident
        |
        v
Explainable Risk and Severity are calculated
        |
        v
Operator reviews the evidence and timeline
        |
        v
Operator approves the next Incident state
        |
        v
A human-approved action is handed to n8n
        |
        v
The lifecycle remains visible in the Incident Timeline
```

ShaktiOS is not presented as an autonomous emergency-response system. It provides situational awareness, explainable risk, operator decision support, and an auditable action handoff.

## 3. Current Implementation Status

Implemented in the current repository:

- Turborepo and pnpm monorepo
- Next.js dashboard application
- FastAPI backend
- PostgreSQL persistence through SQLAlchemy 2.x and psycopg
- Shared Pydantic Event model
- Event validation and normalization
- Event persistence and listing
- Deterministic Event to Incident correlation
- Incident persistence and listing
- Explainable Risk Engine
- Risk factor persistence
- Incident timeline entries
- WebSocket event stream
- WebSocket incident stream
- Operator-controlled Incident status transitions
- Human-approved n8n action handoff
- Civic-Shield Event adapter boundary
- Citizen-report Event adapter boundary
- Deterministic crowd simulator
- Dashboard command center
- Incident detail and operator decision screen
- Automated tests and CI workflow

Not implemented or intentionally limited:

- Authentication and authorization
- Production CORS lockdown
- Multi-process WebSocket delivery
- WebSocket replay for newly connected clients
- Advanced machine-learning risk models
- Autonomous response execution
- Full Civic-Shield source fetching inside this repository
- Full citizen-report frontend/mobile application
- Non-additive database migrations

## 4. Repository Structure

```text
shaktios/
|
+-- apps/
|   +-- dashboard/                      Next.js operator dashboard
|       +-- app/
|       |   +-- page.tsx                 Public project landing page
|       |   +-- dashboard/page.tsx       Live command center
|       |   +-- incidents/[incidentId]/  Incident detail and operator actions
|       |   +-- layout.tsx               Metadata, fonts, global shell
|       |   +-- globals.css               Tailwind and design tokens
|       +-- components/
|       |   +-- situation-map.tsx        Map-like incident visualization
|       |   +-- ui/                      shadcn-style UI primitives
|       +-- lib/
|       |   +-- api.ts                   API client and frontend domain types
|       |   +-- realtime.ts              WebSocket reconnect helper
|       +-- tests/                       Frontend API and realtime tests
|       +-- package.json
|
+-- services/
|   +-- api/                             FastAPI service
|       +-- src/shaktios_api/
|       |   +-- main.py                  API routes and application lifecycle
|       |   +-- database.py              SQLAlchemy engine, sessions, metadata
|       |   +-- models.py                Event Pydantic model
|       |   +-- event_store.py            Event ORM model and persistence
|       |   +-- incident_models.py         Incident models and enums
|       |   +-- incident_store.py          Incident ORM and correlation
|       |   +-- risk.py                   Explainable risk calculation
|       |   +-- timeline_models.py         Timeline response model
|       |   +-- timeline_store.py          Timeline persistence
|       |   +-- realtime.py                In-memory WebSocket managers
|       |   +-- migrate.py                 Additive schema setup command
|       +-- tests/test_api.py             Backend API and domain tests
|       +-- pyproject.toml
|       +-- .venv/                        Local API virtual environment
|
+-- intelligence/
|   +-- civic-shield/                    Civic-Shield adapter boundary
|   |   +-- src/civic_shield/adapter.py  Social signal normalization
|   |   +-- tests/test_adapter.py
|   +-- citizen-report/                  Citizen report adapter boundary
|       +-- src/citizen_report/adapter.py
|       +-- tests/test_adapter.py
|
+-- simulator/
|   +-- crowd/                            Deterministic crowd signal simulator
|       +-- src/shaktios_crowd_simulator/main.py
|       +-- tests/test_main.py
|
+-- packages/
|   +-- types/                            Shared TypeScript Event types
|   +-- config/                           Shared configuration boundary
|   +-- ui/                               Shared starter UI package
|   +-- eslint-config/                    Shared ESLint configuration
|   +-- typescript-config/                Shared TypeScript configuration
|
+-- docs/                                 Project and evaluation documentation
+-- scripts/seed.py                       Demo database seed script
+-- docker-compose.yml                    Local PostgreSQL service
+-- .env.example                          Environment variable template
+-- .github/workflows/ci.yml              CI checks
+-- AGENTS.md                             Engineering conventions
+-- package.json                          Root pnpm/Turborepo commands
+-- pnpm-workspace.yaml                   Workspace package globs
+-- turbo.json                            Turborepo task pipeline
```

## 5. Frontend Routes

### `GET /`

Public landing page for ShaktiOS.

Purpose:

- Explain the Event -> Incident -> Risk -> Human Decision loop
- Establish the product positioning
- Link to the command center
- Explain that response remains human-approved

### `GET /dashboard`

The main operator command center.

Displays:

- Active incident count
- Elevated risk count
- Signal count
- Event and Incident stream status
- Situation map
- Incident queue
- Activity feed
- Signal submission dialog

The dashboard loads data from the FastAPI service and subscribes to both WebSocket streams.

### `GET /incidents/{incidentId}`

Incident detail and operator decision view.

Displays:

- Incident type and location
- Risk percentage
- Severity
- Confidence
- Explainable factors
- Incident timeline
- WebSocket connection state
- Allowed status transition controls
- Optional operator notes
- Human-approved n8n action request when the Incident is `RESPONDING`

## 6. Backend HTTP Routes

Base URL during local development:

```text
http://localhost:8000
```

### `GET /health`

Returns API health status.

```json
{
  "status": "ok",
  "service": "shaktios-api"
}
```

### `POST /events`

Validates, persists, correlates, broadcasts, and returns a normalized Event.

Request:

```json
{
  "type": "crowd_density",
  "source": "crowd_simulator",
  "location": "gate_4",
  "confidence": 0.95,
  "payload": {
    "density": 0.72
  }
}
```

Processing sequence:

```text
Validate Event
  -> Persist Event
  -> Correlate with active Incident
  -> Recalculate Incident risk when applicable
  -> Add timeline entry when correlated
  -> Broadcast Event update
  -> Broadcast Incident update
  -> Return Event
```

### `GET /events?limit=50`

Returns persisted Events newest first.

### `GET /incidents?limit=50`

Returns persisted Incidents ordered by most recently updated.

### `GET /incidents/{incident_id}`

Returns one Incident or `404`.

### `GET /incidents/{incident_id}/timeline?limit=100`

Returns chronological timeline entries for one Incident.

Timeline entries can include:

- `event.correlated`
- `status.changed`
- `action.requested`

### `POST /incidents/{incident_id}/status`

Records an operator-approved status transition.

Request:

```json
{
  "status": "ASSESSING",
  "note": "Operator is reviewing evidence."
}
```

Allowed transitions:

```text
DETECTED  -> ASSESSING
ASSESSING -> RESPONDING
ASSESSING -> RESOLVED
RESPONDING -> RESOLVED
```

Invalid transitions return `409`.

### `POST /incidents/{incident_id}/actions`

Requests a human-approved action for an Incident in `RESPONDING` status.

Request:

```json
{
  "type": "notify_operator",
  "note": "Send the approved response."
}
```

Behavior:

- Requires `RESPONDING` status
- Requires `N8N_WEBHOOK_URL`
- Sends the Incident and action payload to n8n
- Records `action.requested` after successful delivery
- Returns `503` when the webhook is not configured
- Returns `502` when webhook delivery fails

This endpoint requests a workflow. It does not autonomously execute emergency action.

## 7. Backend WebSocket Routes

### `WS /ws/events`

Streams newly persisted Events from the current API process.

Message format:

```json
{
  "type": "event.created",
  "event": {
    "id": "event-id",
    "type": "crowd_density",
    "source": "crowd_simulator",
    "timestamp": "2026-09-20T09:42:00Z",
    "location": "gate_4",
    "confidence": 0.95,
    "payload": {
      "density": 0.72
    }
  }
}
```

### `WS /ws/incidents`

Streams Incident creation and updates from the current API process.

Message format:

```json
{
  "type": "incident.updated",
  "incident": {
    "id": "incident-id",
    "type": "crowd_risk",
    "location": "gate_4",
    "status": "DETECTED",
    "severity": "MEDIUM",
    "confidence": 0.95,
    "risk": 0.408,
    "factors": {
      "crowd_density": 0.72,
      "social_velocity": 0.0,
      "abnormal_movement": 0.0,
      "citizen_reports": 0.0,
      "citizen_report_count": 0
    },
    "created_at": "2026-09-20T09:42:00Z",
    "updated_at": "2026-09-20T09:42:00Z"
  }
}
```

The WebSocket implementation is intentionally simple and in-memory for the MVP. It is designed for a single API process and does not provide replay or cross-process fanout.

## 8. Domain Models

### Event

An Event is a normalized representation of a Signal.

```text
id
 type
source
timestamp
location
confidence
payload
incident_id (database link, nullable)
```

Confidence is constrained from `0.0` to `1.0`. IDs and timestamps are generated when omitted.

### Incident

An Incident is a situation inferred from one or more related Events.

```text
id
type
location
status
severity
confidence
risk
factors
created_at
updated_at
```

Current Incident type:

```text
crowd_risk
```

Current statuses:

```text
DETECTED
ASSESSING
RESPONDING
RESOLVED
```

Current severity values:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Timeline Entry

A Timeline Entry is an immutable chronological record connected to an Incident.

```text
id
incident_id
type
timestamp
details
```

## 9. Correlation and Risk Logic

Relevant Event types:

- `crowd_density`
- `abnormal_movement`
- `social_concern`
- `citizen_report`

An Event can contribute to an active Incident when:

- the location matches
- the Event type is relevant
- the Event is inside `INCIDENT_CORRELATION_WINDOW_SECONDS`
- the Incident is not `RESOLVED`

Default correlation window:

```text
300 seconds
```

Events outside the time window create a separate Incident instead of attaching to a newer Incident.

The explainable Risk Engine uses:

```text
risk = 0.4 * crowd_density
     + 0.3 * social_velocity
     + 0.2 * abnormal_movement
     + 0.1 * citizen_reports
```

Severity thresholds:

- `LOW`: below `0.40`
- `MEDIUM`: `0.40` through `0.69`
- `HIGH`: `0.70` through `0.84`
- `CRITICAL`: `0.85` through `1.00`

The factors are persisted with the Incident so an operator can see why the score changed.

## 10. Database Structure

### `events`

| Column | Type | Purpose |
|---|---|---|
| `id` | `VARCHAR(36)` | Event identifier and primary key |
| `type` | `VARCHAR(255)` | Normalized Event type |
| `source` | `VARCHAR(255)` | Source or adapter name |
| `timestamp` | `TIMESTAMP WITH TIME ZONE` | Time of observation |
| `location` | `VARCHAR(255)` | Named location or gate |
| `confidence` | `FLOAT` | Source confidence from `0.0` to `1.0` |
| `payload` | `JSON` | Source-specific normalized details |
| `incident_id` | `VARCHAR(36)` nullable | Current lightweight Event to Incident link |

### `incidents`

| Column | Type | Purpose |
|---|---|---|
| `id` | `VARCHAR(36)` | Incident identifier and primary key |
| `type` | `VARCHAR(255)` | Current value is `crowd_risk` |
| `location` | `VARCHAR(255)` | Correlation location |
| `status` | `VARCHAR(32)` | Lifecycle state |
| `severity` | `VARCHAR(32)` | Explainable severity bucket |
| `confidence` | `FLOAT` | Highest contributing Event confidence |
| `risk` | `FLOAT` | Normalized explainable risk score |
| `factors` | `JSON` | Risk contributors and report count |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Incident creation time |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Latest update time |

### `incident_timeline`

| Column | Type | Purpose |
|---|---|---|
| `id` | `VARCHAR(36)` | Timeline entry identifier |
| `incident_id` | `VARCHAR(36)` | Related Incident |
| `type` | `VARCHAR(64)` | Timeline event type |
| `timestamp` | `TIMESTAMP WITH TIME ZONE` | Time of lifecycle event |
| `details` | `JSON` | Event-specific audit details |

Tables are created through SQLAlchemy metadata. The additive setup command is:

```powershell
cd services/api
.\.venv\Scripts\python.exe -m shaktios_api.migrate
```

`create_all` and the additive setup command do not perform non-additive column migrations. Future schema changes need an explicit reviewed migration or documented local database reset.

## 11. Source Adapters

### Civic-Shield Adapter

Location:

```text
intelligence/civic-shield/src/civic_shield/adapter.py
```

Responsibilities:

- Accept Civic-Shield analysis output
- Normalize location aliases
- Normalize confidence
- Preserve social metadata such as sentiment, emotion, velocity, mention count, tone, headline, platform, and trend status
- Produce a ShaktiOS Event with:

```text
type: social_concern
source: civic_shield
```

The adapter does not fetch social data itself.

### Citizen Report Adapter

Location:

```text
intelligence/citizen-report/src/citizen_report/adapter.py
```

Responsibilities:

- Accept a public report
- Require location and description/text
- Preserve original description and category
- Normalize confidence
- Produce a ShaktiOS Event with:

```text
type: citizen_report
source: citizen_report
```

The adapter does not overwrite the original report content.

## 12. Simulator and Demo Utilities

### Deterministic crowd simulator

Location:

```text
simulator/crowd/
```

Run:

```powershell
cd simulator/crowd
.\.venv\Scripts\python.exe -m shaktios_crowd_simulator.main
```

Dry run:

```powershell
.\.venv\Scripts\python.exe -m shaktios_crowd_simulator.main --dry-run
```

The simulator emits a deterministic `crowd_density` Event at `gate_4`.

### Seed script

Location:

```text
scripts/seed.py
```

The seed script posts deterministic random-seeded demo Events across named locations and sources. It expects the API to be running on `http://localhost:8000`.

Run from the repository root:

```powershell
python scripts/seed.py
```

## 13. Local Runbook

### Start PostgreSQL

```powershell
docker compose up -d
```

### Install frontend dependencies

```powershell
pnpm install
```

### Start the API

```powershell
cd services/api
.\.venv\Scripts\python.exe -m shaktios_api.migrate
.\.venv\Scripts\python.exe -m uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
```

### Start the dashboard

In a second terminal:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open:

```text
http://localhost:3000
```

Then open the command center:

```text
http://localhost:3000/dashboard
```

### Seed demo data

In a third terminal:

```powershell
python scripts/seed.py
```

## 14. Presentation Demo Sequence

1. Open `/` and introduce ShaktiOS as the signal-to-action platform.
2. Open `/dashboard` and show the operational command center.
3. Run the crowd simulator or seed script.
4. Show new Events arriving in the activity feed.
5. Show related Events forming one Incident at a location.
6. Show Risk, Severity, and contributing factors.
7. Open the Incident detail route.
8. Show the Timeline entries created from correlated Events.
9. Move the Incident from `DETECTED` to `ASSESSING`.
10. Move it to `RESPONDING` to represent operator approval.
11. Request the configured n8n workflow action.
12. Show the action request recorded in the Timeline.
13. Resolve the Incident and show the final lifecycle state.

For a reliable hackathon demo, use deterministic simulator or seed data rather than depending on live external social APIs, CCTV, or hardware.

## 15. Architecture Decisions

### PostgreSQL

PostgreSQL is used because Event, Incident, Timeline, and future Action relationships are relational and easy to inspect during the hackathon.

### SQLAlchemy

SQLAlchemy 2.x provides a small ORM boundary without adding a large data-access framework.

### Deterministic correlation

The first correlation implementation uses location, event type, lifecycle state, and a recent time window. This is explainable and reliable for the MVP.

### Explainable risk

The Risk Engine uses fixed weighted factors rather than an opaque model. Operators can inspect the contributing factors.

### In-memory realtime

WebSocket subscribers are held in memory in the current API process. This is sufficient for a single-process demo and intentionally avoids adding Redis or another event broker.

### Human-approved action

The API only sends an action request to n8n after the operator has moved an Incident into `RESPONDING`. It does not autonomously dispatch emergency services.

## 16. Current Limitations and Future Work

The MVP is intentionally focused. Future work can add:

- Authentication and role-based authorization
- Production CORS configuration
- Durable WebSocket fanout and replay
- Event/Incident many-to-many evidence links if required
- More formal database migrations
- Civic-Shield production ingestion scheduling
- Citizen reporting mobile web/PWA
- Report rate limiting and reliability signals
- More detailed source evidence views
- Operator notes and richer timeline entries
- Additional action types and workflow status callbacks
- A full deterministic multi-stage crowd scenario

These are future extensions, not prerequisites for the current evaluation flow.
