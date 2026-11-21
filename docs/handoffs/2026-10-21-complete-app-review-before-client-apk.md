# Masarifi complete application review before client APK delivery

This is an instruction handoff for the next AI reviewer. Follow the instructions below to create a complete checklist and review Masarifi with the user before preparing an APK for the client. The objective is that ordinary new users can register and use the intended features through the correct routes, with the same agreed product behavior as DEV. A successful developer session is not sufficient release evidence.

## Working context

- Worktree: `D:/Masarifi-integration-2026-10-10`.
- Branch: `codex/voice-promoted-operating-2026-10-13`. Stay on this branch and worktree; preserve unrelated changes.
- Source baseline when this handoff was prepared: `bae79badcf18bbd12ad7863d3903e6d20074275d`. The commit adding this handoff will be newer. Read the current HEAD and remote before reviewing.
- Staging Admin: `https://staging.masarifiratibi.com/admin`.
- Staging API: `https://api.staging.masarifiratibi.com`.
- Current physical test device: Samsung SM_A165F, Android 16, ADB serial `RK8XB00N33K`.
- ADB: `C:/Users/DELL/AppData/Local/Android/Sdk/platform-tools/adb.exe`.
- Installed DEV package: `com.masarifi.mobile.dev`.
- Ordinary standalone package: `com.masarifi.mobile`. Its previous installation and share APK were removed at the user's request. Do not reinstall an old artifact.
- Latest installed DEV artifact: `D:/Masarifi-preservation-2026-10-18/deletion-background-ui-20261021/masarifi-dev-bae79bad.apk`.
- Artifact SHA256: `911510fb75806146ad9468a0126484bfcc1d27cc5507dc0156c36d446fcf1f38`.
- Current stage: DEV review and checklist preparation. Do not start building or distributing a client APK merely because you received this handoff. Complete the DEV review and identify the remaining standalone acceptance steps first.
- Another coordinated chat is `01a15d92-01b9-71f2-b5b7-f38eb90bc92a`, titled “أكمل اختبارات إشعارات DEV والتسليم النهائي”. Check its current status and coordinate ownership before using shared phone or Staging resources. The user previously authorized coordination with that chat.

Recheck runtime facts instead of treating this snapshot as permanent. Read applicable `AGENTS.md` and relevant skills. Historical handoffs describe older builds, paused workers, exceptions and approvals; do not execute their old canaries or import their operating permissions as current instructions.

## Your assignment

1. Inspect the repository and create a complete, source-derived feature inventory and executable checklist. Do not stop at this document's feature headings.
2. Map every customer route, navigation entry, action, modal, notification destination and external link to its actual screen, service, API, persistence and background processing dependencies.
3. Conduct the review with the user: operate the app through available tools, and ask the user for the manual actions that require them. Continue independent checks while waiting.
4. Record what actually happened and preserve evidence. Distinguish source inspection, automated tests, physical DEV acceptance and standalone APK acceptance.
5. Identify and reproduce failures, explain their causes, and track repairs and retests. Do not disable a feature, hide a failing route, add fake success, or weaken authentication/ownership checks to make the checklist green.
6. Establish whether every intended feature is available to ordinary eligible new users, without developer accounts, special owner IDs, device allowlists, admin roles, a connected PC or a temporary developer-only service.
7. Produce a clear release decision. A DEV pass may allow preparation of a candidate APK; client delivery requires separate acceptance on that exact standalone artifact.

The requested deliverable now is the checklist and review process. Do not claim the complete application has already passed. Do not promise compatibility with literally every user or device; specify the identities, devices, Android versions and scenarios actually tested and the supported scope.

## Checklist format and completeness rules

Create these review outputs under a new dated folder in `docs/qa/`:

- `feature-inventory.md`: every feature, action and entry point, with source references and availability rules.
- `route-matrix.md`: each route and inbound/outbound navigation path, including guard, parameters, owner checks and back behavior.
- `acceptance-checklist.md`: individual executable test cases and results.
- `dev-apk-parity.md`: build/runtime differences, intended behavior and acceptance evidence for both variants.
- `defects.md`: reproduction, severity, suspected/confirmed cause, affected source, repair commit and retest result.
- `client-release-decision.md`: current gate, blockers, known limitations and remaining human/provider checks.

Use stable case IDs. Each test case needs:

| Field | Required content |
| --- | --- |
| ID and feature | A unique case and concrete action being tested |
| Entry and route | Starting screen, taps, exact destination and route parameters |
| Preconditions | User type, account/currency, permissions, network and data state |
| Steps | Reproducible numbered actions; include the user's manual step where needed |
| Expected behavior | Visible outcome plus expected persisted/financial effect |
| Observed behavior | The actual result, not a copy of the expectation |
| Environment | Commit, DEV or standalone APK, package, device and backend release |
| Evidence | Test result, private screenshot/log/receipt reference and timestamp |
| Status | `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE` with reason |
| Defect or follow-up | Issue ID, repair/retest reference, or specific missing dependency |

Keep separate result fields for automated checks, physical DEV and physical standalone APK. A mocked service, code inspection or passing DEV case does not mark the standalone column PASS. A provider or feature being disabled does not count as a successful feature test. Explain exclusions and obtain agreement on genuine delivery exclusions; never silently remove them from coverage.

Reconcile the inventory against the route appendix, `apps/mobile/src/features`, service contracts, native modules, API controllers, migrations, worker entry points and relevant Admin screens. Discover actions that do not have their own route files. Every source route must be covered, classified as a layout/redirect/intent handler, or explicitly excluded with a reason. Check role-restricted and development-only routes without exposing them to customers.

## Required feature coverage

Expand each group below into individual positive, failure, retry and navigation cases where applicable. Do not combine a whole feature into a single PASS row.

### Registration, onboarding and startup

- Fresh installation, first launch, language selection, Google account selection, genuine first-time registration, returning-user login, cancellation, unavailable network and session restoration.
- A genuinely unused Google identity must create a new normal profile. Inspect owner-scoped evidence instead of assuming that choosing a different-looking account proves new registration.
- Name and currency selection, required-field validation, default account creation exactly once, interrupted setup, cold reopen and routing after completion.
- No notification/reminder activation control on Welcome, Google authentication or the name/currency screen. Notification activation belongs inside the authenticated app.
- One coherent initial loading flow, correct brand assets, no duplicated startup loader, no stale-data/loading debug paragraph on Home, and appropriate actionable errors when services are unavailable.
- Logout, account switching and session expiry must not reveal the prior owner's profile, balances, cached transactions, pending recordings or notification destinations.

### Home, accounts and currencies

- Home totals, balance visibility, Today feed, refresh, account scope selector and links to the correct details.
- Account list, creation, details, edits, supported account types, opening balance, credit behavior, archive/delete behavior and validation as implemented.
- EGP and SAR accounts must retain their own correct currency in Home, transaction list/details, forms, balances, reports, assistant context and notifications.
- All-account aggregation must have an explicit currency policy. Do not silently label mixed-currency totals as SAR or invent exchange conversion.
- Switching accounts must update displayed data and future capture context without moving existing transactions.

### Manual transactions and categories

- Expense, income and supported transfer flows; amounts, dates, notes, account and category selection; create, read, edit, delete and cancel.
- Expense-to-income correction and the reverse: compatible category selection, correct signs, balance adjustment, summary refresh, stable transaction identity and no duplicate ledger effects.
- Transfers must debit/credit the correct owned accounts under the implemented currency rules; unsupported cases must be rejected clearly.
- Search, filters, date/account/category/source scopes, pagination, empty states, conflicts and returning from details/edit screens.
- Category groups, create/edit/archive or deletion behavior, applicable income/expense constraints and propagation to pickers and existing records.

### Voice recording and automatic posting

- Record from Home, Add and any other real entry point. Test microphone consent/denial, start/stop/cancel, interruptions, foreground/background, upload failure and retry.
- Recording must capture the selected account context when it starts. With the EGP wallet selected, omitted spoken account/currency must use that wallet; repeat with a non-default SAR card and another ordinary user.
- Switch account during an in-flight recording or upload and verify the operation preserves its original account/owner. A replacement user must not inherit or submit the old user's recording.
- Follow the full chain: recording file, upload, authenticated session/batch, provider result, event validation, worker, posting receipt, transaction, balance and visible result.
- Verify actual financial posting, not merely recognized text or a completed analysis response. Check single events and supported multi-event batches, amount, kind, category, account, currency and exactly-once effects after retry/reopen.
- Test Arabic and English, ambiguous/missing details, unsupported actions and provider/quota failures according to the current product contract. Do not make unsupported voice transfers pass by guessing a destination.
- Inspect current owner/cohort admission, feature flags, worker/epoch health, provider credentials and quotas. A special DEV-owner exception or a short-lived operating setup is a client release blocker unless replaced by the approved normal-user path.
- Use fresh, agreed synthetic recordings and a cleanup ledger. Do not replay historical audio or drain historical queues to create apparent success.

### Automatic tracking and bank messages

- Tracking education/setup, SMS permission, Android notification access, source selection, supported senders, keywords, enable/pause/resume and persisted configuration.
- Direct users to the correct Android settings screen and reflect grant, denial, permanent denial and revocation accurately after returning.
- Supported SMS and notification ingestion in foreground/background and after restart; distinguish OS limitations such as force-stop from ordinary background behavior.
- Correct merchant, amount, transaction type, currency, timestamp and owned account resolution; explicitly test multiple accounts, EGP/SAR, missing/ambiguous account information and changed defaults.
- Deduplication across SMS and notifications, history, review queue, low-confidence cases, duplicate resolution, refunds, undo/matching and failure recovery as implemented.
- No posting after tracking is paused, permission is revoked or owner changes. No cross-owner device journal, queue or financial data reuse.
- Confirm service availability for an ordinary new user and a device without the developer's setup. Source fixtures alone do not prove real OS capture.

### Notifications and reminders

- In-app notification center: list, unread counts, read/delete actions, categories, empty state and synchronization.
- Activation inside Application Settings and the existing tracking/notification flows; OS permission state, denial/settings recovery and preference persistence.
- Relevant notification categories, quiet hours, daily/weekly summaries, privacy/hide-amount settings and localization.
- Actual opt-in delivery in foreground, background and cold-start scenarios where supported, including fresh device/token registration and ordinary-user eligibility.
- Tap every implemented notification target and supported action: Home, account, transaction, tracking/review, budget, obligation, salary, savings goal, report, assistant, security, settings and onboarding.
- Test expired actions, missing/deleted resources, malformed/foreign IDs, logged-out taps and owner switching. Opening a notification must not create duplicate postings or route to another user's content.

### Personal assistant

- Entry points, first conversation, history, reopen, new conversation and implemented rename/delete actions.
- Real Arabic/English provider-backed replies, selected-account/currency/time-period context, reports and insights, consent, quota, timeout, error and retry behavior.
- Correct preview/action/detail routes and confirmation requirements for any implemented action. No financial side effect from an informational answer or repeated polling.
- Ordinary new users must reach the normal assistant service without developer roles, inherited consent from another owner, test-only tokens or temporary exceptions.
- Validate the result and persisted conversation as well as the UI; a successful HTTP response with empty or incorrect content is not sufficient.

### Planning, reporting and other customer features

- Budgets: list, creation, edits, allocations, transaction drill-down, period boundaries, spending updates, threshold behavior and supported deletion/archive.
- Salary: cycle/profile setup, dates/month-start rules, receipt details, allocations and the implemented links to budgets, obligations and balances.
- Obligations: create/edit/details, payment, matching, schedule/status changes, reminders and financial effects.
- Savings: create/edit/details, target/progress, deposits/withdrawals or movements, balance effects and validation.
- Reports: entry, filters, account/currency/period selection, totals/charts, preview, drill-down, scheduling and supported export/share behavior. Validate numbers against owned ledger data.
- Profile and settings: name/avatar/phone where supported, language/RTL, theme, regional currency/calendar/month start, sensitive-value visibility, accessibility and persistence after reopen.
- Security: app lock, PIN create/change/forgot, biometrics where implemented, unlock routing, sessions/devices, security events and sign-out behavior.
- Support: help content, contact routes, ticket creation/list/details, replies/attachments if implemented, and correct return navigation.
- Subscription/plan/checkout/manage screens: inventory their actual availability. Current runtime declares `billingAvailable: false`; investigate the intended delivery scope and verify an honest unavailable state. Do not label real checkout/payment as working without an enabled provider and fresh evidence.
- Branding: current logo in launcher/adaptive icon, startup/loading, login, app surfaces and the notification icon where platform rendering requires a distinct asset.
- Social links: independent Admin fields for Instagram, TikTok and Snapchat; save, clear, validation, external opening, conditional icon visibility, current smaller size/spacing near Delete Account, refresh and cold reopen.

### Account deletion and privacy

- One irreversible confirmation, immediate deletion according to the user's requested policy, no cooling/review detour, correct server receipt, local cleanup and sign-out.
- During execution, only the opaque progress surface should be visible. No deletion-status paragraph, description, refresh action or page content should show behind it.
- Preserve honest failure/retry behavior; never claim completed deletion before the server confirms it. Test network loss, interrupted cleanup, reopen and recovery with controlled fixtures.
- Verify personal fields, accounts, transactions, planning records, voice data, assistant conversations, tracking/device state and provider identity against the actual deletion contract. Separate any legally/operationally retained anonymized audit records from active personal data.
- Re-registration after deletion must create a clean profile and must not restore the deleted owner's local/server data.
- Use a disposable test identity for destructive acceptance. The user's personal account is not a disposable fixture. A new actual deletion requires their deliberate confirmation in the app.

### Admin, API, database and operations

- Inventory all Admin pages in the appendix, their roles, actions and effect on mobile. Review customer-impacting settings, social links, content/categories, notification templates, sender/parser rules, support, flags, plans and privacy requests end to end.
- Map API requests to the actual Staging ingress route, deployed release, controller/service, database function/table and required worker/provider. A single healthy base URL is not proof that all routed services are the same version.
- Check authentication, ownership/RLS, cross-owner IDs, migrations, API contract compatibility, idempotency, synchronization/conflict behavior and dependent summary/cache refreshes.
- Verify required worker queues, leases/heartbeats, schedules, callbacks/webhooks, push registration and provider availability for the candidate cohort. Detect stale temporary routes, owner restrictions and missing rollout dependencies.
- Exercise background/restart, network loss/restoration, retry, timezone/date boundaries, empty/new accounts, realistic account counts and invalid input across features.

## DEV and standalone APK parity audit

Build a side-by-side table from the actual configuration and deployed services. Inspect at least `apps/mobile/eas.json`, `app.config.js`, `app.json`, `scripts/staging-development.mjs`, `scripts/check-client-runtime.mjs`, `src/config/client-runtime.ts`, `src/config/mobile-automation.ts`, Firebase configuration and Android native modules.

Check API/Clerk environment, Google OAuth callback/scheme, package/application ID, signing certificate registrations, Firebase client/push configuration, embedded flags, permissions, native background services, voice automatic posting, account deletion, tracking, notifications, assistant, app lock and live-versus-fixture service selection. Inspect the generated/embedded configuration, not just the shell environment used before building. Do not put secrets or raw credential values in reports.

Specific known differences require explicit resolution:

1. **Deletion:** `devPrivacyDeletionApiUrl()` currently selects the immediate `/dev-account-deletion` path only for the DEV variant. Ordinary clients can follow `OwnedAccountDeletionPanel` and a different server policy. The recent zero-cooling fix was deployed to the DEV deletion ingress only. The requested immediate-delete behavior is therefore a critical standalone parity check, not an already-proven APK feature. Do not simply relabel a normal client as DEV to bypass this distinction.
2. **App lock:** the DEV launcher disables it, while the current `staging-client` profile enables it. Review onboarding/unlock/PIN paths and decide whether the difference is intentional before acceptance.
3. **Automation:** `staging-client` explicitly enables `EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED` and voice automatic posting. Verify these values survive into the bundle, and that normal package/owner paths still reach the correct services.
4. **Authentication and push:** DEV and ordinary packages need their own valid identity, callback, certificate and Firebase registrations. DEV success does not establish normal-package success.
5. **Billing:** current runtime reports billing unavailable. An unavailable payment capability must remain visible in the readiness decision rather than being silently counted as passed.

The future standalone candidate must work with Metro stopped, USB disconnected, no ADB reverse, no developer menu, no local proxy and no developer authentication or account allowlist. Test on ordinary Wi-Fi/mobile internet, with a genuinely new user and preferably an independent second Android device. New users may still need normal OS permissions, network access, valid identity and legitimate plan/quota entitlements; those requirements must be explained and tested rather than bypassed.

## Review sequence and gates

1. **Inventory:** produce all feature and route rows with NOT RUN status, dependencies and priority. Show the user a short testing order and the manual actions needed.
2. **Environment check:** verify branch/commit, installed package/artifact, deployed API/worker releases, migrations, provider readiness and the current ordinary-user restrictions. Do not change Production.
3. **DEV acceptance:** test registration/onboarding, accounts/manual finance, voice, tracking, notifications, assistant and planning/reporting, then remaining settings/Admin integrations. Retest fixed defects and retain exact evidence.
4. **User eligibility:** use at least two independent normal identities, including a genuinely new identity. Compare account/device/token/config initialization and test owner isolation. A single developer-owned session is insufficient.
5. **DEV gate:** list all unresolved cases and parity differences. Do not mark NOT RUN/BLOCKED cases as PASS. Recommend whether a standalone candidate may be prepared and state what it must prove.
6. **Standalone gate, when the user asks for the build:** produce an artifact from the reviewed source with a verified package, signature, SHA256, embedded config and Staging backend. Install it safely and repeat the entire customer-critical matrix on that exact artifact, including fresh registration, voice posting, SMS/notification tracking, assistant, notifications, deletion and offline/restart behavior. Do not substitute an installed DEV build for this step.
7. **Client delivery:** give a short tester guide, artifact identity/install instructions, tested scope, expected permissions, agreed limitations and remaining blockers. Client acceptance is READY only after the agreed critical cases pass on the standalone build and no blocking failure remains.

Read each application's current package scripts and use appropriate automated checks, relevant integration tests and native checks. Database resets/seed fixtures belong in isolated disposable local databases; never reset the shared Staging database to run tests. Historical passing counts and screenshots are leads, not fresh acceptance of a new artifact.

Ask the user to perform Google account choice, credentials/PIN/biometric steps, actual microphone recording, required OS permission decisions and agreed real-device message tests themselves. Never request passwords or OTPs in chat. Coordinate phone use and check the foreground/call state before operating it. Do not clear/uninstall DEV or change actual customer records to simplify a test.

Keep screenshots, audio, tokens, real user identifiers and financial payloads out of Git. Commit sanitized checklist/results and agreed fixes to the same branch, then verify remote HEAD and working-tree status. This handoff itself authorizes no Production deployment, external messages, financial backlog replay, unrestricted worker activation or client distribution.

## Recent evidence and remaining physical checks

- `docs/qa/account-voice-transaction-correction-2026-10-21.md`: manual expense/income correction, selected EGP/SAR voice results, worker/API evidence and its actual scope.
- `docs/qa/dev-immediate-deletion-existing-request-2026-10-21.md`: inherited cooling-period defect, DEV ingress repair, completed existing request and clean re-registration. It is not evidence that the ordinary APK deletion path now matches DEV.
- `1e9f48c5`: removed reminder/notification activation controls from Google authentication, first-launch screen and profile setup; kept the authenticated in-app control.
- `bae79bad`: removed the deletion panel's underlying content while progress is visible and made the progress modal opaque. Three deletion suites / 47 tests, typecheck, scoped lint and the DEV build passed; the APK was installed with `adb install -r`.
- The user completed Google login. The latest physical observation was the DEV name/currency screen with name, currency picker and Continue only; notification activation was absent. Welcome/authentication had also been checked without that control.
- The newest deletion-progress appearance has automated evidence but has not yet been exercised through a fresh destructive physical deletion. Keep that case NOT RUN until a disposable identity or the user's deliberate in-app confirmation permits it.
- Last observed onboarding had not selected a currency or completed setup. Do not assume the signed-in profile already has accounts or that a full new-user journey has passed.
- Private local evidence roots: `D:/Masarifi-preservation-2026-10-18/voice-account-edit-20261021/`, `dev-immediate-delete-20261021/`, `notification-entry-ui-20261021/` and `deletion-background-ui-20261021/` under that same preservation directory. Do not copy their private contents into public review outputs.

## Route source inventory

The appendix below is generated from tracked source files at the handoff baseline. It is an inventory to expand, not an acceptance result. Expo route groups are filesystem organization rather than literal URL segments. Resolve effective paths, redirects, parameters and guards from code. Layout files are listed separately. `+native-intent.tsx` is an inbound-link handler, not a customer screen.

### Mobile route and intent files

Tracked entries: 98. Expand each into its navigation and feature cases.

- `apps/mobile/app/(onboarding)/android-sms-permission.tsx`
- `apps/mobile/app/(onboarding)/complete.tsx`
- `apps/mobile/app/(onboarding)/ios-automation.tsx`
- `apps/mobile/app/(onboarding)/ios-capture-options.tsx`
- `apps/mobile/app/(onboarding)/profile-setup.tsx`
- `apps/mobile/app/(onboarding)/tracking-demo.tsx`
- `apps/mobile/app/(onboarding)/tracking-intro.tsx`
- `apps/mobile/app/(onboarding)/tracking-keywords.tsx`
- `apps/mobile/app/(onboarding)/tracking-preferences.tsx`
- `apps/mobile/app/(public)/auth-pending.tsx`
- `apps/mobile/app/(public)/legal.tsx`
- `apps/mobile/app/(public)/welcome.tsx`
- `apps/mobile/app/(tabs)/add.tsx`
- `apps/mobile/app/(tabs)/home.tsx`
- `apps/mobile/app/(tabs)/more.tsx`
- `apps/mobile/app/(tabs)/reports.tsx`
- `apps/mobile/app/(tabs)/transactions.tsx`
- `apps/mobile/app/+native-intent.tsx`
- `apps/mobile/app/accounts/[id]/edit.tsx`
- `apps/mobile/app/accounts/[id]/index.tsx`
- `apps/mobile/app/accounts/index.tsx`
- `apps/mobile/app/accounts/new.tsx`
- `apps/mobile/app/assistant/[conversationId]/actions/[previewId].tsx`
- `apps/mobile/app/assistant/[conversationId]/index.tsx`
- `apps/mobile/app/assistant/index.tsx`
- `apps/mobile/app/budgets/allocation/[budgetId].tsx`
- `apps/mobile/app/budgets/edit/[budgetId].tsx`
- `apps/mobile/app/budgets/index.tsx`
- `apps/mobile/app/budgets/new.tsx`
- `apps/mobile/app/budgets/transactions/[budgetId].tsx`
- `apps/mobile/app/categories/[id].tsx`
- `apps/mobile/app/categories/index.tsx`
- `apps/mobile/app/categories/new.tsx`
- `apps/mobile/app/category-picker.tsx`
- `apps/mobile/app/design-system/index.tsx`
- `apps/mobile/app/foundation/accessibility.tsx`
- `apps/mobile/app/foundation/capture.tsx`
- `apps/mobile/app/foundation/notifications.tsx`
- `apps/mobile/app/foundation/position.tsx`
- `apps/mobile/app/foundation/scenarios.tsx`
- `apps/mobile/app/foundation/trust.tsx`
- `apps/mobile/app/index.tsx`
- `apps/mobile/app/modal/planning-conflict.tsx`
- `apps/mobile/app/modals/account-picker.tsx`
- `apps/mobile/app/modals/sync-conflict.tsx`
- `apps/mobile/app/modals/transaction-filters.tsx`
- `apps/mobile/app/notifications/index.tsx`
- `apps/mobile/app/notifications/preferences.tsx`
- `apps/mobile/app/obligations/[obligationId].tsx`
- `apps/mobile/app/obligations/[obligationId]/edit.tsx`
- `apps/mobile/app/obligations/[obligationId]/match.tsx`
- `apps/mobile/app/obligations/[obligationId]/payment.tsx`
- `apps/mobile/app/obligations/index.tsx`
- `apps/mobile/app/obligations/new.tsx`
- `apps/mobile/app/profile/application.tsx`
- `apps/mobile/app/profile/index.tsx`
- `apps/mobile/app/profile/phone.tsx`
- `apps/mobile/app/profile/privacy.tsx`
- `apps/mobile/app/reports/drill-down.tsx`
- `apps/mobile/app/reports/preview.tsx`
- `apps/mobile/app/reports/schedule.tsx`
- `apps/mobile/app/salary/index.tsx`
- `apps/mobile/app/salary/profile.tsx`
- `apps/mobile/app/salary/receipt/[receiptId].tsx`
- `apps/mobile/app/savings/[goalId].tsx`
- `apps/mobile/app/savings/[goalId]/edit.tsx`
- `apps/mobile/app/savings/[goalId]/movement.tsx`
- `apps/mobile/app/savings/index.tsx`
- `apps/mobile/app/savings/new.tsx`
- `apps/mobile/app/security/events.tsx`
- `apps/mobile/app/security/pin/change.tsx`
- `apps/mobile/app/security/pin/create.tsx`
- `apps/mobile/app/security/pin/forgot.tsx`
- `apps/mobile/app/security/sessions.tsx`
- `apps/mobile/app/security/settings.tsx`
- `apps/mobile/app/security/unlock.tsx`
- `apps/mobile/app/settings/application.tsx`
- `apps/mobile/app/settings/currency.tsx`
- `apps/mobile/app/settings/month-start.tsx`
- `apps/mobile/app/subscriptions/checkout.tsx`
- `apps/mobile/app/subscriptions/index.tsx`
- `apps/mobile/app/subscriptions/manage.tsx`
- `apps/mobile/app/support/index.tsx`
- `apps/mobile/app/support/new.tsx`
- `apps/mobile/app/support/tickets/[id].tsx`
- `apps/mobile/app/support/tickets/index.tsx`
- `apps/mobile/app/tracking/demo.tsx`
- `apps/mobile/app/tracking/duplicates/[id].tsx`
- `apps/mobile/app/tracking/history.tsx`
- `apps/mobile/app/tracking/index.tsx`
- `apps/mobile/app/tracking/keywords.tsx`
- `apps/mobile/app/tracking/permission.tsx`
- `apps/mobile/app/tracking/review/[id].tsx`
- `apps/mobile/app/tracking/review/index.tsx`
- `apps/mobile/app/tracking/senders.tsx`
- `apps/mobile/app/transactions/[id].tsx`
- `apps/mobile/app/transactions/[id]/edit.tsx`
- `apps/mobile/app/transactions/conflicts/[id].tsx`

### Mobile layout and guard files

Tracked entries: 16. Inspect protection, loading, redirect and navigation behavior.

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(onboarding)/_layout.tsx`
- `apps/mobile/app/(public)/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/accounts/_layout.tsx`
- `apps/mobile/app/assistant/_layout.tsx`
- `apps/mobile/app/categories/_layout.tsx`
- `apps/mobile/app/design-system/_layout.tsx`
- `apps/mobile/app/foundation/_layout.tsx`
- `apps/mobile/app/notifications/_layout.tsx`
- `apps/mobile/app/profile/_layout.tsx`
- `apps/mobile/app/reports/_layout.tsx`
- `apps/mobile/app/security/_layout.tsx`
- `apps/mobile/app/subscriptions/_layout.tsx`
- `apps/mobile/app/support/_layout.tsx`
- `apps/mobile/app/tracking/_layout.tsx`

### Admin page files

Tracked entries: 105. Expand customer-impacting behavior and role-specific acceptance without making Admin routes public.

- `apps/admin-web/src/app/admin/access-requests/[requestId]/page.tsx`
- `apps/admin-web/src/app/admin/access-requests/[requestId]/workspace/page.tsx`
- `apps/admin-web/src/app/admin/access-requests/page.tsx`
- `apps/admin-web/src/app/admin/admin-team/[adminId]/page.tsx`
- `apps/admin-web/src/app/admin/admin-team/invite/page.tsx`
- `apps/admin-web/src/app/admin/admin-team/page.tsx`
- `apps/admin-web/src/app/admin/ai/failures/page.tsx`
- `apps/admin-web/src/app/admin/ai/models/page.tsx`
- `apps/admin-web/src/app/admin/ai/page.tsx`
- `apps/admin-web/src/app/admin/ai/prompts/[promptId]/page.tsx`
- `apps/admin-web/src/app/admin/ai/prompts/page.tsx`
- `apps/admin-web/src/app/admin/ai/providers/[providerId]/page.tsx`
- `apps/admin-web/src/app/admin/ai/providers/page.tsx`
- `apps/admin-web/src/app/admin/ai/reports/page.tsx`
- `apps/admin-web/src/app/admin/ai/safety-rules/page.tsx`
- `apps/admin-web/src/app/admin/ai/usage/page.tsx`
- `apps/admin-web/src/app/admin/audit/[eventId]/page.tsx`
- `apps/admin-web/src/app/admin/audit/page.tsx`
- `apps/admin-web/src/app/admin/content/announcements/page.tsx`
- `apps/admin-web/src/app/admin/content/categories/[categoryId]/page.tsx`
- `apps/admin-web/src/app/admin/content/categories/page.tsx`
- `apps/admin-web/src/app/admin/content/email-templates/page.tsx`
- `apps/admin-web/src/app/admin/content/faqs/page.tsx`
- `apps/admin-web/src/app/admin/content/help-center/page.tsx`
- `apps/admin-web/src/app/admin/content/onboarding/page.tsx`
- `apps/admin-web/src/app/admin/content/push-templates/page.tsx`
- `apps/admin-web/src/app/admin/content/tips/page.tsx`
- `apps/admin-web/src/app/admin/data-requests/deletions/[requestId]/page.tsx`
- `apps/admin-web/src/app/admin/data-requests/deletions/page.tsx`
- `apps/admin-web/src/app/admin/data-requests/exports/[requestId]/page.tsx`
- `apps/admin-web/src/app/admin/data-requests/exports/page.tsx`
- `apps/admin-web/src/app/admin/data-requests/retention/page.tsx`
- `apps/admin-web/src/app/admin/feedback/[feedbackId]/page.tsx`
- `apps/admin-web/src/app/admin/feedback/abuse/page.tsx`
- `apps/admin-web/src/app/admin/feedback/page.tsx`
- `apps/admin-web/src/app/admin/imports/duplicates/page.tsx`
- `apps/admin-web/src/app/admin/imports/failed/page.tsx`
- `apps/admin-web/src/app/admin/imports/low-confidence/page.tsx`
- `apps/admin-web/src/app/admin/imports/page.tsx`
- `apps/admin-web/src/app/admin/imports/sessions/[importId]/page.tsx`
- `apps/admin-web/src/app/admin/imports/sessions/page.tsx`
- `apps/admin-web/src/app/admin/imports/unsupported/page.tsx`
- `apps/admin-web/src/app/admin/jobs/queues/page.tsx`
- `apps/admin-web/src/app/admin/jobs/runs/[jobRunId]/page.tsx`
- `apps/admin-web/src/app/admin/jobs/runs/page.tsx`
- `apps/admin-web/src/app/admin/jobs/scheduled/page.tsx`
- `apps/admin-web/src/app/admin/notifications/campaigns/[campaignId]/page.tsx`
- `apps/admin-web/src/app/admin/notifications/campaigns/new/page.tsx`
- `apps/admin-web/src/app/admin/notifications/campaigns/page.tsx`
- `apps/admin-web/src/app/admin/notifications/delivery-logs/page.tsx`
- `apps/admin-web/src/app/admin/notifications/page.tsx`
- `apps/admin-web/src/app/admin/notifications/transactional/page.tsx`
- `apps/admin-web/src/app/admin/page.tsx`
- `apps/admin-web/src/app/admin/parsers/banks/[bankId]/page.tsx`
- `apps/admin-web/src/app/admin/parsers/banks/page.tsx`
- `apps/admin-web/src/app/admin/parsers/category-rules/page.tsx`
- `apps/admin-web/src/app/admin/parsers/merchant-rules/page.tsx`
- `apps/admin-web/src/app/admin/parsers/rules/[ruleId]/page.tsx`
- `apps/admin-web/src/app/admin/parsers/rules/page.tsx`
- `apps/admin-web/src/app/admin/parsers/senders/page.tsx`
- `apps/admin-web/src/app/admin/parsers/test-cases/page.tsx`
- `apps/admin-web/src/app/admin/parsers/versions/page.tsx`
- `apps/admin-web/src/app/admin/payments/events/[eventId]/page.tsx`
- `apps/admin-web/src/app/admin/payments/failed/page.tsx`
- `apps/admin-web/src/app/admin/payments/page.tsx`
- `apps/admin-web/src/app/admin/payments/reconciliation/page.tsx`
- `apps/admin-web/src/app/admin/roles/[roleId]/edit/page.tsx`
- `apps/admin-web/src/app/admin/roles/[roleId]/page.tsx`
- `apps/admin-web/src/app/admin/roles/new/page.tsx`
- `apps/admin-web/src/app/admin/roles/page.tsx`
- `apps/admin-web/src/app/admin/roles/permissions/page.tsx`
- `apps/admin-web/src/app/admin/security/admins/page.tsx`
- `apps/admin-web/src/app/admin/security/authentication-events/page.tsx`
- `apps/admin-web/src/app/admin/security/incidents/[incidentId]/page.tsx`
- `apps/admin-web/src/app/admin/security/page.tsx`
- `apps/admin-web/src/app/admin/security/permission-changes/page.tsx`
- `apps/admin-web/src/app/admin/security/support-access/page.tsx`
- `apps/admin-web/src/app/admin/security/suspicious-activity/page.tsx`
- `apps/admin-web/src/app/admin/settings/ai/page.tsx`
- `apps/admin-web/src/app/admin/settings/feature-flags/page.tsx`
- `apps/admin-web/src/app/admin/settings/imports/page.tsx`
- `apps/admin-web/src/app/admin/settings/maintenance/page.tsx`
- `apps/admin-web/src/app/admin/settings/mobile/page.tsx`
- `apps/admin-web/src/app/admin/settings/page.tsx`
- `apps/admin-web/src/app/admin/settings/security/page.tsx`
- `apps/admin-web/src/app/admin/settings/subscriptions/page.tsx`
- `apps/admin-web/src/app/admin/social-media/page.tsx`
- `apps/admin-web/src/app/admin/subscriptions/[subscriptionId]/page.tsx`
- `apps/admin-web/src/app/admin/subscriptions/page.tsx`
- `apps/admin-web/src/app/admin/subscriptions/plans/page.tsx`
- `apps/admin-web/src/app/admin/subscriptions/promotional-codes/page.tsx`
- `apps/admin-web/src/app/admin/support/categories/page.tsx`
- `apps/admin-web/src/app/admin/support/page.tsx`
- `apps/admin-web/src/app/admin/support/tickets/[ticketId]/page.tsx`
- `apps/admin-web/src/app/admin/support/tickets/page.tsx`
- `apps/admin-web/src/app/admin/system-health/ai-usage-limits/page.tsx`
- `apps/admin-web/src/app/admin/system-health/api/page.tsx`
- `apps/admin-web/src/app/admin/system-health/database/page.tsx`
- `apps/admin-web/src/app/admin/system-health/page.tsx`
- `apps/admin-web/src/app/admin/system-health/providers/page.tsx`
- `apps/admin-web/src/app/admin/system-health/storage/page.tsx`
- `apps/admin-web/src/app/admin/users/[userId]/page.tsx`
- `apps/admin-web/src/app/admin/users/page.tsx`
- `apps/admin-web/src/app/invitations/accept/page.tsx`
- `apps/admin-web/src/app/page.tsx`
