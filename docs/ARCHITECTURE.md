# Architecture

ShaktiOS is planned as one simple event-driven platform:

```text
Sources -> Adapters -> Events -> Intelligence -> Signal Fusion -> Risk Engine -> Incident Engine -> Action -> Dashboard
```

Current implementation covers the Event and Incident stages plus a deterministic correlation boundary. Risk calculation is the next backend milestone. Realtime delivery, the dashboard command center, source adapters, human approval, and actions remain intentionally incremental.
