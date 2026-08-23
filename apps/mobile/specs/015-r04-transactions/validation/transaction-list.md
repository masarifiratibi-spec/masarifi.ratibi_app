# R04 Transaction List Evidence

Date: 2026-08-15

Implemented:

- Transaction List now maps each ledger item through `projectTransaction()` before rendering `TransactionRow`.
- Account/category lookup remains read-only and route behavior is unchanged.

Verification:

- Included in focused Jest command recorded in `shared-foundation.md`: PASS.

Open:

- Cursor accumulation/infinite paging, date section headers, next-page states, dense 1,000+ validation, and device evidence remain open.
