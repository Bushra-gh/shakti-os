# Definition of done

A task is complete when:

- The requested outcome exists and required behavior remains intact.
- Relevant checks pass, or existing failures and unverified boundaries are explicitly reported.
- Frontend changes include applicable lint/typecheck/tests; backend changes include relevant pytest coverage.
- Shared API/schema changes are documented and checked against both dashboard and citizen callers.
- Implemented, configured, mocked-tested and live/device-verified behavior are not conflated.
- Documentation has one canonical home per topic, working links and examples consistent with source.
- Only files needed for the task changed; existing unrelated work is preserved.
- The diff is reviewed, secrets/private data are absent and no required part is left as an unexplained TODO.

For documentation-only work, link/contract/scope validation can replace application test runs. Report that distinction clearly. Check commands and current CI limits are in [CONTRIBUTING.md](CONTRIBUTING.md).
