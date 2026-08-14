# T060-T065 review handoff

Scope:
- `apps/mobile/src/features/assistant/assistant-context.test.ts`
- `apps/mobile/src/features/assistant/assistant-context.ts`

Implemented/fixed:
- Context input is typed to real `CoreFinanceService`, `FinancialPlanningService`, and `ReportsService` picks.
- Finance reads use a complete period-bounded `TransactionFilterSet` from `report.period`, paged at 100.
- Report source version uses `generatedAt`; context `dataAsOf` uses report-owned `dataAsOf`.
- Assistant no longer calculates transaction totals. Report-owned money values and safe planning values are persisted.
- Conflicted obligations/goals are excluded from sources and cannot affect obligation payable values.
- Review/conflict/non-current transaction states are excluded; pending local confirmed transaction is included and labeled.
- Pending planning contributes incomplete/pending labeling instead of silently disappearing.
- Snapshot excludes raw notes, merchants, account IDs, planning linked/funding account IDs, provider names, and planning notes.
- Snapshot is immutable.

Fresh verification:
- `npx jest --runInBand src/features/assistant/assistant-context.test.ts` - PASS, 2/2.
- `npm run typecheck` - PASS.

