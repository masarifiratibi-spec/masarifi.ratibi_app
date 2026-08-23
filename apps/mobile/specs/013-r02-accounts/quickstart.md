# Quickstart: Validate R02 Accounts

## Prerequisites

- Use the R01 shared-foundation worktree with R01 contracts available.
- Use existing core-finance fixtures/repository; no production account provider.
- R04 transaction-row integration is optional until R04 is approved and must not be duplicated locally.

## Automated Baseline

```powershell
npm run typecheck
npm run lint
npm run check:design-system
npm run check:core-finance
npx jest --runInBand src/features/accounts src/features/transactions/AccountPicker.test.tsx src/features/core-finance/core-finance-queries.test.ts src/services/mocks/core-finance-accounts.test.ts src/storage/core-finance-ledger.test.ts src/storage/core-finance-performance.test.ts src/design-system/components/SensitiveValue.test.tsx
```

Expected: commands pass; balance projection uses complete ledger data; optional account data survives edit; current routes/commands remain unchanged.

## Screen Validation

### Account List

- Validate no accounts, no search result, typical, 30 and 100+ accounts, active/archived/default, inclusion/exclusion where supplied, multi-currency, duplicate/long mixed-script names, hidden values, loading, and error/retry.
- Verify list balance against complete-ledger fixtures exceeding one page.

### Account Detail

- Validate active/archived, default, credit/multi-currency, missing, loading/error, hidden/large/unknown amount, archive/restore failure, and transfer entry context.
- When R04 is available, validate recent activity without moving transaction commands to R02.

### Create/Edit

- Exercise all seven existing account types, required/invalid fields, currency read-only edit, opening balance extremes, duplicate Save, dirty dismissal, storage failure, and successful return.
- Seed optional institution/lastFour/creditLimit/icon/color/notes; edit visible fields and confirm optional data remains unchanged.

### Account Picker

- Validate current selection, active-only eligibility, archived unavailable where shown, name/currency/last-four search, 100+ items, no eligible accounts, no result, select, cancel, and caller draft preservation.

## Language and Device Matrix

- Arabic RTL and English LTR;
- light and dark themes;
- normal and 200% text;
- minimum 320×568 and one larger phone;
- TalkBack/VoiceOver;
- keyboard and safe areas;
- normal/reduced motion;
- visible/hidden values and background/app-switcher privacy;
- supported Android device and supported iOS device/environment.

## Downstream Regression

Verify account identity/selection in Transactions, Add, Voice review, Tracking review, Home, Salary, Reports, More, and App Settings. Callers retain their draft/filter/scroll context and account selection semantics.

## Evidence

Record device/OS/build, screen/state, locale/theme/text scale/accessibility/privacy state, expected/actual result, and safe artifact path. If iOS infrastructure is unavailable, record blocked and do not mark the iOS task complete.

