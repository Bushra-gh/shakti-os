# Contributing

## Scope and workflow

- Use `feature/*`, `fix/*`, `docs/*` or `chore/*` branches and concise commits such as `feat: add event type` or `docs: clarify setup`.
- Open a focused pull request; do not push directly to `main` or alter unrelated work.
- Follow [AGENTS.md](../AGENTS.md) and the [definition of done](DEFINITION_OF_DONE.md).
- For shared API changes, inspect both `apps/dashboard` and sibling `shaktios-app`. Do not silently change contracts or assume the sibling app is a workspace package.
- Keep secrets, tokens, environment files, private reports and recordings out of commits, logs, screenshots and examples.

## Local checks

Install dependencies and configure local processes using the [README](../README.md). Run checks relevant to the change and report the actual command/result, not a copied historical test count.

### JavaScript workspace

From `shakti-os`:

```bash
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

To scope a check, use `pnpm --filter @shaktios/dashboard test` (or `lint`, `check-types`, `build`). The dashboard uses Vitest. Root pnpm tasks do not run Python or sibling Expo checks.

`apps/dashboard/tests/scrolling.browser.cjs` is a separate Chromium regression runner, not part of Vitest. It needs a running dashboard and an available Playwright/Chromium installation; follow its header for arguments. It uses synthetic sessions and intercepted API data, not live operator authentication or n8n delivery.

### Python packages

With the API virtual environment active, from `services/api`:

```bash
python -m pip install -e ".[test]"
python -m pytest
```

API tests use isolated in-memory SQLite and mocked external boundaries. They cover access/ownership, venues, correlation/risk, timelines/actions, seeds and voice behavior. They do not prove hosted migration correctness, real provider delivery or native client behavior.

For changes in `intelligence/civic-shield`, `intelligence/citizen-report` or `simulator/crowd`, use that package's virtual environment, install `.[test]` and run `python -m pytest` from the package directory. The root API test command does not discover those suites.

### Sibling citizen app

Follow the [app README](../../shaktios-app/README.md) and [build-readiness checklist](../../shaktios-app/BUILD_READINESS.md). Its current local scripts include `pnpm run check-types` and `pnpm test`; it has no lint script. An Expo export is not a signed APK/AAB/IPA or proof of working device permissions.

### Current CI coverage

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs:

- Node 24 / pnpm 11.25.0: frozen install, lint, typecheck and build.
- Python 3.11: API test-extra installation and `pytest` in `services/api`.

CI currently does **not** run `pnpm test`, adapter/simulator suites, standalone browser checks or sibling mobile checks. Run applicable checks explicitly; do not treat a green CI job as coverage of those paths.

## Documentation-only changes

- Verify claims against the current source in both repos when a flow crosses the API boundary.
- Use the [README documentation map](../README.md#documentation-map) to find the owner of a topic. Link instead of duplicating setup, endpoint schemas, risk formulas or presentation scripts.
- Label synthetic data and separate implemented behavior, configuration presence, automated verification and live/device verification.
- Check relative links, section anchors, referenced paths, commands and JSON examples. Sibling links require both checkouts side by side.
- Review `git diff --check` and the changed-file list. Preserve pre-existing edits and keep the change limited to documentation when that is the task.
- No application build or live integration is necessary merely to edit prose. State which documentation checks actually ran; do not report unrun application tests as passed.

Avoid root `pnpm format` for a documentation-only task: it writes matching TypeScript/TSX files too. If formatting is needed, pass the exact Markdown paths to Prettier rather than formatting the whole repository.
