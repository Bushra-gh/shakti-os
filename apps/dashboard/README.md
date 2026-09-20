# ShaktiOS Dashboard

Next.js frontend for ShaktiOS. The public landing page is at `/`; the full-width operational command center is at `/dashboard`; incident detail pages are at `/incidents/{incident_id}`.

Set `NEXT_PUBLIC_API_URL` when the API is not running at `http://localhost:8000`.

The frontend uses Tailwind utilities and installed shadcn primitives. There are no page-specific CSS modules; shared global tokens live in `app/globals.css`.

The dashboard uses `GET /health`, `GET /events`, `POST /events`, `GET /incidents`, `GET /incidents/{incident_id}`, `GET /incidents/{incident_id}/timeline`, `POST /incidents/{incident_id}/status`, `POST /incidents/{incident_id}/actions`, `WS /ws/events`, and `WS /ws/incidents`. Civic-Shield and citizen-report adapters remain source-side packages; their normalized events enter through `POST /events`.

From the repository root:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000`.
