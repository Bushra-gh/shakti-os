# API contract ownership

## Canonical sources

The FastAPI Pydantic models are the runtime authority for the JSON API:

- `services/api/src/shaktios_api/models.py` — Event and camera detection input
- `incident_models.py` — Incident, status, severity and action contracts
- `venue_models.py` — venue and zone responses
- `timeline_models.py` — timeline responses
- `report_models.py` and `report_contracts.py` — owned reports, categories, urgency and report status
- `voice_provider.py` and `priority_models.py` — voice draft and priority-assist responses
- `api_models.py` — health, identity, integration and public overview responses

The TypeScript clients do not maintain hand-written copies of those wire
models. `scripts/generate_contracts.py` converts the Pydantic JSON schemas into:

- `packages/types/src/generated.ts` — exported by `@shaktios/types` and consumed by the dashboard
- `../shaktios-app/src/types/contracts.ts` — generated into the independently installed Expo repository

The mobile copy is intentional: `shaktios-app` is not a pnpm workspace package
and must remain independently installable. It is generated output, not a second
manual contract. Both copies must be refreshed together.

## Regenerate and verify

From `shakti-os`, with the API test environment installed:

```bash
python scripts/generate_contracts.py --mobile ../shaktios-app
python scripts/generate_contracts.py --check --mobile ../shaktios-app
```

The generator imports only Pydantic contract modules. It does not connect to a
database, load private dotenv values or call an external provider.

When a contract changes:

1. Update the owning Pydantic model.
2. Regenerate both TypeScript outputs.
3. Update route behavior and both client API callers.
4. Run API pytest, dashboard typecheck/tests and mobile typecheck/tests.

Client-only state is deliberately not part of the wire contract. Examples are
mobile GPS readings, temporary photo/voice drafts, local auth presentation and
operator dashboard connection state.
