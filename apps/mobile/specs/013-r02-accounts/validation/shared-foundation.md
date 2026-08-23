# R02 Shared Foundation Evidence

Date: 2026-08-15

Implemented:

- Added `CoreFinanceService.listAccountBalances()` and `useAccountBalances()` as a read-only account balance projection.
- Projection reuses `CoreFinanceRepository.accountBalance()` and does not introduce a UI ledger calculation.
- Added `projectAccount()` for presentation-only account identity and balance state mapping.
- Updated account edit persistence path so omitted optional account fields preserve existing values.

Verification:

- `npm run typecheck` PASS.
- `npm run lint` PASS.
- `npm run check:design-system` PASS.
- `npm run check:core-finance` PASS.
- `npm run test -- src/features/accounts/account-presentation.test.ts src/features/accounts/AccountRow.test.tsx src/features/accounts/AccountListScreen.test.tsx src/features/accounts/AccountDetailScreen.test.tsx src/features/accounts/AccountForm.test.tsx src/features/transactions/AccountPicker.test.tsx src/services/mocks/core-finance-accounts.test.ts src/storage/core-finance-ledger.test.ts src/features/core-finance/core-finance-queries.test.ts` PASS.
- `npx jest --runInBand src/features/accounts src/features/transactions/AccountPicker.test.tsx src/features/core-finance/core-finance-queries.test.ts src/services/mocks/core-finance-accounts.test.ts src/storage/core-finance-ledger.test.ts src/storage/core-finance-performance.test.ts src/design-system/components/SensitiveValue.test.tsx` PASS.

Focused result:

- Focused R02 command: 9 suites passed, 25 tests passed.
- Quickstart command: 13 suites passed, 30 tests passed.

Notes:

- Quickstart Jest emitted non-failing React `act(...)` warnings from `AccountDetailScreen` async query updates. No assertion failed.

Not completed here:

- Full R02 Android matrix, iOS evidence, and every exhaustive manual edge case remain open in `tasks.md` unless explicitly checked.
