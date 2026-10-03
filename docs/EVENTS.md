# Signal sources and event normalization

For domain definitions, correlation and risk, see [DOMAIN.md](DOMAIN.md). For HTTP submission/access and Event fields, see [API.md](API.md). This guide describes how sources enter that contract.

## Current source types

| Event type | Typical source | Relevant payload |
| --- | --- | --- |
| `crowd_density` | Crowd simulator / future sensor adapter | `density` |
| `abnormal_movement` | Machine signal / explicit demo fixture | `score` |
| `social_concern` | Civic-Shield adapter | `velocity`, social metadata |
| `citizen_report` | Citizen app or authorized dashboard observation | `venue_event_id`, category, description, urgency, optional GPS |

These four types can contribute to `crowd_risk` incidents. Other valid types are persisted/broadcast without current incident correlation. Source labels identify provenance; they do not prove a physical camera or production social connector is online.

Use the same **canonical zone ID** and fresh timestamps across sources when demonstrating fusion. The crowd simulator's default `gate_4` location does not automatically match a registered venue zone; pass its `--location` option explicitly. Coordinates in a citizen payload are supporting evidence, not a substitute for the zone ID.

## Source packages

| Package | Implemented boundary | Caveat |
| --- | --- | --- |
| [`simulator/crowd`](../simulator/crowd/README.md) | One deterministic `crowd_density` event; send or print-only mode | Synthetic input, not CCTV inference; separate Python environment |
| [`intelligence/civic-shield`](../intelligence/civic-shield/README.md) | `CivicShieldAdapter.to_event()` / `send_event()` normalize social output; `bridge.py` and `ingest.py` provide a generated-post demonstration | No production social-source collection/scheduling; optional Groq analysis may call a provider when configured |
| [`intelligence/citizen-report`](../intelligence/citizen-report/README.md) | `CitizenReportAdapter.to_event()` normalizes report text and excludes identity | Legacy `send_event()` supplies neither Auth nor the required venue context; it is not a working current citizen submission client |
| Sibling [`shaktios-app`](../../shaktios-app/README.md) | Authenticated citizen submission with registered venue/zone and current session | It builds the request directly; it does not use the Python citizen adapter |

Optional voice processing supplies **draft fields**, not an Event. Only the citizen's later review/confirmation enters `POST /events`.

## Identity and provenance

- FastAPI owns `reporter_id` and `incident_id`; source-supplied identities/links are not trusted.
- Citizen submissions require a verified user. Dashboard-prefixed sources additionally require operator capability.
- Non-citizen machine ingestion remains anonymous for the local MVP. Secure this boundary before deployment; a source string is not authentication.
- The supported SQL seed uses `seed_*` source names, `is_seeded` and `seed_batch`, with no invented citizen identity. Keep these labels visible in demonstrations.
- Payload metadata is evidence supplied by a source, not a verified claim or an instruction to execute.

Use the [seed runbook](REAL_DATA.md) for fixture creation and [DEMO.md](DEMO.md) for a fresh, zone-matched multi-source walkthrough.
