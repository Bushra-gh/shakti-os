# API

## Authentication and access

All operator reads (`/events`, `/incidents`, related evidence/timelines, `/integrations`) and status/action writes require `Authorization: Bearer <Supabase access token>` **and operator capability**. Missing/invalid credentials return `401`; a citizen attempting operator endpoints receives `403`. Operators are granted using `OPERATOR_USER_IDS`, `OPERATOR_EMAILS`, or trusted `app_metadata.role=operator|admin`. `GET /me` returns `{id,email,role,is_operator}`.

Public routes are `/health`, `/venues`, `/venues/{id}` and `/public/overview`. The overview returns database-wide counts plus field-projected incident/event summaries; it never returns report payloads or reporter identities. It includes `seeded_event_count` so clients can label seeded data.

### Citizen report and venue routes

- `GET /venues`: registered venues and canonical zones, including nullable `startTime`, `endTime`, and `helpline`.
- `GET /venues/{id}`: a venue or `404`.
- `GET /me/reports?limit=50&offset=0`: verified citizen's reports, filtered by ownership **before** pagination (limit 1–100).
- `GET /me/reports/{id}`: one owned report; `404` for missing or unowned IDs.
- Report responses include `incident_id`, `incident_status`, `report_status` and `venue_name` alongside event fields. Status follows the persisted incident: `DETECTED → received`, `ASSESSING → under_review`, `RESPONDING → action_initiated`, `RESOLVED → resolved`; no incident means `submitted`. `RESPONDING` is an operator workflow state, not confirmation that responders were dispatched.
- `GET /incidents/{id}/events`: operator-only evidence filtered by the actual incident association, not a matching location string.
- `GET /integrations`: operator-only n8n configuration/secret-presence flags. Configuration is not a live delivery health check.


## `GET /health`

Returns the service status for local health checks.

```json
{
  "status": "ok",
  "service": "shaktios-api"
}
```

## `POST /events`

Validates, persists, and logs one event, then returns the persisted normalized event. `id` and `timestamp` are generated when omitted.

```json
{
  "type": "crowd_density",
  "source": "crowd_simulator",
  "location": "gate_4",
  "confidence": 0.95,
  "payload": {
    "density": 0.42
  }
}
```

The response has status `201` and includes the generated `id` and UTC `timestamp`.

Authentication is via Supabase Auth: citizen clients send
`Authorization: Bearer <supabase_access_token>`. The token is optional
for machine signal sources, but a present-but-invalid token is rejected
with `401`. For `citizen_report` events, any client-supplied identity is
stripped and `reporter_id` is stamped server-side from the verified JWT
`sub` (see `docs/SUPABASE.md`). Citizen reports require a valid session, `payload.venue_event_id`, and `location` equal to a zone ID belonging to that venue. `incident_id` is always server-owned; duplicate event IDs return `409`. Dashboard-prefixed sources additionally require operator capability. Non-citizen machine ingestion remains open for the local MVP; secure it before public deployment.

## `GET /events`

Returns persisted events ordered newest first. The optional `limit` query parameter defaults to `50`.

```text
GET /events?limit=10
```

## `GET /incidents`

Returns incidents ordered by most recently updated. The optional `limit` parameter defaults to `50`.

## `GET /incidents/{incident_id}`

Returns one incident or `404` when it does not exist.

## `GET /incidents/{incident_id}/timeline`

Returns the incident's chronological timeline entries, oldest first. The optional `limit` defaults to `100`. A relevant event creates an `event.correlated` entry after it is associated with the incident.

```json
[
  {
    "id": "timeline-entry-id",
    "incident_id": "incident-id",
    "type": "event.correlated",
    "timestamp": "2026-09-19T12:00:00Z",
    "details": {
      "event_id": "event-id",
      "event_type": "crowd_density",
      "source": "crowd_simulator",
      "risk": 0.168,
      "severity": "LOW"
    }
  }
]
```

## `POST /incidents/{incident_id}/status`

Records an operator-approved incident status transition and returns the updated incident. The request supports an optional note:

```json
{
  "status": "ASSESSING",
  "note": "Operator is reviewing evidence."
}
```

Allowed transitions are `DETECTED -> ASSESSING`, `ASSESSING -> RESPONDING` or `RESOLVED`, and `RESPONDING -> RESOLVED`. Invalid transitions return `409`. Each accepted transition creates a `status.changed` timeline entry and broadcasts the updated incident.

## `POST /incidents/{incident_id}/actions`

Requests a human-approved action for an incident in `RESPONDING` status and forwards it to `N8N_WEBHOOK_URL`.

```json
{
  "type": "notify_operator",
  "note": "Send the approved response."
}
```

The endpoint returns `503` when the webhook URL is not configured, `502` when delivery fails, and `409` when the incident is not `RESPONDING`. The operator note is forwarded to n8n and successful delivery creates an `action.requested` timeline entry. This integration requests a workflow; it does not execute autonomous emergency action.

## `WS /ws/incidents`

Both WebSocket routes require the first JSON message within five seconds to be `{"type":"authenticate","token":"<Supabase access token>"}`. Credentials must not be put in the URL. After operator verification the server sends `{"type":"authenticated"}`; invalid or non-operator sessions close with code `1008`. A connection is not live until this acknowledgement is received.

Streams incident updates from the current API process. The connection remains open until the client disconnects. When an event creates or updates an incident, subscribers receive:

```json
{
  "type": "incident.updated",
  "incident": {
    "id": "incident-id",
    "type": "crowd_risk",
    "location": "gate_4",
    "status": "DETECTED",
    "severity": "LOW",
    "confidence": 0.95,
    "risk": 0.168,
    "factors": {},
    "created_at": "2026-09-19T12:00:00Z",
    "updated_at": "2026-09-19T12:00:00Z"
  }
}
```

This is intentionally an in-memory, single-process implementation for the MVP. It does not provide cross-process delivery or replay for clients that connect later.

## `WS /ws/events`

Streams normalized events from the current API process. When an event is persisted, subscribers receive:

```json
{
  "type": "event.created",
  "event": {
    "id": "event-id",
    "type": "crowd_density",
    "source": "crowd_simulator",
    "timestamp": "2026-09-19T12:00:00Z",
    "location": "gate_4",
    "confidence": 0.95,
    "payload": { "density": 0.42 }
  }
}
```

The event stream uses the same in-memory, single-process delivery model as the incident stream and does not provide replay.

Events with types `crowd_density`, `abnormal_movement`, `social_concern`, and `citizen_report` can create or update a `crowd_risk` incident when they share a location and fall within the recent correlation window. The window defaults to 300 seconds and can be changed with `INCIDENT_CORRELATION_WINDOW_SECONDS`.

## Database schema

The API creates the `events` table on startup:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `VARCHAR(36)` | Primary key |
| `type` | `VARCHAR(255)` | Required |
| `source` | `VARCHAR(255)` | Required |
| `timestamp` | `TIMESTAMP WITH TIME ZONE` | Required |
| `location` | `VARCHAR(255)` | Required |
| `confidence` | `FLOAT` | Required, validated from `0.0` to `1.0` |
| `payload` | `JSON` | Required |

The API also creates the `incidents` table:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `VARCHAR(36)` | Primary key |
| `type` | `VARCHAR(255)` | Required |
| `location` | `VARCHAR(255)` | Required |
| `status` | `VARCHAR(32)` | Required |
| `severity` | `VARCHAR(32)` | Required |
| `confidence` | `FLOAT` | Required, validated from `0.0` to `1.0` |
| `risk` | `FLOAT` | Required, normalized from `0.0` to `1.0` |
| `factors` | `JSON` | Required, explainable contributions |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Required |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Required |

The API also creates the `incident_timeline` table:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `VARCHAR(36)` | Primary key |
| `incident_id` | `VARCHAR(36)` | Required, indexed |
| `type` | `VARCHAR(64)` | Required |
| `timestamp` | `TIMESTAMP WITH TIME ZONE` | Required |
| `details` | `JSON` | Required |

## Schema changes

Run `supabase db push` from `shakti-os` to apply the authoritative SQL migrations. The venue/coordinate migration adds `venues`, `venue_zones`, and nullable incident `latitude`/`longitude`. It enables RLS on venue tables; clients use FastAPI rather than direct table access. Startup `create_all` supports isolated SQLite tests but does not alter existing columns. Do not reset the project to apply these changes. Supabase transaction pooling requires psycopg named preparation disabled (`prepare_threshold=None`), which the API engine configures.

Incidents also expose the current explainable risk state:

```json
{
  "risk": 0.408,
  "severity": "MEDIUM",
  "factors": {
    "crowd_density": 0.42,
    "social_velocity": 0.8,
    "abnormal_movement": 0.0,
    "citizen_reports": 0.0,
    "citizen_report_count": 0
  }
}
```

The initial calculation is:

```text
risk = 0.4 * crowd_density
     + 0.3 * social_velocity
     + 0.2 * abnormal_movement
     + 0.1 * citizen_reports
```

Severity thresholds are `LOW` below `0.40`, `MEDIUM` from `0.40`, `HIGH` from `0.70`, and `CRITICAL` from `0.85`. This is deterministic and explainable; it is not an AI or predictive model.

The API runs locally on port `8000` by default and allows requests from the dashboard at `http://localhost:3000`.
