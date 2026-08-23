# Masarifi Canonical Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved Home palette the single shared Masarifi color system across Home, Transactions, and other semantic-token consumers.

**Architecture:** Keep `tokens.ts` as the sole raw-color owner. Move the approved Home hero anchors into the canonical teal ramp, reference them from light/dark Horizon compositions, and leave screen structure and financial/status semantics unchanged.

**Tech Stack:** Expo 51, React Native, TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-08-18-masarifi-canonical-color-system-design.md`

## Global Constraints

- Work only in `.worktrees/r01-shared-ui-foundation`.
- Preserve all existing modified and untracked files.
- Do not commit, push, reset, clean, or stop the verified Expo server.
- No new dependencies, abstractions, layouts, routes, or feature-local raw colors.
- Home remains the visual source of truth; financial and status colors remain distinct.

---

### Task 1: Canonicalize and verify the shared color system

**Files:**

- Modify: `apps/mobile/src/design-system/tokens.test.ts`
- Modify: `apps/mobile/src/design-system/theme.test.ts`
- Modify: `apps/mobile/src/design-system/tokens.ts`

**Interfaces:**

- Consumes: existing `colorTokens`, `lightThemeColors`, `darkThemeColors`, and `resolveTheme` exports.
- Produces: one canonical teal ramp and theme-specific `ThemeColors['horizon']` mappings with unchanged consumer property names.

- [x] **Step 1: Write failing regression tests**

```ts
expect(lightThemeColors.horizon.heroStart).toBe(colorTokens.teal["900"]);
expect(lightThemeColors.horizon.heroEnd).toBe(colorTokens.teal["600"]);
expect(darkThemeColors.horizon).not.toBe(lightThemeColors.horizon);
```

Add contrast assertions for on-hero content against both gradient endpoints in both themes.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- --runInBand src/design-system/tokens.test.ts src/design-system/theme.test.ts`

Expected: failure because Horizon still owns duplicate hero hex values and both themes reuse the same Horizon object.

- [x] **Step 3: Implement the minimum central mapping**

Move `#103F37` and `#1D7464` into the canonical teal primitive ramp, make Horizon hero roles reference those primitives, and create separate light/dark Horizon compositions while preserving the existing public keys.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --runInBand src/design-system/tokens.test.ts src/design-system/theme.test.ts`

Expected: both suites pass with zero failures.

- [x] **Step 5: Verify affected surfaces and boundaries**

Run focused Home, Transactions, and shell tests, followed by `npm run check:design-system`, `npm run check:app-shell`, `npm run typecheck`, and `npm run lint`. Verify that the running Expo web bundle contains the canonical Home anchors and no longer contains the superseded primary token.

- [ ] **Step 6: Capture the live visual comparison**

Capture Home and Transactions from the running Expo web app in Arabic and English when the local-browser security policy permits localhost inspection. Do not substitute the static mockup generator as evidence of the live application.
