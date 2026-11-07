# Android 136 source synchronization — 2026-11-07

The `iOS` branch incorporates published integration source
`73b790d04d705d349107da1e34cc65a06b195107` through merge
`0eaa43e9663ac4d3254e46b6d29ea1e40df9b377`.

The Android 136 receipt in
`ops/releases/2026-11-07-mobile-dark/verification.json` identifies application
source `3ce9b784db0e93fd6ab0e947c074213e971ace66`. Its complete mobile tree was
compared with `33811656ee61cd76688252f1476d39af1cdf0dbe`: there are no differences.
The 136 dark-theme implementation was therefore already present in the
[previous verified synchronization](2026-11-07-ios-android135-sync.md), including
its theme tests, mobile typecheck and source-bound production iOS JS export.

This follow-up adds the published 136 release receipt and subsequent CI/Admin
repairs. The only additional mobile runtime change is two existing translation
calls in `RecentAuthDialog.tsx`. API runtime, mobile dependencies, app
configuration and EAS build inputs are unchanged from the preceding checkpoint.

The merge had no conflicts. Committed `apps/` and `packages/` match the pinned
integration source except for the same two intentional iOS profile/test files:
`apps/mobile/eas.json` and `apps/mobile/scripts/ios-ad-hoc-config.test.mjs`.

## Incremental checks

| Check | Result |
| --- | --- |
| Recent authentication, security journey, reset confirmation and obligation owner identity | 23 passing cases / 4 mobile suites; natural exit 0 |
| API compilation using its real build configuration | Passed |
| Owner-erasure unit checks with database/storage boundaries mocked | 5 passing cases / 1 suite; natural exit 0 |
| Historical tracking repository fixture | 1 passing Node case; natural exit 0 |
| Scoped mobile lint | 2 changed files, zero errors or warnings |

The first historical fixture attempt encountered a missing compiled
`apps/api/dist/src` prerequisite in this checkout. Its failure log was retained.
After compiling the API, the unchanged fixture passed. No server or database was
started. No test code, skips, timeouts or runner exit behavior were changed here.
The narrow follow-up uses focused checks; the preceding full mobile typecheck
and iOS export remain recorded against source `33811656`, rather than being
reported as new runs on this follow-up.

The unchanged strict history scanner reported one match: a literal synthetic
UUID named `claimToken` in the new tracking repository unit fixture. Inspection
confirmed that it is used by an in-memory query client supplied through a fake
`withClient`, with no real connection or authentication operation. Raw scanner
output was retained; rules, values and exception lists were unchanged. The
source chat was notified about the fixture classification. Complete CI
qualification remains separate from these incremental local checks.

Evidence: `E:\Masarifi-ios-artifacts\sync-android136-20261107`.
The original unfinished iOS Modal work remains preserved separately in stash
`ff79cf20f821725ec5a8f909c2760822d53a50c7` and its verified E-drive backups.
No other worktree or unpublished peer changes were modified. Broader iOS work
remains paused; no new IPA, Apple account operation, device test, hosted
activation or live data operation was performed.
