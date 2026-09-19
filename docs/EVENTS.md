# Events

- **Signal:** An observation from a source before it is normalized.
- **Event:** A normalized, timestamped record describing something observed.
- **Incident:** A tracked situation created when signals indicate meaningful risk.
- **Risk:** An assessment of likelihood and potential impact.
- **Action:** A response proposed for human approval and execution.
- **Timeline:** The ordered audit record of observations, decisions, and actions.

Relevant crowd-risk event types currently include `crowd_density`, `abnormal_movement`, `social_concern`, and `citizen_report`. Events sharing a location within the configured correlation window may contribute to one `crowd_risk` incident.
