# Job-history retention and restore

The existing `operations.job-history-retain` handler moves at most 250 terminal runs and their complete attempts into two private, lightly indexed archive tables per claim. The live history window is the greater of 90 days and `operations.history.retention_days`. A run with a running or recently completed attempt stays live. A live retry child keeps its parent online. Older descendants move first and retain their original parent IDs. Terminal states include success, failure, dead letter and cancellation.

One five-minute schedule has 288 slots and capacity for 72,000 runs/day, compared with the observed 27,320/day. At that arrival rate 110 full or partial slots/day suffice. Attempts have ten numbered slots per run. Both copies and removals share one transaction, which compares all columns and row counts before commit. The worker's existing database pool caps each statement at two seconds and the archive function caps lock waits at 250 ms. A locked run is skipped. A timed-out attempt lock aborts the batch. The provider-check sweep keeps its existing 35-day window and 1,000-row bound, and a successful sweep is recorded in the job summary once per UTC day.

## Rollout

1. Verify backups include `private.job_history_archive` and `private.job_attempt_history_archive` when these tables exist. Rehearse sample restoration on a disposable database with the deployed PostgreSQL major version. Both tables retain records indefinitely. The same-database archive still consumes storage. Apply future changes to run and attempt columns to their archive counterparts in the same migration.
2. On a populated installation, prebuild both indexes using an authorized table owner, in autocommit. Each command needs its own transaction. An interrupted concurrent build can leave an invalid index. Inspect `pg_index.indisvalid` and `indisready` and repair any incomplete build before proceeding.

   ```sql
   SET lock_timeout = '1s';
   CREATE INDEX CONCURRENTLY IF NOT EXISTS job_runs_retry_parent_idx
     ON private.job_runs(retry_of_run_id) WHERE retry_of_run_id IS NOT NULL;
   CREATE INDEX CONCURRENTLY IF NOT EXISTS job_runs_completed_retention_idx
     ON private.job_runs(completed_at,id) WHERE completed_at IS NOT NULL;
   ```

3. Apply migration `20261121101100_archive_job_history` through the normal migration runner. It validates the indexes, replaces the old destructive retention branch and updates only this job's interval. It preserves the scheduler's enabled setting.
4. Use one dedicated instance of the built backend worker image with the following entry point and environment in addition to its normal private runtime configuration. Verify the deployed image implements the four-argument scoped claim before startup. Keep the scope explicit throughout restart and rollback.

   ```sh
   env MASARIFI_PROCESS_KIND=worker \
       MASARIFI_OPERATIONS_JOB_KEYS=operations.job-history-retain \
       MASARIFI_AI_ASSISTANT_ONLY=false \
       MASARIFI_VOICE_ANALYSIS_ONLY=false \
       node dist/src/worker.js
   ```

5. Check the first completed run and attempt, its result summary, and that the instance claims only this job. A zero-row successful batch is expected until records have aged past the cutoff. Stop this dedicated worker on lock timeouts, increased API p95 during comparable traffic, or persistent backlog growth. Diagnose before restarting. Keeping the migrated handler in place permits safe resumption from the remaining live rows.

## Measurement

Record the following snapshot daily. Compare the byte and dead-tuple changes, elapsed time since autovacuum and the number of rows moved with the same interval's workload. VACUUM can reuse freed live pages. An immediate drop in allocated live bytes is unnecessary.

```sql
SELECT clock_timestamp() AS sampled_at, relname, n_live_tup, n_dead_tup,
       pg_relation_size(relid) AS heap_bytes, pg_indexes_size(relid) AS index_bytes,
       pg_total_relation_size(relid) AS total_bytes, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname='private' AND relname IN
  ('job_runs','job_attempts','job_history_archive','job_attempt_history_archive')
ORDER BY relname;

SELECT (queued_at AT TIME ZONE 'UTC')::date AS utc_day,
       count(*) AS retention_runs,
       count(*) FILTER (WHERE status='succeeded') AS successful,
       sum((result_summary->>'runsArchived')::bigint) AS runs_moved,
       sum((result_summary->>'attemptsArchived')::bigint) AS attempts_moved
FROM private.job_runs
WHERE job_key='operations.job-history-retain' AND queued_at>=now()-interval '7 days'
GROUP BY 1 ORDER BY 1;
```

On a read replica or restored snapshot, count completed runs and attempts over matching time windows to establish the daily arrival rate. Compare eligible terminal backlog before and after the rollout. A growing queue of protected retry parents can be explained by following `retry_of_run_id` in both tiers.

## Restore

Pause the scoped worker for an in-place investigation. Prefer an isolated restore database for a drill. Run the example with `psql` as the authorized archive owner and set `run_id` to the requested UUID. The first query lists its archived ancestry and restores any archived ancestors in parent-first order. Both the schedule reference and original run/attempt IDs must be available. The restore verifies every copied field before removing the archive copy. A conflicting live ID, missing parent or incompatible column causes transaction rollback. A repeat call for a run already restored returns false.

```sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE masarifi_migration;
SET LOCAL statement_timeout = '2s';
WITH RECURSIVE ancestors AS (
  SELECT id,retry_of_run_id,0 AS depth,ARRAY[id] AS path
  FROM private.job_history_archive WHERE id=:'run_id'::uuid
  UNION ALL
  SELECT p.id,p.retry_of_run_id,a.depth+1,a.path||p.id
  FROM ancestors a JOIN private.job_history_archive p ON p.id=a.retry_of_run_id
  WHERE NOT p.id=ANY(a.path)
)
SELECT format('SELECT private.restore_job_history(%L::uuid);',id)
FROM ancestors ORDER BY depth DESC \gexec
SELECT r.id,r.retry_of_run_id,r.status,r.version,a.attempt_no,a.status AS attempt_status,a.safe_error_code
FROM private.job_runs r LEFT JOIN private.job_attempts a ON a.run_id=r.id
WHERE r.id=:'run_id'::uuid ORDER BY a.attempt_no;
ROLLBACK;
```

For an authorized in-place restore, commit after checking the result. The next retention cycle can rearchive restored old runs. Audit, financial and outbox records have their own lifecycle.

## Local qualification

On an empty disposable database with the migrated operations schema, run `psql -X -f verify.sql` and `psql -X -f benchmark.sql`. Both scripts roll back their fixture transactions. The benchmark builds 375,000 runs and one attempt per run and processes one day's 27,320 eligible runs via separate SQL statements. Reported handler times exclude fixture setup, commits, scheduler delays, and concurrent API traffic. The FK probe reports its actual execution plan and buffers.

Local PostgreSQL 18.6 on Windows, 21 November 2026. The lab used the repository's operations tables, constraints, policies, triggers and worker routines, with minimal external catalog prerequisites. One eligible day contained 27,320 runs and 27,320 attempts. Each tree moved exactly that many rows of each kind in 110 statements and retained 347,680 recent runs with their attempts.

| Source tree | Total handler time | Batch p95 | Slowest batch | Retry-FK probe before / after index |
| --- | ---: | ---: | ---: | ---: |
| Android | 4.290 s | 46.3 ms | 87.0 ms | 45.816 / 0.025 ms |
| iOS | 3.303 s | 38.7 ms | 66.6 ms | 35.522 / 0.020 ms |

Both probes went from scanning 375,000 runs (8,334 buffers) to a partial-index lookup (2 buffers). Each run produced 11,321,344 allocated bytes across the two archive tables and their indexes. A separate two-connection test skipped a locked run and received a lock-timeout error after 269 ms for a locked attempt on each tree. Both rolled back the failed archive move. Each tree's actual scoped OperationsWorker then completed one retention run and restored the sample. Production API latency, PostgreSQL 17 plans, replication lag and concurrent autovacuum behavior require observation on the target workload.
