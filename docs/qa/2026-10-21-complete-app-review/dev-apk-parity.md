# DEV and standalone parity
Baseline `61117eaf07323ffa63c00f867d5d65e6f3142ece`; generated 2026-10-21T19:25:31+00:00 (timestamps UTC unless offset is explicit). Review date 2026-10-21, Asia/Riyadh. Worktree `D:/Masarifi-integration-2026-10-10`; branch `codex/voice-promoted-operating-2026-10-13`.

## Scope decisions

Payments/subscription activation excluded by explicit user decision. Standalone app lock must be disabled with code retained; PIN/biometric/unlock acceptance excluded. Authentication, ownership and sessions remain required. No candidate APK has been built or installed by this review.

| Dimension | Current DEV / source | Standalone intended configuration | Evidence / acceptance requirement | DEV / standalone result |
|---|---|---|---|---|
| Artifact | Installed com.masarifi.mobile.dev; preserved bae79bad APK hash recorded in checklist | com.masarifi.mobile; future exact reviewed APK hash/signature required | Installed base APK hash verified; runtime JS bundle identity remains separate | Base artifact inspection PASS; behavioral acceptance NOT RUN / NOT RUN |
| Build source | DEV installed before handoff commit; source HEAD is newer documentation baseline | Reviewed same branch plus agreed fixes | Do not equate working HEAD, installed DEV and future embedded bundle | NOT RUN / NOT RUN |
| Runtime API | staging-development launcher selects live Staging | staging-client live Staging; no local proxy/Metro dependency | Inspect embedded bundle and each routed backend release | NOT RUN / NOT RUN |
| App lock | DEV launcher false | eas staging-client changed true → false in this review | Existing runtime policy permits false only at approved Staging URL; preserve Production safety | Config changed; existing tests required / future bundle NOT RUN |
| Deletion | devPrivacyDeletionApiUrl selects /dev-account-deletion only for DEV | Ordinary OwnedAccountDeletionPanel/security path must implement immediate policy | Critical unclosed parity gap; no normal-client relabeling as DEV | NOT RUN / NOT RUN; DEF-001 |
| Automation | DEV package supported when enabled | staging-client explicitly enables mobile automation and voice posting | Verify embedded flags, native package checks and normal-owner server admission | NOT RUN / NOT RUN |
| Google and Clerk | DEV scheme/package/certificate registration | Ordinary scheme/package/signing callback/Clerk registration separately valid | User chooses unused identity; inspect normal-owner profile and OAuth callback | NOT RUN / NOT RUN |
| Firebase/push | DEV google-services.dev.json registration | Normal google-services.json matching com.masarifi.mobile and signing identity | Configuration tests alone do not establish actual new-token delivery | NOT RUN / NOT RUN |
| Voice | DEV operating path/provider/worker must be identified | Durable ordinary-user posting, no developer owner/epoch exception | Fresh U-A/U-B real audio and full financial receipt chain | NOT RUN / NOT RUN |
| Tracking | Native SMS/listener/background journal; automation API routing | Normal package owns independently registered device, permissions and background services | Real OS events; pause/revoke/owner-switch/duplicate tests | NOT RUN / NOT RUN |
| Notifications | May route through tracking/device notifications when automation enabled | Normal eligible token and delivery/target behavior | Foreground/background/cold-start, all target kinds and privacy | NOT RUN / NOT RUN |
| Assistant | Live service selected outside fixtures; provider/admission flags remain runtime dependencies | Ordinary-user consent/quota/provider and persisted replies | Two normal identities; no empty HTTP success accepted | NOT RUN / NOT RUN |
| Support | Live adapter exists but new/history/detail routes contain fixture-only gates | Intended support paths must be usable without fixture mode | Source-confirmed availability defect, physical reproduction and repair required | NOT RUN / NOT RUN; DEF-002 |
| Security events | Live security/events route contains fixture-only gate | Intended owner-scoped events usable; app-lock exclusion does not exclude sessions/events | Source-confirmed availability defect; preserve auth/ownership | NOT RUN / NOT RUN; DEF-003 |
| Billing | runtime billingAvailable false; subscriptions unavailable live | Clearly unavailable; no payment gateway changes | Agreed exclusion; verify honest UX only | NOT RUN honest UX / NOT RUN honest UX; activation NOT APPLICABLE |
| Fixture routes | foundation/design-system layout redirects in live mode | Must stay protected from customer fixture data | Direct URL and role/owner guard verification | NOT RUN / NOT RUN |
| Offline independence | DEV may use Metro/USB during development | Metro stopped, USB unplugged, no adb reverse, developer menu/auth or temporary service | Future exact artifact on ordinary Wi-Fi/mobile network; independent device preferred | NOT RUN / NOT RUN |

Configuration sources: [apps/mobile/eas.json:1](../../../apps/mobile/eas.json#L1); [apps/mobile/app.config.js:1](../../../apps/mobile/app.config.js#L1); [apps/mobile/src/config/client-runtime.ts:1](../../../apps/mobile/src/config/client-runtime.ts#L1); [apps/mobile/src/config/mobile-automation.ts:1](../../../apps/mobile/src/config/mobile-automation.ts#L1); [apps/mobile/scripts/staging-development.mjs:1](../../../apps/mobile/scripts/staging-development.mjs#L1); [apps/mobile/scripts/check-client-runtime.mjs:1](../../../apps/mobile/scripts/check-client-runtime.mjs#L1). Firebase files must be inspected privately and no credential contents committed.

<!-- current-review-evidence -->
## Current artifact and routed-service evidence

Installed DEV base APK hash was read directly through ADB at 2026-10-21T18:32:49.575Z: `911510fb75806146ad9468a0126484bfcc1d27cc5507dc0156c36d446fcf1f38`, exactly matching the preserved handoff artifact. `adb reverse --list` was empty at that observation. This proves installed native artifact identity, not a future normal-package build or that DEV had no runtime bundle updates/Metro dependency.

Read-only Staging observation at 2026-10-21T18:27:49Z: voice analysis enabled, audience `authenticated`, owner policy restriction absent; automatic posting enabled; enforced operating epoch active with no expiry and heartbeat about 0.34 seconds old. Manifest declares `normalEligibility=true`, `continuous=true`, `newCapturesOnly=true`, `clientVariant=staging-development` and source `d02f03df7ab49260c57800d7576f1cd2c2a1ca24`. Manifest audit owner presence alone is not evidence of a restrictive policy. Ordinary-package runtime still needs proof. Assistant-agent job table had no rows; this neither proves worker readiness nor failure. Provider shallow health records were dated 2026-10-04 and are too old to establish current provider readiness. No provider charge or fresh financial action was triggered.

Public unauthenticated preflight at 2026-10-21T18:29:16–19Z: `/health/live` 200 with release `139be49655177e5748382b6c46731095c7d71e45`; `/health/compatibility` 200 (voiceSession 2, voiceBatch 3, voiceExtraction 3, voiceWorker 1, voiceConfirmation 2, assistantDirect 2, assistantProvider 1, manualReceipt 1). `/health/ready` returned nginx 404; readiness must be checked through the approved internal/operational path, not counted as a feature failure. Source-valid `/api/v1/meta`, `/api/v1/meta/social-media`, `/api/v1/assistant/availability`, `/api/v1/assistant/conversations`, `/api/v1/voice/batches/recovery`, `/api/v1/support/tickets` and `/api/v1/accounts` rejected unauthenticated reads with 401. This proves those unauthenticated request outcomes only, not authenticated availability, ownership or matching routed releases. An exploratory `/api/v1/security/events` returned 404; source investigation established the correct owner route is `/api/v1/me/security/events`, so the exploratory 404 is not a feature defect. Private evidence: `public-preflight.json`.

144 tracked SQL migrations and 144 deployed migration rows; the 145th tracked migration-directory file is `.gitkeep`. Counts agree, contents/version identities do not.

| Source migration name | Source version | Deployed state |
|---|---|---|
| planning_payment_version_salary_date_corrections | 20261018145544 | No deployed migration with this name |
| normalize_reminder_cycle_baseline | 20261020220455 | No deployed migration with this name |
| automatic_salary_detection | 20261017140043 | Same name recorded under 20261017141513; SQL equivalence/checksum NOT VERIFIED |
| atomic_obligation_payment_create | 20261017144514 | Same name recorded under 20261017145825; SQL equivalence/checksum NOT VERIFIED |
| account_idempotency_erasure_guard | 20261020131349 | Same name recorded under 20261020131934; SQL equivalence/checksum NOT VERIFIED |
| manual_transaction_kind_revision | 20261021122922 | Same name recorded under 20261021125639; SQL equivalence/checksum NOT VERIFIED |
| voice_capture_account_context | 20261021122923 | Same name recorded under 20261021125643; SQL equivalence/checksum NOT VERIFIED |
| staging_automatic_salary_schedule | Not tracked with this name | Deployed version 20261017141555; reconcile purpose and source |
| renew_approved_dev_tracking_single_device_20261020 | Not tracked with this name | Deployed version 20261020062210; reconcile purpose and source |

Read-only pg_proc inspection confirmed `private.allocate_obligation_payment_core` and `private.reminder_baseline` are absent. Existing payment/salary/reminder functions are present, but current definitions differ from the reviewed correction path until equivalence is proven. This is a source/deployment compatibility finding, not a physical financial-failure reproduction. No migration was applied and no queue was replayed. Evidence: Supabase read-only tool results at approximately 2026-10-21T18:27–18:32Z; `deployed-migrations.json` private.

<!-- physical-review-ledger -->
## Current physical scope

Two synthetic accounts, one manual and one voice expense are persisted. Backend voice processing succeeded on U-A; visible result failed. See PHY-005/008 and DEF-010/011. Source fixes are not embedded in the preserved installed native APK. Any Metro-loaded DEV retest is explicitly separate from standalone independence. App-lock configuration is false locally; no standalone APK was built.

## Verification provenance

- Mobile latest complete per-file aggregation: **551 files, 3878 passed, 0 failed, 0 skipped** after the three new opening-source cases. This combines completed bounded batches with later complete per-file retests, not one monolithic run. Private `mobile-final-results.json` lists every attempt/file.
- API: **50 files, 234 passed, 0 failed, 8 skipped**; `api-final-results.json`. Skipped database integration/recovery scenarios are **BLOCKED** until an isolated disposable database is prepared. Docker daemon was unavailable and local 54322 absent; unrelated PostgreSQL on 5432 was left untouched. Shared Staging was not reset.
- Admin: **89 files, 946 passed**, bounded single-worker Vitest; typecheck and lint passed. Authenticated Admin browser acceptance **BLOCKED** at Clerk sign-in; no credentials entered by reviewer.
- Mobile final typecheck, API typecheck, scoped lint, 18 Node configuration cases and frontend/runtime boundary checks passed at the recorded attempts. A 768 MB mobile typecheck exhausted its heap; 1536 MB rerun passed. Original infrastructure failures remain preserved.
- Budget routing: original view failed; exact view/edit tests RED → GREEN, 26/26 in the affected two suites. View now targets `/budgets/transactions/:budgetId`; edit remains `/budgets/edit/:budgetId`; no financial action runs on view/edit.
- Navigation test maintenance: stale Clerk mock initially caused 27 failures; adding the already-required session-key mock exposed four outdated signed-out notification expectations. Tests now assert auth-pending and no remote resolution before authentication; no production auth guard changed. Three-suite retest 47/47 passed.
- API ownership maintenance: exact two existing authenticated automation aliases were missing from endpoint inventory. Added exact register/sign-out entries without wildcard/guard changes; ownership retest 6/6 passed after initial one failure.
- Opening-source regression: first RED had two real failures and an incorrect negative-error expectation. Corrected RED: two failures, one negative PASS. The first implementation passed runtime tests but failed type inference; final schema keeps a typed object, permits `account_opening` only for opening rows and normalizes its local projection to adjustment. Final relevant regression run 205/205 across five suites passed; final typecheck passed. Original logs and intermediate attempt remain private.
- Fresh independent reviewer found three material record defects: mutation callbacks mislabeled draft-only, vague budget destination, and disconnected integration inventory. Resolved by mutation-first expected effects, exact budget routes plus regression repair, and 218 joined adapter operation traces with 15 delegated integration bridges. Source/route/link verification ran after corrections. Clean-code/test-guard review retained boundary-based regression tests and strict money/owner/source validation.
