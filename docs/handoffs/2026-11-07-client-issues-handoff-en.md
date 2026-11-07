# Client issue continuation handoff

Read this file completely before changing application state. Communicate with the user in Arabic and write evidence in English.

## Objective and boundaries

Continue fixing the remaining customer-reported Android problems with the smallest necessary changes. The user's latest request is to move this work into a new chat. They have not yet provided a new reproducible failure after the fixes below. Start by reading this evidence, checking current state, and asking which symptom still occurs on the customer's handset, its app version, and the approximate failure time. Do not treat the historical complaints as proof they still fail after the production changes.

Use D:/Masarifi-integration-2026-10-10 on branch codex/voice-promoted-operating-2026-10-13. Remote ratibi is https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git. Before this handoff, local HEAD and remote matched abd641d1032654298f0c94a99d8ed73ce3cea712, the dashboard branding commit. Fetch and reconcile newer peer changes before publication. The saved Codex project may initially open D:/MY Work/0Part_Time/MASREFY _Final. Explicitly use the integration repository above.

Preserve all financial records, keys, sessions, drafts, pending requests, foreign-owner data, Voice001, private evidence, documentation and UI changes. Existing authorization allows diagnosis and focused fixes. The user's original condition requires a concrete review package before a new hosted deployment or primary application update. Earlier package approvals are consumed. Avoid routine permission questions, while respecting that package review requirement for a new artifact.

Do not clear app storage, uninstall, sign out, change account identity, bypass owner validation, replay financial work, or perform real account deletion as a test. The original historical account was deleted by the user on Android125. A legitimate later identity is in use. Never recreate the deleted account to obtain proof.

## Current signed Android artifact

The physically checked app is com.masarifi.mobile, version 1.0.0, code 129, arm64-v8a, minSdk24, targetSdk36, production signer 886a58e9f93168683e858355ff3bba4ad89ee19cbdfc3babe6e490eb7f421e57.

The latest delivery filename observed during this handoff is E:/Masarifi-task30-build-artifacts-20261106/Final_2.apk. It was read and hashed successfully. SHA256 is 3f72e5041f152f4ced70950410c615211e0bb38a5215fe5021ae1c105f43cee1 and size is 50,603,786 bytes. Earlier messages, delivery pointers and historical manifests refer to Final.apk or task40-customer-129-native.apk. Those paths were absent at this check. Final_2.apk contains the same qualified bytes. The file was not renamed by this handoff.

Code129 was built from 2a26016f4d57777e61f77dae5cdaf14bc2cb346d. Later database fixes work with that APK and do not require rebuilding it. Old127/128 and duplicate129 APK cleanup was already performed at the user's request. Do not regenerate old artifacts merely to restart this chat.

Redmi serial f66a40694eca, model23076RN8DY, Android35, user0, original UID10321. ADB connected at handoff check. The earlier physical test ended on Home, with device authentication off and Hide balances off, matching their initial settings. Treat phone state as live and verify before input. Ask the user to touch the enrolled sensor when native authentication is needed. Never emulate a successful biometric result.

## Verified fixes and their limits

### Personal finance for ordinary users and dashboard identities

The original customer complaints included failed account/category/transaction creation and Assistant activation. Production logs showed13 denied first writes around09:24–09:26 Riyadh on7November. The database excluded owners who also had dashboard membership. Signup was public with no allowlist or blocklist.

Migration20261107065248 was explicitly approved and applied once. Eight functions and16owner read policies were independently verified, keeping authenticated ownership, idempotency, worker and inactive-profile checks. History174 became175. Source1f709f5, evidence8ccfb35, extended evidencefc3a850c.

Evidence docs/releases/2026-11-07-personal-finance-access.md and ops/releases/2026-11-07-personal-finance/execution-result.json.47real local API cases and29ledger/RLS assertions covered new ordinary and staff-owner paths. The same67additional cases passed for both roles across planning, reports, sync, native Assistant and tracking consent.79mobile settings/control cases and16biometric-service cases also passed. These are automated qualification, with synthetic/provider boundaries documented.

The affected customer's handset was unavailable at that time. A fresh activation and tap performance on that customer's device remain unverified. Later Redmi Assistant was already enabled and returned a read-only monthly-total answer, visible within3.547s including USB/UI capture. No fresh consent activation was performed on that existing consent.

### Biometric background return

Android127 opened the automatic prompt while still backgrounded. Android cancelled it before the user returned. The initial Android128 foreground fix passed a controlled return, but a separate stall left a successful scan on a mounted lock screen with no Retry.

Two specific regressions reproduced stale callbacks before foregrounding and permanently hidden Retry after a guarded callback returned. Android129 selects the latest committed callback at prompt start, retains the callback and identity fences for that attempt, and keeps Retry available if the screen remains. All38focused cases, type checking and scoped lint passed.

On actual Redmi129, two Home/return cycles showed zero active biometric requests in12background samples each. Foreground prompts appeared within531ms and391ms including USB overhead. A single scan returned to Security settings. An intentional Android Back cancellation exposed Retry, a fresh scan returned successfully, and original preferences were restored. User assisted with the sensor. Avoid promising universal absence of intermittent device issues from these bounded trials.

Evidence docs/releases/2026-11-07-redmi-biometric-resume.md, actual screenshots docs/releases/2026-11-07-redmi129-unlock.png and docs/releases/2026-11-07-redmi129-biometric-prompt.png, package and receipt ops/releases/2026-11-07-biometric-retry/. Device evidence committed944cd271, final delivery pointer commitf55f4275.

### Dashboard owner self-deletion

The user explicitly requested any owner, including the same dashboard login, be able to delete their own account. Migration20261107083047 was reviewed at4620733e and explicitly approved through call_ae046e62e60a4316acdd2d203ae591d6. It was applied once. Three function bodies, exact grants/owners and history were independently verified. History175 became176, original operator membership restored, API liveness200/ok. Evidence44443dfa3ab501f6abcacaa3b56c1edacaa477b4, ops/releases/2026-11-07-dashboard-owner-deletion/execution-result.json.

The verified processing request can freeze and erase a staff owner. The admin membership is revoked at freeze. Its audit foreign keys and consumed first-admin bootstrap record remain. Normal last-admin management protection remains, with a narrow exception for the frozen owner's confirmed self-erasure. The existing handler revokes provider sessions and deletes the identity.

Before activation, production had one active staff member who was the sole super-admin. The user approved the consequence that their own confirmed deletion would leave no active dashboard administrator. Applying the migration itself deleted no account, and the staff account remained active after verification. Do not appoint a successor or weaken bootstrap unless separately requested.

Sixteen integration cases passed on an isolated PostgreSQL clone, with provider calls simulated. A separate transactional sole-admin fixture covered permission revocation, wrong owner rejection, repeated freeze and real payload erasure. No production account deletion or destructive Redmi test was submitted for this upgrade. Inspect current request state before retrying any failure.

## Coordination

The user authorized coordination with the Dashboard and iOS chats. Dashboard chat01a1b326-3cd3-7460-a9be-c244b11d9fae was preparing an approved branding deployment on staging port3041 with rollback3040, scoped to Admin assets/layout. Its source commitabd641d1 is already at HEAD. The hosted deployment outcome was not established by this handoff. Before touching shared server access, publishing shared files or claiming its rollout complete, send that chat a concise status request and coordinate.

iOS was explicitly paused. Do not resume its work or request fresh tests. Keep its changes intact.

## Access and private evidence

Private evidence directory W is D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-11-04-production-apk-readiness. Existing credentials and operator helpers remain private. Never print or commit secrets. Do not rerun consumed task37/38/39/40/41 build, installation, SQL dispatch, question or deletion scripts.

Production project qcffvfbpzvpwcwxwjyro. Hosted reads were available through the Supabase connector. The approved deletion migration used the existing verified operator configuration via direct PostgreSQL TLS verify-full. W/task41-production.py and task41-production-dispatch.json are consumed receipts, not restart commands. Operator cert metadata and the encrypted recovery material are preserved. No firewall rule was opened for that execution. SSH root/password remain disabled. Coordinate any shared server access with the Dashboard chat, and follow the historical access section if a new bounded connection is genuinely needed.

Local PostgreSQL18 cluster under .superpowers/sdd/2026-10-23-admin-dashboard-recovery/native-db/data, loopback55442, was stopped after qualification. Disposable qa41_dashboard_deletion and prior qa38 databases were retained. Avoid restarting local services without an input change requiring them.

Historical long handoff docs/handoffs/2026-11-05-production-core-handoff-en.md contains access, build and earlier receipts. Its top is129, but older sections and some cross-links are historical. Prefer the focused receipts above for current status.

Preserve three inherited modified files docs/performance/2026-11-02/measured-performance-bottlenecks.md, measured-performance-coverage.json, measured-performance-task-ledger.md, and all unrelated untracked/private material. Publish only owned fixes and proof on the same ratibi branch after verification.

## Deferred work

The user explicitly postponed Google Play in-app updates until preparing the Play release. Bring it back at that phase. Do not implement it during this customer-issue continuation. No scheduled reminder was created. Paid billing is disabled and remains outside this scope. Avoid benchmark, broad optimization, model comparisons and unrelated release work.

## First useful action

Read this handoff and the focused evidence, inspect current branch and peer status, then obtain the customer's current symptom/version/time. Use the actual available device and existing logs for that report. Treat automated proof, Redmi proof and a different customer's phone as separate evidence. Fix the smallest demonstrated cause, preserve requests and data, run only affected checks, and obtain concrete package approval before changing hosted services or the primary APK.
