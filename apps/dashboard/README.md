# ShaktiOS operator dashboard

Next.js 16 / React 19 frontend for the ShaktiOS API. `/` is a static, labelled sample landing page. `/login` uses Supabase Auth; operational routes verify `/me` and operator capability before loading backend data.

## Configure and run

Follow the [monorepo setup](../../README.md#local-setup) for dependencies, FastAPI, Supabase and operator authorization. Put **only client-safe values** in ignored `apps/dashboard/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Next.js does not automatically load the monorepo root `.env`. Restart after changing local configuration and rebuild deployed clients when public values change. Never copy backend secrets into this file.

From the monorepo root:

```bash
pnpm --filter @shaktios/dashboard dev
```

Open `http://localhost:3000/login`, then `/dashboard`. See the [route/capability inventory](../../docs/PROJECT_OVERVIEW.md#operator-experience) rather than maintaining a second route list here.

## Implementation pointers

- `lib/api.ts`: authenticated HTTP calls and client types.
- `lib/supabase.ts`: current Supabase session/token access.
- `components/dashboard/operator-session.tsx`: operational route gate.
- `lib/realtime.ts`, `hooks/`: acknowledged WebSocket subscriptions, reconnect and HTTP refresh.
- `components/situation-map.tsx`: Leaflet/OpenStreetMap display of actual incident/zone coordinates.
- `app/globals.css`, `components/ui/`: shared Tailwind/design tokens and UI primitives; no page-specific CSS modules.

Snapshots are bounded, and source activity is not connector health. See [Architecture](../../docs/ARCHITECTURE.md) and the [API contract](../../docs/API.md).

## Checks

From the monorepo root, use `pnpm --filter @shaktios/dashboard` followed by `test`, `lint`, `check-types` or `build`. The separate `tests/scrolling.browser.cjs` runner has its own prerequisites/usage in its header. [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) explains coverage and current CI limits.
