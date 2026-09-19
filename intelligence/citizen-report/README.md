# Citizen Report Adapter

This package normalizes a public citizen report into a ShaktiOS `citizen_report` event. It does not expose a public endpoint, store reporter identity, or make risk decisions.

```python
from citizen_report import CitizenReportAdapter

event = CitizenReportAdapter().to_event({
    "location": "gate_4",
    "description": "Crowd is blocking the south entrance.",
    "category": "crowding",
    "urgency": "high",
    "confidence": 0.9,
})
```

Send the returned payload to ShaktiOS `POST /events`. Reporter identity is intentionally not forwarded in the normalized event payload.
