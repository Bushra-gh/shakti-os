# ShaktiOS Dashboard

Minimal Next.js shell for the ShaktiOS operator experience. The home screen includes read-only incident list and detail views backed by `GET /incidents` and `GET /incidents/{incident_id}`.

Set `NEXT_PUBLIC_API_URL` when the API is not running at `http://localhost:8000`.

From the repository root:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000`.
