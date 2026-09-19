# Demo

Placeholder for the future end-to-end demo flow:

1. Start PostgreSQL.
2. Start the API.
3. Start the crowd simulator.
4. Observe the event in the dashboard.
5. Open an incident to review risk, severity, confidence, and explainable factors.
6. Keep the incident stream connected while new events update the incident state.
7. Review the incident timeline entries created from correlated events.
8. Review the human-approved action and audit timeline.

The current backend supports event delivery, deterministic incident correlation, explainable risk calculation, in-process event and incident WebSocket updates, and persisted incident timeline entries. The dashboard provides read-only incident list and detail views that receive incident updates. Operator approval and response workflows remain future steps.
