# Demo

End-to-end local demo flow:

1. Start PostgreSQL.
2. Start the API.
3. From `services/api`, run `python -m shaktios_api.migrate` for an existing database.
4. Start the crowd simulator.
5. Observe the event in the dashboard.
6. Open an incident to review risk, severity, confidence, and explainable factors.
7. Keep the incident stream connected while new events update the incident state.
8. Review the incident timeline entries created from correlated events.
9. Approve a controlled incident status transition with an operator note.
10. Request the approved action through the configured n8n webhook.
11. Confirm the execution in n8n and review the human-approved action in the audit timeline.

The current backend supports event delivery, deterministic incident correlation, explainable risk calculation, in-process event and incident WebSocket updates, persisted incident timeline entries, controlled operator status transitions, and an n8n action handoff. Civic-Shield output and citizen reports can be normalized through their adapters and sent into `POST /events`. The dashboard provides incident list, detail, timeline, operator approval, action handoff, and deterministic location-map views that receive incident updates. Import `n8n/shaktios-action-handoff.json` and follow `n8n/README.md` to configure the handoff. The webhook requests a workflow after human approval; it does not make autonomous emergency decisions.
