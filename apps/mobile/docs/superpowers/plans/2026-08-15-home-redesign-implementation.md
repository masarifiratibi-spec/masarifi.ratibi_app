# Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Home presentation with the approved `000-home` visual design while preserving all existing data, routes, actions, states, and business logic.

**Architecture:** Keep `HomeScreen` as the query/state owner and `HomeSummary` as the ready/partial data renderer. Reuse R01 semantic tokens, `FinancialPulse`, `AttentionRail`, `GroupedList`, `AmountText`, and the shared tab bar; only add presentation props and localized copy needed by the approved composition.

**Tech Stack:** Expo 51, React Native 0.74, Expo Router, TanStack Query, Zustand preferences/privacy, Jest, Testing Library.

## Global Constraints

- Work only in `.worktrees/r01-shared-ui-foundation` as explicitly requested.
- Do not alter services, repositories, routes, permissions, tracking rules, financial calculations, or persisted state.
- Preserve Arabic RTL, English LTR, dark mode, hidden balances, 200% text, and 44×44 minimum targets.
- Reuse current query data; never manufacture the sample facts shown in the mockups.
- Preserve unrelated dirty-worktree changes and do not commit them.

---

### Task 1: Home hierarchy and current-state projection

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/HomeSummary.tsx`
- Modify: `src/features/home/HomeScreen.test.tsx`
- Modify: `src/features/home/HomeAccessibility.test.tsx`
- Modify: `src/localization/messages/ar.ts`
- Modify: `src/localization/messages/en.ts`

**Interfaces:**
- Consumes: `HomeSummary`, `useHomeSummary('SAR')`, current preference and privacy providers.
- Produces: branded header, scope chip, financial pulse, attention rows, recent transaction rows, and preserved state rendering.

- [ ] Add failing tests for approved hierarchy, recent activity, attention, localized labels, and hidden values.
- [ ] Run focused Home tests and confirm failure is caused by missing redesigned presentation.
- [ ] Implement the minimum presentation changes using current Home data and routes.
- [ ] Run focused Home and accessibility tests to green.

### Task 2: R01 financial and attention surfaces

**Files:**
- Modify: `src/design-system/components/financial/FinancialPulse.tsx`
- Modify: `src/design-system/components/feedback/AttentionRail.tsx`
- Modify: `src/design-system/components/financial/SharedDecisionSurfaces.test.tsx`

**Interfaces:**
- Consumes: semantic theme tokens and existing `FinancialPulse` / `AttentionRail` props.
- Produces: approved dark summary surface and grouped attention card without breaking existing callers.

- [ ] Add failing component assertions for metric content and grouped attention semantics.
- [ ] Run the focused design-system test and confirm expected failure.
- [ ] Add backward-compatible presentation support and semantic styles.
- [ ] Run the design-system test to green.

### Task 3: Compact planning and preserved Home actions

**Files:**
- Modify: `src/features/financial-planning/PlanningHomeCard.tsx`
- Create: `src/features/financial-planning/PlanningHomeCard.test.tsx`
- Modify: `src/features/home/HomeQuickActions.tsx`
- Modify: `src/features/home/HomeQuickActions.test.tsx`

**Interfaces:**
- Consumes: existing planning routes and `usePlanningOverview` data.
- Produces: compact real-data budget/savings progress when available plus all existing Home destinations.

- [ ] Add failing tests for planning progress, safe loading/error fallback, and all existing quick-action destinations.
- [ ] Run focused tests and confirm the presentation assertions fail.
- [ ] Implement compact progress rows and quiet secondary action rows without new calculations.
- [ ] Run focused tests to green.

### Task 4: Home-only quick-add glass chooser

**Files:**
- Modify: `src/features/shell/AppTabs.tsx`
- Modify: `src/features/shell/AppTabs.test.tsx`
- Modify: `src/design-system/icons.tsx`
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: current Home route, `capture.manual`, `capture.voice`, and existing Add/voice destinations.
- Produces: Home-only icon chooser; other tabs keep direct Add navigation.

- [ ] Add failing tab tests for open, close, manual, voice, RTL/LTR order, and accessibility labels.
- [ ] Run focused tab tests and confirm failure.
- [ ] Implement local disclosure state and approved glass presentation with existing routes.
- [ ] Run shell/tab tests to green.

### Task 5: Cross-state and device validation

**Files:**
- Modify only files above for defects found during validation.

**Interfaces:**
- Consumes: connected Android device, Arabic/English preferences, light/dark themes, privacy state.
- Produces: visual evidence and a verified Home implementation.

- [ ] Run Home, shell, accessibility, privacy, planning, design-system, typecheck, lint, and boundary checks.
- [ ] Launch the current worktree build on the connected Android device.
- [ ] Capture Arabic RTL and English LTR Home screenshots, including quick-add expanded.
- [ ] Compare against all four approved PNGs in one bounded pass and fix material differences.
- [ ] Re-run automated checks and device screenshots after fixes.

