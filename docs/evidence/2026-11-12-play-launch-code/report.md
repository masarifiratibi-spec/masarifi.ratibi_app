# Play launch preparation — source verification

Date: 12 November 2026. Branch: `codex/voice-promoted-operating-2026-10-13`. Baseline: `3d38af414ac4fab28dd5a61a9c411be6de7708c4`. Scope is code preparation; it does not establish Play approval or production availability.

## Delivered source

- Public Arabic/English SSR privacy and terms pages reuse the mobile legal documents, with exact public-provider routing, contact/deletion links and branded metadata. Account deletion keeps the existing authenticated owner verification, idempotency, request status and completion receipts; the public email fallback explicitly starts a request.
- Voice requires a versioned owner-scoped acknowledgement before microphone capture or upload. Disclosure and native preparation hold interaction tokens; rejection leaves manual entry available. Withdrawal and owner changes preserve cancellation guards and uncertain financial-save outcomes. Assistant questions require the existing explicit enabled consent. Tracking copy distinguishes SMS, notification access, background processing and synchronized financial details.
- Android updates use a separate public policy endpoint, disabled publication configuration by default, true installed build codes, an optional bilingual Update now/Later sheet, 24-hour per-release deferral, foreground rechecking, a manual settings check and a fixed Play destination. Recording, consent, lock and edit flows suppress the optional popup. A cold update push opens the data-free update page while financial routes retain their lock/authentication requirements.
- External notices reuse approved notification campaigns and existing providers. A strict Android release audience is checked during governance, expansion and dispatch. Eligible unrevoked Android tokens are selected again at dispatch; publication withdrawal, app/device changes, preferences, quiet hours, pause/resume and cross-campaign per-release deduplication are handled. Admin campaign readers accept the new audience without widening authorization.
- The existing locked `expo-application` 55.0.19 module is declared directly for reliable native version metadata. No dependency installation or upgrade occurred.

## Verification

Final mobile full-suite verification passed after the localization/fixture correction: 627 suites and 5,169 tests, zero failed or skipped tests. Do not treat the earlier failed run as a pass. Jest exited zero with one worker-teardown warning; the source tests passed, but this run does not establish leak-free teardown across the whole repository.

| Check | Evidence/status |
| --- | --- |
| Mobile full suite, final source | 627 suites / 5,169 tests passed with `--maxWorkers=2`, zero failed/pending tests. |
| API full unit suite, final source | 208 suites / 2,300 tests passed. |
| API focused policy/config/campaign/contracts/security/integration aggregate | 158 passed; six actual-PostgreSQL cases explicitly skipped. |
| Admin full suite | 112 files / 1,070 tests passed with `--maxWorkers=2`. |
| Final mobile correction regressions | Four suites / 17 tests passed, preserving support privacy assertions and central localization coverage. |
| Voice reviewer regressions | Five focused suites / 102 tests passed, including deferred cancellation, owner changes, consent decline, uncertain saves and interaction lifecycle. |
| Typecheck/lint | API, Admin and final mobile typechecks passed. API full lint, changed client/web scoped lint and mobile frontend-quality boundary checks passed. |
| Independent review | Seven actionable findings fixed, with regressions for the original cases; final inspection found no remaining actionable source finding in this scope. Final localization/support-fixture delta also reviewed. |

Use the direct local Jest/Vitest executables; PowerShell argument forwarding through npm is not required. No verification command here runs a build:

```text
apps/mobile: node node_modules/jest/bin/jest.js --maxWorkers=2 --json --outputFile=<local-result.json>
apps/mobile: npm run check:frontend-quality
apps/mobile: node node_modules/typescript/bin/tsc --noEmit
apps/admin-web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
apps/admin-web: node node_modules/typescript/bin/tsc --noEmit
apps/api: node node_modules/jest/bin/jest.js --selectProjects unit --runInBand
```

API focused commands and the gated database harness are listed in the update-announcement runbook. Scoped ESLint was run on changed client/web files; API ESLint passed. Source hashes and final structured results accompany this report.

Earlier verification failures were investigated rather than hidden: older assistant/voice fixtures lacked the new consent interaction, the new feature's text initially bypassed the central catalog, and one support fixture lacked consent hook mocks. Those were corrected with original privacy/finance assertions retained. The unrestricted Admin run failed two existing fixed-100ms UI timing assertions under high concurrency; the unchanged suite passed in full with two workers. An earlier mobile attempt ended without a summary and included an isolated Windows file-read error; it is not counted as completed evidence.

## Explicit pending acceptance

- Six actual-PostgreSQL cases are gated and skipped locally: device/token eligibility, same-release deduplication, device changes, publication withdrawal, custom-template quiet hours and pause/resume. The historical disposable database target was stopped; no unknown local/default database or production target was used. Run these later under genuine CI/disposable roles before activation.
- No APK/AAB/IPA, frontend production build, backend/container image, deployment, live deletion or customer push was produced. There is no new GitHub CI result for these local source changes.
- Public URLs are prepared routes. The observed domain still served parked hosting HTML; successful public hosting/DNS, verified anonymous pages and an authorized disposable-account deletion journey remain separate deployment acceptance.
- Operator identity, production retention/provider arrangements, live push configuration, final signing/OAuth and physical-device behavior require operational evidence. Play Console declarations, SMS exception review, account eligibility/testing and final Play-distributed bundle acceptance remain open.
- The first installed binary containing the feature is necessary for the new update UI and tap behavior. Future announcements must be enabled only after the exact release is available to the full intended audience, with matching API/worker policy and an approved campaign. No actual publication or campaign was activated here.

## Handoff documents

- `docs/runbooks/2026-11-12-play-console-owner-checklist.md`: ordered Arabic owner checklist, factual unknowns, Data safety inventory, SMS evidence/script and reviewer access template.
- `docs/runbooks/2026-11-12-public-legal-pages.md`: prepared routes, hosting prerequisites, shared content and deletion acceptance.
- `docs/runbooks/2026-11-12-android-update-announcements.md`: policy configuration, eligibility, governed activation, withdrawal, pause/retry semantics and no-send verification.

Unrelated Admin security and previous operations/performance edits are outside this scope and must remain unstaged.
