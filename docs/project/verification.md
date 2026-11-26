# Verification record, 26 November 2026

Shared source was compared against operating commit `3a2b30c3`. Play `dd6dd687` and iOS `844c960f` have the same API, Admin, packages, ops and database trees. The shared application checks below ran in the Play checkout. Mobile checks apply to the named branch.

| Area | Check and observed result |
|---|---|
| Operating mobile | Node tests for Firebase config and app-shell boundaries passed 4/4. |
| Shared API | TypeScript and lint passed. Jest contract tests passed 262/262. Unit suite passed 2,394/2,395. The worker-process liveness test failed during the full run. Its suite passed 27/27 on an isolated retry. |
| Shared Admin | TypeScript and lint passed. Vitest passed 1,085/1,088. Initial failures affected workspace cache expiry, AI usage limits and settings. Two governance suites still failed in a focused run. A local Next build completed with synthetic build-time configuration. A build with missing required configuration stopped at runtime validation. |
| Play mobile | TypeScript, lint and frontend boundary checks passed. Jest passed 5,356/5,357. The privacy check expected a generated Android manifest. After Expo Android prebuild, that check passed in isolation. |
| iOS source | TypeScript passed after installing the sibling API dependencies. Lint reported warnings and zero errors. The frontend boundary checker flagged the provider names inside the Arabic and English consent copy. Jest passed 5,574/5,624. Failures were in development account deletion, deletion recovery and the Android manifest check in this cross-platform suite. Investigate the deletion fixtures and live adapter expectations separately before changing account deletion. |
| Database and native acceptance | Local Docker engine was unavailable for disposable DB/RLS and container tests. Signed-device and store statuses in the audit come from dated release receipts. No fresh production or device acceptance was performed in this documentation pass. |

Test counts describe each complete run. Isolated retries are recorded alongside the original results. For feature impact and follow-up, see the [audit](audit.md).
