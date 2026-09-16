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

Validates and logs one event, then returns the normalized event. `id` and `timestamp` are generated when omitted.

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

The API runs locally on port `8000` by default and allows requests from the dashboard at `http://localhost:3000`.
