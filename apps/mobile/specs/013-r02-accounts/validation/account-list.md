# R02 Account List Evidence

Date: 2026-08-15

Implemented:

- Account List now consumes `useAccountBalances(true)` instead of deriving balances from a transaction page.
- Replaced repeated `AccountCard` hero cards with virtualized section rows using `AccountRow`.
- Added active and archived account sections.
- Loading and error states now wait for/refetch account balances as well as accounts.
- Empty search distinguishes no account data from no matching results.
- Hidden/unknown balances are mapped through the R02 projector and never rendered as zero.

Verification:

- Included in focused R02 Jest command recorded in `shared-foundation.md`: PASS.
- Included in quickstart Jest command recorded in `shared-foundation.md`: PASS.

Open:

- Complete dense-device matrix and iOS visual evidence remain open.
