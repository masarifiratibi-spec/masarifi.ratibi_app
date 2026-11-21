# Masarifi — Final Review, Device Test Results and Remaining Checklist

**Reporting date:** 25 October 2026 (Asia/Riyadh).  
**Report status:** Final record of the completed testing round; **not** a complete-report closure or release approval.  
**Current instruction:** Test/document only. No further application fixes, server deployments or production infrastructure changes. Billing/subscriptions remain the final deferred phase.

## 1. Executive result

The attached Arabic report is an earlier report produced in this chat. Its snapshot contained **55 grouped test cases and 12 observed issues**. This English report supersedes that snapshot and incorporates the later offline edit result and the interrupted cold-offline attempt.

| Measure | Final recorded result |
|---|---:|
| Original PDF finding references | 69 |
| Independent acceptance units in the closure checklist | 88 |
| Grouped device/runtime test cases recorded | 58 |
| Passed within the stated case boundary | 38 |
| Failed cases | 13 |
| Partial cases | 5 |
| Inconclusive cases | 2 |
| Distinct issues observed | 13 |
| Observed issues still without a verified correction | 12 |
| Previously corrected symptom with a successful device retest | 1 — PIN verification latency |
| Original findings newly closed in full by this device round | 0 |

These are inventory and test-case counts, **not a completion percentage**. A passed subcase does not close its parent finding. Failed/repeated attempts may belong to the same issue. Four grouped cases contain 90 synthetic parser/native/amount checks; those checks do not increase the original 69-finding denominator.

The earlier verified storage closure for finding 4.4 is preserved as prior evidence. This round did not independently requalify storage encryption in a final release artifact. Accepted exceptions, especially screenshots being allowed, are not new security fixes.

## 2. What was actually reviewed

- The earlier closure plan inventories all 30 PDF pages, all 69 original references and 88 acceptance units. This report reconciles that inventory with the actual device log; it does not claim all acceptance units were tested end to end on the phone.
- A real Xiaomi **23076RN8DY**, Android **15**, arm64-v8a was used. No Samsung or second OEM was tested in this round.
- The user signed into a real account and privately entered the PIN and Clerk OTP. Financial writes were limited to clearly named QA records/configuration; original financial records were not deleted.
- Actual UI journeys, real service responses and selected production-code probes were recorded. Synthetic runtime probes are identified separately from real inbox/provider journeys.
- Some guarded pages were entered through authenticated Expo Router diagnostics because the menu route was missing. No authentication or PIN state was bypassed; that entry does not qualify normal menu accessibility.
- No subagents were used. No new service, signing key or runtime environment was created. No server or production infrastructure was updated during this device round.

### Build and service boundary

| Item | Evidence / limitation |
|---|---|
| Source baseline | `5aa1267dccac67a8b95249dbddbf398c25d1bb49` |
| Installed DEV APK | Masarifi Ratibi Dev; `com.masarifi.mobile.dev`; 0.0.1 / versionCode 1; target SDK 36; arm64-v8a |
| Latest APK | `Masarifi-Dev-PIN-Fix-20261025.apk` |
| APK SHA-256 | `5aa443428e94789d870b3d9514459091a6c94071529bd00c61da5dbfbfd011bf` |
| Existing development certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Source qualification | Baseline plus local PIN changes; the correction was uncommitted in the inspected worktree. DEV JavaScript is served by local Metro over USB. This is not a signed/minified Google Play release candidate. |
| Actual client environment | Live client connected to `https://api.staging.masarifiratibi.com`; Clerk live instance on a Staging domain; intentional DEV diagnostics enabled; app lock enabled. |
| Hosted API last observed during testing | Source `a488f4adbf8f291ea49b09940baf5cdb4fe5f0e7`; no deployment performed. This is historical observation, not a new health check at report generation. |
| Hosted schema last inspected | 165 migrations, latest `20261023195606`, versus 174 in the candidate. Hosted provider/schema parity is unqualified. |
| Earlier CI | Retained evidence reports 18 successful checks and one tag-only signed-release skip at the baseline. It does not cover the later uncommitted PIN correction. |

## 3. Positive results, with their boundaries

- **Account/onboarding:** required currency validation worked; the QA account saved with 50.25 SAR; an online cold restart retained the owner/profile/account. Interrupted first save and all duplicate-write scenarios remain open.
- **Amount entry:** a new opening balance accepted 50 without a leading zero and then 50.25. The budget accepted Arabic numeric 100.50, rejected excessive SAR precision and focused missing/invalid fields. The actual payoff field accepted Arabic 5.00. Other financial input paths/currencies remain incomplete.
- **Budget and obligations:** the October QA budget saved with 100.50 SAR. A 10 SAR obligation saved as two 5 SAR installments. Arabic and English obligation dates were observed. The invalid-month budget path failed separately.
- **Payment repetition:** two rapid confirmations and another confirmation after success left one visible 5 SAR payment, 5 SAR outstanding and QA account balance 25.25 SAR. Cross-device concurrency and interrupted network replay were not tested.
- **Salary setup:** expected 100.50 SAR, day 25, a QA salary source and the QA receiving account saved. No salary receipt/income was confirmed; unavailable summary values in that state were not automatically labelled a defect.
- **Assistant:** actual live-app responses reported largest category Shopping/20 SAR and monthly spending 25 SAR. Arabic/English timestamp localization worked. External AI model execution, timeouts and rate-limit recovery were not independently proven. Narrative dates and 24-hour preference failed separately.
- **Support:** the local draft survived navigation; one explicitly authorized QA ticket was created and the returned ticket opened. Administrator reply/refresh was not tested, and its status translation failed.
- **Authentication:** real Clerk re-verification was prompted after a recent-auth rejection; the replay progressed beyond 403, then export failed with 500. This is partial step-up evidence, not export acceptance.
- **Warm offline access:** cached balances/categories/transactions and the existing expense editor were accessible without an active network. Saving the note edit failed; cold-offline acceptance remains inconclusive.
- **Theme, language and screenshots:** system theme following, a saved Dark override, Arabic/English switching and screenshots in observed screens including PIN worked. Dark-label contrast, long-name readability and remaining screen/release combinations are still open.
- **Permissions:** SMS disclosure and cancellation worked without granting READ_SMS or importing history. Microphone denial kept recording off, but the complete post-denial recovery UI was not accepted.
- **Synthetic production-code checks on the phone:** shared parser 36/36; installed native policy 38/38; installed native scanner 6/6; amount boundaries 10/10. These did not read the real SMS inbox or exercise real notification capture, queue acknowledgment, providers or owner-switch races.

## 4. Observed issues and current disposition

The PIN correction below happened before the later test-only instruction. **No other issue was fixed during the continued testing round.**

### ISSUE-001 — Dark-mode regional labels are hard to read.

**Status:** Open. **Report reference:** J9. **Work area:** Mobile UI/theme.

App Settings retains dark text on a dark background for language, week start, currency and month start.

Evidence: [19-system-dark.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/19-system-dark.png>), [21-app-dark-override.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/21-app-dark-override.png>).

### ISSUE-002 — PIN verification previously appeared unresponsive.

**Status:** PIN latency retest passed; full lock acceptance open. **Report reference:** 4.9 / 2.2. **Work area:** Prior local native/JS correction; no further fix in the test-only round.

Two actual attempts took 33,987.63 ms and 33,559.03 ms. After the prior native KDF change, the unchanged PIN verified in 641.88 ms and the owner lock became unlocked.

Evidence: [pin-performance-observation.txt](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-performance-observation.txt>), [pin-verify-timing.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-verify-timing.json>), [pin-actual-verify-latency.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-actual-verify-latency.json>).

### ISSUE-003 — Live Security Events is blocked.

**Status:** Open. **Report reference:** 8.2.d. **Work area:** Mobile route/UI, then API acceptance.

The route renders an unavailable state in live mode and its settings entry is fixture-only. The existing API client does not overcome the UI block.

Evidence: [141-security-events-direct-confirmed.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/141-security-events-direct-confirmed.png>).

### ISSUE-004 — Security Settings is missing from More.

**Status:** Open. **Report reference:** P1 security navigation / full report security coverage. **Work area:** Mobile navigation.

The normal menu does not expose Security Settings. Diagnostic navigation was used for page inspection and does not count as normal accessibility.

Evidence: [17-more-menu.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/17-more-menu.xml>), [30-more-bottom.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/30-more-bottom.xml>), [42-current-after-pin-report.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/42-current-after-pin-report.xml>).

### ISSUE-005 — Refund action is bypassed by normal expense navigation.

**Status:** Open. **Report reference:** J1. **Work area:** Mobile navigation/refund journey.

The transaction list opens Edit; the refund action is on a separate details screen and was not available through the observed normal flow.

Evidence: [52-expense-refund-action.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/52-expense-refund-action.png>), [53-expense-actions-lower.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/53-expense-actions-lower.png>).

### ISSUE-006 — The live financial report is unavailable.

**Status:** Open; root cause unconfirmed. **Report reference:** 8.2.b. **Work area:** Client/API diagnosis required; do not assume deployment alone fixes it.

Repeated UI attempts failed. With cycle day 25, the service received the correct monthly/day/zone input but rejected with reports_unavailable in 263 ms. No definite HTTP or migration cause was established.

Evidence: [56-reports-live.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/56-reports-live.png>), [57-reports-retry.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/57-reports-retry.png>).

### ISSUE-007 — Support status is an untranslated key.

**Status:** Open. **Report reference:** 8.2.c / localization. **Work area:** Mobile status/localization mapping.

The successfully created ticket displays support.ticket.status.waiting_support.

Evidence: [89-support-send-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/89-support-send-settled.png>).

### ISSUE-008 — The cross-year period chip clips its ending year.

**Status:** Open. **Report reference:** 20 / 2.10.a. **Work area:** Mobile layout/date presentation.

The range October 1, 2025-October 31, 2026 has a complete accessibility label, but the final year is visually cut at normal font size.

Evidence: [108-crossyear-period-chip.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/108-crossyear-period-chip.png>).

### ISSUE-009 — Export returns HTTP 500 after Clerk re-verification.

**Status:** Open; hosted correlation pending. **Report reference:** 8.2.e. **Work area:** Hosted API investigation plus full export lifecycle.

The replay and one retry returned INTERNAL_ERROR. Request IDs are retained in the evidence index; no successful export or download was verified.

Evidence: [112-export-after-user-verification.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/112-export-after-user-verification.png>), [113-export-retry-response.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/113-export-retry-response.xml>).

Hosted correlation IDs: `4ff699e5-2a86-4b72-ad31-c66d249799ef`, `3fb081a4-1393-4caf-b007-20e08fe4eb05`.

### ISSUE-010 — Invalid budget month hides the editable form.

**Status:** Open. **Report reference:** 26 / 2.7. **Work area:** Mobile query guard, editable validation and draft recovery.

Entering 2026-13 triggers HTTP 400 and replaces the form with an unavailable state; the invalid period returns through the local QA draft. The saved server budget remained October/100.50 SAR.

Evidence: [139-budget-edit-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/139-budget-edit-settled.png>).

### ISSUE-011 — Arabic assistant narrative dates remain raw ISO bounds.

**Status:** Open. **Report reference:** 2.10.b. **Work area:** Assistant response/date presentation; identify candidate API/client responsibility.

The response included 2026-10-01-2026-10-31 while message timestamps themselves were localized.

Evidence: [198-assistant-response.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/198-assistant-response.png>), [200-assistant-advice-result.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/200-assistant-advice-result.png>).

### ISSUE-012 — Assistant timestamps ignore the device's 24-hour preference.

**Status:** Open. **Report reference:** 16. **Work area:** Mobile timestamp formatting.

A new English message still showed 12:22 PM after the device setting changed to 24-hour time and the app was brought back to the foreground. The original 12-hour setting was restored.

Evidence: [220-assistant-english-response.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/220-assistant-english-response.png>), [221-assistant-english-24h.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/221-assistant-english-24h.png>), [222-assistant-new-message-24h.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/222-assistant-new-message-24h.png>).

### ISSUE-013 — An offline expense-note save returns a misleading validation error.

**Status:** Open. **Report reference:** 2.1. **Work area:** Mobile offline edit/queue contract and error presentation.

Cached editing loaded correctly with no active network, but saving QA-OFFLINE-20261025 returned a generic check-transaction-data message. Text remained; durable queued-save success was not established.

Evidence: [243-offline-expense-actual-entry.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/243-offline-expense-actual-entry.png>), [245-offline-note-save.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/245-offline-note-save.png>), [246-offline-save-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/246-offline-save-settled.png>).

### Additional UX observation — long obligation names

At system font scale 1.3, the English obligation hero heading, amount and date did not overlap. However, the long QA record name shrank to a very small list-card label. This is a recorded readability observation, not a new original PDF finding and not proof that all ordinary names fail. Arabic large-text and wider name coverage remain pending. See [229-obligations-large-en.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/229-obligations-large-en.png>).

### PIN correction evidence and limits

The native Android KDF preserves the existing credential format, salt, stored iteration count and constant-time comparison. New PINs still use 120,000 PBKDF2-SHA256 iterations; the user's PIN was not reset. Devices below Android API 26 retain the existing JS fallback and do not receive this performance improvement.

Recorded local checks: original privacy/SecurityJourney 28 tests, new native-boundary four tests, Android-native six tests, focused type/lint/format checks and the Debug build passed. A separate synthetic installed-native vector took 658.77 ms; the **actual user PIN verification** took 641.88 ms. Earlier unsuccessful synthetic JS load is excluded from those timings. Full lockout escalation/restart/owner isolation remains open. See [pin-latency-fix.md](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-25-device-checklist/pin-latency-fix.md>).

## 5. What requires server/configuration work or external verification

Installing a DEV APK does not deploy API code, SQL migrations, published tracking policy, provider settings or Play configuration. Existing configuration must be reused after verification; this report does not authorize deployment.

| Area | Remaining action and evidence boundary |
|---|---|
| Reports unavailable | Investigate the exact client/API failure first. The recorded code is reports_unavailable; do not assume one missing migration or a deployment alone is the cause. Preview/charts/net-worth/scheduling acceptance is blocked. |
| Export HTTP 500 | Correlate the retained request IDs with redacted hosted logs; then qualify request/status/download, expiry and ownership. No successful artifact exists from this test. |
| Server deletion and provider cleanup | Candidate deletion/cleanup code and migrations need authorized qualification of immediate/delayed expiry, retries and actual erasure. No deletion was tested on the real owner. |
| Cursor/authentication-age changes | Verify the dedicated cursor-key configuration, token version/resync behavior and queued operation authentication age on the intended server. Keep secrets out of chat/Git. |
| SQL financial corrections | Qualify feeMinor validation, per-currency ranking and applicable registry/financial-period changes against the verified candidate schema and hosted compatibility. No hosted migration was run. |
| Assistant behavior | Candidate wording/model-contract changes execute server-side. Actual model identity, aliases, deployment topology and transient-failure recovery still need redacted provider evidence. |
| Tracking policy/registry | The bundled/native synthetic tests passed, but the effective published policy and real sender mappings were not accepted. Controlled fixtures and actual background capture are required. |
| Security Events | A mobile live-route/menu block is confirmed. A server update alone will not remove that UI block; owner/pagination acceptance follows the later authorized fix. |
| Public privacy/deletion pages | Verify correct public URLs and truthful lifecycle/retention copy. Prior inspection found the public binding incomplete; this device round did not publish anything. |
| Production binding/signing/version | Prior inspection found an existing EAS-managed upload JKS and a working Staging setup. Verify intended Play publisher/certificate, approved production endpoint/Clerk binding, version history and final AAB. No new signing key was created. |
| CI/repository administration | Requalify the exact candidate including any local PIN changes and have an authorized administrator configure required checks. No protection or production setting was changed in this round. |
| Play and device qualification | Final signed/minified artifact, merged manifest, production bundle, permissions/SMS approval, Data safety, applicable closed testing and Samsung/other OEM checks remain external or unexecuted. |

The full-report server checks still require independent acceptance for net worth/FX, totals with refunds and transfers, installment interruption/concurrency, notification content, real report email, sync-conflict convergence and phone OTP. The bounded installment and Clerk re-verification positives do not close that entire list. Clerk email/OTP re-verification is not proof of every phone-OTP send/resend/ownership scenario.

## 6. Test records, configuration changes and data preservation

| Test data | Last observed / recorded state |
|---|---|
| QA-20261025-DEV-SAR cash account | Opening 50.25 SAR; expense 20 SAR; one installment payment 5 SAR; last observed balance **25.25 SAR**. Original default cash account was not replaced. |
| QA-20261025-EXPENSE-20 | Posted/synchronized 20 SAR expense. Offline QA note edit returned an error; its server save was not confirmed. Reconcile the retained field/draft before any later resend. |
| QA-20261025-BUDGET | Saved October 2026 budget, 100.50 SAR. The separate invalid local edit draft contains month 2026-13 and was not accepted as a server update. |
| QA-20261025-INSTALLMENTS-10 | Total 10 SAR, one recorded payment 5 SAR, remaining 5 SAR. The next displayed installment date was November 25, 2026. |
| QA-20261025-SALARY | Expected 100.50 SAR, day 25, QA receiving account. No receipt confirmed and no salary income posted by this test. This test configuration remains saved. |
| QA support ticket | One authorized submission, subject QA-20261025-SUPPORT-DRAFT; body “Device test only. No personal data.” No additional support reply/message was sent. |
| Assistant | Personalization was enabled through the UI for the financial-query test and remained enabled at the last observation. Test conversations remain; no claim is made that consent was restored to disabled. |

Restored/retained settings at the end: Wi-Fi on, mobile data off, font scale 1.0, device clock format 12-hour, Arabic application locale, financial month start restored to day 1, last observed System theme with light OS, and auto-lock restored to Immediate. The app was left locked with its existing PIN configured and the owner session authenticated/unexpired in the last safe status read.

SMS and notification tracking were not enabled; READ_SMS was not granted; no historical inbox/audio import ran. Microphone permission was denied in its test, and no recording/audio upload occurred. Original user records, app data and keys were not cleared, and the ordinary non-DEV app was not updated. Business QA writes/settings used normal app APIs; this is distinct from deploying or modifying the server.

The last cold-offline attempt was stopped when the user requested the final report. Native activity timing is not app-ready timing; foreground-safe capture was skipped. No other foreground app/window was inspected. Wi-Fi was restored before report completion.

## 7. Remaining work, in order — no execution authorized by this report

1. Review the 12 still-unfixed observed issues and the additional long-name readability note. A later repair round must be explicitly requested; this round stopped at documentation.
2. After authorized corrections, rerun each exact failed scenario on the phone. Keep the wider original acceptance unit open until all its applicable checks pass.
3. Complete cold offline unlock/read, supported queued edits and synchronization, conflicts, logout decisions, interruption/restart, owner isolation and isolated key-loss recovery. Avoid erasing the real owner's records for these tests.
4. Complete controlled real SMS/notification capture, permission grant/revocation, queue acknowledgment/capacity, OEM recovery and actual voice/provider flows. Do not bulk-import historical user data as a shortcut.
5. Complete refunds, remaining localized financial inputs/currencies, timezone boundaries, report periods and the remaining RTL/large-text/theme/date screens.
6. Resolve/qualify actual hosted report/export/provider behavior, authorized Admin support reply/refresh, security-event retrieval and the seven server acceptance areas. Existing client methods or local tests are insufficient.
7. Qualify the exact integration commit/schema and final signed/minified AAB, final manifest/bundle, production configuration and required CI/Play gates through separately authorized release work.
8. **Billing and subscriptions remain last and open.** Confirm markets/distribution/program eligibility and intended Stripe flow, then implement compliant purchases, server entitlements, restore, cancellation/refund handling and associated acceptance. No provider is selected by this report and no purchase capability was enabled.

Required retained TODO:

> TODO(report-8.2): Implement real subscription billing in the final closure phase; verify the intended Stripe integration against current Google Play Payments requirements and applicable regional programs before enabling purchases. Deferred, not resolved.

The inherited nullable source_version CHECK follow-up is separate from the original PDF inventory. It was not fixed or counted as an additional original finding in this round.

## Appendix A — All original acceptance units and what remains

The “Prior implementation record” column is translated from the existing closure trace; it is not a fresh runtime-success claim. “Not exercised on this device” may refer to a CI/configuration/Console concern, an unavailable external dependency or an unexecuted phone journey. Full acceptance remains unchecked. Billing is explicitly deferred; accepted screenshot/unsupported-claim exceptions retain their meaning.

| Open acceptance unit | Area | Prior implementation record | Device evidence | Remaining acceptance |
|---|---|---|---|---|
| [ ] 1.1 | Release signing | Partial | Not exercised on this device; No device case assigned | Match the existing approved upload key to the intended Play publisher and verify the final AAB certificate and package. DEV signing is not release signing acceptance. |
| [ ] 1.2.a | Production API and Clerk binding | Open | Not exercised on this device; No device case assigned | Approve and qualify the final production API/Clerk binding. The inspected working setup is Staging with a Clerk live instance on a Staging domain. |
| [ ] 1.2.b | Production app-lock flag | Code changes recorded | Not exercised on this device; No device case assigned | Verify the resolved final release configuration and artifact. PIN works in DEV, but that does not qualify the production build. |
| [ ] 1.2.c | Production automation/diagnostics flags | Code changes recorded | Not exercised on this device; No device case assigned | Verify disabled automation/diagnostics in the final production artifact. Enabled DEV tools are intentional. |
| [ ] 1.2.d | Release version and build number | Open | Not exercised on this device; No device case assigned | Check intended Play/EAS release history and approve next identifiers; DEV remains 0.0.1/versionCode 1. |
| [ ] 1.3 | R8 and resource shrinking | Code changes recorded | Not exercised on this device; No device case assigned | Exercise startup, SQLCipher, Clerk, voice, notifications and tracking in the final signed/minified artifact. |
| [ ] 1.4 | SMS disclosure and Play declaration | Partial | Partial device coverage; D023, D024 | Complete permission grant/revocation and real capture tests, then obtain applicable Play approval and verify Data safety/disclosures. |
| [ ] 1.5 | Playback foreground permission | Code changes recorded | Not exercised on this device; No device case assigned | Inspect the final merged release manifest and verify recording/playback after permission removal. |
| [ ] 1.6.a | Storage/overlay permission removal | Code changes recorded | Not exercised on this device; No device case assigned | Verify supported file sharing and notification flows in the final artifact without unjustified permissions. |
| [ ] 1.6.b | Unrelated wallet queries | Code changes recorded | Not exercised on this device; No device case assigned | Inspect the final merged release manifest for reintroduced unrelated package queries. |
| [ ] 1.7.a | Immediate and delayed server erasure | Code changes recorded | Not exercised on this device; No device case assigned | Qualify actual eligible-data erasure after both deletion paths against an authorized candidate schema; do not delete this real owner for testing. |
| [ ] 1.7.b | Deletion/provider retry safety | Code changes recorded | Not exercised on this device; No device case assigned | Verify cancellation, expiry, retries, partial-provider failures and truthful completion across all configured providers. |
| [ ] 1.7.c | Public deletion request page | Code changes recorded | Not exercised on this device; No device case assigned | Publish/verify the correct public deletion request/status route and retention copy through a separately authorized release action. |
| [ ] 1.8 | Public-repository privacy review | Limited inspection | Not exercised on this device; No device case assigned | Preserve the targeted text scan's limits; investigate confirmed exposures individually. No broad asset deletion or history rewrite is authorized. |
| [ ] 1.9 | Integration PR and required CI | Partial | Not exercised on this device; No device case assigned | Run exact-candidate CI after including local PIN changes and have a repository administrator configure required checks. Historical green CI does not cover uncommitted changes. |
| [ ] 1.10 | Closed-testing eligibility | Open | Not exercised on this device; No device case assigned | Verify the intended Play publisher's account eligibility, required tester history and production-access decision. |
| [ ] 2.1 | Cached offline access and queued edits | Code changes recorded | Observed device failure; open; D018, D019, D056, D057, D058 | Resolve the observed offline note-save failure, then test cold unlock, durable supported edits, restart, sync and owner switching. |
| [ ] 2.2 | Startup performance | Code changes recorded | Partial device coverage; D041, D058 | Record complete cold/warm startup timings. PIN latency improved, but the interrupted cold-offline launch is not startup acceptance. |
| [ ] 2.3 | Saudi/Gulf assistant wording | Code changes recorded | Partial device coverage; D050 | Verify varied generated and deterministic/error responses on the intended server version, beyond the limited sampled wording. |
| [ ] 2.4 | Intermittent assistant failures | Open | Partial device coverage; D047, D050, D053 | Correlate redacted request/model diagnostics and exercise actual provider success, timeout, rate limit, cancellation and idempotent recovery. |
| [ ] 2.5 | Support submission safety | Code changes recorded | Partial device coverage; D017 | Test local-save failure, offline retry, double-tap and successful server creation followed by cleanup failure, without sending unapproved support messages. |
| [ ] 2.6.a | Tracking activation persistence | Code changes recorded | Not exercised on this device; No device case assigned | Enable tracking with controlled fixtures and verify reload/restart persistence and stale-response fencing. |
| [ ] 2.6.b | OEM battery/settings guidance | Code changes recorded | Not exercised on this device; No device case assigned | Verify contextual guidance and background behavior on Xiaomi/Samsung and another available OEM. |
| [ ] 2.6.c | Tracking permission lifecycle | Code changes recorded | Partial device coverage; D024 | Complete grant, denial, revocation and return-from-settings flows. Only disclosure cancellation was accepted in this round. |
| [ ] 2.7 | Planning journeys | Open | Observed device failure; open; D033, D035, D042 | Correct the invalid-month form trap later; complete planning retrieval, interrupted retries and version conflicts beyond the successful QA budget/obligation saves. |
| [ ] 2.8 | First onboarding save | Open | Partial device coverage; D001, D002 | Complete interruption/double-submit/server-durability acceptance; the observed online restart is only a bounded positive result. |
| [ ] 2.9 | Opening-balance leading zero | Code changes recorded | Partial device coverage; D003, D004 | Finish decimal/Arabic/Persian and applicable account-type coverage; the basic 50 and 50.25 paths passed. |
| [ ] 2.10.a | Period presentation | Code changes recorded | Observed device failure; open; D025 | Correct the observed cross-year clipping and verify narrow widths, RTL and larger fonts. |
| [ ] 2.10.b | Assistant narrative dates | Code changes recorded | Observed device failure; open; D048 | Correct the observed raw ISO date bounds in Arabic responses and retest both languages. |
| [ ] R4 | Malformed SMS rows | Code changes recorded | Partial device coverage; D038 | Complete JS/native integration and cursor/queue-failure tests with controlled capture; synthetic production-scanner cases already passed. |
| [ ] fix-01 | Voice database acceptance | Automated verification recorded | Not exercised on this device; No device case assigned | Verify the exact authorized schema target and applicable voice/posting/idempotency/RLS cases; no hosted reset or migration was executed. |
| [ ] R5 | Lost SQLCipher key recovery | Code changes recorded | Not exercised on this device; No device case assigned | Use an isolated owner/test data set to verify quarantine, explicit recovery and unsynced-data warnings; do not remove the real owner's key. |
| [ ] R6 | AI model identity validation | Code changes recorded | Not exercised on this device; No device case assigned | Qualify missing/incorrect/valid identities against actual configured provider contracts on the candidate API. |
| [ ] New-1 | Ambiguous bare riyal | Code changes recorded | Partial device coverage; D036 | Verify actual tracking/account evidence and conflicts in both modes; the synthetic parser probes are not real sender/account acceptance. |
| [ ] J1 | Linked refunds | Code changes recorded | Observed device failure; open; D014, D015 | Restore normal access to the eligible-expense refund flow later, then test full/partial refunds, remaining balance, currency/account checks and over-refund rejection. |
| [ ] J7 | Arabic brand/greeting spelling | Code changes recorded | Partial device coverage; D010 | Review every affected onboarding/screen string visually; language switching and the welcome sample do not cover all occurrences. |
| [ ] J8.a | Obligation layout | Code changes recorded | Partial device coverage; D042, D055 | Complete Arabic and English layout checks at larger fonts and narrow widths; inspect the observed excessive shrinking of a long list name. |
| [ ] J8.b | Obligation date locale | Reviewed / preserved | Partial device coverage; D042, D055 | Complete date/missing-date/cross-year coverage. The observed Arabic and English obligation dates were localized. |
| [ ] J8.c | Net-worth comparison | Code changes recorded | Blocked by unavailable reports; D016 | Unblock reports and verify balances, liabilities, FX/missing rates and zero/near-zero comparison bases. |
| [ ] J8.d | Subscription capability | Deferred | DEFERRED — final phase; No device case assigned | Deferred to the final billing phase; purchases and entitlement acceptance remain open. |
| [ ] 21 | Budget/subscription date presentation | Code changes recorded | Partial device coverage; D033 | Finish budget transaction headings, missing/cross-year dates and renewal-date formatting; formatting is separate from deferred billing. |
| [ ] 16 | Assistant timestamp locale/clock | Code changes recorded | Observed device failure; open; D049, D053, D054 | Correct the observed failure to honor 24-hour preference; Arabic and English timestamp localization passed bounded checks. |
| [ ] 20 | Period-chip clipping | Code changes recorded | Observed device failure; open; D025 | Correct ending-year clipping later and retest same-year/cross-year ranges, RTL and larger fonts. |
| [ ] 26 | Budget validation and correction | Code changes recorded | Observed device failure; open; D030, D031, D033, D034, D035 | Keep invalid month input editable instead of replacing the entire form; retest all fields and successful recovery. Missing name/amount focus checks passed. |
| [ ] 24 | Category mini-bars | Code changes recorded | Blocked by unavailable reports; D016 | Unblock the actual report and test zero, one, two and more than seven values; preserve legitimate zero time buckets. |
| [ ] 47 | Demo banks and verified sender registry | Code changes recorded | Not exercised on this device; No device case assigned | Qualify the effective published registry and verified Saudi/UAE fixtures; apply candidate migration only through an authorized server release. |
| [ ] R10 | Recent-auth step-up | Code changes recorded | Partial device coverage; D027, D028 | Finish cancellation, failure, expiry and idempotent resume across protected operations; export replay progressed beyond 403 but then failed with 500. |
| [ ] R11 | Route-specific AI deadlines | Reviewed / preserved | Not exercised on this device; No device case assigned | Retain the supported existing deadlines; verify a real long voice request. The original blanket three-second claim remains unsupported. |
| [ ] R13 | Pinned Admin dependencies | Code changes recorded | Not exercised on this device; No device case assigned | Retain prior clean-install/build/test evidence and rerun relevant checks for the exact integration candidate; this is not a phone test. |
| [ ] R14 | Validated Node/npm toolchain | Code changes recorded | Not exercised on this device; No device case assigned | Retain the validated Node 24.16.0/npm 11.17.0 setup and investigate bounded peer warnings; qualify exact-candidate installation/CI. |
| [ ] J9 | System theme and contrast | Code changes recorded | Observed device failure; open; D007, D008 | Correct dark regional-label contrast later; complete remaining release-build theme and override scenarios. |
| [ ] J10 | Per-currency largest expense | Code changes recorded | Partial device coverage; D047 | Qualify the forward SQL change and real SAR/JPY/KWD ranking. A single-SAR assistant response does not close this finding. |
| [ ] J11 | API formatting | Code changes recorded | Not exercised on this device; No device case assigned | Retain prior read-only formatting evidence and recheck affected exact-candidate changes; no phone-specific acceptance applies. |
| [ ] R16 | Controlled feeMinor SQL errors | Code changes recorded | Not exercised on this device; No device case assigned | Qualify the forward migration with malformed, fractional, negative, overflow, missing and valid values in a verified database target. |
| [ ] R17 | Unknown sync-operation rejection | Reviewed / preserved | Not exercised on this device; No device case assigned | Preserve API/direct-SQL rejection and reverify it; the original restore-fallback claim remains unsupported. |
| [ ] R18 | Dedicated cursor signing key | Code changes recorded | Not exercised on this device; No device case assigned | Configure the separate server key through approved secret handling and verify tampering, rotation and explicit resync without losing queued work. |
| [ ] R19 | Execution-time authentication age | Code changes recorded | Not exercised on this device; No device case assigned | Qualify delayed queued protected operations, legacy entries and retry after re-verification on the intended API/schema. |
| [ ] R20 | Replica-aware circuit/rate semantics | Open | Not exercised on this device; No device case assigned | Verify deployed replica topology and actual provider limits before requiring shared enforcement; no speculative Redis service was added. |
| [ ] R21 | Recoverable Admin mock bootstrap | Code changes recorded | Not exercised on this device; No device case assigned | Retain prior failed-import/start/retry tests and production MSW exclusion; this is an Admin development check, not a DEV phone journey. |
| [ ] 4.1 | Arabic morphology | Code changes recorded | Partial device coverage; D036, D037 | Complete real controlled JS/native capture parity beyond the passing synthetic parser/discovery cases. |
| [ ] 4.2 | Promotional context | Code changes recorded | Partial device coverage; D036, D037 | Retest controlled real receipts/merchant near-matches in both tracking modes; synthetic merchant-preservation checks passed. |
| [ ] 4.3 | OTP/security context | Code changes recorded | Partial device coverage; D036, D037 | Retest controlled receipt/OTP capture and merchant near-matches; synthetic classification cases passed. |
| [ ] 4.4 | Encrypted SMS/voice payload storage | Reviewed / preserved | Not exercised on this device; No device case assigned | Preserve the prior verified closure and automated migration/isolation evidence; inspect encryption in the final release artifact. No replacement storage was needed. |
| [ ] 4.5 | Bills, requests and URLs | Code changes recorded | Partial device coverage; D036, D037 | Complete real controlled tracking of posted receipts versus non-posted obligations; synthetic cases passed. |
| [ ] 4.6 | Transaction versus balance/limit amounts | Code changes recorded | Partial device coverage; D036, D037 | Complete real multi-amount receipt capture/order/decimal cases; synthetic role-separation cases passed. |
| [ ] 4.7 | Merchant suffix boundaries | Code changes recorded | Partial device coverage; D036, D037 | Complete real Arabic/English merchant capture and missing-name cases; synthetic boundary cases passed. |
| [ ] 4.8.a | Pending-notification retention | Reviewed / preserved | Not exercised on this device; No device case assigned | Verify more than 200 pending entries on the actual capture/acknowledgment path without eviction. |
| [ ] 4.8.b | Parsed policy caching | Code changes recorded | Not exercised on this device; No device case assigned | Verify owner/generation/release invalidation on the actual listener path and safe missing-policy behavior. |
| [ ] 4.8.c | Queue performance and compaction | Partial | Not exercised on this device; No device case assigned | Measure processing/capacity and acknowledged-entry compaction on the phone without dropping pending entries. |
| [ ] 4.9 | Persistent escalating PIN lockout | Code changes recorded | Partial device coverage; D011, D041 | Complete owner-specific 30s/5m/30m/60m escalation, restart/expiry and successful-unlock reset. Fast existing-PIN verification is only one accepted subcase. |
| [ ] 4.10 | Botim/imo exclusions | Code changes recorded | Partial device coverage; D036, D037 | Verify real package notifications and legitimate-bank controls in both tracking modes; shared/native synthetic exclusions passed. |
| [ ] 4.11 | Release deep-link allowlist | Code changes recorded | Not exercised on this device; No device case assigned | Verify final release schemes/auth callbacks; DEV intentionally retains its development scheme. |
| [ ] 4.12 | Native financial SMS pagination | Code changes recorded | Partial device coverage; D038 | Complete controlled integration with queue failure, crashes and owner changes. Native synthetic scanning/filtering/tie traversal passed. |
| [ ] 8.1 | Currency aliases and bare dinar | Code changes recorded | Partial device coverage; D036, D037 | Verify published policy version, trustworthy account evidence and actual tracking in both modes; synthetic alias/precision/conflict cases passed. |
| [ ] 8.2.a | Billing/subscriptions | Deferred | DEFERRED — final phase; No device case assigned | Explicitly deferred to the final phase. Review intended Stripe flow against applicable Play rules/programs before selecting/enabling the real integration. |
| [ ] 8.2.b | Reports/output/schedules/history | Code changes recorded | Observed device failure; open; D016, D052 | Diagnose unavailable report reads; then verify preview, download, email, create/edit/pause schedules, conflicts, retries and delivery history. |
| [ ] 8.2.c | Support workflow | Code changes recorded | Partial device coverage; D017 | Correct raw status translation later and complete mobile-to-Admin reply/refresh/owner-isolation acceptance using authorized support messages. |
| [ ] 8.2.d | Security event retrieval | Code changes recorded | Observed device failure; open; D012 | Remove the observed live-route/menu blocks later, then test owner-only retrieval, ordering, pagination and safe metadata rendering. |
| [ ] 8.2.e | Export lifecycle | Code changes recorded | Observed device failure; open; D027, D028, D029 | Correlate hosted HTTP 500 request IDs, then verify request/status/download, expiry, contents, retries and owner-only access. |
| [ ] 8.3 | Localized amount input | Code changes recorded | Partial device coverage; D004, D032, D043 | Complete remaining voice, allocation, filter and edit-comparison UI paths and 0/2/3-decimal currency boundaries; observed budget/payoff and module cases passed. |
| [ ] 8.4 | Monthly financial cycle | Code changes recorded | Partial device coverage; D051 | Unblock report totals and establish client/server period parity, historical/calendar-preset stability and the November 3/day-25 example. |
| [ ] 8.5 | Timezone-aware civil today | Code changes recorded | Partial device coverage; D046, D051 | Verify Riyadh/Dubai midnight, month/year rollover and inclusive/exclusive conversion boundaries; normal daytime/zone propagation is insufficient. |
| [ ] 8.6.a | Salary timezone fallback | Code changes recorded | Partial device coverage; D045, D046 | Verify valid profile zone, valid device fallback, persisted server zone and explicit selection when neither is valid; normal QA salary save alone is insufficient. |
| [ ] 8.6.b | Budget timezone fallback | Code changes recorded | Not exercised on this device; No device case assigned | Independently verify the budget profile/device/no-valid-zone cases and the persisted server operation zone. |
| [ ] 8.7 | Screenshots intentionally permitted | Reviewed / preserved | Accepted scope exception; observed screenshots allowed; D020 | Preserve the approved scope exception and verify remaining screens in the release build; observed screenshots including PIN were allowed. |
| [ ] 8.8 | Production/demo entrypoint separation | Code changes recorded | Not exercised on this device; No device case assigned | Inspect the actual final release bundle for excluded fixtures/mock purchase/session paths. DEV diagnostics are intentional and not release-bundle proof. |
| [ ] 8.9 | Sync-first logout and removal | Code changes recorded | Not exercised on this device; No device case assigned | Test cancellation, offline/failed sync, unsynced financial/tracking/voice work, explicit removal and owner switching in an isolated owner context. |
| [ ] 8.10 | Truthful privacy lifecycle copy | Code changes recorded | Partial device coverage; D026 | Complete English and all lifecycle/error states, including Security Settings; observed Arabic privacy distinctions do not prove actual erasure/export completion. |

## Appendix B — Complete grouped test-case log

PASS applies only to the stated case. It does not mean that every requirement in a linked finding was met. Evidence remains local; owner screenshots are not published to the public repository.

| Case | Outcome | What was reviewed / result | Selected local evidence |
|---|---|---|---|
| D001 | PASS — bounded case | Onboarding rejected a missing currency and kept the form open. | [02-onboarding-required-currency.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/02-onboarding-required-currency.xml>), [02-onboarding-required-currency.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/02-onboarding-required-currency.png>) |
| D002 | PARTIAL | Onboarding save entered a busy state and reached Home; interrupted-save and duplicate-server-write acceptance remained incomplete. | [04-onboarding-currency-selected.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/04-onboarding-currency-selected.xml>), [05-first-save-result.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/05-first-save-result.xml>) |
| D003 | PASS — bounded case | Typing 50 in a new account displayed 50, without a leading zero. | [10-account-form-initial.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/10-account-form-initial.xml>), [11-account-amount-50.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/11-account-amount-50.xml>) |
| D004 | PASS — bounded case | Appending a decimal produced 50.25 SAR in the opening-balance field. | [12-account-amount-decimal.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/12-account-amount-decimal.xml>) |
| D005 | PASS — bounded case | The QA cash account saved with opening balance 50.25 SAR and did not replace the original default account. | [14-account-save-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/14-account-save-settled.xml>), [14-account-save-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/14-account-save-settled.png>) |
| D006 | PASS — bounded case | An online cold restart retained the authenticated owner, completed profile and QA account. | [16-online-restart-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/16-online-restart-settled.xml>), [16-online-restart-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/16-online-restart-settled.png>) |
| D007 | PASS — bounded case | System theme changes switched the application between light and dark. | [18-app-settings.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/18-app-settings.png>), [19-system-dark.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/19-system-dark.png>) |
| D008 | FAIL | Regional-setting labels had insufficient contrast on the dark background. | [19-system-dark.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/19-system-dark.png>), [21-app-dark-override.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/21-app-dark-override.png>) |
| D009 | PASS — bounded case | An explicit Dark override survived an online cold restart while the OS was light; System mode was subsequently restored. | [21-app-dark-override.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/21-app-dark-override.png>), [23-dark-preference-restored.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/23-dark-preference-restored.xml>) |
| D010 | PASS — bounded case | Arabic/RTL and English/LTR switching worked in the observed settings screens. | [25-english-settings.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/25-english-settings.png>), [27-arabic-restored.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/27-arabic-restored.png>) |
| D011 | PASS — bounded case | The user created their PIN and an unlock succeeded; this did not validate lockout escalation or performance. | [35-pin-create.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/35-pin-create.xml>), [36-pin-after-user-setup.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/36-pin-after-user-setup.png>) |
| D012 | FAIL | Security Events was unavailable in live DEV; the route was blocked before live event retrieval. | [141-security-events-direct-confirmed.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/141-security-events-direct-confirmed.png>) |
| D013 | FAIL | The normal More menu did not expose Security Settings. | [17-more-menu.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/17-more-menu.png>), [30-more-bottom.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/30-more-bottom.png>) |
| D014 | PASS — bounded case | The QA expense of 20 SAR was posted, synchronized and displayed once. The earlier apparent double-tap was intercepted by the DEV overlay and is not duplicate-submission evidence. | [46-test-expense-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/46-test-expense-ready.xml>), [51-test-expense-saved.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/51-test-expense-saved.xml>) |
| D015 | FAIL | Opening the eligible expense used the edit route and did not expose the refund action located on the separate details screen. | [52-expense-refund-action.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/52-expense-refund-action.png>), [53-expense-actions-lower.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/53-expense-actions-lower.png>) |
| D016 | FAIL | The live financial report remained unavailable after retry; charts and preview could not be accepted. | [56-reports-live.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/56-reports-live.png>), [57-reports-retry.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/57-reports-retry.png>) |
| D017 | PASS — bounded case | The support subject and body survived leaving and reopening the draft. | [62-support-draft-filled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/62-support-draft-filled.xml>), [64-support-draft-return.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/64-support-draft-return.png>) |
| D018 | PASS — bounded case | Cached balances, categories and the transaction list remained readable in a warm offline session. | [67-offline-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/67-offline-settled.xml>), [73-offline-categories-actual.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/73-offline-categories-actual.png>) |
| D019 | INCONCLUSIVE | The first offline edit attempt was interrupted during loading and was inconclusive; later attempts are recorded separately. | [77-offline-edit-open.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/77-offline-edit-open.xml>), [78-offline-edit-21-ready.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/78-offline-edit-21-ready.png>) |
| D020 | PASS — bounded case | Screenshots worked in the observed screens, including PIN/unlock, without exposing the PIN. | [36-pin-after-user-setup.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/36-pin-after-user-setup.png>), [51-test-expense-saved.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/51-test-expense-saved.png>) |
| D021 | PASS — bounded case | One explicitly authorized QA support submission opened the returned ticket and displayed its text; no administrator reply was tested. | [87-approved-ticket-before-send.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/87-approved-ticket-before-send.png>), [88-approved-ticket-send-result.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/88-approved-ticket-send-result.xml>) |
| D022 | FAIL | The support status displayed the raw translation key support.ticket.status.waiting_support. | [89-support-send-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/89-support-send-settled.xml>), [89-support-send-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/89-support-send-settled.png>) |
| D023 | PASS — bounded case | The prominent SMS disclosure appeared before any system READ_SMS permission request. | [93-tracking-initial.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/93-tracking-initial.xml>), [94-sms-disclosure-before-permission.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/94-sms-disclosure-before-permission.png>) |
| D024 | PASS — bounded case | Choosing Not now left SMS and notification tracking disabled and READ_SMS ungranted; no historical inbox import ran. | [95-sms-consent-cancelled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/95-sms-consent-cancelled.xml>), [95-sms-consent-cancelled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/95-sms-consent-cancelled.png>) |
| D025 | FAIL | The cross-year period chip visually clipped the ending year at the original width and font size, despite a complete accessibility label. | [107-crossyear-period-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/107-crossyear-period-ready.xml>), [108-crossyear-period-chip.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/108-crossyear-period-chip.xml>) |
| D026 | PASS — bounded case | Arabic privacy copy distinguished export, local removal and account-deletion requests; no deletion was submitted. | [109-privacy-live.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/109-privacy-live.png>) |
| D027 | PASS — bounded case | An export received RECENT_AUTH_REQUIRED and opened real Clerk re-verification. The user entered the OTP privately. | [111-export-settled-stepup.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/111-export-settled-stepup.png>) |
| D028 | PARTIAL | The export replay progressed beyond the recent-auth rejection but then returned HTTP 500; successful operation completion was not established. | [112-export-after-user-verification.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/112-export-after-user-verification.png>) |
| D029 | FAIL | The export and one retry both returned INTERNAL_ERROR/HTTP 500; no successful export or download was verified. | [112-export-after-user-verification.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/112-export-after-user-verification.png>), [113-export-retry-response.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/113-export-retry-response.xml>) |
| D030 | PASS — bounded case | Budget submission with no name displayed an error and focused the name field. | [114-budget-form.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/114-budget-form.xml>), [115-budget-empty-validation.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/115-budget-empty-validation.png>) |
| D031 | PASS — bounded case | Budget submission with no spending cap displayed an error and focused the amount field. | [116-budget-name-filled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/116-budget-name-filled.xml>), [117-budget-limit-required.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/117-budget-limit-required.png>) |
| D032 | PASS — bounded case | Arabic numeric input 100.50, using Arabic digits and decimal separator in the actual Android field, saved as 100.50 SAR. | [120-native-arabic-budget-value.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/120-native-arabic-budget-value.png>), [124-budget-draft-reopened.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/124-budget-draft-reopened.xml>) |
| D033 | PASS — bounded case | The QA October budget was created and displayed with cap/remaining amount 100.50 SAR and a localized Arabic month heading. | [126-budget-arabic-actual-save.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/126-budget-arabic-actual-save.xml>), [127-budget-arabic-save-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/127-budget-arabic-save-settled.xml>) |
| D034 | PASS — bounded case | A three-decimal SAR amount entered with Arabic digits was rejected and the amount field received focus. | [131-invalid-sar-precision.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/131-invalid-sar-precision.xml>), [132-invalid-sar-precision-rejected.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/132-invalid-sar-precision-rejected.png>) |
| D035 | FAIL | An invalid budget month triggered HTTP 400, hid the editable form and returned through the persisted invalid draft. | [134-invalid-budget-period-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/134-invalid-budget-period-ready.xml>), [137-budget-edit-for-period.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/137-budget-edit-for-period.xml>) |
| D036 | PASS — bounded case | The installed shared parser passed 36 synthetic regression checks on the phone's Hermes runtime; no inbox, queue or server mutation was used. | [runtime-parser-probes.js](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/runtime-parser-probes.js>), [parser-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/parser-device-probes.json>) |
| D037 | PASS — bounded case | Production Kotlin policy loaded from the installed APK passed 38 synthetic discovery/exclusion/control checks on Android ART; positive controls were test fixtures, not verified bank registrations. | [NativePolicyProbe.java](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/NativePolicyProbe.java>), [native-policy-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/native-policy-device-probes.json>) |
| D038 | PASS — bounded case | The installed native SMS page scanner passed six synthetic cursor/filter/timestamp-tie checks, including traversal beyond a filtered-empty page. | [NativePolicyProbe.java](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/NativePolicyProbe.java>), [native-policy-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/native-policy-device-probes.json>) |
| D039 | PASS — bounded case | Ten production amount-normalization/wire-boundary probes passed on the phone for Arabic/Persian input and JPY/SAR/KWD boundaries. | [runtime-amount-probes.js](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/runtime-amount-probes.js>), [amount-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/amount-device-probes.json>) |
| D040 | PARTIAL | The Android microphone prompt was denied and no recording started; immediate relocking prevented full verification of the post-denial recovery UI. | [143-voice-microphone-permission.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/143-voice-microphone-permission.png>), [144-voice-permission-denied.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/144-voice-permission-denied.png>) |
| D041 | PASS — bounded case | After the previously authorized PIN correction and DEV update, the unchanged owner PIN verified in 641.88 ms and the lock became unlocked with zero invalid attempts. | [pin-after-update-actual-latency.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-after-update-actual-latency.json>), [pin-fix-build-receipt.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-fix-build-receipt.json>) |
| D042 | PASS — bounded case | A QA obligation of 10 SAR saved as two 5 SAR installments and appeared in list/details with Arabic dates. | [158-obligation-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/158-obligation-ready.xml>), [160-obligation-save-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/160-obligation-save-settled.png>) |
| D043 | PASS — bounded case | An actual Android payoff field accepted Arabic 5.00 and review displayed 5.00 SAR against the correct QA funding account. | [164-payoff-arabic.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/164-payoff-arabic.xml>), [167-payoff-arabic-review.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/167-payoff-arabic-review.png>) |
| D044 | PASS — bounded case | Two rapid payment confirmations followed by another confirmation after success produced one visible 5 SAR payment, 5 SAR outstanding and a single deduction to account balance 25.25 SAR. | [168-payment-double-confirm.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/168-payment-double-confirm.xml>), [169-payment-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/169-payment-settled.png>) |
| D045 | PASS — bounded case | An out-of-range salary day was rejected with an explicit 1-31 message while preserving the other fields; the value was then corrected. | [183-salary-invalid-day-result.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/183-salary-invalid-day-result.png>), [184-salary-corrected-day.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/184-salary-corrected-day.xml>) |
| D046 | PASS — bounded case | The QA salary configuration saved with expected 100.50 SAR, day 25, QA source and QA receiving account. No salary receipt or income transaction was confirmed. | [189-salary-all-fields-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/189-salary-all-fields-ready.xml>), [191-salary-valid-save-settled.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/191-salary-valid-save-settled.png>) |
| D047 | PASS — bounded case | After enabling personalization through the UI, the live assistant returned Shopping/20 SAR for the largest-expenses question; cross-currency ranking and external-model execution were not proven. | [194-assistant-open.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/194-assistant-open.png>), [196-assistant-consent-dialog.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/196-assistant-consent-dialog.xml>) |
| D048 | FAIL | The Arabic assistant response still contained raw ISO date bounds instead of localized narrative dates. | [198-assistant-response.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/198-assistant-response.png>), [200-assistant-advice-result.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/200-assistant-advice-result.png>) |
| D049 | PASS — bounded case | Both the user-message and assistant-response timestamps displayed Arabic time and the correct PM marker. | [198-assistant-response.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/198-assistant-response.png>) |
| D050 | PARTIAL | The saving-tips suggestion returned a request for more specific financial context. The sampled wording was understandable; external-provider execution and failure recovery remained unverified. | [200-assistant-advice-result.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/200-assistant-advice-result.png>) |
| D051 | PASS — bounded case | Selecting financial day 25 displayed October 25-November 24; the actual report-service input carried monthly, anchor 2026-10-25, monthStartDay 25 and Asia/Riyadh. | [204-financial-cycle-options.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/204-financial-cycle-options.xml>), [205-financial-cycle-selected.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/205-financial-cycle-selected.xml>) |
| D052 | FAIL | Report retry still failed with the client service code reports_unavailable in 263 ms; no HTTP/root-cause claim follows from that code alone. | [208-reports-cycle25-result.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/208-reports-cycle25-result.png>), [209-reports-cycle25-retry.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/209-reports-cycle25-retry.xml>) |
| D053 | PASS — bounded case | English assistant timestamps displayed English time. A live spending response returned 25 SAR, matching the QA 20 SAR expense plus 5 SAR installment payment. | [216-settings-english-settled.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/216-settings-english-settled.xml>), [220-assistant-english-response.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/220-assistant-english-response.png>) |
| D054 | FAIL | With the device explicitly set to 24-hour time, a new English assistant message still displayed PM. The device clock preference was restored afterward. | [221-assistant-english-24h.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/221-assistant-english-24h.png>), [222-assistant-new-message-24h.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/222-assistant-new-message-24h.png>) |
| D055 | PARTIAL | At font scale 1.3, the English obligation heading, amount and date did not overlap. The long QA name became extremely small in the list card, leaving readability acceptance incomplete. | [225-obligations-english-default.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/225-obligations-english-default.png>), [229-obligations-large-en.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/229-obligations-large-en.png>) |
| D056 | PASS — bounded case | With no active network, cached Home and the existing QA expense editor loaded the saved amount, category and account after dismissing the offline warning. | [240-offline-home-round2.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/240-offline-home-round2.xml>), [241-offline-expense-opening.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/241-offline-expense-opening.png>) |
| D057 | FAIL | Saving a QA note edit offline returned a generic transaction-validation message. The text remained in the field, but a durable queued-save success was not established. | [244-offline-note-ready.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/244-offline-note-ready.xml>), [245-offline-note-save.png](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/245-offline-note-save.png>) |
| D058 | INCONCLUSIVE | The final cold-offline startup attempt was interrupted before acceptance. Native activity launch took 2,308 ms, but foreground-safe capture was skipped and application-ready/unlock timing was not established. Network settings were restored. | [cold-offline-interrupted.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/cold-offline-interrupted.json>) |

## Evidence index and limits

- [session.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/session.json>)
- [round2-observations.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/round2-observations.json>)
- [pin-fix-build-receipt.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-fix-build-receipt.json>)
- [pin-after-update-actual-latency.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-after-update-actual-latency.json>)
- [pin-native-unit-results.xml](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/pin-native-unit-results.xml>)
- [parser-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/parser-device-probes.json>)
- [native-policy-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/native-policy-device-probes.json>)
- [amount-device-probes.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/amount-device-probes.json>)
- [report-cycle25-observation.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/report-cycle25-observation.json>)
- [cold-offline-interrupted.json](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/device-checklist/cold-offline-interrupted.json>)
- [Original 69-reference / 88-unit implementation trace](<D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-report-dev-build/all-report-changes-trace.json>)
- [Original closure ledger](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-24-report-closure/closure-ledger.json>)
- [Earlier read-only infrastructure/signing inspection](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-24-report-closure/production-configuration-inspection.md>)

No PIN, OTP, token, password or private signing key is included. Screenshots/logs are local evidence, not public artifacts. Native/synthetic probes, development-tool interruptions and actual user journeys are distinguished throughout. The only release conclusion is that **full report closure and Google Play readiness remain unverified; billing remains deferred**.
