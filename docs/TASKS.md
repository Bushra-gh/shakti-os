# Remaining work

This is the current follow-up list, not a historical checklist of completed bootstrap tasks. Implemented capabilities are summarized in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). Each item below still needs its own scoped implementation or verification.

## Demo and native acceptance

- [ ] Run the authenticated citizen → API → authorized operator → citizen-status walkthrough on the target Android device, including cross-account isolation and native session/venue restoration.
- [ ] Verify camera, GPS, microphone permissions and actual audio codec/transcription behavior. Mocked tests and Expo exports do not prove these work on a device.
- [ ] Complete owned app identifiers, EAS project/signing configuration, reachable HTTPS endpoints and installable build validation. Follow the [mobile build-readiness checklist](../../shaktios-app/BUILD_READINESS.md).
- [ ] Complete and test automatic external venue deep-link resolution. Camera/manual QR-text parsing works, but `/scan` currently redirects without forwarding the received venue parameter.

## Security and deployment

- [ ] Authenticate/authorize machine-signal ingestion before public exposure.
- [ ] Add general ingestion abuse/rate controls, HTTPS and reviewed production CORS settings. Voice's process-local guard is not a distributed or platform-wide rate limiter.
- [ ] Register/review real venue coordinates and contacts; add a venue-admin workflow if required. Seed layouts remain illustrative.
- [ ] Review public projections, logging, retention and third-party audio processing before collecting sensitive real-world data.

## Integration reliability

- [ ] Extend n8n with approved notification-provider nodes, verified delivery outcomes/callbacks and action idempotency. The current workflow only acknowledges a handoff.
- [ ] Add report retry/idempotency behavior for uncertain network outcomes; preventing concurrent button taps does not prevent duplicate later submissions.
- [ ] Add durable realtime fanout/replay if deploying multiple API workers or replicas.
- [ ] Extend history pagination and export semantics beyond bounded dashboard/mobile snapshots.
- [ ] Validate production source adapters and evaluate risk calibration/decay before claiming prediction or broader operational readiness.

## Tooling and contract debt

- [ ] Update or retire the anonymous `scripts/seed.py` and `scripts/e2e_check.py` assumptions. Until then use [REAL_DATA.md](REAL_DATA.md) and [DEMO.md](DEMO.md).
- [ ] Update the Python citizen adapter delivery interface for authentication and registered venue/zone context, or explicitly retain it as normalization-only.
- [ ] Expand CI to cover dashboard tests, adapter/simulator packages and separately maintained mobile checks; see [CONTRIBUTING.md](CONTRIBUTING.md) for current coverage.

Photo/evidence attachments, phone/Google sign-in, push notifications and citizen messaging are **not current features**. They need separately scoped requirements rather than being implied by existing UI, a reserved bucket or an action name.
