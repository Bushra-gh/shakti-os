# ShaktiOS Presentation Context

> Purpose: source context for another model to create a documentation about ShaktiOS.
> Snapshot date: 2026-09-25.
> Repositories inspected: `shakti-os` and sibling `shaktios-app`.

## 1. One-sentence description

ShaktiOS is an event-driven intelligence and response platform that turns fragmented signals from crowds, social intelligence, and citizens into explainable incidents, human-approved actions, and an auditable timeline.

## 2. The problem

Safety teams receive partial, disconnected observations:

- A crowd-density or abnormal-movement signal may indicate physical danger.
- Social concern may rise before an incident is obvious on the ground.
- Citizens may see a local problem that sensors miss.
- Operators need to understand what is happening, how serious it is, why the system believes that, and what action is appropriate.

Individual source systems do not answer the operational question:

> What is happening across multiple sources, how serious is it, and what should happen next?

ShaktiOS provides the common event model, correlation, risk explanation, operator workflow, and audit history that connect those sources.

## 3. Product promise and safety posture

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

The platform is decision support, not an autonomous emergency-response system. It does not independently dispatch responders or take irreversible action. An operator reviews evidence, controls the incident state, and explicitly requests an approved downstream action.

## 4. Repository map

### Core platform: `shakti-os`

Remote: `https://github.com/Hyperion147/shakti-os.git`  
Primary branch: `main`

| Area | Role |
| --- | --- |
| `apps/dashboard` | Next.js operator dashboard and command center |
| `services/api` | FastAPI backend, event ingestion, incident correlation, risk, timeline, auth, realtime, action handoff |
| `intelligence/civic-shield` | Adapter boundary for social-intelligence output |
| `intelligence/citizen-report` | Adapter boundary for citizen observations |
| `simulator/crowd` | Deterministic crowd-density signal generator |
| `packages/types` | Shared frontend event types |
| `packages/config`, `packages/eslint-config`, `packages/typescript-config` | Shared monorepo configuration |
| `supabase/migrations` | Authoritative PostgreSQL schema and row-level security setup |
| `scripts/seed.py` | Deterministic demo seeding through the API |
| `scripts/e2e_check.py` | End-to-end verification script |
| `docs` | Architecture, domain model, API, demo, decisions, setup, and evaluation context |

The core repo is a pnpm 11 + Turborepo workspace. The frontend uses Next.js and TypeScript. The backend uses Python 3.11+, FastAPI, SQLAlchemy 2.x, Pydantic, and psycopg. The production-shaped database boundary is Supabase PostgreSQL; SQLite is available for local smoke tests.

### Native citizen app: sibling repository `shaktios-app`

Remote: `https://github.com/Hyperion147/shaktios-app.git`  
Primary branch: `master`  
Local sibling path: `x:\Work\hackathons\Hackspire\shaktios-app`

This is the citizen-facing mobile/web companion, separate from the core monorepo. It is an Expo React Native app with Expo Router, NativeWind, React Native Reusables, Supabase Auth, Expo Camera, Expo Location, Expo Secure Store, and Lucide icons.

The app is intentionally a citizen reporting surface. It does not expose operator incident controls, risk calculations, action requests, or WebSocket feeds.

## 5. End-to-end architecture

```text
Crowd simulator / Civic-Shield / citizen app / future vision sources
                              |
                              v
                         FastAPI API
                              |
                 normalize and persist Event
                              |
          correlate by location + recent time window
                              |
                              v
                         Incident state
                              |
              deterministic explainable Risk Engine
                              |
          +-------------------+-------------------+
          v                                       v
   Next.js operator dashboard              incident timeline
          |                                       |
          v                                       v
   human-approved status/action --------> n8n webhook handoff

Supabase PostgreSQL stores events, incidents, and timeline entries.
Supabase Auth supplies citizen identity; FastAPI verifies JWTs server-side.
```

### Core domain objects

- **Signal:** raw observation from a source before normalization.
- **Event:** normalized, timestamped observation with type, source, location, confidence, and payload.
- **Incident:** situation inferred from one or more related Events.
- **Risk:** current explainable severity estimate and factor values for an Incident.
- **Action:** response requested for an Incident after human approval.
- **Timeline:** chronological record of correlated observations, status changes, and actions.
- **Operator:** person using the command dashboard.
- **Citizen:** person submitting a public report.

## 6. Core platform behavior

### Event ingestion

`POST /events` validates and persists normalized events. The event contract includes:

```json
{
  "type": "crowd_density",
  "source": "crowd_simulator",
  "location": "gate_4",
  "confidence": 0.95,
  "payload": { "density": 0.42 }
}
```

Relevant event types for the current crowd-risk scenario are:

- `crowd_density`
- `abnormal_movement`
- `social_concern`
- `citizen_report`

### Correlation and incident creation

Events of those types can create or update a `crowd_risk` incident when they share a location and fall inside the recent correlation window. The default window is 300 seconds and is configurable with `INCIDENT_CORRELATION_WINDOW_SECONDS`.

The current correlation is deterministic and intentionally understandable: a new event either joins the most recent unresolved incident at that location within the window or starts a new incident.

### Explainable risk

The initial risk calculation is deterministic, bounded to 0-1, and stores factor values on the incident:

```text
risk = 0.4 * crowd_density
     + 0.3 * social_velocity
     + 0.2 * abnormal_movement
     + 0.1 * citizen_reports
```

Citizen reports increment a count and contribute progressively, capped at five reports. Severity thresholds are:

| Risk | Severity |
| --- | --- |
| `< 0.40` | LOW |
| `0.40` to `< 0.70` | MEDIUM |
| `0.70` to `< 0.85` | HIGH |
| `>= 0.85` | CRITICAL |

This is an explainability foundation, not a machine-learning prediction model. The dashboard can show why risk changed rather than only displaying a score.

### Human-controlled lifecycle

Allowed incident transitions are:

```text
DETECTED -> ASSESSING
ASSESSING -> RESPONDING or RESOLVED
RESPONDING -> RESOLVED
```

Each accepted transition creates a `status.changed` timeline entry. An incident in `RESPONDING` can receive a human-approved action request through `POST /incidents/{incident_id}/actions`, which forwards the request to an optional n8n webhook. The webhook requests a workflow; it does not authorize autonomous emergency action.

### Realtime behavior

The API exposes in-process WebSocket streams:

- `WS /ws/events` for normalized event creation.
- `WS /ws/incidents` for incident updates.

The dashboard subscribes to both streams and reconnects through a frontend helper. This is an MVP single-process implementation: no cross-process delivery and no replay for clients that connect after an event.

## 7. Dashboard experience

The Next.js app has three important routes:

### `/`

Public product framing. It explains the Event -> Incident -> Risk -> Human Decision loop and directs users to the command center.

### `/dashboard`

Operator command center showing:

- active incident count
- elevated risk count
- signal count
- event and incident stream status
- situation map / location visualization
- incident queue
- activity feed
- signal submission dialog

### `/incidents/{incidentId}`

Operator decision view showing:

- incident type and location
- risk percentage, severity, and confidence
- explainable risk factors
- incident timeline
- WebSocket connection state
- allowed status transition controls
- operator notes
- human-approved n8n action request when the incident is `RESPONDING`

The map is a deterministic location visualization for the demo, not a live GIS integration.

## 8. Native citizen app experience

### Citizen journey

```text
Open app
  -> sign in or create account
  -> join a venue event or scan event QR
  -> choose report category
  -> describe what happened
  -> provide area label and optionally GPS
  -> optionally select a photo
  -> choose normal or urgent
  -> review
  -> submit to ShaktiOS
  -> view own reports
```

### App routes and screens

- `/login`: Supabase email/password sign-in and account creation.
- `/(tabs)/home`: current event, report-incident CTA, reports, event information, and profile access.
- `/(tabs)/join`: choose one of the demo venue events or go to QR scanning.
- `/scan`: camera-based QR event join flow.
- `/report`: category, free-text description, area label, optional GPS, photo picker, urgency.
- `/review`: shows the event, category, description, location, GPS state, and photo state before submission.
- `/submitted`: confirms receipt and links to the report list.
- `/(tabs)/reports`: fetches the signed-in citizen’s reports from FastAPI.
- `/report-detail`: report detail view.
- `/(tabs)/profile`: signed-in identity, current event, API endpoint, and sign-out.

### Citizen-to-core contract

The native app submits this conceptual event through `POST /events`:

```json
{
  "type": "citizen_report",
  "source": "citizen_app",
  "location": "Gate 4",
  "confidence": 0.7,
  "payload": {
    "category": "crowd",
    "description": "Heavy pushing near Gate 4",
    "latitude": null,
    "longitude": null,
    "accuracy": null,
    "venue_event_id": "evt-riverfest-2026",
    "urgency": "normal"
  }
}
```

Urgency maps to the event confidence signal: normal = 0.7, high = 0.9. The mobile app does not compute risk. FastAPI validates the Supabase JWT, strips client-supplied identity fields, stamps `reporter_id` from the verified JWT `sub`, and owns correlation and risk.

### Native app truth table

| Capability | Current state |
| --- | --- |
| Supabase email/password auth | Implemented |
| Secure native session persistence | Implemented with Expo Secure Store |
| FastAPI bearer-token requests | Implemented |
| Citizen event submission | Implemented |
| Own-report retrieval | Implemented through `/me` plus `/events` filtering |
| Optional GPS capture | Implemented; text area label remains the correlation key |
| Camera QR event join | Implemented |
| Photo selection | UI capture exists, but upload is not implemented; photo URI remains local-only |
| Venue/event registry | Not backend-backed; demo events are client-side mock data |
| Citizen incident status tracking | Limited; report list currently displays a received-style badge rather than a live incident lifecycle |
| Direct database access | Intentionally absent; app talks to FastAPI only |
| Operator controls | Intentionally absent from citizen app |

## 9. Data and security boundaries

Supabase provides PostgreSQL, Auth, and a private `citizen-evidence` storage bucket reserved for future media upload. FastAPI remains the system brain and connects server-side to PostgreSQL.

Important security choices:

- The mobile app contains only the Supabase publishable key, never a service-role key.
- FastAPI verifies Supabase JWT signature, issuer, audience, and expiry.
- Citizen identity is derived from the verified token, not trusted from request payloads.
- Client-supplied `reporter_id`, `user_id`, and similar identity fields are stripped or ignored.
- Supabase tables have deny-all policies for direct `anon` and `authenticated` table access; clients go through FastAPI.
- Citizen evidence is intended to follow `Expo -> FastAPI -> Supabase Storage` with signed upload behavior, but that media endpoint does not exist yet.

## 10. Demo story for a presentation

Use one named scenario, such as an emerging crowd incident at Riverfest 2026, Gate 4:

1. A social-concern signal rises near Gate 4.
2. The crowd simulator sends a crowd-density event.
3. A citizen opens the native app, signs in, joins Riverfest, and reports heavy pushing near Gate 4.
4. FastAPI normalizes all observations as Events.
5. Location and time correlation fuses the Events into one `crowd_risk` Incident.
6. The explainable Risk Engine updates factors, risk, severity, and confidence.
7. The dashboard receives the update over WebSockets and shows the incident, map location, factors, and timeline.
8. An operator moves the incident from `DETECTED` to `ASSESSING`, adds a note, and then chooses whether to move to `RESPONDING`.
9. After approval, the operator requests a controlled action through n8n.
10. The timeline records the correlated events, operator decisions, and action request.

The citizen-facing emotional moment is “my observation becomes part of a larger safety picture.” The operator-facing value is “one explainable, auditable view instead of several disconnected feeds.”

## 11. What is implemented versus future work

### Implemented in the inspected codebase

- pnpm/Turborepo monorepo and CI checks
- Next.js operator dashboard
- FastAPI event and incident APIs
- Event validation and persistence
- deterministic event-to-incident correlation
- explainable weighted risk engine
- incident risk-factor persistence
- incident timeline entries
- operator status transitions and notes
- event and incident WebSocket streams
- n8n action handoff after human approval
- Civic-Shield and citizen-report adapter boundaries
- deterministic crowd simulator
- Supabase PostgreSQL/Auth/RLS integration design
- Expo citizen app with auth, event join, QR scan, reporting, GPS, and report history
- automated frontend, backend, adapter, simulator, and auth tests

### Not yet implemented or intentionally limited

- full external Civic-Shield fetching inside this repository
- production authentication/authorization for the operator dashboard
- production CORS lockdown and multi-process realtime fanout
- WebSocket replay for late subscribers
- advanced or learned risk models
- autonomous response execution
- backend media upload and evidence storage flow
- backend event registry for venue onboarding
- full native-app live incident lifecycle/status experience
- additive-only migration discipline is required for future schema evolution; `create_all` is not a substitute for migrations

## 12. Suggested presentation structure

1. **Title:** ShaktiOS — From scattered signals to coordinated, accountable response.
2. **The operational gap:** crowd sensors, social intelligence, and citizen reports are individually incomplete.
3. **The platform loop:** Signals -> Events -> Incidents -> Risk -> Human Decision -> Action -> Timeline.
4. **System architecture:** show the two experiences, operator dashboard and citizen app, connected through FastAPI and Supabase.
5. **Signal fusion demo:** social concern + crowd density + citizen report become one Gate 4 incident.
6. **Explainable risk:** show weighted factors and severity thresholds, emphasizing transparency over black-box prediction.
7. **Citizen app:** sign in, join event, report, optional GPS, review, submit.
8. **Operator command center:** live incident queue, map, risk factors, timeline, realtime state.
9. **Human approval:** status transitions, operator note, n8n handoff, no autonomous emergency action.
10. **Why it matters:** faster shared situational awareness, citizen participation, and an auditable chain of decisions.
11. **Current maturity and roadmap:** clearly distinguish working MVP capabilities from future integrations such as media upload, event registry, stronger auth, and production realtime.

## 13. Presentation language and visual guidance

Prefer these ideas:

- “A common operating picture for evolving safety incidents.”
- “Every signal becomes traceable evidence.”
- “Risk is explainable before action is approved.”
- “Citizens contribute observations; operators retain control.”
- “The timeline makes the response auditable.”

Avoid claiming:

- that ShaktiOS autonomously responds to emergencies;
- that the risk engine is machine learning or predictive AI;
- that photos are uploaded to the backend;
- that venue events are already managed by a production event registry;
- that WebSockets are horizontally scalable;
- that Civic-Shield source fetching is fully inside this codebase.

Useful visuals for the presentation:

- a left-to-right signal-to-action pipeline;
- three source cards converging on one Gate 4 incident;
- a risk factor breakdown rather than a black-box score;
- a split-screen citizen report and operator incident detail;
- a vertical timeline showing event correlation, assessment, approval, and action request;
- a clear human-approval checkpoint before n8n.

## 14. Technical references in this workspace

- [Project overview](PROJECT_OVERVIEW.md)
- [Architecture](ARCHITECTURE.md)
- [Domain model](DOMAIN.md)
- [API contract](API.md)
- [Demo flow](DEMO.md)
- [Events](EVENTS.md)
- [Supabase and authentication](SUPABASE.md)
- [Core repository README](../README.md)