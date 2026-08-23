# Client Demo Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Masarifi directly on Home with visible balances and a complete, persistent client-demo dataset while keeping the existing login routes and UI unchanged.

**Architecture:** One `EXPO_PUBLIC_DEMO_MODE` switch owns both the local authenticated shell and the SQLite demo seed. Existing repositories remain the source of truth. Demo records use stable IDs and are inserted once behind a database marker; existing user records are never deleted or overwritten.

**Tech Stack:** Expo Router, React Native, TypeScript, Zustand, expo-sqlite, Jest.

**Spec:** `docs/superpowers/specs/2026-08-23-client-demo-mode-design.md`

## Global Constraints

- Work only in `.worktrees/r01-shared-ui-foundation`.
- Preserve every approved screen, style, color, layout, and route name.
- Keep login/onboarding files; demo mode only bypasses their entry routing.
- Do not import `mocks` or `test-utils` from production seed code.
- Seed once, additively, in one transaction; rollback the marker with the data on failure.
- Reports, analytics, and assistant context must derive from the shared finance/planning repositories.

---

## Task 1: One demo-mode switch

**Files:**
- Create: `apps/mobile/src/config/demo-mode.ts`
- Create: `apps/mobile/src/config/demo-mode.test.ts`
- Modify: `apps/mobile/src/services/mocks/core-finance-service.ts`

- [ ] Write a failing test proving only the exact value `1` enables demo mode.
- [ ] Add `isDemoModeEnabled(value = process.env.EXPO_PUBLIC_DEMO_MODE)` and use it in the production core-finance factory instead of `EXPO_PUBLIC_DEMO_DATA`.
- [ ] Run `npm test -- --runInBand src/config/demo-mode.test.ts src/services/mocks/core-finance-service.test.ts`.
- [ ] Commit: `feat: add client demo mode switch`.

## Task 2: Bypass authentication without deleting routes

**Files:**
- Create: `apps/mobile/src/domain/demo-session.ts`
- Modify: `apps/mobile/src/state/app-shell.ts`
- Modify: `apps/mobile/src/features/shell/resolve-entry-route.test.ts`
- Modify: `apps/mobile/src/state/app-shell.test.ts`

- [ ] Add failing tests proving demo hydration yields an authenticated, non-expiring local session, completed onboarding, unlocked privacy state, and Home entry.
- [ ] Add small pure builders for the demo session and completed onboarding using existing domain types.
- [ ] In `hydrate`, preserve stored non-auth preferences but replace session/onboarding only while demo mode is enabled; persist those two values so refresh and restart remain stable.
- [ ] Keep `app/(public)` and onboarding route files untouched.
- [ ] Run `npm test -- --runInBand src/state/app-shell.test.ts src/features/shell/resolve-entry-route.test.ts src/features/shell/AuthRoutes.test.tsx`.
- [ ] Commit: `feat: open client demo on home`.

## Task 3: Add the idempotent database marker

**Files:**
- Modify: `apps/mobile/src/storage/database.ts`
- Modify: `apps/mobile/src/storage/database.test.ts`

- [ ] Add a failing migration test for schema version 8 and table `demo_seed_markers(id, applied_at)`.
- [ ] Add the table to the existing migration transaction and bump `CURRENT_SCHEMA_VERSION` from 7 to 8.
- [ ] Run `npm test -- --runInBand src/storage/database.test.ts`.
- [ ] Commit: `feat: add demo seed marker migration`.

## Task 4: Build production-safe, relative demo data

**Files:**
- Modify: `apps/mobile/src/domain/core-finance-seeds.ts`
- Create: `apps/mobile/src/domain/financial-planning-seeds.ts`
- Create: `apps/mobile/src/domain/demo-data.ts`
- Create: `apps/mobile/src/domain/demo-data.test.ts`

- [ ] Write failing tests that validate all records with existing Zod schemas, use stable IDs, reference existing demo accounts/categories/transactions, and fall in the supplied financial month.
- [ ] Make core demo dates relative to an injected `now` while retaining the approved values and all transaction effect types.
- [ ] Move only the useful planning fixture shape into a production-safe builder: salary/receipt, multiple monthly budgets/category limits, obligation/schedule/payment, savings goal/movement.
- [ ] Add one tracking event/review/history record and two notification events using existing domain schemas; do not seed assistant conversations or canned responses.
- [ ] Export one `createClientDemoData(now, timeZone)` bundle.
- [ ] Run `npm test -- --runInBand src/domain/demo-data.test.ts src/domain/core-finance-seeds.test.ts`.
- [ ] Commit: `feat: build complete client demo data`.

## Task 5: Seed all SQLite domains once

**Files:**
- Create: `apps/mobile/src/storage/client-demo-seeder.ts`
- Create: `apps/mobile/src/storage/client-demo-seeder.test.ts`
- Modify: `apps/mobile/src/storage/core-finance-repository.ts`
- Modify: `apps/mobile/src/storage/financial-planning-repository.ts`

- [ ] Add failing tests for first-run insertion, second-run no-op, rollback on failure, and preservation of pre-existing rows.
- [ ] Reuse the repositories' existing row serialization/upsert helpers by exporting the minimum needed insertion functions; do not call destructive `persistAll()`.
- [ ] In one `runExclusiveDatabaseTransaction`, check `demo-seed-v1`, insert demo rows with stable IDs only when absent, then insert the marker last.
- [ ] Seed finance, planning, tracking, notifications, and notification preferences; reports/analytics/assistant remain derived.
- [ ] Run `npm test -- --runInBand src/storage/client-demo-seeder.test.ts src/storage/core-finance-repository.test.ts src/storage/financial-planning-repository.test.ts`.
- [ ] Commit: `feat: seed client demo database once`.

## Task 6: Bootstrap before application hydration

**Files:**
- Create: `apps/mobile/src/state/client-demo-bootstrap.ts`
- Modify: `apps/mobile/src/state/app-shell.ts`
- Modify: `apps/mobile/src/state/app-shell.test.ts`
- Modify: `apps/mobile/src/services/mocks/financial-planning-service.ts`
- Modify: `apps/mobile/src/services/mocks/automatic-tracking-service.ts`

- [ ] Add failing tests proving the seed finishes before `hydrated: true` and a seed failure falls back safely without deleting stored state.
- [ ] Call the single seeder from app-shell hydration only when demo mode is enabled.
- [ ] Remove the production singleton's `test-utils` planning seed and make planning transactions read from `coreFinanceService` instead of fixtures.
- [ ] Let persistent tracking hydrate from the seeded SQLite tables; retain mock event simulation only for dev/test paths already using it.
- [ ] Run the app-shell, planning, tracking, reports, and cross-feature consistency tests.
- [ ] Commit: `feat: bootstrap shared demo data`.

## Task 7: Verify no UI or quality regression

**Files:**
- Modify tests only if an existing assertion encodes the old signed-out entry behavior.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run check:frontend-quality`.
- [ ] Run `npm test -- --runInBand` and reject unexpected console warnings.
- [ ] Run `git diff --check`.
- [ ] Open `/`, refresh, and verify Home is the first screen, values are visible, login pages still exist, and accounts/transactions/planning/reports/tracking/notifications show coherent data.
- [ ] Compare Home before/after at phone width and confirm zero visual design delta except populated numerical/list content.
- [ ] Commit: `test: verify client demo mode`.

