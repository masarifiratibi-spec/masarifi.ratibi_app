# Masarifi Light Surface Hierarchy Implementation Plan

> **For agentic workers:** Execute inline with strict red-green TDD. Do not delegate this task.

**Goal:** Apply the approved light-mode pale-teal canvas and white-card hierarchy across the mobile app while preserving the current Home financial hero exactly.

**Architecture:** Keep `apps/mobile/src/design-system/tokens.ts` as the only raw-color owner. Change only light-theme primitive/semantic mappings so existing screen consumers inherit the approved canvas, cards, borders, inset surfaces, and sheets without feature-local overrides; leave dark-theme mappings, layout, content, and behavior unchanged.

**Tech Stack:** React Native, Expo, TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-08-18-masarifi-canonical-color-system-design.md`

## Global Constraints

- Light mode only; do not redesign or remap dark mode.
- Preserve the Home hero contract: `financialHero` and `heroStart` stay `#103F37`; `heroEnd` stays `#1D7464`.
- Approved light canvas is `#E8EFEC`; cards and grouped card surfaces are `#FFFFFF`; default border is `#D7E1DC`.
- Preserve layout, typography, navigation, privacy, financial semantics, category artwork, and business behavior.
- Raw colors remain owned by `tokens.ts`; no feature-local color literals.

---

### Task 1: Canonical light surface hierarchy

**Files:**
- Modify: `apps/mobile/src/design-system/tokens.test.ts`
- Modify: `apps/mobile/src/design-system/tokens.ts`

**Interfaces:**
- Consumes: existing `colorTokens`, `lightThemeColors`, and `darkThemeColors` exports.
- Produces: unchanged public types with updated light semantic values inherited by all existing consumers.

- [ ] **Step 1: Write the failing token contract**

Add a test that asserts the approved light page/card/border mapping, legacy alias alignment, exact hero preservation, and unchanged dark surface values.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --runInBand src/design-system/tokens.test.ts`

Expected: failure because the light page still resolves to `#F6F7F5`, grouped surfaces are not white, and the border still resolves to `#E3E9E7`.

- [ ] **Step 3: Implement the smallest shared-owner change**

Update only the light primitive/semantic mappings in `tokens.ts`: page canvas `#E8EFEC`, muted/inset support surfaces, white grouped/card/sheet surfaces, and border `#D7E1DC`. Preserve all dark mappings and hero endpoints.

- [ ] **Step 4: Run focused GREEN checks**

Run: `npm test -- --runInBand src/design-system/tokens.test.ts src/design-system/theme.test.ts src/design-system/component-accessibility.test.tsx`

Expected: all focused suites pass with zero failures.

- [ ] **Step 5: Verify system boundaries and rendered consumers**

Run: `npm run check:design-system`, `npm run typecheck`, and `npm run lint`.

Inspect Home, Transactions, Add/Edit, Category Picker, Account Picker, Reports, More, filters/sheets, and Voice in the running app. Check Arabic and English at a phone viewport; correct only shared-role misses found in one bounded pass.

