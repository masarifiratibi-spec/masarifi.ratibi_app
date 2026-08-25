# Home Finance Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver premium, independent Home account and transaction cards without changing application behavior or data flow.

**Architecture:** Keep the work local to `HomeSummary` and extend the existing `DesignIcon` catalog only for required category visuals. Existing summary values, `AmountText`, preference state, and Expo Router destinations remain authoritative.

**Tech Stack:** React Native 0.74, Expo Router, TypeScript, Jest, Testing Library, existing R01 design tokens and Ionicons wrapper.

## Global Constraints

- UI-only: no business logic, API contract, domain model, query, or function-flow changes.
- Preserve `/accounts` and `/transactions/:id` navigation.
- Preserve Arabic RTL, English LTR, dark mode, accessibility, and hidden balances.
- Add no dependency and no raw feature colors.

---

### Task 1: Home card behavior contract

**Files:**
- Modify: `src/features/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `HomeScreen`, `HomeSummary`, and existing router mock.
- Produces: observable tests for the accounts destination and category-specific transaction presentation.

- [x] Add two recent transactions with different category IDs and assert both titles remain independently pressable.
- [x] Assert the All Accounts button opens `/accounts`.
- [x] Assert representative Salary and Shopping icons render through stable visual test IDs.
- [x] Run `jest --runInBand src/features/home/HomeScreen.test.tsx` and confirm the new assertions fail before production edits.

### Task 2: Premium account and transaction cards

**Files:**
- Modify: `src/features/home/HomeSummary.tsx`
- Modify: `src/design-system/icons.tsx`
- Modify: `src/localization/messages/en.ts`
- Modify: `src/localization/messages/ar.ts`

**Interfaces:**
- Consumes: `HomeSummary.recentTransactions`, `activeAccountCount`, `excludedAccountIds`, existing privacy state, `AmountText`, `DesignIcon`, and router.
- Produces: pressable `AllAccountsCard` and independent `HomeTransactionRow` cards.

- [x] Add paired localized account-count and system-category labels.
- [x] Add the minimum Ionicons names needed by the system-category visual map.
- [x] Render All Accounts using existing summary values and route it to `/accounts`.
- [x] Replace `GroupedList` with independent bordered transaction surfaces; retain the existing transaction detail route and amount component.
- [x] Run the focused Home test and make it pass.
- [x] Run targeted lint, `npm run typecheck`, `npm run check:design-system`, and the Home/accessibility/privacy suites.
- [x] Run the Impeccable detector once over the changed UI files and review the final diff for UI-only scope.
