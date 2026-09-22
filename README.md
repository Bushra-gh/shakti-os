# SHAKTIOS

ShaktiOS is an event-driven intelligence and response platform. Its planned flow is:

```text
Signals -> Events -> Signal Fusion -> Risk Assessment -> Incident -> Human-approved Action -> Audit / Timeline
```

This repository is the bootstrap phase. It contains the architecture, development conventions, a minimal Next.js dashboard shell, a FastAPI Event, Incident, and explainable Risk foundation, shared frontend types, and a local crowd-event simulator. Product intelligence adapters, actions, WebSockets, authentication, and integrations are intentionally incremental.

## Repository structure

```text
apps/dashboard/                 Next.js frontend
services/api/                   FastAPI backend
intelligence/civic-shield/      Civic-Shield integration placeholder
simulator/crowd/                Deterministic event simulator
packages/types/                 Shared TypeScript event types
packages/config/                Shared configuration placeholder
docs/                           Architecture and workflow documentation
```

The repository also retains the shared ESLint, TypeScript, and UI packages from the initial Turborepo setup.

For an evaluation-ready overview of the architecture, routes, database schema, demo flow, and current limitations, see [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Prerequisites

- Node.js 24+
- pnpm 11+
- Python 3.11+
- A Supabase project (PostgreSQL + Auth) and the Supabase CLI
- Docker is no longer required (no local database container)

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
```

Fill in `.env` with your Supabase values (see `.env.example`):

```text
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:...@...pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_PROJECT_REF=...
NEXT_PUBLIC_API_URL=http://localhost:8000
SHAKTIOS_API_URL=http://localhost:8000
N8N_WEBHOOK_URL=
```

`N8N_WEBHOOK_URL` is optional until the n8n workflow is hosted and activated.

Apply the database schema (the single authoritative migration set):

```powershell
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

For an offline smoke test without Supabase, set `DATABASE_URL=sqlite+pysqlite:///./shaktios-local.db` before starting the API. SQLite is for smoke tests only — Supabase PostgreSQL is the runtime database.

## Run the frontend

Run the dashboard through Turborepo:

```powershell
pnpm dev
```

Or run it independently:

```powershell
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000`.

## Run the backend

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
uvicorn shaktios_api.main:app --app-dir src --reload --port 8000
```

Run `supabase db push` once to deploy the schema before starting the server. Check `http://localhost:8000/health`. Events can be submitted to `POST http://localhost:8000/events` and read with `GET http://localhost:8000/events`; see [docs/API.md](docs/API.md). Supabase Auth is the identity provider for citizen clients; see [docs/SUPABASE.md](docs/SUPABASE.md).

## Run the simulator

```powershell
cd simulator/crowd
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
python -m shaktios_crowd_simulator.main
```

The simulator sends one deterministic event to the API. Add `--dry-run` to print without sending, or set `SHAKTIOS_API_URL` to use another API base URL.

The API and simulator use separate virtual environments. Run the simulator with `simulator/crowd/.venv\Scripts\python.exe`, not the API virtual environment.

## Development commands

```powershell
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm check-types
```

Run API tests from `services/api` with `pytest` after installing the test extras.

## Git workflow

`main` is the stable branch. Use `feature/*`, `fix/*`, `docs/*`, or `chore/*` branches. Keep pull requests small, do not push directly to `main`, and avoid unrelated file changes. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
