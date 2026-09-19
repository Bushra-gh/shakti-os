# Crowd Simulator

Builds one deterministic crowd-density event and sends it to the ShaktiOS API by default. Use `--dry-run` to print without sending.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
python -m shaktios_crowd_simulator.main
# Print only
python -m shaktios_crowd_simulator.main --dry-run
# Use another API URL
python -m shaktios_crowd_simulator.main --api-url http://localhost:8000
```

The API URL can also be set with `SHAKTIOS_API_URL`.
