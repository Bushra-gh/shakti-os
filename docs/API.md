# API

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

## `GET /events`

Returns persisted events ordered newest first. The optional `limit` query parameter defaults to `50`.

```text
GET /events?limit=10
```

## `GET /incidents`

Returns incidents ordered by most recently updated. The optional `limit` parameter defaults to `50`.

## `GET /incidents/{incident_id}`

Returns one incident or `404` when it does not exist.

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
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Required |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Required |

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
