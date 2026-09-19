# ShaktiOS Dashboard

Minimal Next.js shell for the ShaktiOS operator experience. The home screen includes read-only incident list and detail views backed by `GET /incidents`, `GET /incidents/{incident_id}`, and live updates from `WS /ws/incidents`. Incident detail also supports controlled operator status approvals through `POST /incidents/{incident_id}/status`.

Set `NEXT_PUBLIC_API_URL` when the API is not running at `http://localhost:8000`.

The dashboard uses `GET /health`, `GET /events`, `GET /incidents`, `GET /incidents/{incident_id}`, `GET /incidents/{incident_id}/timeline`, `POST /incidents/{incident_id}/status`, `POST /incidents/{incident_id}/actions`, `WS /ws/events`, and `WS /ws/incidents`. Event submission remains a simulator/source responsibility and is intentionally not exposed as a dashboard control.

From the repository root:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000`.
