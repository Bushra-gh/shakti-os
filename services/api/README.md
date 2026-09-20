# ShaktiOS API

FastAPI service for Event, Incident, explainable Risk, realtime updates, timeline, approval, and action handoff workflows.

For local smoke testing without PostgreSQL, set `DATABASE_URL=sqlite+pysqlite:///./shaktios-local.db` before starting the server. The test suite uses isolated in-memory SQLite.

Run the additive schema command before starting the server when using an existing database:

```powershell
python -m shaktios_api.migrate
```

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
uvicorn shaktios_api.main:app --app-dir src --reload --port 8000
```
