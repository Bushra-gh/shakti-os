# Architecture

ShaktiOS is planned as one simple event-driven platform:

```text
Sources -> Adapters -> Events -> Intelligence -> Signal Fusion -> Risk Engine -> Incident Engine -> Action -> Dashboard
```

Current implementation covers Event, Civic-Shield normalization, deterministic Incident correlation, explainable Risk, realtime delivery, the dashboard command center, human approval, and an n8n action handoff. Source fetching remains outside ShaktiOS; adapters normalize external output into Events.
