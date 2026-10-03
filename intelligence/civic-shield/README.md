# Civic-Shield intelligence adapter

This package connects Civic-Shield-style analysis output to ShaktiOS, without importing or operating the separate source-collection application.

`CivicShieldAdapter.to_event()` accepts a mapping (including `region`, `location_name`, `mention_count`, `avg_tone`, `sample_headline` and `velocity`) and returns a normalized `social_concern` Event with source `civic_shield`. `send_event()` posts that normalized payload to a caller-supplied ShaktiOS API URL.

```python
from civic_shield.adapter import CivicShieldAdapter

signal = {
    "location_name": "hackspire26_sonarpur_registration",
    "mention_count": 42,
    "avg_tone": -3.2,
    "velocity": 0.84,
}
event = CivicShieldAdapter().to_event(signal)
```

The adapter does not fetch social data or make incident-risk decisions. Use the same canonical zone ID as other sources when demonstrating correlation; see [Events](../../docs/EVENTS.md).

## Demo bridge

`bridge.py` contains region matching, trend/credibility helpers, optional Groq sentiment analysis and generated demo posts. `ingest.py` assembles a synthetic social-concern scenario and either prints or posts it:

```bash
# From this package, after installation in its own environment:
python -m civic_shield.ingest --location hackspire26_sonarpur_registration --local
# Omit --local only when a stored demo event is intended:
python -m civic_shield.ingest --location hackspire26_sonarpur_registration --api-url http://localhost:8000
```

`--local` prevents the final ShaktiOS POST, **not** all possible provider calls: if `GROQ_API_KEY` and the optional Groq client are available, analysis can call Groq. Without usable provider configuration it falls back to neutral sentiment. Keep provider keys server-side and avoid private text in demonstrations.

This package does not supply deployed social-source fetching/scheduling. Anonymous non-citizen ingestion is a local-MVP API exception, not production connector authentication.

Install `.[test]` in this package's virtual environment and run `python -m pytest` for adapter tests. See the [API contract](../../docs/API.md) and [contribution checks](../../docs/CONTRIBUTING.md).
