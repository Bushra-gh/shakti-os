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

## Prerequisites

- Node.js 24+
- pnpm 11+
- Python 3.11+
- Docker Desktop (only needed for PostgreSQL)

## Setup

```powershell
pnpm install
Copy-Item .env.example .env
```

The local `.env` uses these defaults:

```text
DATABASE_URL=postgresql://shaktios:shaktios_dev@localhost:5432/shaktios
NEXT_PUBLIC_API_URL=http://localhost:8000
SHAKTIOS_API_URL=http://localhost:8000
N8N_WEBHOOK_URL=
```

`N8N_WEBHOOK_URL` is optional until the n8n workflow is hosted and activated.

Start local PostgreSQL when needed:

```powershell
docker compose up -d
```

Docker Desktop must be installed and running for PostgreSQL. For a no-Docker smoke test, set `DATABASE_URL=sqlite+pysqlite:///./shaktios-local.db` before starting the API.

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

Run `python -m shaktios_api.migrate` before starting the server when using an existing database. Check `http://localhost:8000/health`. Events can be submitted to `POST http://localhost:8000/events` and read with `GET http://localhost:8000/events`; see [docs/API.md](docs/API.md).

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
