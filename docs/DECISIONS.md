# Architecture decisions

These decisions describe the current implementation and its trade-offs. They are not claims that every deployment or external integration is production-ready.

## ADR-001: PostgreSQL persistence

Use Supabase PostgreSQL with SQLAlchemy. Events, incident associations, venue zones, ownership and timeline history fit a relational model and are inspectable during the demo. The original alternative was MongoDB; it was not selected for these relational workflows.

The repository's SQL migrations are authoritative. SQLite remains useful for isolated tests but does not replace PostgreSQL migration/RLS verification. See [SUPABASE.md](SUPABASE.md).

## ADR-002: WebSocket updates with HTTP snapshots

Use authenticated FastAPI WebSockets for timely operator event/incident updates. Load and recover state through HTTP; detail/timeline views also refresh periodically. This is not a rejection of all polling.

The current connection managers are process-local. Keeping them simple avoids another broker for the single-process MVP, but multi-worker fanout and replay require additional design. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Current design choices

- **FastAPI owns operational access.** Both clients use Supabase for Auth, but FastAPI validates identity, operator capability and report ownership. Direct client operational-table access is denied by RLS.
- **Deterministic correlation and scoring.** Exact location/time rules and fixed factors are easy to explain and test. They are not semantic inference, learned prediction or calibrated emergency probability. Rules live in [DOMAIN.md](DOMAIN.md).
- **Human approval before handoff.** An operator controls incident state and separately requests an action. n8n is an optional downstream workflow boundary, not an autonomous dispatcher.
- **Separate citizen repository.** Expo has its own dependency/build lifecycle. Sharing a backend contract does not make `shaktios-app` a monorepo workspace package; API changes require checking both clients.
- **Voice drafts, not voice actions.** Audio processing is opt-in, server-mediated and transient in the application. Suggested fields remain editable and need explicit confirmation before the normal report flow. See [VOICE_REPORTING.md](VOICE_REPORTING.md).
- **Labelled synthetic fixtures.** Seeded observations and static landing samples remain distinguishable from authenticated submissions and live external signals.

Record new trade-offs here; keep endpoint details, setup commands and test results in their owning guides instead of copying them into decisions.
