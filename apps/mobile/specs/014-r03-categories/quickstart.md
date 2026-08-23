# Quickstart: Validate R03 Categories

## Prerequisites

- Use the requested R01 worktree and approved R01 contracts.
- Use existing core-finance category fixtures/repository only.
- Do not add duplicate rejection, category sync status, usage counts, or recency storage.

## Automated Baseline

```powershell
npm run typecheck
npm run lint
npm run check:design-system
npm run check:core-finance
npx jest --runInBand src/features/categories src/features/transactions/CategoryPicker.test.tsx src/features/core-finance/core-finance-queries.test.ts src/services/mocks/core-finance-categories.test.ts src/storage/core-finance-repository.test.ts
```

Expected: commands pass; duplicate labels remain valid; merge still reclassifies existing transactions and archives source; no route or category rule changes.

## Screen Validation

### Category List

- Validate system/custom, favorites, hierarchy, active/archived/merged, no custom, no result, 150+, duplicate and long bilingual labels, missing icon/color, loading, error/retry, and mapped offline failure.
- Verify normalized Arabic/English search and stable favorite ordering.

### Create/Edit

- Validate both labels, allowed duplicates, invalid required/hierarchy input, parent/no-parent search, favorite, keyboard, dirty dismissal, duplicate Save, failure/retry, and preservation of existing icon/color values.

### Category Detail and Decisions

- Validate active/archived/merged/missing states.
- Archive/restore: verify named consequence, confirm/cancel, duplicate-action block, failure, success.
- Merge: choose target explicitly, compare source/target, confirm, fail/retry, succeed, and verify downstream transaction reclassification.

### Category Picker

- Validate current selection, favorites, active-only eligibility, normalized bilingual search, 150+, no result, select/cancel, and caller-supported create-return without losing caller state.

## Language and Device Matrix

- Arabic RTL/English LTR, light/dark, normal/200% text;
- 320×568 and larger phone;
- TalkBack/VoiceOver, keyboard, safe areas, reduced motion;
- mixed labels/digits and grayscale/non-color meaning;
- supported Android and iOS device/environment.

## Downstream Regression

Verify category identity/selection in Transactions, Add, Voice, Tracking review, Budgets, Reports, and Assistant evidence. Each caller retains its own draft/filter/scroll and category application.

## Evidence

Record device/OS/build, screen/state, locale/theme/text/access settings, expected/actual outcome, and safe artifact path. Mark unavailable iOS infrastructure blocked rather than complete.

