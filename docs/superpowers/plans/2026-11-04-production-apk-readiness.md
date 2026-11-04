# Production APK Readiness Implementation Plan

> For agentic workers: use superpowers:executing-plans, sequential native implementation, with one fresh whole-change review at the end. The user approved implementation on 4 November 2026.

**Goal:** Qualify a data-preserving Android production customer APK and concrete server rollout package.

**Architecture:** Owner-scoped durable Tracking admission and queues, explicit production device consent, additive server compatibility, qualified signing continuity, exact-artifact/device acceptance.

**Tech Stack:** Existing Expo/React Native/Clerk, Kotlin/WorkManager, NestJS, PostgreSQL/Supabase, existing signing infrastructure and Node/npm lockfile toolchain.

**Spec:** `docs/superpowers/specs/2026-11-04-production-apk-readiness-design.md` and the user's approved Arabic plan.

## Global constraints

Same workspace/branch; preserve all existing data/keys/sessions/pending work/UI/dirty documents/Metro/reverses. No clear/uninstall/sign-out/identity bypass. No closed comparisons or Voice001 replay. APK first, existing data/Clerk continuity, billing/payment/subscription/iOS deferred. Hosted activation and actual signing transition remain concrete proof/review gates, not implicit actions. Preserve all private evidence; do not upload it or delete this plan's evidence workspace after review.

## Review focus

- Foreign and unattributed legacy data must remain byte-identical when a fresh owner works or cleans up.
- Crash between native preparation and JS/native commit must never enable intake or duplicate migration.
- Stale owner/generation/consent work must not read, acknowledge or mutate the current namespace.
- Production capture must not inherit DEV cohort enrollment or depend on development automation.
- Signing/rollout rollback must preserve newer durable formats and pending operations.

## Task 1: Native owner-scoped durable admission and storage

**Files:** new focused native owner-transition implementation and JUnit tests in the existing masarifi-sms-inbox module; integrate native runtime/store/queue/module contracts.

**Interfaces:** prepare/commit/reconcile native owner context using ownerDigest+generation; explicit owner/generation leases for native queue/configuration/cleanup. Existing legacy methods remain compatible and cannot mutate preserved v2 data after v3 admission. New queue/presentation/preference namespaces must be separate from all v2 records.

- [x] Write and observe RED real-preference tests for foreign preservation, prepare/commit interruption, same-owner continuity, stale commit/ack/configure/cleanup and ciphertext isolation.
- [x] Implement native transition/store integration; prepare always suspends, commit only acknowledges exact durable prepared generation. No foreign queue/key reads or clears.
- [x] Run all module native unit tests; inspect every result. Qualified75/75; TypeScript and bridge ESLint exit0. Native source checkpoint only; Task2 and actual-device acceptance remain pending.

## Task 2: JS owner contexts, consent and lifecycle integration

**Files:** Tracking runtime/admission/source preferences, queue migration, owner lifecycle and UI; focused persistence integration tests.

**Interfaces:** JS persists prepared owner/generation before exact native commit; only committed verified owner receives admission. Owner-scoped source preferences start disabled. No global legacy removal on parse/owner mismatch; cleanup targets admitted owner only.

- [ ] RED restoration through real state with native/storage boundaries: foreign current login gets independent namespace; interruption reconciles; stale owner/logout/consent work rejects; foreign legacy bytes survive load/clear/logout.
- [ ] Implement and connect Task 1 protocol, fenced headless/capture/read/ack/cleanup and explicit available/current-owner UI.
- [ ] Run affected integration suites, mobile typecheck/lint/boundaries and required full mobile suite. Record accepted limitations separately; commit qualified code.

## Task 3: Production installation consent and capture contract

**Files:** Tracking controller/service/repository/DTO/OpenAPI and additive migration/SQL tests; mobile ordinary Tracking service and consent flow.

**Interfaces:** `PUT /api/v1/tracking/installations/:deviceId` expectedVersion+explicit sources/boundaries+registered device; principal-only owner; response version and existing SmsRuleSnapshot. Same transaction validates server mode/preferences and session-bound Android device. No GET enrollment, no DEV enablement.

- [ ] RED contract/real SQL cases for authorized registration, conflicts/retries, foreign/revoked/session-mismatched device, disabled/paused preference, consent revoke/re-enable and stale submission/worker lease.
- [ ] Implement additive production consent records and shared capture policy admission while preserving DEV data/behavior. Generate migration through pinned discovered CLI; preserve historical SQL.
- [ ] Wire mobile consent mutations to explicit enrollment; ordinary reads stay reads. Run affected API/mobile/SQL/OpenAPI/security checks and required complete suites. Commit qualified source without hosted migration dispatch.

## Task 4: Current-app acceptance and specific defect closure

- [ ] Reconcile existing crosswalks against current evidence without repeating accepted unchanged work or reviving cancelled comparisons.
- [ ] Test safe current-account reads and named reversible QA writes across core finance/planning/reports/export/notifications/support/settings/security/assistant/voice, preserving original records and avoiding deferred financial/provider actions.
- [ ] Reconcile Voice001 read-only; do not replay. Each reproduced new defect gets RED→GREEN regression, minimal fix and applicable phone proof. Keep unverified capabilities explicitly open.
- [ ] Maintain an English acceptance ledger; accepted exceptions/deferred scope never count as passes. Commit only specific supported repairs.

## Task 5: Hosted compatibility, recovery and rollout package

- [ ] Reconcile exact current schema/history/route/worker state; reuse completed isolated helper proof, extend only missing current-restore/compatibility/rollback evidence.
- [ ] Qualify additive forward corrections and history provenance separately, with owner/RLS/lease/grant preservation, under pinned PostgreSQL/Supabase tooling. Do not invoke blanket hosted migration/history repair.
- [ ] Prepare verified off-host backup/restore and exact image/config/worker/DNS/TLS/privacy/deletion/legacy-write restriction package with bounded rollback and consumer admission. Keep serving workloads intact.
- [ ] Prepare approved exact existing Clerk instance binding and production configuration, preserving sessions; do not change Clerk domain. Hosted execution waits for final concrete approval.

## Task 6: Signing continuity and customer artifacts

- [ ] Qualify existing signers and counters privately; no key creation/export to Git or primary transition.
- [ ] RED-capable synthetic installed-data fixture, API33+ bridge→production-only API24+ final APK, signing history and SecureStore/SQLCipher/pending preservation. Prepare higher-version compatible rollback.
- [ ] Verify API24–32 fresh install support; do not claim legacy upgrades from Redmi-only proof. Keep exact existing identity/flags/release-safety/native/16KB checks.
- [ ] Record concrete transition evidence for review before changing primary signer. Version default1.0.0 with unused increasing counters.

## Task 7: Final candidate, review, actual Redmi acceptance and delivery

- [ ] Exact-source full qualification and fresh independent review; Important/Critical findings get one RED→GREEN fix pass and green suites. Retain evidence.
- [ ] With concrete transition/hosted approvals satisfied, perform guarded in-place primary update and production rollout; reconcile uncertain outcomes before retry.
- [ ] Actual Redmi feature matrix and full Tracking capture→parser→queue→HTTP→worker→Ledger→confirmation, dedup/offline/restart/permission/pause cases. Current Google session preserved; fresh OAuth on independent clean authorized target.
- [ ] Verify no temporary observer/Benchmark/read-only contamination and unchanged protected data identities. No production readiness with material failing/unverified core paths.
- [ ] Update delivered APK/identity and sanitized English reports; prove final installed/delivery/source equality, push same branch, verify remote. No merge/main/store automatically. Report remaining uncertainty truthfully in Arabic.
