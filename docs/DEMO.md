# Demo

Placeholder for the future end-to-end demo flow:

1. Start PostgreSQL.
2. Start the API.
3. Start the crowd simulator.
4. Observe the event in the dashboard.
5. Open an incident to review risk, severity, confidence, and explainable factors.
6. Keep the incident stream connected while new events update the incident state.
7. Review the incident timeline entries created from correlated events.
8. Approve a controlled incident status transition with an operator note.
9. Request the approved action through the configured n8n webhook.
10. Review the human-approved action and audit timeline.

The current backend supports event delivery, deterministic incident correlation, explainable risk calculation, in-process event and incident WebSocket updates, persisted incident timeline entries, controlled operator status transitions, and an n8n action handoff. The dashboard provides incident list, detail, timeline, operator approval, action handoff, and deterministic location-map views that receive incident updates. The webhook requests a workflow after human approval; it does not make autonomous emergency decisions.
