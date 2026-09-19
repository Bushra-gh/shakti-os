# ShaktiOS API

FastAPI service for the Event, Incident, and explainable Risk foundation. It exposes `GET /health`, Event ingestion/listing, and Incident listing/detail endpoints.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
uvicorn shaktios_api.main:app --app-dir src --reload --port 8000
```
