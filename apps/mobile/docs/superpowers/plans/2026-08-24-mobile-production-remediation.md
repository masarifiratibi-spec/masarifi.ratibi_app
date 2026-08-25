# Masarifi Mobile Production Remediation Implementation Plan

> Execute test-first in order. Keep diffs narrow and preserve `new_Desinge/final_visual_mockups`.

**Goal:** Resolve confirmed release, security, data-integrity, navigation, voice, RTL, and quality defects while making absent production integrations fail closed.

**Architecture:** Reuse the existing route gate, repositories, service contracts, preference store, canonical transaction projection, and query invalidation. Add no speculative service layer or multi-user architecture.

---

## Phase 1 — Security containment

### Task 1: Deny protected routes at one root boundary

**Files:** `app/_layout.tsx`, `src/features/shell/ProtectedRouteGate.tsx`, corresponding route tests.

1. Add failing tests for signed-out, expired, locked, and temporarily locked direct routes plus public/onboarding exemptions.
2. Make the root gate classify explicit public routes and protect every other route.
3. Pass current lock state into `AppPrivacyGate`.
4. Remove redundant nested gates only if tests prove they are unnecessary; otherwise leave them.
5. Run the shell, route, deep-link, and notification test groups.

### Task 2: Close alternate notification and recovery paths

**Files:** `src/features/shell/ProtectedRouteGate.tsx`, `app/security/pin/forgot.tsx`, auth service selection, tests.

1. Test that notification actions require exactly `unlocked`.
2. Test that non-demo PIN recovery cannot trust mock reauthentication.
3. Fix the shared predicate and fail closed in recovery.
4. Run security, notification-response, and auth journey tests.

### Task 3: Harden native privacy boundaries

**Files:** `app.json`, `android/app/src/main/AndroidManifest.xml`, tracking onboarding/service tests, voice recorder/hook tests.

1. Test stop/release/delete behavior when recording stop or file cleanup throws.
2. Repair recorder cleanup ownership and hook state finalization.
3. Remove `READ_SMS` and make unavailable tracking UI truthful without changing layout.
4. Disable Android backup.
5. Run voice, tracking, config, and manifest checks.

## Phase 2 — Persistence and money integrity

### Task 4: Replace schema stamping with ordered migrations

**Files:** `src/storage/database.ts`, database migration tests.

1. Build representative old-schema test databases for supported historical versions.
2. Add ordered idempotent migrations using SQLite-native operations and schema inspection only where required.
3. Record each version only after success and verify rollback/retry.
4. Run all storage/repository tests.

### Task 5: Define one complete user-data reset

**Files:** `src/storage/local-data-reset.ts`, app-shell storage/state, persistence repositories, reset/sign-out tests.

1. Seed every user-derived table and covered key-value store in a failing reset test.
2. Delete child-to-parent in one exclusive transaction and reset external/in-memory state.
3. Reuse the reset on sign-out for the current single-user product.
4. Verify idempotency, rollback, and post-reset hydration.

### Task 6: Enforce canonical transaction invariants

**Files:** `src/domain/core-finance.ts`, `src/storage/core-finance-repository.ts`, core finance tests.

1. Add failing tests for deleted default lists and currency/account mismatch mutations.
2. Exclude deleted records unless explicitly requested.
3. Validate transaction currency equals the source account currency and reject unsupported cross-currency transfers.
4. Run transaction-effect, repository, Home, and transaction journey tests.

### Task 7: Remove fixture dates and ledgers from planning

**Files:** `src/services/mocks/financial-planning-service.ts`, planning contracts/factories as needed, planning tests.

1. Add injected-clock/live-ledger regression tests for salary, budgets, obligations, early settlement, matching, and goals.
2. Replace frozen dates and fixture lookups with injected dependencies.
3. Calculate settlement from actual outstanding balances and reject invalid zero/negative outcomes.
4. Run all planning, salary, obligation, budget, and savings tests.

### Task 8: Unify base currency and reporting completeness

**Files:** Home hooks/screen, core finance rate service, reports service/domain, account form, tests.

1. Test preference-driven Home currency, report conversion parity, unavailable-rate metadata, and account defaults.
2. Use the stored base currency and one rate snapshot in Home and Reports.
3. Surface incomplete totals instead of silent omission.
4. Default new accounts from base currency, not language.

### Task 9: Correct financial-period boundaries

**Files:** `src/domain/financial-period.ts`, `src/domain/cycle-start.ts`, tests.

1. Add half-/quarter-hour timezone and current-cycle preview regressions.
2. Include minute/second parts in timezone conversion.
3. Reuse canonical current-cycle logic for settings preview.

## Phase 3 — Production/demo and state isolation

### Task 10: Remove production fixture imports

**Files:** assistant, reports, rates, planning, tracking service factories and tests.

1. Add a boundary check forbidding `test-utils` imports from production modules.
2. Move fixture construction into test/demo factories.
3. Make absent production capabilities return typed unavailable results.
4. Preserve explicit demo mode and its visual data.

### Task 11: Persist or disable mutable product state honestly

**Files:** settings/profile, assistant/subscription/support service selection, repositories, tests.

1. Test restart behavior for supported local preferences/profile fields.
2. Persist supported state through existing repositories/preferences.
3. Disable backend-owned mutations that cannot be durable instead of acknowledging them falsely.

## Phase 4 — UI-preserving cleanup

### Task 12: Guard drafts across every back path

**Files:** transaction/category/session hooks and route tests.

1. Add hardware/gesture-back tests for dirty forms and selection sessions.
2. Reuse the existing draft/discard contract through navigation prevention.
3. Ensure completed, discarded, and unmounted sessions are cleaned once.

### Task 13: Correct RTL and dead fields

**Files:** `src/components/MenuLink.tsx`, More/assistant rows, Account form, existing UI tests.

1. Replace stale RTL expectations with approved mirrored order.
2. Apply direction-aware row order without changing spacing or hierarchy.
3. Remove the unsaved credit-card due-day control until the model supports it.

### Task 14: Repair quality noise and stale expectations

**Files:** the two failing tests, asynchronous screen tests, route modal safe-area component, lint import sites where production-relevant.

1. Update only obsolete fixture/copy expectations.
2. Await asynchronous state changes to remove React act warnings.
3. Replace deprecated SafeAreaView with the already-installed safe-area component.
4. Convert remaining production CommonJS imports where lazy loading is not required.

## Phase 5 — Completion verification

1. Run every targeted test group changed above.
2. Run `jest --runInBand`, `npm run typecheck`, `npm run lint`, `npm run check:frontend-quality`, and `npm run check:frontend-quality-gates`.
3. Run `git diff --check` and review the final diff with clean-code and test guards.
4. Compare representative Arabic/English screens with approved mockups; verify safe areas, keyboard, long text, small screens, and tablet behavior.
5. If Android is connected, exercise auth/lock, transaction CRUD, planning, reports, voice permission/cancel/error, tracking unavailable state, RTL/LTR, background privacy, deep links, and notifications. Record any unavailable iOS/device/study evidence as an explicit remaining blocker.
6. Produce the requested 14-part completion report with exact commands, results, modified files, remaining external dependencies, and release recommendation.
