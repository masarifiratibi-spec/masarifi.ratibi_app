# Guarded hosted compatibility: prepared continuation

**NOT READY for canonical cutover. No live DDL or history repair has been dispatched.** The isolated three-helper proof is complete for its bounded scope; it does not resolve the remaining history/capability/recovery gates.

The exact tested private additive SQL artifact is `clone-helper-artifact/supabase/migrations/20261102111014_clone_only_additive_helpers.sql`, SHA-256 `8544f0d66e294ccaea96ef53739895ed2e594c6c1891804a5ea9a4db2db56e6a`. It was created by the discovered Supabase CLI and tested as a complete transaction under the migration owner, actual nonsuperuser worker, and two real nonsuperuser operator membership shapes. See the [isolated report](isolated-helper-compatibility-report.md).

## What this artifact establishes

It can add exactly the three absent helper signatures to the frozen partial schema, with unchanged existing function definitions, owner/RLS prerequisites, worker-only execute grants, exact membership restoration, failure rollback and repeat-apply rejection. It does not install the containing historical migrations in full. Tracking finalizer wrappers and the two reminder consumers remain outside this slice. Its direct test does not call a provider, claim production work, finalize deletion or access Storage.

The clone-only file is not a canonical fresh-install migration: on a canonical fresh database these functions already exist, so its absence guard correctly rejects it. Do not copy it unmodified into the repository migration chain or record the older whole migrations as applied because their helpers now exist somewhere.

## Before any hosted additive dispatch

1. Freeze a forward/operator packaging decision that accurately records only the three additions. Preserve all applied immutable SQL and hosted-only records. Do not bypass the canonical runner's ordered-prefix guard.
2. Recheck the exact project/server version, executor identity, all frozen relation/column/owner/RLS/policy/function/role prerequisites, missing signatures, enabled event-trigger definitions and grants. Acquire the existing migration advisory lock `5574319470126001` (from `apps/api/src/platform/database/migration-runner.ts`) with bounded lock/statement deadlines. A changed prerequisite requires reconciliation, rather than relaxing the guard.
3. Preserve the current hosted metadata/history and exact rollback artifact off-host. The historical clone has171 history rows; live has174, including three already-applied maintenance migrations. Those newer changes and their SQL bytes are protected. Full portable/application recovery is still incomplete.
4. Ensure transaction wrapping, grantor-specific role restoration, acknowledgment and post-commit verification use the actual hosted executor. Keep a separate one-shot marker and reconcile an uncertain outcome before retry. Compare every unrelated object/membership fingerprint and the three exact new definitions/ACLs; require the containing migrations' remaining components to stay explicitly unqualified.

## History work remains a separate artifact

The four timestamp/outer-whitespace-equivalent pairs in the [compatibility report](hosted-schema-compatibility-report.md) remain candidates only. Before a history-only repair, qualify exact row names, source/target version presence, statement-array cardinality, original untrimmed SQL hashes, independently verified trimmed equivalence and advisory/row locking on a disposable historical transaction. Require four affected rows and unchanged name/statement bytes and unrelated history/membership fingerprints. All changes must be atomic with explicit acknowledgment and read-only reconciliation.

Do not combine that operation with helper DDL, replay the old SQL, delete hosted-only records, or stamp the other missing versions by name. Even repairing all four leaves eleven missing canonical versions and three hosted-only records. A three-helper addition does not resolve salary, financial-semantics, finalizer, compensation, reminder-consumer or other partial-backport decisions.

Current original APIs/workers must continue serving required workloads. No canonical backend deployment, consumer activation, representative capacity acceptance, complete rollback/RTO or24-hour canonical observation has occurred. Existing-account tests remain read-only.
