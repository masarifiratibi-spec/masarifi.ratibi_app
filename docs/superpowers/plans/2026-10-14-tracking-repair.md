# SMS and financial notification tracking repair

Goal: implement the approved 14 October Tracking repair using existing capture, encrypted queues and ledger infrastructure.

Baseline: codex/voice-promoted-operating-2026-10-13 at 4a2b8654a0e2a6782eef6341ad36be453bd45b7c.

## Constraints

- Preserve the pre-existing API quota metadata patch, profile evidence and untracked recovery documents.
- Preserve legacy imports, owner restoration, authentication, ledger, Manual and Voice behavior.
- No deployment, physical-device operations, posting activation, real financial tests or replay/backfill without their separate scope.
- DEV is the application qualification target. Local database tests must be financially disposable.

## Tasks

1. Unify live keyword configuration; persistent default deletion; binding compatibility and queue preservation.
2. Persist source activation boundaries and enforce financial-source admission with chat exclusions.
3. Deterministic Arabic numbers, currency-free amounts, clause-scoped roles and private unresolved evidence.
4. Versioned nominal-default-account imports with authoritative account/category resolution and unchanged numerical amounts.
5. Movement idempotency, automatic recovery and quiet finance reconciliation.
6. Focused and broad local verification, disposable-database qualification, independent combined review, and a concrete DEV/Staging qualification scope.

## Acceptance

All approved review findings have executable regressions. Eligible completed outgoing/incoming captures create expense/income through LedgerService on the default account, without FX conversion or success notifications. Equal values alone do not prove duplicates. New capture starts at source activation; pending data survives source disablement and restart. Historical queues retain original policy/identity and are not drained during qualification.
