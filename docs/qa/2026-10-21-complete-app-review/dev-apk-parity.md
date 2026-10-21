# DEV and standalone parity
Baseline `058385f83e6ed5ab46be21de41dea74bc786449f`; generated 2026-10-21T20:15:11+00:00 (timestamps UTC unless offset is explicit). Review date 2026-10-21, Asia/Riyadh. Worktree `D:/Masarifi-integration-2026-10-10`; branch `codex/voice-promoted-operating-2026-10-13`.

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

Two synthetic accounts, one manual and one voice expense are persisted. Backend voice processing succeeded on U-A; visible result failed. See PHY-005/008 and DEF-010/011. The preserved original APK lacks the fixes; ENV-DEV-02 below embeds the reviewed repair. Any Metro-loaded DEV retest is explicitly separate from standalone independence. App-lock configuration is false locally; no standalone APK was built.

## Verification provenance

- Mobile latest complete per-file aggregation: **551 files, 3896 passed, 0 failed, 0 skipped** including the opening-source and signed-direction regressions. This combines completed bounded batches with later complete per-file retests, not one monolithic run. Private `mobile-final-results.json` lists every attempt/file.
- API: **50 files, 234 passed, 0 failed, 8 skipped**; `api-final-results.json`. Skipped database integration/recovery scenarios are **BLOCKED** until an isolated disposable database is prepared. Docker daemon was unavailable and local 54322 absent; unrelated PostgreSQL on 5432 was left untouched. Shared Staging was not reset.
- Admin: **89 files, 946 passed**, bounded single-worker Vitest; typecheck and lint passed. Authenticated Admin browser acceptance **BLOCKED** at Clerk sign-in; no credentials entered by reviewer.
- Mobile final typecheck, API typecheck, scoped lint, 18 Node configuration cases and frontend/runtime boundary checks passed at the recorded attempts. A 768 MB mobile typecheck exhausted its heap; 1536 MB rerun passed. Original infrastructure failures remain preserved.
- Budget routing: original view failed; exact view/edit tests RED → GREEN, 26/26 in the affected two suites. View now targets `/budgets/transactions/:budgetId`; edit remains `/budgets/edit/:budgetId`; no financial action runs on view/edit.
- Navigation test maintenance: stale Clerk mock initially caused 27 failures; adding the already-required session-key mock exposed four outdated signed-out notification expectations. Tests now assert auth-pending and no remote resolution before authentication; no production auth guard changed. Three-suite retest 47/47 passed.
- API ownership maintenance: exact two existing authenticated automation aliases were missing from endpoint inventory. Added exact register/sign-out entries without wildcard/guard changes; ownership retest 6/6 passed after initial one failure.
- Opening-source regression: first RED had two real failures and an incorrect negative-error expectation. Corrected RED: two failures, one negative PASS. The first implementation passed runtime tests but failed type inference; final schema keeps a typed object, permits `account_opening` only for opening rows and normalizes its local projection to adjustment. Final relevant regression run 205/205 across five suites passed; final typecheck passed. Original logs and intermediate attempt remain private.
- Fresh independent reviewer found three material record defects: mutation callbacks mislabeled draft-only, vague budget destination, and disconnected integration inventory. Resolved by mutation-first expected effects, exact budget routes plus regression repair, and 218 joined adapter operation traces with 15 delegated integration bridges. Source/route/link verification ran after corrections. Clean-code/test-guard review retained boundary-based regression tests and strict money/owner/source validation.

<!-- dev-retest -->
## DEV repair retest — ENV-DEV-02

Replacement installed at 2026-10-21T19:40:22.775Z using `adb install -r`; no clear/uninstall. Same DEV signing certificate and Clerk public configuration as the preserved original. Source repairs at `61117eaf07323ffa63c00f867d5d65e6f3142ece`. Package `com.masarifi.mobile.dev`; APK SHA256 `e4c22b165d00504da129d88698c424801584221e6efb99600e4211e6b3a36a4c`; certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; embedded JS SHA256 `9780afe892a4f8134088385f4b13b7588c5b015bc898018b0408cf27b92b2107`. Private artifact/config/signature/install proof: `dev-review-artifact.json`, `dev-review-config.json`, `dev-review-install.json`. Native build passed after two retained Windows path-length failures; final short isolated root `D:/mq21/native`, CMake object-path limit 220, 853 tasks, 10m11s. No client package was built or installed. Metro is stopped and the temporary 8081 reverse mapping was removed; this still does not establish standalone acceptance.

| Retest / original | Steps and expected result | Actual / status | Timestamp / private evidence |
|---|---|---|---|
| RT-010-01 / PHY-005, DEF-010 | 1. Reopen preserved U-A. 2. Select EGP wallet. 3. Read Home and scroll to original expenses. Expected 965 EGP and both persisted rows without financial-load error. | **PASS** on ENV-DEV-02. Feed shows coffee -10 EGP, labeled manual expense -25 EGP and 965 EGP balance. Original failed attempt remains FAIL in history. | 19:40:46–19:41:31Z `qa-dev-fixed-settled`, `qa-retest-egp-home`, `qa-retest-egp-feed` |
| RT-010-02 / PHY-008 read subcase | 1. Tap original coffee. 2. Inspect saved editor. 3. Android Back without Save. Expected same owned 10 EGP expense, Restaurants, correct wallet and no write. | **PASS** original saved-result read/back. UI shows 10 EGP, Restaurants, EGP wallet and title coffee; returns to Home. This is not a fresh recording success claim. | 19:41:47–19:41:51Z `qa-retest-voice-detail`, `qa-retest-back-from-voice-detail` |
| RT-010-03 / PHY-005 saved-draft recovery | 1. Open Add. 2. Observe original saved/refresh warning for the original 25 EGP operation. 3. Tap Save once. 4. Reconcile ledger. Expected clean navigation to Transactions, same operation, no duplicate. | **PASS** recovery/refresh. Warning clears and Transactions opens with expense total -35 EGP. Database still one manual and one voice expense; EGP 96500, SAR 200000, pending zero. | 19:42:07–19:42:31Z `qa-retest-original-manual-draft`, `qa-retest-manual-retry-settled`, `ledger-after-fixed-dev-retry.json` |

DEF-010 read-contract/refresh repair is accepted for these DEV retests only. Full manual creation on the new artifact and full first-to-last voice recording still require their own executions; original full visible-result failure is retained. DEF-011's reported earlier analysis message is not retroactively rewritten as a provider failure or a pass. No audio replay or duplicate recording was used for these retests.

## DEF-012 — Opening-balance row displays a negative sign

- Severity/state: P2 material financial-display defect, physically reproduced on ENV-DEV-02; persisted balance remains correct. Historical reproduction before repair; current source repair and DEV retests are below.
- Entry/steps: Open Transactions for A-EGP after RT-010-03 and inspect the opening row.
- Expected: the opening entry's direction matches its positive 100000-minor posting; opening does not inflate expense totals.
- Actual: row displays `-1,000.00 EGP` and English `Opening balance` in the Arabic UI, while owned balance and opening posting are positive. The expense summary correctly excludes opening and shows -35 EGP. Evidence `qa-retest-manual-retry-settled` at 19:42:31Z.
- Cause under investigation: opening projects to local adjustment; `financialMeaning` defaults a positive absolute amount to expense and Transactions does not pass an explicit direction. A safe repair must derive actual posting direction for negative credit openings/reversals too; do not infer every opening is positive or alter persisted data.
- Current repair: 058385f8; RT-012-01/02 positive/negative opening physical DEV PASS below. Signed reversal/adjustment regressions PASS; physical reversal and standalone remain NOT RUN. Original failure retained.

## Next user-dependent execution

At 19:43:38Z the non-default SAR card is selected at 2000 SAR on ENV-DEV-02 (`qa-sar-user-recording-ready`). User is asked for one new English recording, “I spent seven on coffee”, with account/currency omitted. Expected one 7 SAR expense, balance 1993 SAR, EGP unchanged 965. This request was completed and verified below as PHY-010 / RT-VOICE-007-01 **PASS** on U-A DEV only. Do not operate the phone while awaiting the recording.

## PHY-010 / RT-VOICE-007-01 — English, non-default SAR account

- Entry/parameters: ENV-DEV-02 Home, U-A, A-SAR non-default bank account selected, 2000 SAR starting balance; EGP wallet 965 EGP. No spoken account or currency.
- Steps: 1. User starts Voice. 2. Says “I spent seven on coffee”. 3. User stops and leaves result visible. 4. Reviewer captures UI and owned provider/event/ledger chain.
- Expected: one 700-minor SAR expense on the captured card, correct visible result, card 199300 minor, EGP unchanged 96500; no extra postings.
- Actual: **PASS** for this U-A / installed DEV execution. User confirmed correct result; 19:46:30Z UI shows coffee -7 SAR and card 1993 SAR. Session created 19:45:58Z, 5390 ms recording; completed Google Vertex attempt (`google/gemini-3.5-flash-lite`) with generation receipt; completed batch/event 0 committed at 19:46:06Z, ledger version 5, captured SAR account true; one confirmed 700-minor voice expense and one posting. Both fixtures remain non-default; EGP unchanged 96500, SAR 199300, pending zero. This does not pass second-owner/new-registration/standalone eligibility.
- Evidence: `qa-sar-english-user-result.{png,xml,json}`, `voice-sar-english-chain.json`, `voice-sar-english-balances.json`; timestamps above UTC.
- Defect/retest: fresh visible-result recovery after DEF-010 repair; original Arabic failed attempt retained under DEF-011. Arabic original-language retest is separately requested with a new 3 EGP recording; **NOT RUN** until evidence arrives.
- Cleanup: T-VOICE-02 retained; no replay. A-SAR current 199300 minor; A-EGP 96500 minor.

## PHY-011 / RT-VOICE-AR-01 — Fresh Arabic EGP retest

- Entry/parameters: ENV-DEV-02, U-A, A-EGP selected at 965 EGP. The utterance explicitly names pounds; it omits the account, **not the currency**. Exact EGP currency-omission coverage remains NOT RUN.
- Steps: 1. User taps Voice. 2. Says “صرفت تلاتة جنيه على قهوة”. 3. Stops once and reports correct result. 4. Reviewer reconciles UI and owned provider/event/ledger chain.
- Expected: one new 300-minor EGP expense, wallet 96200 minor, unchanged SAR 199300; correct visible result, no duplicate/replay of the old 10 EGP capture.
- Actual: **PASS** for this fresh Arabic selected-account/explicit-currency execution. Session created 19:48:25Z, 7609 ms recording; Google Vertex `google/gemini-3.5-flash-lite` attempt completed with generation receipt; batch completed and one event committed at 19:48:33Z, ledger version 6, captured EGP account true; one posting/expense 300 EGP minor. UI at 19:49:14Z shows 962 EGP and feed at 19:49:33Z shows -3 EGP. Server EGP 96200, SAR 199300, pending zero; EGP voice count two (old 10 plus new 3), manual test count one; SAR voice count one. No account switch/second-owner test is implied.
- Evidence: `qa-egp-arabic-user-retest-result`, `qa-egp-arabic-retest-feed`, `voice-egp-arabic-retest-chain.json`, `voice-egp-arabic-retest-balances.json`. All timestamps UTC; raw IDs/audio private.
- Defect/retest: fresh Arabic and English visible-result retests now PASS after DEF-010 repair; original reported analysis message and failed UI remain in history. Exact cause of that earlier literal message is not invented. The original audio was never replayed.
- Cleanup: T-VOICE-03 retained; latest wallet 96200 minor. Do not delete fixtures until their remaining correction/reversal/ownership cases are complete.

## DEF-013 — Generic system title remains English in Arabic UI

P3, observed at 19:49:33Z: the new valid Arabic 3 EGP event uses the generic server fallback “Voice transaction”; the opening row also uses “Opening balance”. Amount/account/category/posting remain correct. Expected Arabic system labels, while preserving stored titles and ordinary user titles. Existing `voice.title` and account-opening localization keys can supply presentation labels. Source repair at 058385f8, final139/139 regressions PASS; RT-013-01 physical DEV label retest PASS below. Standalone NOT RUN.

Unused Google identity remains **BLOCKED** pending user preparation (user reconfirmed “Still preparing the unused account”). No logout or new-owner registration was attempted. Continue safe current-owner review; ordinary-new-user eligibility remains unproven.

<!-- assistant-review -->
## PHY-012–016 — Assistant consent, scope and provider review

Environment: U-A, ENV-DEV-02, same Staging ingress; 2026-10-21 UTC. Preconditions: disposable owned EGP/SAR fixtures, EGP balance 96200 minor, SAR 199300 minor, six ledger transactions; no developer account entitlement was added. Owner role classification and second ordinary identity remain unverified.

| Execution / case | Entry, parameters and numbered steps | Expected visible / persisted effect | Actual and evidence | Result / retest |
|---|---|---|---|---|
| PHY-012 / AI-001 consent subcase | Assistant entry. 1. Observe personalization consent. 2. Tap enable personalization. 3. Observe confirmation. | Per-owner consent saved and assistant available. No financial write. | Enabled at 20:02:59Z; UI confirmation captured in `qa-assistant-consent-action`. This does not cover every entry, revoked consent or another owner. | Consent subcase **PASS**; full AI-001 **NOT RUN**. |
| PHY-013 / AI-004 explicit wallet/currency subcase | 1. Ask “How much did I spend today from QA21 EGP Wallet. Answer in English with EGP only.” 2. Observe supported-period clarification. 3. Ask monthly version. 4. Inspect saved context and reply. | Daily request honestly clarifies unsupported period. Monthly request returns 38 EGP for requested wallet/currency, or clearly requests account clarification; no silent widening. | Daily `period_required` clarification at 20:03:55Z. Monthly reply at 20:05:38Z returns “Spending: 38 EGP / 7 SAR (2026-10-01 – 2026-10-31).” Stored context contains both currency totals. No provider usage for these deterministic requests. UI `qa-assistant-provider-answer`, `qa-assistant-month-answer`; `assistant-provider-chain-final.json`. | Explicit scope subcase **FAIL**, DEF-014. Full selected-account switching matrix remains **NOT RUN**. Repair/retest **NOT RUN**. |
| PHY-014 / AI-003 general-finance provider subcase | 1. Ask “Explain inflation in two short sentences in English.” 2. Await reply. 3. Reconcile provider receipt and saved response. | Supported general-finance route gives a useful English explanation, or accurately states scope limits. | Real Azure `openai/gpt-6-luna` completed usage with generation receipt at 20:10:42Z; saved reply at 20:10:50Z asks for supplied evidence/source instead of explaining inflation. UI labels it a confirmed fact and calls it an old answer without verified period/currencies. `qa-assistant-english-provider-result`; private provider-chain evidence. Transport/provider subcase **PASS**, useful-answer acceptance **FAIL** pending route/prompt review. | DEF-016; no broad AI-003 PASS. Repair/retest **NOT RUN**. |
| PHY-015 / AI-002 Arabic suggestion shortcut | 1. Tap rendered “نصائح ذكية للتوفير”. 2. Await response. 3. Inspect stored route. | Built-in advice suggestion starts useful Arabic advice, or clearly asks a relevant clarification. | Routed to `savings_status`, returns `entity_required` clarification to identify a financial record; no provider call. `qa-assistant-arabic-provider-result` at 20:11:34Z, saved turn 20:11:28Z. | Shortcut **FAIL**, DEF-017. Arabic provider-answer case AI-002 remains **NOT RUN**. Repair/retest **NOT RUN**. |
| PHY-016 / AI-003 owned-ledger advice | 1. Ask “Give advice to reduce spending this month based on my confirmed records. Answer in English.” 2. Await reply. 3. Compare categories, provider receipt and saved context to owned ledger. | Correct amounts: Shopping 25 EGP; Restaurants 13 EGP and 7 SAR. Advice cannot inflate minor units or change ledger. | Real Azure `openai/gpt-6-luna` completed usage with generation receipt at 20:12:00Z; saved/UI reply at 20:12:09Z says EGP 2,500 shopping, EGP 1,300 restaurants and SAR 700 restaurants. Context holds `expenseMinor` 2500/1300/700, which equal 25/13/7 major units. `qa-assistant-context-advice-result`; `assistant-provider-chain-final.json`. | **FAIL**, release-critical DEF-015. Repair/retest **NOT RUN**. |

Financial side-effect subcase **PASS** for these five informational attempts: at 20:12:30Z there are still exactly six transactions, newest at 19:48:32Z; EGP 96200 and SAR 199300 confirmed minor, pending zero. `assistant-after-report-ledger.json` and `assistant-provider-chain-final.json`. Full AI-010 intent/retry matrix remains **NOT RUN**. Ten persisted messages represent five user turns and five replies; no extra financial action was requested or confirmed. History/reopen/pagination acceptance remains **NOT RUN**.

## DEF-014 — Assistant silently broadens explicit EGP wallet request

- Severity: P1, incorrect financial context. Reproduced PHY-013. Expected requested EGP/account scope or explicit clarification; actual both EGP and SAR returned.
- Source investigation: `apps/api/src/ai/assistant-context.ts` currency expression omits EGP and Arabic pound names; account clarification expression recognizes the literal word account and limited Arabic forms, but not a supplied wallet name. `AssistantFinancialTools.resolve` passes the resulting unfiltered context to report summary. This establishes the local parsing gap; exact deployed source equivalence remains unverified.
- Smallest repair direction: recognize supported owner currencies and reject unresolved account scope honestly; do not silently broaden or guess an owner record. Public API redesign is not authorized/planned. Source repair and original physical retest **NOT RUN**.

## DEF-015 — Provider advice inflates verified amounts by one hundred

- Severity: P1, release-critical financial correctness. Reproduced PHY-016 with completed provider receipt and persisted incorrect response, not an HTTP-only observation.
- Expected Shopping 25 EGP, Restaurants 13 EGP / 7 SAR; actual 2500 EGP, 1300 EGP / 700 SAR. Persisted report context contains correct integer minor units. Ledger/balances are unchanged.
- Investigation: the observed path is `financial_advice` through the provider worker; local `ai.worker.ts` sends encoded financial context to `ASSISTANT_ADVICE_OUTPUT_SCHEMA`. Need validate actual deployed prompt/output validation and ensure money is rendered/checked server-side with currency precision. Do not assume newer agent fact rendering is the active ingress/worker implementation. No speculative provider or database configuration change made.
- Repair/regression/retest **NOT RUN**. Include non-two-decimal currencies and negative amounts in regression; repeat the original owned-ledger English and fresh Arabic questions after a verified repair.

## DEF-016 — Supported general-finance answer and evidence labels are misleading

P2, PHY-014: `general_finance` is an explicit source-supported route, yet its real provider answer declines a basic explanation for lack of owner financial evidence. UI marks the refusal as a confirmed fact and an old answer moments after generation. Scope/prompt and metadata classification need investigation; do not weaken verified-data protections for owner-specific numerical questions. Repair/retest **NOT RUN**.

## DEF-017 — Built-in Arabic advice suggestion selects savings-record status

P2, PHY-015: tapping “نصائح ذكية للتوفير” sends the displayed text and selects `savings_status`, asking for a specific record instead of advice. Source routing advice rule does not match this suggestion before the savings rule. Repair/regression/retest **NOT RUN**. Arabic provider delivery remains untested; this failed shortcut is not a provider failure.

Unused Google identity remains **BLOCKED** pending preparation; user reconfirmed this at the latest reply. No sign-out or second-owner data access attempted. Standalone acceptance remains **NOT RUN**; no client APK built or distributed.

<!-- direction-retest -->
## ENV-DEV-03 / RT-012–013 — Posting direction and localized system labels

Source commit `058385f83e6ed5ab46be21de41dea74bc786449f`. DEV-only package `com.masarifi.mobile.dev`; APK SHA256 `020ca2d2e69865becc325a53280c5293406df3bee2ea66a8791ef9d0ad087eb5`; signing certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; embedded bundle SHA256 `7ef55ef2ae760520e8cd50e8ddaf84655deb06dc829c070eb0b1c3f58ae3f7f6`. Isolated build completed in 1m57s, 853 tasks (14 executed). Same Staging development launcher and native DEV template; same verified signing identity. Installed 2026-10-21T20:14:43.306Z with `adb install -r`; existing owner and synthetic data preserved. Private `dev-direction-artifact.json`, `dev-direction-install.json`, `native-dev-review-direction.log`. No client package/build/distribution and no standalone acceptance.

The initial installer guard correctly refused to replace the app while the Home balance was scrolled offscreen; after scrolling to the observed 962 EGP Home, install succeeded. Initial post-launch UIAutomator idle failure provides no valid XML evidence; settled captures below are used. Screenshots precede XML, so the first Transactions screenshot shows loading; the later settled capture is the visual evidence.

| Retest / case | Preconditions, entry and steps | Expected | Actual / evidence / UTC | Result |
|---|---|---|---|---|
| RT-012-01 / DEF-012 positive direction | U-A, preserved A-EGP 962 EGP. 1. Select EGP wallet. 2. Open Transactions. 3. Inspect opening and summary. | Opening +1000 EGP; expenses 38 EGP; opening excluded from income/expense totals; balances unchanged. | 20:16:08Z `qa-direction-positive-opening-settled`: +1,000 EGP opening, -38 EGP expenses, +0 income. Owned DB later confirms +100000-minor opening posting, balance 96200. | **PASS** DEV subcase. |
| RT-013-01 / DEF-013 system localization | Same EGP feed. 1. Read opening and generic voice fallback. 2. Compare original user titles. | Arabic system labels; persisted/user titles preserved. | Same capture: “الرصيد الافتتاحي”, “معاملة صوتية”; original coffee and synthetic manual title remain unchanged. | **PASS** DEV subcase. |
| PHY-017 / ACC-008 credit opening subcase | Disposable U-A. Accounts → Manage → Add → Credit. 1. Enter `QA21 Credit Negative`. 2. Keep SAR, enter available 1500 and limit 2000. 3. Leave optional days blank. 4. Keep default off. 5. Save once. | One non-default credit account, one -50000-minor opening, no change to other accounts/default. | Saved 20:18:38Z; 20:18:48Z list -500 SAR, four active accounts, SAR total1493 with other-currency exclusion disclosure. `qa-credit-fixture-corrected-values`, `qa-credit-fixture-save-settled`, `credit-opening-db.json`. DB type credit_card, limit200000, balance-50000, pending0, defaultfalse. | **PASS** creation subcase; complete credit detail/payoff behavior **NOT RUN**. |
| RT-012-02 / DEF-012 negative direction | New credit fixture. 1. Recover Home using known DEV link after Back failure. 2. Select credit. 3. Open Transactions. | Opening -500 SAR, no invented positive income; zero ordinary expense/income; exact negative balance persists. | 20:19:55Z `qa-direction-negative-opening-settled`: -500 SAR opening, zero income/expense; `direction-retest-db.json` at20:20:18Z proves exactly one -50000 opening posting. A-EGP96200 and A-SAR199300 unchanged. | **PASS** DEV subcase. |
| RT-009-01 / DEF-009 navigation | After creating credit and reaching Accounts, press Android Back once. | Return to an accessible previous application destination. | 20:19:00Z `qa-credit-after-create-back`: stays on Accounts without an exit control. Source-resolved Home link at20:19:10Z recovers navigation; this is not a Back pass. | **FAIL**, DEF-009 remains open. |

Input automation temporarily put the available amount into the name field before Save; this was detected and corrected. No incorrect financial write occurred. Input tooling now re-verifies focused field after tapping and rejects clipped bounds. The final observed values were name `QA21 Credit Negative`, available1500, limit2000 before the one submission.

Repair details: special ledger kinds opening/adjustment/reversal derive their direction from validated confirmed account postings in selected and all-account projections. Existing version/identity/currency/amount consistency and owner checks remain. Presentation reads adjustmentSign; generic system titles use existing localization keys; positive opening no longer gets the salary fallback icon. No financial write or public API change. Physical reversal and negative-adjustment matrix **NOT RUN**; standalone retests **NOT RUN**.

Regression provenance: initial direction tests exposed ten failures; two UI test setup failures were corrected before the focused RED. A later icon assertion exposed an unwanted salary fallback. One intermediate repair broke the existing real-income icon contract, then was corrected. Final five-file run **139/139 PASS** (`opening-direction-green-accepted.json`), mobile typecheck PASS (`mobile-typecheck-direction-final.log`), scoped lint exit0 with one existing require-style warning. Interrupted/stalled and intermediate failed attempts retained privately. Latest complete per-file aggregate is551files/3896passed; no claim of a monolithic or physical pass.

Latest cleanup: A-CREDIT negativeSAR fixture retained with one opening; total owned ledger transactions now7 (previous6 plus this deliberate opening). A-EGP96200, A-SAR199300, A-CREDIT-50000 confirmed minor; pending0. No deletion/reversal/cleanup performed. The assistant no-ledger-effect evidence precedes this deliberate account creation and still applies to those informational turns.
