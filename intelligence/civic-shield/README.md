# Civic-Shield Intelligence Adapter

This package defines the integration boundary between the separate SIH Civic-Shield project and ShaktiOS.

`CivicShieldAdapter.to_event()` accepts a Civic-Shield analysis mapping, including the SIH backend's `CivicEvent` fields such as `region`, `location_name`, `mention_count`, `avg_tone`, and `sample_headline`, and returns a normalized ShaktiOS `social_concern` event payload.

The adapter does not fetch data, import the SIH application, or make risk decisions. A caller is responsible for sending the returned payload to ShaktiOS `POST /events`.

```python
from civic_shield.adapter import CivicShieldAdapter

event = CivicShieldAdapter().to_event({
    "region": "Delhi",
    "mention_count": 42,
    "avg_tone": -3.2,
    "velocity": 0.84,
})
```
