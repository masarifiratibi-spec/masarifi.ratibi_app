# Account voice and transaction correction implementation plan

> Execute inline with superpowers:executing-plans, using red/green regression checks per task.

**Goal:** Correct a mistaken manual income/expense and capture voice using the account open when recording starts, with verified normal authenticated Staging posting.

**Architecture:** Extend the existing versioned ledger revision with an allowlisted income/expense kind change and append the net posting adjustment atomically. Pass an optional captured account ID through the existing durable voice journal and strict API DTO into the server-owned voice context. Existing owner, account/currency, quota, auth, worker and idempotency checks remain authoritative.

**Spec:** User request in this chat: manual expense-to-income correction; voice defaults to the open account and its currency; ordinary valid users can use normal posting. With no selected account, retain the server default. Explicit unambiguous spoken account/currency remains validated; ambiguity never authorizes a guessed posting.

**Constraints:** Same worktree and branch; deploy only Staging. No Production activation, authentication bypass, customer record edits, historical replay or direct balance edits. Use temporary fixtures/rollback database tests, and ask the user to make the final physical voice recordings when needed.

## Tasks

- [x] Add failing mobile/API/SQL regressions for expense↔income revision, correct net balances, stale version, refunded original, foreign owner and unsupported kinds. Extend only the existing mutation contract, preserve immutable posting evidence and audit revisions; validate with PostgreSQL.
- [x] Add failing capture/journal/API/SQL tests for selected account, switched account during recording, omitted account, wrong owner/inactive account and recovery. Persist selection at capture start; forward it to the existing default-account context with server validation.
- [ ] Verify normal authenticated voice ingress, worker and posting on Staging for independent owners/currencies; investigate any failure at its actual boundary. Preserve existing quota and failure controls.
- [ ] Review runtime/test diffs; scoped tests, typechecks, builds and migration validation. Apply Staging migration and route only affected API paths to a verified candidate, retaining existing releases for rollback.
- [ ] Build/install DEV APK without clearing data. Verify manual type correction and new voice posting with the user, record evidence, push the same GitHub branch and document exact limits.

## Evidence before Staging API release

- Mobile: 6 scoped suites / 275 tests passed. API: 4 scoped unit suites / 104 tests passed. Actual PostgreSQL receipt integration: 4 tests passed, including both corrections, replay, original posting retention and corrected-then-reversed detail parsing.
- Staging forward migrations applied on 2026-10-21. Both rollback SQL scripts passed against deployed functions; their synthetic fixtures leave no committed records. Voice checks cover independent owners, EGP/SAR, omitted-account fallback, foreign/archived rejection, selected account beyond the 20-account alias window and an actual leased assistant message regression.
- API build and scoped lint/checksum validation passed. Physical recording and deployed API acceptance are pending.
