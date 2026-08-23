# Masarifi Horizon Foundation and Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the approved Noto/Roboto Horizon foundation and deliver the first app-wide vertical slice by redesigning Transactions without changing its financial, filtering, privacy, pagination, or navigation behavior.

**Architecture:** Extend the existing typography resolver and reuse the already-present Horizon tokens, `FinancialHorizonSurface`, `PrimaryShellHeader`, `AppSheet`, `AmountText`, `CategoryIcon`, and `TransactionRow`. Keep summary, filters, queries, route ownership, and category mapping where they already live; make only the screen composition and shared typography change. Stop after the visual-proposal task until the user explicitly approves both locales.

**Tech Stack:** Expo 51, React Native 0.74, Expo Router, TypeScript 5.3, React Query, Zustand, react-native-svg, Jest Expo, Testing Library React Native.

## Global Constraints

- Work only in `D:\MY Work\0Part_Time\MASREFY _Final\.worktrees\r01-shared-ui-foundation` on `codex/r01-shared-ui-foundation`.
- Preserve all existing uncommitted changes. Do not reset, clean, commit, push, or overwrite unrelated files.
- Light mode is the only active visual target; do not remove dark tokens or implement dark styling.
- The strong Horizon gradient remains limited to Home and Transactions.
- Use Noto Sans Arabic UI for Arabic UI text and Roboto for English UI and every financial amount.
- Do not add a font package; vendor only the required static font files and their SIL Open Font License texts.
- Do not add raw feature-level colors or duplicate category visual mappings.
- Do not change domain schemas, service contracts, storage, summary queries, filter shape, routes, or deep-link behavior.
- Preserve the global hidden-balance preference and explicit reveal behavior.
- At 200% text, stack or reflow; never shrink semantic typography to retain a horizontal layout.
- Do not continue beyond Task 1 until Arabic and English Transactions proposals are explicitly approved.
- Do not claim Android or TalkBack validation without an authorized attached device and captured evidence.
- The user's no-commit instruction overrides the skill's normal commit checkpoints; use diff/test checkpoints only.

---

## File map

### Visual proposal files

- Modify: `apps/mobile/new_Desinge/final_visual_mockups/generate-final-visual-mockups.mjs` — generate the approved Horizon Transactions composition in both locales.
- Replace generated artifact: `apps/mobile/new_Desinge/final_visual_mockups/03-transactions/transactions-list-ar.png`.
- Replace generated artifact: `apps/mobile/new_Desinge/final_visual_mockups/03-transactions/transactions-list-en.png`.
- Modify: `apps/mobile/new_Desinge/final_visual_mockups/README.md` — identify these two images as the Stage 1 approval pair.

### Shared foundation files

- Add font binaries under `apps/mobile/assets/fonts/` for Noto Sans Arabic UI 400/500/600/700/800 and Roboto 400/500/600/700/900.
- Add: `apps/mobile/assets/fonts/Noto-SIL-OFL-1.1.txt`.
- Add: `apps/mobile/assets/fonts/Roboto-SIL-OFL-1.1.txt`.
- Modify: `apps/mobile/THIRD_PARTY_NOTICES.md` — record font family, upstream source, included weights, and license paths.
- Modify: `apps/mobile/src/design-system/typography.ts` — register assets and resolve locale/semantic weight.
- Modify: `apps/mobile/src/design-system/typography.test.ts` — lock asset aliases and resolver behavior.
- Modify: `apps/mobile/src/components/StyledText.tsx` — resolve each semantic variant to the approved family and weight.
- Modify: `apps/mobile/src/components/StyledText.test.tsx` — prove Arabic/English and amount typography.
- Modify: `apps/mobile/src/design-system/components/financial/FinancialPrimitives.tsx` — give `AmountText` Roboto financial typography.
- Modify: `apps/mobile/src/design-system/components/financial/FinancialPrimitives.test.tsx` — prove financial family, LTR isolation, and tabular numerals.
- Modify: `apps/mobile/src/design-system/components/ActionButton.tsx`.
- Modify: `apps/mobile/src/design-system/components/forms/ChipControls.tsx`.
- Modify: `apps/mobile/src/design-system/components/overlays/AppSheet.tsx`.
- Modify: `apps/mobile/src/features/shell/PrimaryShellHeader.tsx`.
- Modify their existing focused tests to prove semantic typography without changing component APIs.

### Transactions files

- Modify: `apps/mobile/src/features/transactions/transaction-sections.ts` — expose the approved four relative-time groups.
- Modify: `apps/mobile/src/features/transactions/transaction-sections.test.ts` — lock group boundaries and ordering.
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx` — Horizon hero, controls, activity sheet, independent cards, responsive summary.
- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx` — behavior and composition coverage.
- Modify: `apps/mobile/src/design-system/components/financial/TransactionRow.tsx` — typography and independent-card density only; public props remain backward compatible.
- Modify: `apps/mobile/src/design-system/components/financial/TransactionRow.test.tsx` — card, RTL/LTR, large-text, visuals, and masking coverage.
- Reuse the existing Arabic and English month, filter, summary, and relative-time labels; this release adds no new copy keys.

---

### Task 1: Produce and approve the Transactions visual pair

**Files:**

- Modify: `apps/mobile/new_Desinge/final_visual_mockups/generate-final-visual-mockups.mjs`
- Replace: `apps/mobile/new_Desinge/final_visual_mockups/03-transactions/transactions-list-ar.png`
- Replace: `apps/mobile/new_Desinge/final_visual_mockups/03-transactions/transactions-list-en.png`
- Modify: `apps/mobile/new_Desinge/final_visual_mockups/README.md`

**Interfaces:**

- Consumes: approved Home Horizon palette and the design specification.
- Produces: the exact Stage 1 visual authority at 390×844 for Arabic RTL and English LTR.

- [ ] **Step 1: Update the existing Transactions mockup scene**

Set the generated scene to the following fixed composition:

1. Horizon gradient header with Reports action, centered Transactions title/period control, and profile initials action.
2. Income and expense shown together with equal width and equal visual weight.
3. Search and filter actions remain reachable without displacing the summary.
4. Horizontal shortcut rail contains All plus active Food, Transfer, Transportation, Shopping, and Health scopes when fixture categories exist. Each chip uses 14px horizontal padding, an 8px rail gap, and a comfortable visible height; the rail scrolls instead of compressing labels.
5. Light activity sheet begins with a rounded top edge below the gradient.
6. Relative headings read Today, Yesterday, Last week, Earlier in English and the existing localized equivalents in Arabic.
7. Each transaction is an independent rounded card; category/title/account stay on the reading side and amount/date stay opposite.
8. Expense and income signs and colors remain explicit; category visuals use the existing OpenMoji mapping.
9. Bottom navigation remains the existing three-destination shell.

- [ ] **Step 2: Generate and verify both images**

Run from `apps/mobile`:

```powershell
node new_Desinge/final_visual_mockups/generate-final-visual-mockups.mjs
node new_Desinge/final_visual_mockups/verify-bilingual-mockups.mjs
```

Expected: both Transactions images are regenerated at 390×844 and the bilingual verifier exits 0.

- [ ] **Step 3: Present both images and stop for approval**

Show the Arabic and English images side by side. Do not edit production files until the user explicitly approves this pair.

- [ ] **Step 4: Record the approval checkpoint**

Add one dated line under the Transactions pair in the mockup README identifying the approved files. Do not commit.

---

### Task 2: Vendor and resolve the approved fonts

**Files:**

- Add: `apps/mobile/assets/fonts/NotoSansArabicUI-Regular.ttf`
- Add: `apps/mobile/assets/fonts/NotoSansArabicUI-Medium.ttf`
- Add: `apps/mobile/assets/fonts/NotoSansArabicUI-SemiBold.ttf`
- Add: `apps/mobile/assets/fonts/NotoSansArabicUI-Bold.ttf`
- Add: `apps/mobile/assets/fonts/NotoSansArabicUI-ExtraBold.ttf`
- Add: `apps/mobile/assets/fonts/Roboto-Regular.ttf`
- Add: `apps/mobile/assets/fonts/Roboto-Medium.ttf`
- Add: `apps/mobile/assets/fonts/Roboto-SemiBold.ttf`
- Add: `apps/mobile/assets/fonts/Roboto-Bold.ttf`
- Add: `apps/mobile/assets/fonts/Roboto-Black.ttf`
- Add: `apps/mobile/assets/fonts/Noto-SIL-OFL-1.1.txt`
- Add: `apps/mobile/assets/fonts/Roboto-SIL-OFL-1.1.txt`
- Modify: `apps/mobile/THIRD_PARTY_NOTICES.md`
- Modify: `apps/mobile/src/design-system/typography.ts`
- Test: `apps/mobile/src/design-system/typography.test.ts`

**Interfaces:**

- Consumes: `Locale` from `@/domain/foundation` and Expo `useFonts`.
- Produces: `SemanticFontWeight`, `fontFamilyForLocale(locale, weight)`, `financialFontFamily(weight)`, and `FONT_ASSETS`.

- [ ] **Step 1: Write the failing font contract tests**

Replace the IBM-specific expectations with:

```ts
expect(Object.keys(FONT_ASSETS)).toEqual([
  'MasarifiArabic-400',
  'MasarifiArabic-500',
  'MasarifiArabic-600',
  'MasarifiArabic-700',
  'MasarifiArabic-800',
  'MasarifiLatin-400',
  'MasarifiLatin-500',
  'MasarifiLatin-600',
  'MasarifiLatin-700',
  'MasarifiLatin-900'
]);
expect(fontFamilyForLocale('ar', 400)).toBe('MasarifiArabic-400');
expect(fontFamilyForLocale('ar', 800)).toBe('MasarifiArabic-800');
expect(fontFamilyForLocale('en', 600)).toBe('MasarifiLatin-600');
expect(fontFamilyForLocale('en', 900)).toBe('MasarifiLatin-900');
expect(financialFontFamily(700)).toBe('MasarifiLatin-700');
expect(financialFontFamily(900)).toBe('MasarifiLatin-900');
```

- [ ] **Step 2: Run the focused test and confirm red**

Run:

```powershell
npm test -- --runInBand src/design-system/typography.test.ts
```

Expected: FAIL because the current resolver accepts `regular | semibold | bold` and returns IBM Plex aliases.

- [ ] **Step 3: Vendor only the ten static assets and two licenses**

Use the official Noto Arabic `NotoSansArabicUI-v2.011` release and the official Roboto classic distribution. Copy the exact upstream SIL OFL 1.1 text beside each family. Do not copy unused weights, italics, source files, specimen images, or complete font repositories.

Record in `THIRD_PARTY_NOTICES.md`:

```markdown
## Noto Sans Arabic UI
- Included weights: 400, 500, 600, 700, 800
- Source: https://github.com/notofonts/arabic/releases/tag/NotoSansArabicUI-v2.011
- License: SIL Open Font License 1.1 (`assets/fonts/Noto-SIL-OFL-1.1.txt`)

## Roboto
- Included weights: 400, 500, 600, 700, 900
- Source: https://github.com/googlefonts/roboto-3-classic
- License: SIL Open Font License 1.1 (`assets/fonts/Roboto-SIL-OFL-1.1.txt`)
```

- [ ] **Step 4: Implement the minimal resolver**

Use this public shape in `typography.ts`:

```ts
export type SemanticFontWeight = 400 | 500 | 600 | 700 | 800 | 900;

export function fontFamilyForLocale(
  locale: Locale,
  weight: SemanticFontWeight
): string {
  const family = locale === 'ar' ? 'MasarifiArabic' : 'MasarifiLatin';
  const supported = locale === 'ar' && weight === 900 ? 800 : weight;
  return `${family}-${supported}`;
}

export function financialFontFamily(weight: 400 | 500 | 600 | 700 | 900) {
  return `MasarifiLatin-${weight}`;
}
```

Map every `FONT_ASSETS` alias to one local static TTF and keep `FontGate` behavior unchanged.

- [ ] **Step 5: Run the focused test and confirm green**

Run:

```powershell
npm test -- --runInBand src/design-system/typography.test.ts
```

Expected: PASS, including the existing loading and font-load-failure behavior.

- [ ] **Step 6: Check only intended font files changed**

Run:

```powershell
git diff --check
git status --short -- apps/mobile/assets/fonts apps/mobile/THIRD_PARTY_NOTICES.md apps/mobile/src/design-system/typography.ts apps/mobile/src/design-system/typography.test.ts
```

Expected: ten font binaries, two license texts, the notice, resolver, and test only. Do not commit.

---

### Task 3: Apply semantic typography to the shared path used by Transactions

**Files:**

- Modify: `apps/mobile/src/components/StyledText.tsx`
- Test: `apps/mobile/src/components/StyledText.test.tsx`
- Modify: `apps/mobile/src/design-system/components/financial/FinancialPrimitives.tsx`
- Test: `apps/mobile/src/design-system/components/financial/FinancialPrimitives.test.tsx`
- Modify: `apps/mobile/src/design-system/components/ActionButton.tsx`
- Test: `apps/mobile/src/design-system/component-accessibility.test.tsx`
- Modify: `apps/mobile/src/design-system/components/forms/ChipControls.tsx`
- Test: `apps/mobile/src/design-system/components/forms/ChipControls.test.tsx`
- Modify: `apps/mobile/src/design-system/components/overlays/AppSheet.tsx`
- Test: `apps/mobile/src/design-system/components/overlays/Overlays.test.tsx`
- Modify: `apps/mobile/src/features/shell/PrimaryShellHeader.tsx`
- Test: `apps/mobile/src/features/shell/PrimaryShellHeader.test.tsx`

**Interfaces:**

- Consumes: `fontFamilyForLocale`, `financialFontFamily`, and current locale.
- Produces: the existing component APIs with approved font families; no new component or appearance prop.

- [ ] **Step 1: Write failing semantic typography assertions**

Set the locale explicitly in each focused test and add assertions that cover this mapping:

```ts
const variantWeight = {
  caption: 400,
  body: 400,
  subtitle: 600,
  title: 700,
  headline: 800,
  amount: 900
} as const;
```

Assert in Arabic that `headline` resolves to `MasarifiArabic-800`, in English that `title` resolves to `MasarifiLatin-700`, and in Arabic that `StyledText variant="amount"` and `AmountText size="hero"` both resolve to `MasarifiLatin-900` with `writingDirection: 'ltr'` and `fontVariant: ['tabular-nums']`.

Assert shared controls resolve visible labels through semantic text:

```ts
expect(screen.getByText('Apply')).toHaveStyle({ fontFamily: 'MasarifiLatin-600' });
expect(screen.getByText('All')).toHaveStyle({ fontFamily: 'MasarifiLatin-600' });
expect(screen.getByText('All accounts')).toHaveStyle({ fontFamily: 'MasarifiLatin-700' });
expect(screen.getByText('AZ')).toHaveStyle({ fontFamily: 'MasarifiLatin-700' });
```

- [ ] **Step 2: Run shared focused tests and confirm red**

Run:

```powershell
npm test -- --runInBand src/components/StyledText.test.tsx src/design-system/components/financial/FinancialPrimitives.test.tsx src/design-system/components/forms/ChipControls.test.tsx src/design-system/components/overlays/Overlays.test.tsx src/features/shell/PrimaryShellHeader.test.tsx
```

Expected: FAIL on the new font-family assertions.

- [ ] **Step 3: Update `StyledText` without changing its public variants**

Replace the old three-name weight resolver with the numeric mapping above. Resolve `variant="amount"` through `financialFontFamily(900)` in every locale; resolve all other variants through `fontFamilyForLocale`. Preserve translation, derived accessibility labels, wrapping, scaling, color, and writing direction.

- [ ] **Step 4: Route financial and shared-control text through the resolver**

- `AmountText`: use `financialFontFamily(900)` for hero and `financialFontFamily(700)` for default/row.
- `ActionButton`: render its visible label with semantic 600.
- `ChipControls`: render chip text with semantic 600 and keyword-entry text with semantic 400.
- `AppSheet`: render the menu title with semantic 700; keep the existing modal, scrim, drag, Android Back, and backdrop behavior.
- `PrimaryShellHeader`: render initials with semantic 700; keep the current profile fallback and More navigation.

Prefer the existing `StyledText` component. Use `fontFamilyForLocale` directly only where `AmountText` must force Roboto for financial numerals.

- [ ] **Step 5: Run shared focused tests and confirm green**

Run the command from Step 2.

Expected: PASS with no public component signature change.

- [ ] **Step 6: Run design-system boundaries**

Run:

```powershell
npm run check:foundation
npm run check:design-system
npm run check:app-shell
```

Expected: all three commands exit 0. Do not commit.

---

### Task 4: Lock the approved relative-time section contract

**Files:**

- Modify: `apps/mobile/src/features/transactions/transaction-sections.ts`
- Test: `apps/mobile/src/features/transactions/transaction-sections.test.ts`

**Interfaces:**

- Consumes: `Transaction[]`, current timestamp, and the existing `FirstDayOfWeek` argument for call-site compatibility.
- Produces: ordered section keys `today | yesterday | lastWeek | earlier` and the existing row-position metadata.

- [ ] **Step 1: Replace the section expectation with four groups**

Use a fixed `now` and assert:

```ts
expect(transactionPeriodKey(at(19), now, 'sunday')).toBe('today');
expect(transactionPeriodKey(at(18), now, 'sunday')).toBe('yesterday');
expect(transactionPeriodKey(at(15), now, 'sunday')).toBe('lastWeek');
expect(transactionPeriodKey(at(10), now, 'sunday')).toBe('earlier');
expect(sections.map((section) => section.key)).toEqual([
  'today',
  'yesterday',
  'lastWeek',
  'earlier'
]);
```

Keep grouped-position assertions because other shared-row callers remain backward compatible even though Transactions will render every item as an independent card.

- [ ] **Step 2: Run the focused test and confirm red**

Run:

```powershell
npm test -- --runInBand src/features/transactions/transaction-sections.test.ts
```

Expected: FAIL because the current helper exposes a separate `thisWeek` group.

- [ ] **Step 3: Implement a rolling seven-day `lastWeek` bucket**

Keep Today and Yesterday as calendar-day buckets. Put transactions older than Yesterday but no more than seven calendar days before Today into `lastWeek`; put older transactions into `earlier`. Retain the third argument as `_firstDayOfWeek` so no external call contract changes and lint does not report an unused parameter.

Set the order to:

```ts
const periodOrder: TransactionPeriodKey[] = [
  'today',
  'yesterday',
  'lastWeek',
  'earlier'
];
```

- [ ] **Step 4: Run the focused test and confirm green**

Run the command from Step 2.

Expected: PASS with deterministic section order.

---

### Task 5: Recompose the Transactions hero and controls

**Files:**

- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Test: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`

**Interfaces:**

- Consumes: existing `useHomeSummary`, `useInfiniteTransactions`, filter store actions, profile header, Horizon surface, and localized month formatter.
- Produces: the approved hero composition while retaining `TransactionListScreen({ onBack? })`.

- [ ] **Step 1: Write failing hero composition tests**

Add expectations for:

```ts
expect(screen.getByTestId('transactions-horizon-hero')).toBeTruthy();
expect(screen.getByTestId('financial-horizon-gradient')).toBeTruthy();
expect(screen.getByTestId('transaction-period-control')).toBeTruthy();
expect(screen.getByTestId('transaction-summary-income')).toBeTruthy();
expect(screen.getByTestId('transaction-summary-expense')).toBeTruthy();
expect(screen.getByTestId('transaction-search-action')).toBeTruthy();
expect(screen.getByTestId('transaction-filter-action')).toBeTruthy();
expect(screen.getByTestId('transactions-activity-cap')).toBeTruthy();
```

Retain the existing assertions for real summary amounts, masking, period navigation, shortcut labels, preserved non-category filters, contextual Back, and Reports/More routing.

Add a 200% text assertion:

```ts
jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
expect(screen.getByTestId('transaction-summary-values')).toHaveStyle({
  flexDirection: 'column'
});
```

- [ ] **Step 2: Run the screen test and confirm red**

Run:

```powershell
npm test -- --runInBand src/features/transactions/TransactionListScreen.test.tsx
```

Expected: FAIL because the current screen uses a plain page header and keeps summary cards outside the Horizon surface.

- [ ] **Step 3: Move the branded region into `FinancialHorizonSurface`**

Within the existing `ListHeaderComponent`:

- wrap the primary header, title/period, summary, search/filter actions, and shortcut rail in `FinancialHorizonSurface`;
- pass `appearance="financialHero"` to `PrimaryShellHeader` when `onBack` is absent;
- keep contextual Back instead of Reports/More when `onBack` is supplied;
- color hero text/actions with `theme.colors.content.onFinancialHero`;
- keep the selected period press target routing to `/modals/transaction-filters`;
- keep the search field and filter-session lifecycle unchanged;
- set the quick-filter `AppSheet` to `appearance="menu"`;
- give quick-scope chips `minHeight: 44`, `paddingHorizontal: 14`, and an 8px rail gap; preserve horizontal scrolling when all six no longer fit;
- add the light rounded activity cap immediately after the hero.

Do not create a new hero component; the composition has one caller.

- [ ] **Step 4: Make the summary responsive without changing its query**

Use `PixelRatio.getFontScale() >= 1.5` in `MonthlySummary`:

```ts
const largeText = PixelRatio.getFontScale() >= 1.5;
```

Render income and expense side by side at normal scale and in one vertical stack at large scale. Keep both equal in width/visual weight, keep `useHomeSummary(baseCurrencyCode)` unchanged, and continue using the central hidden-balance state.

- [ ] **Step 5: Run the screen test and confirm green**

Run the command from Step 2.

Expected: PASS for hero composition, filters, privacy, period navigation, and 200% text.

---

### Task 6: Render independent transaction cards with correct RTL/LTR

**Files:**

- Modify: `apps/mobile/src/features/transactions/TransactionListScreen.tsx`
- Test: `apps/mobile/src/features/transactions/TransactionListScreen.test.tsx`
- Modify: `apps/mobile/src/design-system/components/financial/TransactionRow.tsx`
- Test: `apps/mobile/src/design-system/components/financial/TransactionRow.test.tsx`

**Interfaces:**

- Consumes: existing `TransactionRow` props and category visual mapping.
- Produces: independent-card rendering in Transactions while preserving grouped rendering for Account Detail and other callers.

- [ ] **Step 1: Write failing card and direction tests**

Add screen assertions that every rendered transaction row receives `groupedPosition="only"`, section headings remain outside cards, and the item keys remain unique after paginated deduplication.

Add shared-row assertions:

```ts
expect(screen.getByTestId('transaction-row')).toHaveStyle({
  borderRadius: 12,
  borderWidth: StyleSheet.hairlineWidth
});
expect(screen.getByTestId('transaction-row')).not.toHaveStyle({
  borderTopLeftRadius: 0
});
```

Retain the existing Arabic `row-reverse`, English `row`, 200% vertical stack, category visual, transfer fallback, income fallback, and masked-amount assertions.

- [ ] **Step 2: Run focused row and screen tests and confirm red**

Run:

```powershell
npm test -- --runInBand src/design-system/components/financial/TransactionRow.test.tsx src/features/transactions/TransactionListScreen.test.tsx
```

Expected: FAIL because Transactions currently forwards first/middle/last group positions and visually joins adjacent rows.

- [ ] **Step 3: Make Transactions use the existing independent-card mode**

Keep `buildTransactionSections` and `TransactionRow` public types intact. In the Transactions renderer, pass `groupedPosition="only"` for every transaction and add screen-owned vertical spacing between cards. Keep headings outside the cards and retain FlatList virtualization.

- [ ] **Step 4: Apply approved row typography and density**

In `TransactionRow`:

- render category/date metadata with semantic 400/600 roles;
- render title and amount with semantic 700;
- keep financial amount/currency in Roboto and LTR isolation;
- keep the existing `direction: 'ltr'` outer layout plus direction-aware row order;
- keep category visuals and account/source/status content unchanged;
- keep the current 200% vertical stack and 44dp-or-larger press target.

Do not add a new row component or a second category map.

- [ ] **Step 5: Run focused row and screen tests and confirm green**

Run the command from Step 2.

Expected: PASS for card shape, RTL/LTR order, masking, visuals, direct Edit routing, pagination deduplication, and virtualization.

---

### Task 7: Run regression, visual, and device gates

**Files:**

- Verify all files changed in Tasks 1–6.
- Add evidence only under the existing approved validation/documentation location if a capture is retained.

**Interfaces:**

- Consumes: complete Stage 0/1 implementation.
- Produces: release evidence or an explicit Android blocker.

- [ ] **Step 1: Run focused Stage 0/1 tests**

Run from `apps/mobile`:

```powershell
npm test -- --runInBand src/design-system/typography.test.ts src/components/StyledText.test.tsx src/design-system/components/financial/FinancialPrimitives.test.tsx src/design-system/components/financial/FinancialHorizonSurface.test.tsx src/design-system/components/financial/TransactionRow.test.tsx src/design-system/components/forms/ChipControls.test.tsx src/design-system/components/overlays/Overlays.test.tsx src/features/shell/PrimaryShellHeader.test.tsx src/features/transactions/transaction-sections.test.ts src/features/transactions/transaction-presentation.test.ts src/features/transactions/TransactionListScreen.test.tsx src/features/transactions/TransactionsRoute.test.tsx
```

Expected: all focused suites pass.

- [ ] **Step 2: Run full automated checks**

Run:

```powershell
npm test -- --runInBand
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
git diff --check
```

Expected: every command exits 0. Do not commit.

- [ ] **Step 3: Run Impeccable once after final UI edits**

Read the current Impeccable craft constraints, then run:

```powershell
node C:\Users\DELL\.agents\skills\impeccable\scripts\detect.mjs --json apps/mobile/src/components/StyledText.tsx apps/mobile/src/design-system/components/financial/FinancialPrimitives.tsx apps/mobile/src/design-system/components/financial/TransactionRow.tsx apps/mobile/src/features/transactions/TransactionListScreen.tsx
```

Expected: JSON output contains no unresolved findings. Fix material findings in one batch, rerun the affected focused tests, and do not run the detector a second time.

- [ ] **Step 4: Validate Arabic and English web layouts**

Start or reuse Expo web, then inspect `/transactions` at 390×844 in Arabic RTL and English LTR at normal text and 200% text.

Verify:

- header and hero align with the approved pair;
- income and expense are equal and never clip;
- shortcuts scroll horizontally without changing unrelated filters;
- independent cards preserve category/title/account against amount/date;
- Today, Yesterday, Last week, Earlier appear in order when data exists;
- search, advanced filters, period control, privacy masking, row-to-edit navigation, and scrolling work;
- loading, empty, error, and next-page states remain readable.

- [ ] **Step 5: Run the Android release gate**

Run:

```powershell
adb devices -l
```

If an authorized device is listed, launch the installed dev client against Metro without rebuilding first, capture the initial and final Transactions screenshots, and exercise search, filters, period control, shortcut scopes, privacy toggle, scrolling, and row-to-edit navigation.

If no authorized device appears, or rebuilding reaches the known `react-native-screens` CMake `build.ninja still dirty` failure, stop the Android gate and report the blocker. Do not claim Android or TalkBack validation.

- [ ] **Step 6: Review scope**

Run:

```powershell
git status --short
git diff -- apps/mobile/src/design-system apps/mobile/src/components/StyledText.tsx apps/mobile/src/features/shell/PrimaryShellHeader.tsx apps/mobile/src/features/transactions apps/mobile/THIRD_PARTY_NOTICES.md
```

Expected: only the approved Stage 0/1 files and pre-existing user changes are present; no domain, service, storage, route, or unrelated-screen rewrite was introduced.
