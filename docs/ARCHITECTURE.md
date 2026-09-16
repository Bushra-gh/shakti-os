# Architecture

ShaktiOS is planned as one simple event-driven platform:

```text
Sources -> Adapters -> Events -> Intelligence -> Signal Fusion -> Risk Engine -> Incident Engine -> Action -> Dashboard
```

The initial repository only provides the dashboard shell, a health-check API, shared frontend types, and a deterministic simulator. The remaining stages are intentionally placeholders until their contracts are designed.
