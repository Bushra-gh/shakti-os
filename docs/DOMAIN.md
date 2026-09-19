# Domain

- **Signal:** A raw observation from a source.
- **Event:** A normalized representation of a signal.
- **Incident:** A situation inferred from one or more related events.
- **Risk:** The current explainable estimate of incident severity and confidence.
- **Action:** A response requested or executed for an incident.
- **Report:** A human-provided signal that may become an Event.
- **Timeline:** The chronological history of incident events and actions.
- **Operator:** A person using the command dashboard.
- **Citizen:** A person submitting a public report.

Event → may contribute to Incident

Incident → has many Events

Incident → has Risk state and contributing factors

The first Risk Engine implementation stores `risk`, `severity`, and `factors` on the Incident. It combines normalized crowd density, social velocity, abnormal movement, and citizen report contributions with fixed weights.

Incident → may have Actions

Incident → has Timeline entries