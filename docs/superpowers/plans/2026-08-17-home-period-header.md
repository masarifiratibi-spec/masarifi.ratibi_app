# Home Period Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared More glyph with real profile initials and make Home's month pill drive a localized monthly/custom date range that filters Home data.

**Architecture:** Home owns a small applied-period value and presents a three-step `AppSheet`. Existing transaction filters are passed through the backward-compatible Home summary query/service so aggregation remains in the finance owner. The shared shell owns initials presentation and unchanged More navigation.

**Tech Stack:** React Native, Expo Router, TanStack Query, Zustand preferences/session state, Jest, React Native Testing Library.

## Global Constraints

- Continue only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Preserve all existing uncommitted changes; do not reset, clean, commit, push, or overwrite unrelated files.
- Reuse Masarifi tokens, profile data, More/Reports routes, transaction filters, and native/web date picker.
- Preserve privacy masking, account navigation, RTL/LTR, dark theme, large text, and accessibility.
- Do not add dependencies or a custom calendar.

---

### Task 1: Period model and filtered Home summary

**Files:**
- Create: `apps/mobile/src/features/home/home-period.ts`
- Create: `apps/mobile/src/features/home/home-period.test.ts`
- Modify: `apps/mobile/src/services/contracts/core-finance-service.ts`
- Modify: `apps/mobile/src/services/mocks/core-finance-service.ts`
- Modify: `apps/mobile/src/services/mocks/core-finance-service.test.ts`
- Modify: `apps/mobile/src/features/core-finance/core-finance-queries.ts`
- Modify: `apps/mobile/src/features/core-finance/core-finance-queries.test.ts`

**Interfaces:**
- Produces: `HomePeriod`, `monthPeriod(timestamp)`, `customPeriod(start, end)`, `homePeriodFilters(period)`, and optional `filters` parameters on `getHomeSummary`/`useHomeSummary`.

- [ ] Write failing tests proving month/custom boundaries, query-key separation, and period-filtered summary totals/recent rows.
- [ ] Run `npm test -- --runInBand src/features/home/home-period.test.ts src/features/core-finance/core-finance-queries.test.ts src/services/mocks/core-finance-service.test.ts` and confirm the new assertions fail.
- [ ] Implement UTC-inclusive period helpers and filter Home aggregation with `matchesFilters`, preserving current balances.
- [ ] Rerun the focused tests and confirm they pass.

### Task 2: Shared profile initials avatar

**Files:**
- Modify: `apps/mobile/src/features/shell/PrimaryShellHeader.tsx`
- Create: `apps/mobile/src/features/shell/PrimaryShellHeader.test.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useSettingsProfile()` and `useAppShellStore(...session.userId)`.
- Produces: exported pure `profileInitials(name, email, userId)` and the existing More press target rendered as an initials circle.

- [ ] Write failing tests for multi-word, single-word, email/user-id fallbacks, 48×48 target, and unchanged More route.
- [ ] Run `npm test -- --runInBand src/features/shell/PrimaryShellHeader.test.tsx src/features/home/HomeScreen.test.tsx` and confirm failure.
- [ ] Replace only the More glyph with the token-colored avatar and preserve its label, route, origin, and physical side.
- [ ] Rerun the focused tests and confirm they pass.

### Task 3: Interactive Home period sheet

**Files:**
- Create: `apps/mobile/src/features/home/HomePeriodSheet.tsx`
- Create: `apps/mobile/src/features/home/HomePeriodSheet.test.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.tsx`
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionDateField.native.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionDateField.web.tsx`
- Modify: `apps/mobile/src/features/transactions/TransactionDateField.d.ts`
- Modify: `apps/mobile/src/localization/messages/ar.ts`
- Modify: `apps/mobile/src/localization/messages/en.ts`

**Interfaces:**
- Consumes: `HomePeriod`, `monthPeriod`, `customPeriod`, `TransactionDateField`, and `AppSheet`.
- Produces: `HomePeriodSheet({visible, period, onApply, onDismiss})`; `TransactionDateField` gains an optional localized `label` prop.

- [ ] Write failing tests for opening the pill, localized month/year, choose screen, dynamic month selection, custom dates, invalid range, duration, apply/close, and RTL/LTR rows.
- [ ] Run `npm test -- --runInBand src/features/home/HomePeriodSheet.test.tsx src/features/home/HomeScreen.test.tsx src/features/transactions/TransactionDateField.test.tsx` and confirm failure.
- [ ] Implement the filled pill and the three sheet views using existing tokens/icons/date picker.
- [ ] Connect the applied period to `useHomeSummary('SAR', homePeriodFilters(period))`.
- [ ] Rerun the focused tests and confirm they pass.

### Task 4: Regression and visual verification

**Files:**
- Modify only task files if verification exposes a defect.

**Interfaces:**
- Produces: verified Arabic/English and mobile-width behavior without changing unrelated routes.

- [ ] Run all focused Home/header/date/service tests.
- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run typecheck` and `npm run lint`.
- [ ] Run `npm run check:design-system`, `npm run check:app-shell`, and `npm run check:core-finance`.
- [ ] Run the Impeccable detector once on the final diff.
- [ ] Start Expo web with one Metro worker, inspect Home in Arabic RTL and English LTR at mobile width, exercise monthly/custom selection, and capture evidence.
- [ ] Check `adb devices -l`; use the installed dev client without rebuilding when authorized, or report the exact Android gate blocker without claiming validation.
