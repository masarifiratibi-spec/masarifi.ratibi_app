# Quickstart: Validate R04 Transactions

## Prerequisites

- Use the requested R01 worktree and approved shared contracts.
- R02/R03 picker contracts and R05 form anatomy must be available for their integration points.
- Use existing core-finance fixtures/repository; no production provider.

## Automated Baseline

```powershell
npm run typecheck
npm run lint
npm run check:design-system
npm run check:core-finance
npx jest --runInBand src/features/transactions src/features/core-finance src/domain/core-finance.test.ts src/storage/core-finance-ledger.test.ts src/storage/core-finance-performance.test.ts src/storage/core-finance-persistence.test.ts src/services/mocks/core-finance-delete.test.ts src/services/mocks/core-finance-conflict.test.ts
```

Expected: all commands pass; pagination reaches beyond first page; all current types/signs/sources/statuses remain correct; filters, delete/undo, conflict, routes, and effects are unchanged.

## Screen Validation

### Transaction List

- Validate first-use empty, typical, 500 and 1,000+, all types/sources/statuses, mixed currencies/scripts, hidden/large/unknown values, review/conflict, initial/next-page loading, next-page failure, query error/retry, and live updates.
- Verify stable chronology, no duplicate rows, and context after detail return.

### Filters

- Exercise every current filter field, amount validation, apply, cancel, reopen, individual chip removal, Clear all, archived/missing account/category, keyboard, 200% labels, and filtered empty.
- Cancel must not leak draft edits.

### Detail

- Open each type/source/status and transfer/original/obligation relationship.
- Validate missing/error, hidden values, automatic report-wrong, support report label/context, edit/delete eligibility, and origin return.

### Edit

- Validate current values, type-dependent fields, R02/R03 pickers, validation retention, dirty dismissal, duplicate Save, mapped result/failure/conflict, and return to ledger.

### Delete and Undo

- Validate confirmation, delete working/failure/success, current 30-second textual countdown, detail reopen, duplicate activation, undo working/failure/success, expiry, and post-expiry correction.

### Sync Conflict

- Validate full-screen and modal entries, differing and equal visible fields, hidden values, local/later financial effect, select/confirm/cancel, concurrent change, failure/retry, and supported choices only.

## Language, Accessibility, and Device Matrix

- Arabic RTL/English LTR, light/dark, normal/200% text;
- 320×568 and larger phone;
- TalkBack/VoiceOver, keyboard, safe areas, reduced motion;
- hidden values, mixed scripts, large/multi-currency amounts;
- supported Android and iOS device/environment.

## Downstream Regression

Verify Accounts recent activity, Add results, Tracking feedback/review, Home activity, Budgets, Obligations, Savings, Reports drill-down, Assistant evidence, Notifications/deep links, and Support context.

## Evidence

Record device/OS/build, screen/state, data volume, locale/theme/text/access/privacy state, expected/actual result, and safe artifact path. Mark unavailable iOS validation blocked rather than complete.

