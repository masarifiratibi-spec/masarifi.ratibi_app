# Salary and obligations corrections

**Goal:** Fix all seven findings in the supplied 17 October salary/obligation review.
**Architecture:** Keep the existing planning API, owner-scoped transaction and ledger functions. Make payment creation/allocation a single idempotent API database transaction. Derive salary periods from confirmed receipt instants. Keep dates in the owner's timezone and expose existing manual review through the overview.
**Tech stack:** TypeScript/NestJS/PostgreSQL, React Native/React Query/Jest.
**Spec:** apps/mobile/specs/007-financial-planning/spec.md FR-003 through FR-008; user-supplied seven-finding review.

## Constraints
- Same branch codex/voice-promoted-operating-2026-10-13 and D:/Masarifi-integration-2026-10-10.
- DEV/Staging only. No real salary, payment or other financial write. Preserve Voice ON Posting.
- Preserve concurrent savings edits; snapshot preexisting diff outside Git.
- Execute in this session under the user's existing authorization; no separate agents/worktrees.

## Review focus
- Failure after ledger posting rolls back balance, transaction, payment and idempotency claim together.
- A retry returns the original payment; ambiguous/lost response cannot charge twice.
- Missing/late salary never fabricates income or daily allowance; actual cycle persists past the expected date.
- Undone receipts have null receivedAt; timezone boundaries and month-end dates stay consistent.
- Manual review only links existing confirmed owned income, prefills a real expected receipt, and displays mutation errors.

## Tasks
- [x] Reproduce seven findings with regression tests before changing implementation.
- [x] Payment: extend normalizePaymentCreate with exclusive transactionId/transaction creation input; use existing ledger normalizer. Post and allocate inside PlanningRepository's existing transaction/idempotency boundary. Mobile sends one payment command. Verify real local DB rollback, retry and owner isolation.
- [x] Salary period: add optional asOf date to summary. Query last valid confirmed receipt through asOf, sum same-currency cycle activity since actual receipt, reserve obligations through projected next date, expose start id/date. Test cross-month, overdue, reversed/undone and missing receipt cases.
- [x] Receipt: accept null received date for undone records, owner-zone dates, matching expectedAt instant, query invalidation and visible undo errors. Test actual SQL-shaped response.
- [x] Manual review: overview opens receipt review/picker of existing confirmed income, expected occurrence comes from server schedule/profile. Add safe empty/error states and verify navigation without confirming.
- [x] Obligation dates/amounts: reuse localDateInTimeZone and normalizeLocalizedNumber in creation/edit/installment/payment paths. Test Arabic separators and Riyadh midnight.
- [x] Dark mode: use theme content colors for salary detail labels/values; verify semantic colors in rendered tests.
- [x] Run focused API/mobile integration, contract, unit, typecheck/lint/boundary checks. Deploy approved API changes only to Staging, verify with rolled-back fixtures. Refresh DEV bundle once with Voice build flag preserved; inspect screens without Save/Confirm.
- [x] Review diff, commit only task-owned changes on the same branch, record evidence/handoff and report any remaining limitations.

## Verification before deployment
- Full mobile suite: 3,391 passed; four preexisting failures remain (three Voice visibility tests and report invalidation). Focused changes: 108 passed.
- API: 114 planning unit/contract, five security, 36 local real-database integration tests passed. Five Staging rollback qualifications passed; no fixtures persisted.
- API build, API/mobile typecheck and scoped lint passed. Staging migration applied as managed version 20261017145825; source version 20261017144514.
- Remaining rollout: immutable scoped API overlay and DEV screen inspection, preserving all existing containers and Voice ON Posting.

## Completed rollout — 17 October 2026
- API source commit 9f650fa54b06dee93deda400ac8e2b47c8a59dd6. Staging overlay ce35b711f187ef35dae45f88668b313e862941e95979ffe48d194a2f3a3b45ec at loopback 3018; only summary GET and payment POST moved. All 151 baseline containers preserved; Voice routes unchanged.
- Native DEV bundle refreshed with automatic Voice flag true. Authenticated Staging summary with asOf returned 200. Obligation overview/detail both show 2026-10-08 and remaining 10000 minor units.
- Salary setup inspected on the phone without saving. Primary owner still has no salary profile or receipts. Test balance remains 168600 minor units. Staging synthetic profiles count zero.
- Added one network-boundary regression for the Riyadh UTC-day boundary; passed. Final typecheck and scoped lint passed.
- Evidence: D:/Masarifi-preservation-2026-10-16/planning-seven-fixes-2026-10-17/completion.json. No GitHub push, real financial command, ordinary app or Production operation.
