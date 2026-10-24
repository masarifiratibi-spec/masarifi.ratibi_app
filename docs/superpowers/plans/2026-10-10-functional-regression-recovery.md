# Masarifi Functional Regression Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover every verified missing approved Voice, Manual, Home and Assistant behavior while retaining newer Tracking, security and accounting safeguards.

**Architecture:** Compare original committed, dirty and ignored evidence against the integrated implementation before changing production code. Separate source recovery from deployment configuration and physical acceptance. Restore only demonstrated gaps with the smallest compatible regression-tested change.

**Tech Stack:** React Native/Expo/Hermes, TypeScript/Jest, NestJS workers, PostgreSQL/Supabase/PGMQ, Android ADB, GitHub Actions.

**Spec:** `C:/Users/DELL/.codex/attachments/3c9ac4cf-dd11-4a17-9c89-236b2c946558/Pasted text.txt`.

## Global Constraints

- Do not modify the original Voice worktree.
- Do not merge into main.
- Do not redesign the UI.
- Do not globally enable financial posting without explicit approval.
- Do not change running Staging services without approval.
- Do not reinstall or clear Redmi data without checking the effect on retained Voice sessions and obtaining approval.
- Device actions target only Redmi `f66a40694eca`; Production and Samsung remain untouched.
- Physical acceptance order: Manual Add, Voice extraction, controlled Voice automatic saving, Home presentation, Assistant, confirmation notification, cross-feature checks.
- Every financial test requires a recorded baseline and explicit approval; one intended transaction must have exactly one ledger effect.
- Existing Savings, source validation, ownership, limits, idempotency and financial validation remain intact.

## Review Focus

- Original dirty or ignored files can contain valid work absent from branch history: compare contents and retain an explicit disposition.
- A stopped financial worker and analysis-only policy can resemble missing saving code: record live images and policies independently of source.
- Pending financial confirmations must keep their operation identity during legacy recovery; never replay unconfirmed audio.
- An empty provider batch can resemble successful extraction: retain that distinction and never count it as financial acceptance.
- New financial records and UI refresh must agree with authoritative owner/account/ledger evidence; fixture tests alone cannot establish device PASS.

## Task 1: Establish source and preservation evidence

**Files:** Existing `Voice-Source-Disposition.json`, `Ignored-Voice-All-Source-Disposition.json`, backup verification receipts and new evidence under `E:/Masarifi-redmi-acceptance-2026-10-10/regression/`.

- [x] Recheck the Voice archive against its verified SHA256 and compare all original dirty source hashes with the frozen inventory.
- [x] Resolve exact Voice, Tracking, integrated, recovery, deployed and APK revisions; retain the current source diff and identity evidence.
- [x] Build the feature matrix with file/function/commit/test citations, distinguishing missing implementation, regression, deployment, configuration, data setup, safety restriction and unverified behavior.

## Task 2: Verify the legacy recovery correction already implemented

**Files:** `apps/mobile/src/services/live/voice-api-service.ts`, `apps/mobile/src/services/live/voice-api-service.test.ts`.

**Interface:** `recoverPending(retryAudio?: boolean)` returns no legacy proposal for unconfirmed audio in automatic batch mode, preserving the existing journal; frozen confirmations retain recovery with their original keys.

- [x] Reproduce unwanted replay/polling/cancellation for legacy awaiting/uploaded/processing and terminal/no-session cases.
- [x] Implement guards in commits `e959f97` and `9470a7c`, preserving financial confirmation handling.
- [x] Pass 43 focused tests, 478 mobile suites / 2,933 tests, typecheck and changed-file lint.
- [x] Verify standalone APK signature, Staging origin, installed bytes, data-directory identities and signed-in recovery.
- [ ] Finish exact-commit CI and retain its actual results; do not substitute canceled or pending jobs for passes.

## Task 3: Compare and restore the feature domains

**Files under review:** Home Today Activity, TransactionCard/presentation, TransactionForm/manual draft/amount/date helpers, Assistant conversation/query/live transport, Voice batch/worker/repository/migrations, Tracking/native capture and financial boundaries.

- [x] Complete independent read-only Home/Manual, Assistant and Tracking comparisons; root reviews Voice and runtime evidence.
- [ ] For each confirmed source regression, append a bounded task with the exact last-correct implementation, failing behavioral test, target file/function and minimal correction before editing it.
- [ ] Run that red/green test and relevant cross-feature tests, review its security/accounting effect, and commit only the verified correction.
- [x] When implementations are already present, record that finding and its remaining runtime/device gate instead of replacing the files.

### Confirmed narrow repair: Home custom category labels

This is an inherited defect, not a lost integration change. Original dirty and nested Home omit the category argument although `projectTransaction` already supports localized category names. The bounded follow-up was assigned after the audit recorded this exact cause.

**Files:** `apps/mobile/src/features/home/HomeSummary.tsx`, `apps/mobile/src/features/transactions/TransactionCard.tsx`, `apps/mobile/src/features/home/HomeScreen.test.tsx`.

- [x] Add real Home rendering regressions for Arabic/English and expense/income custom labels; observe four expected missing-label failures.
- [x] Pass the matching existing Category through ActivitySection to TransactionCard; reuse `projectTransaction.categoryName` and preserve static fallback.
- [x] Verify 57 Home/card tests, typecheck, targeted ESLint and diff check; both StyleSheet blocks remain unchanged.
- [x] Complete independent final review of both legacy Voice commits and this Home diff; no actionable introduced defect found.
- [ ] Finish full mobile suite, commit the bounded repair and verify exact-commit CI/artifact. The initial npm-wrapper run failed before tests with a Node allocation error; retain it and run Jest directly in one process.

Local verification completed: direct serial Jest exit0, 478 suites /2,937 tests passed in262.066 seconds. Repair commit `d39d3816e8611a3c5a74ac7f6a6f1c4851fd55ca` contains only the three Home/card files. Exact final candidate CI/artifact remains a separate gate.

## Task 4: Runtime alignment and physical acceptance packets

**Files:** Current pinned runtime/financial receipts, `latest-fresh-voice-analysis.json`, APK verification and install receipts; new acceptance packet/report in the evidence directory.

- [x] Recheck current API/Analysis/Assistant images, stopped financial/general workers, migrations, provider policy and posting kill switches read-only.
- [ ] Verify Manual form rendering, owner account/category choices and invalid-input handling without submitting financial data.
- [ ] Prepare concrete Manual income/expense approval scope and rollback/compensation policy; no financial execution before approval.
- [x] Preserve both fresh Voice results separately: the six-second 10-SAR valid analysis and the later empty twenty-second batch. Do not replay either recording.
- [ ] Prepare a fresh-session-only automatic Voice acceptance mechanism whose owner/account/amount/currency, maximum effects and expiry are enforced. Keep global SMS/Notification posting disabled. Obtain approval only after implementation, disposable tests and exact deployment changes are reviewable.
- [ ] Execute approved physical steps in the user's requested order, compare ledger/balances/UI after each, and keep remaining features OPEN until device and Staging evidence agree.

## Task 5: Deliver the evidence-backed readiness report

- [ ] Produce the original/current/deployed/APK/acceptance matrix with every difference classified.
- [ ] Record included fixes, exact commits, test results, APK identity, runtime restrictions, remaining blockers and proposed main PR; no merge.
- [ ] Report client readiness separately from Production readiness, and retain incomplete or failed acceptance explicitly.

The user has explicitly authorized autonomous implementation and verification. Plan review is not an additional approval gate; deployment, financial writes and consequential device actions retain the user's required approval boundaries.

## Execution rulings and evidence

- Preserve all evidence/workspaces even where a generic skill suggests cleanup; the user's explicit preservation requirement controls.
- Existing Manual draft (50 SAR expense, Test, no category, description/note) is preserved. Read-only picker inspection is allowed; changing/discarding/submitting this draft needs an exact acceptance scope.
- Existing automatic canary cannot satisfy global-OFF one-shot10SAR acceptance: it enables global posting, fixes two25SAR captures and stops analysis. Do not reinterpret v2 explicit confirmation as automatic acceptance or change old canary pins. The feasibility report defines the unresolved scoped authorization boundary; no new financial bypass is implemented or deployed.
- Fresh reviewer declined overall release readiness, future full-suite/artifact results, physical financial outcomes, runtime drift, complete historical disposition closure, Assistant native/provider risks and a not-yet-implemented scoped posting capability. All remain explicit OPEN gates; none is waived by code review.
- Evidence root: `E:/Masarifi-redmi-acceptance-2026-10-10/regression/`. Reports: `Functional-Recovery-Matrix-2026-10-11.md`, `home-manual-original-current-audit.md`, `assistant-original-current-audit.md`, `tracking-preservation-regression-audit.md`, `voice-scoped-financial-test-feasibility.md`, `recovery-candidate-final-review.md`.
