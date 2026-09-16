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

The API runs locally on port `8000` by default and allows requests from the dashboard at `http://localhost:3000`.
