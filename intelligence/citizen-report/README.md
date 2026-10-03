# Citizen report normalization adapter

`CitizenReportAdapter.to_event()` converts a report mapping into a `citizen_report` Event with source `citizen_report`. It requires location and description/text, normalizes confidence and retains category/urgency plus selected metadata. It does not persist data, assign reporter identity or calculate risk.

```python
from citizen_report import CitizenReportAdapter

event = CitizenReportAdapter().to_event({
    "location": "hackspire26_sonarpur_registration",
    "description": "Demo observation: queue is blocking the entrance.",
    "category": "crowd",
    "urgency": "high",
    "confidence": 0.9,
})
```

**Normalization is not a complete current submission flow.** This adapter does not preserve `venue_event_id`, and its legacy `send_event(report, api_url)` does not accept/send a bearer token. That helper cannot satisfy the current API's authenticated citizen/registered-venue requirements without a caller/integration update. Supplying identity fields in the input is not a workaround.

The sibling mobile app constructs its own authenticated request; it does not call this Python adapter. For a valid submission use the [API contract](../../docs/API.md#event-submission): a verified session, selected venue ID and one of that venue's zone IDs. FastAPI stamps ownership and computes the incident association.

For local package checks, install `.[test]` in this package's virtual environment and run `python -m pytest`. See [Events](../../docs/EVENTS.md) for the source-boundary overview.
