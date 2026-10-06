# ShaktiOS Agent Guide

## Project

ShaktiOS is an event-driven intelligence and response platform.

Core flow:

Source
→ Event
→ Signal Fusion
→ Incident
→ Risk
→ Human Approval
→ Action
→ Timeline

## Repository

- apps/dashboard: Next.js frontend
- services/api: FastAPI backend
- intelligence/civic-shield: social intelligence
- simulator/crowd: event simulation
- packages/types: shared TypeScript types
- docs: architecture and project knowledge

## Core domain rules

- Event = observable signal normalized into ShaktiOS format.
- Incident = situation inferred from one or more Events.
- Risk = current estimated severity/confidence of an Incident.
- Action = response requested or executed for an Incident.
- Timeline = chronological record of an Incident lifecycle.

## Engineering rules

- Prefer simple solutions.
- Do not introduce infrastructure unless required.
- Do not rewrite working code without a reason.
- Do not change unrelated files.
- Keep features small and testable.
- Never silently change API contracts.
- Treat FastAPI Pydantic models as the runtime contract source; regenerate both TypeScript client contract outputs after wire changes.
- Run relevant tests after changes.
- Run typecheck/lint for frontend changes.
- Run pytest for backend changes.

## Architecture

See docs/ARCHITECTURE.md

## Domain

See docs/DOMAIN.md

## API

See docs/API.md

## Decisions

See docs/DECISIONS.md

## Current MVP

See docs/DEMO.md

## Workflow

1. Inspect relevant code.
2. Plan before large changes.
3. Implement smallest viable change.
4. Run tests/checks.
5. Report files changed and validation performed.
