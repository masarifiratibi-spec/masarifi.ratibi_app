# Masarifi Horizon Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Masarifi Horizon Home layout with expenses before income and a full-screen modal accounts sheet.

**Architecture:** Keep `HomeScreen` as the query/period owner and `HomeSummary` as the financial presentation owner. Reuse the existing modal-backed `AppSheet`, existing routes, formatters, privacy provider, and transaction row behavior. Add only small Home-owned presentation helpers; do not alter domain or service contracts.

**Tech Stack:** React Native/Expo, TypeScript, Expo Router, react-native-svg, Jest and React Native Testing Library.

## Global Constraints

- Work only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation`.
- Preserve all existing uncommitted changes; no reset, clean, commit, push, or unrelated overwrite.
- No dependency, domain schema, service contract, or query changes.
- Preserve privacy masking, RTL/LTR, dark theme, large text, and direct transaction edit navigation.

---

### Task 1: Lock the Home behavior with failing tests

**Files:**
- Modify: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify: `apps/mobile/src/features/home/HomeAccessibility.test.tsx`

**Interfaces:**
- Consumes: existing `HomeScreen`, `HomeSummary`, Expo Router mock, `PixelRatio`.
- Produces: regression expectations for test IDs `home-horizon`, `home-quick-action-*`, `home-expense-section`, `home-income-section`, and `home-accounts-sheet`.

- [ ] Add tests proving expense rows precede income rows, transfer rows are excluded, and missing sections are omitted.
- [ ] Add tests proving Add, Voice, and Reports use their existing routes and Accounts opens a modal without navigation.
- [ ] Add tests proving the accounts sheet covers the application through `AppSheet`, closes through cancel/backdrop, and routes Add/Manage correctly.
- [ ] Add RTL/LTR and 200% text expectations without reduced typography.
- [ ] Run the focused tests and confirm they fail for the new behavior.

### Task 2: Implement the Horizon composition and activity sections

**Files:**
- Modify: `apps/mobile/src/features/home/HomeScreen.tsx`
- Modify: `apps/mobile/src/features/home/HomeSummary.tsx`
- Modify: `apps/mobile/src/design-system/tokens.ts` only if a missing semantic surface role is required.

**Interfaces:**
- Consumes: `summary.recentTransactions`, `formatFinancialDisplayValue`, `useSensitiveVisibility`, current theme roles, `router.push`.
- Produces: Home hero, four quick actions, and partitioned expense/income sections.

- [ ] Add the token-backed/SVG Horizon background and integrate the current header into the same visual field.
- [ ] Replace the mini-stat/card stack with the centered total, exact all-accounts context, and four route-backed quick actions.
- [ ] Partition `recentTransactions` with `transaction.type === 'expense'` and `transaction.type === 'income'`; take two each; exclude transfers.
- [ ] Render expenses first, income second, reusing `HomeTransactionRow` for masking, category visuals, account resolution, and edit routing.
- [ ] Make quick actions wrap/stack at large text and keep all amount/currency strings atomic.
- [ ] Run focused tests until green.

### Task 3: Add the full-screen accounts modal

**Files:**
- Create: `apps/mobile/src/features/home/HomeAccountsSheet.tsx`
- Test through: `apps/mobile/src/features/home/HomeScreen.test.tsx`
- Modify localization: `apps/mobile/src/localization/messages/ar.ts`, `apps/mobile/src/localization/messages/en.ts`

**Interfaces:**
- Produces: `HomeAccountsSheet({ visible, onDismiss })`.
- Routes: `/accounts/new`, `/accounts`; local explanatory state for balance help.

- [ ] Reuse `AppSheet` so the transparent modal/backdrop covers the tab bar and page beneath it.
- [ ] Add localized Add account, Manage accounts, How balances work, and Cancel actions with existing design icons and minimum touch targets.
- [ ] Implement the explanatory state inside the same sheet without a new route.
- [ ] Verify dismissal by cancel, backdrop, and `onRequestClose` in tests.
- [ ] Run focused tests until green.

### Task 4: Verify the exact tree

**Files:** No production changes unless verification exposes a scoped defect.

- [ ] Run focused Home and overlay Jest tests.
- [ ] Run the full Jest suite, `npm run typecheck`, `npm run lint`, `npm run check:design-system`, and `npm run check:core-finance`.
- [ ] Run the Impeccable detector once on final changed UI files.
- [ ] Validate Arabic RTL and English LTR on web at phone width, including the modal covering the tab bar and 200% text behavior.
- [ ] Run `adb devices -l`; validate Android only if an authorized device is present, otherwise report the physical-device blocker.
