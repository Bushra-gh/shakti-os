# ShaktiOS Dashboard

Minimal Next.js shell for the ShaktiOS operator experience. The home screen includes a read-only incident list backed by `GET /incidents`.

Set `NEXT_PUBLIC_API_URL` when the API is not running at `http://localhost:8000`.

From the repository root:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000`.
