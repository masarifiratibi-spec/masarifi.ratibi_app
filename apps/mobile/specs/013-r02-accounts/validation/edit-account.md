# R02 Edit Account Evidence

Date: 2026-08-15

Implemented:

- Edit mode initializes from loaded account data and keeps currency read-only.
- The edit route preserves existing loading, missing, error/retry, and back recovery states.
- Omitted optional fields now survive edit in the existing mock service path: `institution`, `lastFour`, `creditLimitMinor`, `iconKey`, `colorKey`, and `notes`.
- Dirty dismissal and field/form error states are shared with create mode.

Verification:

- `npm run test -- src/services/mocks/core-finance-accounts.test.ts` PASS: 1 suite, 4 tests.
- Included in focused R02 Jest command recorded in `shared-foundation.md`: PASS.
- Included in quickstart Jest command recorded in `shared-foundation.md`: PASS.

Open:

- Repository-specific optional-field regression is still not separately added; service-level regression covers the current update path.
