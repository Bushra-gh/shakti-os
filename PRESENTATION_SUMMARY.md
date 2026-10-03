# ShaktiOS — Presentation Summary

> **Two experiences, one accountable safety workflow:** `shakti-os` supplies the operator dashboard and backend; sibling `shaktios-app` supplies the citizen app.
> This summary follows current source and the real-data/API runbooks. Older presentation/overview documents contain superseded claims about missing auth, mock venues, photo selection, and report tracking.

## 1. The pitch: problem, users, value

**ShaktiOS turns fragmented observations into explainable incidents that humans assess, act on, and audit.**

At crowded venues, a density reading, a social concern, and a citizen's observation each show only part of the situation. Operators need a shared answer to: **What is happening, why does it matter, and who approved the next step?**

- **Citizens / venue attendees:** submit a location-specific observation and see the status of its linked incident.
- **Safety operators / event control rooms:** inspect evidence, prioritize incidents, record decisions, and explicitly request a downstream workflow.
- **Venue organizers:** gain a common incident picture and traceable decisions instead of disconnected feeds.
- **Value proposition:** shared situational awareness, transparent prioritization, citizen participation, and an auditable handoff. Faster response is a goal, not a measured outcome here.

**Positioning:** an implemented decision-support MVP, not a certified emergency service, predictive AI system, or autonomous dispatcher.

## 2. Architecture and data flow

```text
Crowd simulator / normalized Civic-Shield output / citizen or operator observation
                                     |
                          POST /events -> FastAPI
                                     |
          validate identity/venue -> persist Event -> correlate by location/time
                                     |
                crowd_risk Incident + deterministic Risk + Timeline
                                     |
          Supabase PostgreSQL <------+------> Next.js operator dashboard
                                     |        HTTP snapshots + authenticated WS
              Expo citizen app <-----+                   |
          /me/reports + stored status          human status change / approval
                                                         |
                                            optional n8n webhook handoff
                                            (validation + acknowledgement only)

Supabase Auth -> client session/JWT -> FastAPI verification and access rules
```

**Domain:** an Event is an observation; an Incident groups related observations; Risk summarizes contributing factors; the Timeline records evidence, decisions, and accepted action requests. A venue event/festival is a registry record, not the same object as a signal Event.

| Layer | Current technologies / responsibility |
| --- | --- |
| Core workspace | pnpm 11 + Turborepo; shared TypeScript types/configuration |
| Operator web | Next.js 16 / React 19 / TypeScript, Tailwind CSS, Base UI/shadcn-style components, Motion; Leaflet + OpenStreetMap tiles |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2, psycopg, HTTPX; PyJWT/JWKS verification |
| Persistence / identity | Supabase PostgreSQL + Supabase Auth; authoritative SQL migrations in `supabase/migrations/` |
| Citizen mobile | Expo 56 / React Native 0.85, Expo Router, NativeWind, React Native Reusables; Camera for QR, Location for GPS, SecureStore for native persistence |
| Integration boundary | Civic-Shield/citizen adapters, deterministic crowd simulator, optional n8n webhook |

Clients use Supabase directly for **Auth**, but operational database reads/writes go through **FastAPI**, not client-side table queries. SQLite supports isolated tests; it is not the demonstrated shared Supabase database. Reserved evidence storage does not constitute an implemented upload flow.

## 3. What the two products actually do

### Operator dashboard — `shakti-os/apps/dashboard`

- `/` is **always static, labelled sample/demo content**: metrics, illustrative map, queue, and activity. It never calls or polls operational APIs, even when the backend is available. It is not a live status screen or an API-failure fallback.
- `/login` uses Supabase Auth. Protected routes verify `/me` and operator capability before mounting operational pages.
- `/dashboard` loads database incidents/events/venues, shows summary counts, an incident queue, activity, and stream state.
- `/incidents` and `/incidents/{incidentId}` expose status, severity, risk factors, actual linked evidence, chronological timeline, decision notes, allowed transitions, and an action-review dialog.
- Dashboard and full map start centered on **Kolkata (22.5726, 88.3639), zoom 12**, including when no markers are available. Incoming data does not auto-fit or reset the view. All loaded active incidents retain their actual API/zone coordinates, including those outside Kolkata; operators can pan/zoom normally. The landing's static sample map is also Kolkata-themed. Missing coordinates are never invented, and seed coordinates remain illustrative even on real map tiles.
- Signals, reports/evidence, sources, analytics, timeline, and action-history pages explore backend data. Source activity is not proof that a production camera or social connector is healthy.
- “New observation” saves an authenticated operator-authored report for a venue zone; it does **not** generate sensor measurements. Profile display-name changes persist through Supabase Auth.
- The shared dashboard snapshot contains up to **200 incidents and 200 events**. Evidence/timeline views are bounded; action history samples the 15 most recently updated incidents. Do not describe dashboard analytics/export as a complete database census.
- WebSockets reconnect and reload authoritative HTTP snapshots. `LIVE` appears only after server authentication acknowledgement, not merely after opening a socket.

### Citizen app — sibling `shaktios-app`

```text
Email/password sign-in or sign-up -> choose registered venue / QR / manual ID
  -> category + description + canonical zone + urgency -> optional GPS
  -> review -> submit -> stored confirmation -> My Reports / report detail
```

- Venue choices resolve real `/venues` records, including seed-labelled scenarios if seeded; there is no bundled fallback venue list or automatic default event.
- Native auth sessions and selected venue ID use SecureStore; venue metadata is fetched again from the API. Web storage uses an in-memory fallback, so do not promise browser-reload persistence.
- Submission is `POST /events`, type `citizen_report`, source `citizen_app`; `location` is a registered **zone ID**, and the payload includes `venue_event_id`, category, description, urgency, and optional GPS/accuracy.
- GPS is supporting evidence, not the correlation key. The mobile location view can link to the captured coordinates on OpenStreetMap.
- Low/medium UI urgency maps to backend `normal` / confidence `0.7`; high maps to `high` / `0.9`. This is a fixed input convention, not verified credibility or a risk prediction.
- Confirmation and detail fetch the stored report ID. History uses **`/me/reports`**, not client filtering of the operator `/events` feed; detail uses **`/me/reports/{id}`**.
- My Reports reloads on screen focus and currently requests the latest 50 reports. The API supports ownership-filtered limit/offset pagination; do not claim a complete paginated mobile history UI.
- Citizens see backend-derived linked-incident status, not a fabricated progress badge. They do not receive operator controls or operator WebSocket feeds.
- **Photo upload, phone login, Google login, and push notifications are not implemented; unsupported controls were removed rather than simulated.** QR camera use is not photo evidence upload.

## 4. Identity, authorization, and ownership

- Both clients authenticate with Supabase email/password sessions; email confirmation depends on project settings. Clients carry a publishable key, never database/service-role credentials.
- FastAPI verifies JWT signature, issuer, audience, expiry, and subject. Missing/invalid credentials on protected routes yield `401`; authenticated non-operators get `403` on operator routes.
- Operator capability comes from server-managed `OPERATOR_USER_IDS` / `OPERATOR_EMAILS` or trusted `app_metadata.role=operator|admin`. Citizen sign-up and editable profile metadata do not grant it. `/me` exposes `is_operator`.
- Operator reads, incident evidence/timelines, integration flags, status/action writes, and WebSockets require operator access. Dashboard-prefixed ingestion sources also require it.
- Citizen reports require a verified session and a zone belonging to the selected venue. The API strips supplied identity fields, stamps `reporter_id` from JWT `sub`, and owns `incident_id`; clients cannot choose another owner or force an incident link.
- `/me/reports` filters ownership **before pagination**. Missing or unowned report IDs both return `404` from the detail route.
- WebSocket credentials travel in the first authentication message, not in URLs. The server verifies operator access before acknowledging the subscription.
- Public routes include health, venues, and a redacted `/public/overview`. The overview exposes counts/projected summaries, not report payloads or reporter identities; the landing page does **not** consume it.
- SQL migrations deny direct `anon`/`authenticated` operational-table access with RLS. FastAPI's privileged database connection makes its authorization checks essential.
- **Known deployment gap:** non-citizen machine signal ingestion remains unauthenticated for the local MVP. Secure it, restrict production CORS, and use HTTPS before public exposure.

## 5. Explainable risk and human-controlled state

Correlation considers `crowd_density`, `social_concern`, `abnormal_movement`, and `citizen_report`. An event joins the latest unresolved `crowd_risk` incident at the exact same location within the eligible recent window (default **300 seconds**); otherwise it starts another incident. This is deterministic location/time correlation, not semantic understanding or GPS-radius matching.

```text
risk = 0.40 × crowd_density + 0.30 × social_velocity
     + 0.20 × abnormal_movement + 0.10 × citizen_reports
```

Factors are bounded to 0–1. The three non-report factors retain their strongest observed values; the report factor is `min(report_count / 5, 1)`. There is no automatic factor decay. Incident confidence is the strongest contributing event confidence, not a calibrated probability.

| Score | Severity |
| --- | --- |
| `< 0.40` | LOW |
| `0.40–<0.70` | MEDIUM |
| `0.70–<0.85` | HIGH |
| `≥ 0.85` | CRITICAL |

**Illustrative calculation, not a live reading:** density `0.8`, social velocity `0.6`, movement `0.5`, and one citizen report produce `0.62` / MEDIUM. A citizen report alone contributes `0.02` to a new incident's score; high urgency does not automatically create a critical incident.

```text
DETECTED -> ASSESSING -> RESPONDING -> RESOLVED
                 \-----------------> RESOLVED
```

Only an operator chooses these transitions; invalid transitions return `409`. Notes and verified operator attribution are recorded with `status.changed`. Detection or a risk threshold never dispatches anyone.

Citizen status mapping: **DETECTED → Received; ASSESSING → Under review; RESPONDING → Operator Responding; RESOLVED → Resolved**. The responding API value is `action_initiated`, but the mobile badge says “Operator Responding” to avoid implying dispatch. No linked incident means Submitted. These labels reflect operator workflow state, **not** confirmed notification, arrival, or dispatch.

## 6. n8n: what approval does — and does not — prove

- The operator must move an incident to `RESPONDING`, then explicitly review/approve `POST /incidents/{id}/actions`.
- FastAPI forwards action ID/type, note, and incident to the configured webhook. A successful handoff records `action.requested`; it does not resolve the incident.
- The supplied `n8n/shaktios-action-handoff.json` contains only **Webhook → Validate Approved Action → Respond to ShaktiOS**. It validates required identifiers and acknowledges receipt. **No notification-provider node or responder dispatch is present.**
- Deployment requires importing/activating the workflow, its Production URL, and matching Header Auth configuration. Provider credentials/nodes, an approval policy, and delivery verification must be added separately for notifications.
- `/integrations` reports configuration/secret-presence flags, not live workflow health or delivery success.
- `503` means no webhook URL; `409` means an invalid incident state. `502` now includes safe, granular diagnostics for upstream `401/403`, `404`, `405`, `429`, other HTTP failures, connection/TLS failures, timeout, and interrupted acknowledgements without exposing secrets or upstream payloads.
- A timeout or `502` can occur **after n8n started execution**. Check execution history before retrying: there is no automatic retry, idempotency, or exactly-once guarantee. Failure creates no successful action timeline entry.

## 7. Six-minute presentation / staged demo

### Preparation — before the audience arrives

1. Follow [REAL_DATA.md](docs/REAL_DATA.md) for migrations and local startup. Point both clients at the same API/Supabase project; ensure the chosen operator is explicitly authorized. Never show environment files, tokens, private account details, or unrelated reports.
2. If needed, review `scripts/seed_supabase.py --dry-run`; apply only to the intended demo database. It adds labelled synthetic scenarios without truncating user data. The v2 fixture is 3 venues / 9 zones / 9 incidents / 63 events; these are fixture counts, not current database totals.
3. Rehearse native sign-in, submission, and app reload first. Use the venue picker/manual ID if camera permission is unreliable; GPS is optional. Keep a clearly labelled recording or seed-only walkthrough as a fallback, not as proof of a live submission.
4. Choose **Kolkata Puja Circuit — Seed Scenario**, zone `kol_sreebhumi`, for the story. Use a clearly marked demo description. A manually submitted demo report is a real stored, owned submission, but its scenario is not an actual emergency.
5. For a fresh fusion demo, stage explicitly synthetic machine events with **that exact zone ID and fresh timestamps**, then submit within five minutes. Do not expect old seed incidents or a generic `gate_4` simulator event to merge automatically. Seed reruns skip existing IDs and do not refresh timestamps.
6. Preflight a controlled n8n destination if showing the handoff; otherwise demonstrate the approval boundary and explain missing configuration. Do not trigger real emergency channels. Check the evidence table and queue on the presentation screen size; the shared scroll-area fix has passed desktop/narrow-screen browser checks.

| Time | Show / do | Suggested narration and key point |
| --- | --- | --- |
| **0:00–0:35** | Title + one venue scenario | “A crowd reading, a social concern, and one attendee each see a fragment. ShaktiOS gives operators one traceable incident picture.” State who the two users are. |
| **0:35–1:05** | Landing preview, then architecture diagram | “This page is labelled sample content, not live operations. Behind the actual dashboard, both clients share FastAPI and PostgreSQL, with Supabase identity.” |
| **1:05–2:15** | Mobile: venue → category/zone → short demo description → review → submit → stored ID | “The citizen contributes an observation, not an emergency command. The server verifies identity and location, stores it, and determines the incident link.” Skip optional GPS for speed. |
| **2:15–3:25** | Actual dashboard: locate the new report's linked incident, evidence, factors, timeline | “These are database records, not the landing fixtures. Matching zone and time connect observations; the score shows exactly which factors contributed.” Use the illustrative calculation only if the displayed factors match. |
| **3:25–4:25** | DETECTED → ASSESSING with a note; reopen My Reports; then RESPONDING if appropriate | “An operator owns the decision. The citizen's status follows this same persisted incident; ‘Operator Responding’ is not dispatch confirmation.” |
| **4:25–5:15** | Review & approve a configured test handoff; inspect accepted timeline entry, or show the configuration/error boundary | “n8n currently validates and acknowledges. This proves a controlled handoff, not a message reaching a responder.” Never relabel an error as success. |
| **5:15–6:00** | Timeline, optional resolve + mobile status, then maturity slide | “The outcome is explainable evidence, human control, and a recorded decision chain. Native end-to-end validation and production integrations are next.” |

**Four-minute cut:** pre-sign in, select the venue in advance, skip QR/GPS and live n8n execution, keep one report → one incident → one operator transition. **Seven-minute version:** add source provenance, reconnect behavior, and ownership-test discussion.

**If the live path fails:** use a labelled seeded incident to show factors/timeline, state which connection failed, and separate that demonstration from the unproven mobile round trip. Do not silently substitute seed data for a user's report or claim a pending request was delivered.

## 8. Implemented, configured, verified, next

| Area | Honest status |
| --- | --- |
| Event persistence, correlation, risk, timeline, state rules | Implemented in backend and exposed in the operator workflow |
| Auth, operator gate, citizen ownership, venue/zone registry, linked statuses | Implemented; deployment still needs correct project configuration, migrations, and an authorized operator account |
| Citizen email/password, join, report, optional GPS/QR, native persistence | Implemented in source; native authenticated end-to-end behavior is **not yet validated** |
| Landing preview / database seed | Intentional synthetic presentation assets, not live emergencies; seed sources use `seed_*`, `is_seeded`, and `seed_batch`, with no invented citizen identity |
| n8n | Implemented request/acknowledgement boundary; activated deployment and provider delivery are separate checks; notifications/dispatch absent |
| Camera/social intelligence | Simulator/normalization boundaries exist; no claim of deployed live CCTV analysis or operational social-source collection |
| Realtime | In-process WebSockets only; no cross-process fanout or replay |
| Photo/phone/Google/push | Unsupported controls removed; not working features |

### Verified checks and remaining gaps

- **API:** 57 tests passed in the preceding webhook-diagnostics check, including access/ownership and action-error coverage. No backend changes were needed for the scrolling fix.
- **Dashboard:** 14 tests, lint, typecheck, and production build passed after the Kolkata map-focus update. Map tests cover the city default, empty states, controls, preserved marker coordinates, and no camera reset on incoming data.
- **Scrolling:** 7 Chromium checks passed: desktop/narrow-screen evidence scrolling, horizontal table scrolling, fixed-height timeline, dashboard queue, search results, and page scrolling after closing search. Wheel and keyboard navigation reach the last rows. Regression runner: `apps/dashboard/tests/scrolling.browser.cjs` (requires an available Playwright/Chromium installation and a running dashboard; usage is documented in its header).
- **Scroll defect/fix:** a 288px evidence container held an unconstrained 445px inner viewport, causing clipping rather than scrolling. The shared viewport now inherits the parent's maximum height. The browser checks use isolated synthetic sessions/API responses and make no operational writes; they do not prove live authentication or n8n delivery.
- **Mobile:** the earlier TypeScript check and Android export passed. Export is bundling evidence, **not** native sign-in, reporting, camera/GPS permission, or persistence validation.
- The presentation summary was checked against source/docs. It contains no credentials or private account/database records, and no live integration was triggered for these checks.

### Next steps, in priority order

1. Validate the Android citizen → API → authorized operator → citizen-status round trip, session/venue restoration, and cross-account isolation on the target demo devices.
2. Secure machine ingestion, add abuse/rate controls, review HTTPS/CORS, and replace scenario venue coordinates/helplines with reviewed registrations. A venue-admin editor is not present.
3. Extend n8n with approved provider nodes, delivery outcomes/callbacks, and idempotency; verify controlled delivery before making notification claims.
4. Add durable realtime/replay and broader history pagination; evaluate risk calibration/decay and real-source adapters before larger deployments. Media support needs a separate authorized upload/storage design.

**Closing line:** “Citizens contribute observations. Operators see why an incident matters. Humans approve the next step, and the timeline records what happened.”

## References / source-of-truth pointers

- Runbook and contracts: [REAL_DATA.md](docs/REAL_DATA.md), [API.md](docs/API.md), [n8n README](n8n/README.md), [citizen README](../shaktios-app/README.md).
- Earlier framing, read with the corrections above: [PRESENTATION_CONTEXT.md](docs/PRESENTATION_CONTEXT.md), [PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).
- Backend behavior: `services/api/src/shaktios_api/{main,auth,report_store,incident_store,risk}.py`; schema: `supabase/migrations/`; fixture provenance: `scripts/seed_supabase.py`.
- Web behavior: `apps/dashboard/app/page.tsx`, `components/dashboard/operator-session.tsx`, `hooks/use-shakti.ts`, `components/situation-map.tsx`, incident detail route.
- Mobile behavior: `../shaktios-app/src/api/reports.ts`, `src/store/session.tsx`, `app/review.tsx`, `app/(tabs)/reports.tsx`, `src/components/ScanView.tsx`.
