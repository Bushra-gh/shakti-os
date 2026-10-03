# ShaktiOS API

FastAPI service for Event, Incident, explainable Risk, realtime updates, timeline, approval, and action handoff workflows.

Supabase PostgreSQL is the runtime database. Set `DATABASE_URL` to the
Supabase pooler connection string (`...pooler.supabase.com:6543/postgres?sslmode=require`)
and deploy the schema once with `supabase db push` (migrations live in
`supabase/migrations/`). For an offline smoke test without Supabase, set
`DATABASE_URL=sqlite+pysqlite:///./shaktios-local.db` before starting the
server. The test suite uses isolated in-memory SQLite.

Supabase Auth is the identity provider: citizen clients send
`Authorization: Bearer <supabase_access_token>`; verification lives in
`shaktios_api/auth.py`. `GET /me` returns the verified identity. Local runs
also load the monorepo root `.env`; production should inject environment
variables through the process manager.
See `docs/SUPABASE.md` for the full auth, RLS, and migration workflow.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
# From services/api; ../../.env is the repository root env file.
uvicorn shaktios_api.main:app --app-dir src --env-file ../../.env --reload --port 8000
```
