# Crowd simulator

Builds one deterministic `crowd_density` Event and posts it to ShaktiOS by default. It is synthetic input, not a CCTV/vision model. Use `--dry-run` to print without sending.

From `simulator/crowd`, in a POSIX shell:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[test]"
python -m shaktios_crowd_simulator.main --dry-run
```

In PowerShell, create the environment with `python -m venv .venv` and activate with `.\.venv\Scripts\Activate.ps1`. Use this package's environment, not `services/api/.venv`.

## Options

| Option | Behavior |
| --- | --- |
| `--dry-run` | Print the event without an HTTP request |
| `--api-url` | Destination; defaults to `SHAKTIOS_API_URL` or `http://localhost:8000` |
| `--location` | Exact location/zone ID; default `gate_4` |
| `--density` | Density input; use 0–1; default is the location preset or `0.42` |
| `--scenario kolkata-ashtami` | Sets legacy demo location `kol_sreebhumi`, default density `0.94` |

To join a registered citizen-report zone, explicitly use its canonical ID:

```bash
python -m shaktios_crowd_simulator.main --location hackspire26_sonarpur_registration --density 0.8 --dry-run
# Remove --dry-run only when you intend to store the event.
```

The simulator does not create the venue/zone registry. `gate_4` and legacy Kolkata preset names do not automatically match the newer seed's canonical zones. Unknown locations may produce incidents without coordinates. See [seed setup](../../docs/REAL_DATA.md) and the [fresh fusion demo](../../docs/DEMO.md).

The API currently permits anonymous machine signals for local integration; that is not a production security design. Run `python -m pytest` from this package for simulator tests.
