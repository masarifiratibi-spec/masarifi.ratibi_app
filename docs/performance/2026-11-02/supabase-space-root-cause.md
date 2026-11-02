# Why a small user population accumulated database load

Measured on 2 November 2026, 07:32–07:41 UTC. This report separates stored data, recurring work and managed-host memory. [Catalog and aggregate evidence](supabase-space-attribution.json).

## Stored bytes come mainly from background bookkeeping

| Relation | Total bytes, including its indexes | Meaning |
| --- | ---: | --- |
| `private.outbox_events` | 327,499,776 | Approximately 550,000 retained domain/operations events |
| `private.job_runs` | 36,388,864 | Scheduled execution history |
| `private.provider_health_checks` | 14,688,256 | Historical shallow provider checks |
| `private.job_attempts` | 14,123,008 | Scheduled attempt history |
| `cron.job_run_details` | 4,112,384 | Cron execution logs |
| `public.transactions` | 442,368 | 80 transactions at this snapshot |

The database occupied 435,457,171 bytes. Outbox alone was **75.2%** of that figure; Outbox, job runs, attempts and provider checks together were **90.2%**. The complete public schema occupied only 10,280,960 bytes. Storage held 37 objects with metadata-reported body sizes totalling 59,793 bytes; object bodies are a separate service and are not the source of the large database table.

These are relation-size measurements, not financial content. Table row counts from `pg_stat_user_tables` are estimates; event/status group counts were explicit SQL counts. Dashboard disk usage around 0.74 GB also includes overhead outside this database-size measure and was observed at a different time. No precise WAL/system breakdown is inferred from their difference. The managed OS root filesystem is separate from the project's displayed 2 GB database volume.

## Why the events were generated

The exact event counts included 533,334 `operations.job-succeeded`, 12,994 failed and 1,828 dead-letter events. The week beginning 28 September alone generated 461,792 Outbox rows. These are historical scheduler outputs, not hundreds of thousands of transactions.

The code registers `sync-mutations.retry` every ten seconds. It claims due mutations, returns the number of executable claims, then records a successful scheduled run even when the count is zero. `private.complete_job_attempt` previously emitted a new durable success event for every such completion. In the measured last hour, **345 run summaries all reported `processed:0`**. In the measured last 24 hours, the scheduler created **3,450 successful sync runs and 3,450 corresponding success events**. This is the reproduced event-amplification defect.

Zero executable claims does not prove zero database work: dependency rejection can still update mutation state before returning no runnable items. Therefore the correction retains the job run, attempt, result summary, terminal timestamps, version, metrics and dependency/error handling. It suppresses only the redundant success notification for the exact validated zero-count sync case. Other jobs, nonzero successes, missing/differently typed summaries, failures and dead letters retain their event behavior.

Migration `20261102073431` was applied once at approximately 07:44 UTC after 14 real SQL regression cases, non-superuser role/ACL preservation, drift rejection and rollback checks passed. At 07:45:50, **nine naturally occurring zero-claim sync runs had completed with zero corresponding success events**, while their run history remained present. Full function ownership, SECURITY DEFINER, empty search path, execute grants and role-membership fingerprint remained unchanged. This is a small live correctness window, not a long-term growth or API latency benchmark. [Growth-fix evidence](supabase-growth-fix-evidence.json).

## Why old rows remained

533,331 of the success events were unpublished at the snapshot. Publishing currently sends an event to the platform queue and then marks the Outbox row published. Unpublished therefore means dispatch was absent, excluded or unsuccessful; a missing downstream consumer alone does not explain that status.

Current source has no implemented `pgmq.read/delete/archive/pop` consumer for that platform queue. Enabling the broad dispatcher would move/copy this backlog into another queue without qualifying its consumption. Existing `operations.job-history-retain` uses the configured 90-day job-history policy and a 35-day provider-check policy; it does not retire Outbox or queue messages. Most retained job rows are not yet 90 days old. No supported archival/disposition contract currently proves that these unpublished events may be discarded.

Pending events, financial data, user identities and private Storage objects remain protected. The large backlog needs explicit event disposition with verified export, lease exclusions, an exact allowlist/cutoff, bounded deletion and recovery tests. It was not truncated or marked published to improve a dashboard number.

## Cleanup completed without changing those contracts

The earlier redundant queue index removal reclaimed 30,113,792 net database bytes. The useful voice-confirmation partial index occupies only 16,384 bytes. Tuned Outbox autovacuum subsequently reduced its dead-tuple estimate to zero.

An additional **5,760 provider checks** older than the existing 35-day retention cutoff were exported into protected encrypted off-host recovery material. The archive was decrypted in memory and restored into a temporary isolated PostgreSQL table: all 5,760 server-side row hashes matched. A writer lock then protected the exact archived fingerprint during a single atomic cleanup, in six batches of at most 1,000. The one-second lock deadline, five-second statement deadline, trigger/foreign-reference guards and exact role restoration remained enforced.

Deletion completed at 07:41:01 UTC. Verification found zero rows before the fixed cutoff, 40,512 newer checks retained, unchanged financial counts (13 accounts, 80 transactions), and unchanged complete role-membership fingerprint. The table's physical size remained 14,688,256 bytes: **no additional filesystem-reclaimed bytes are claimed**. Space can be reused; no locking `VACUUM FULL` was run.

The unused target-version test image was separately removed after proving zero active/stopped container references and preserving the previous restore image, all volumes and container states. Actual VPS disk availability increased 1,570,017,280 bytes. This is VPS image cleanup, not Supabase database reclamation.

## Memory and CPU

The paid organization retained legacy Nano compute, up to 0.5 GB. The user-approved same-price Micro resize completed and provides 1 GB nominal RAM. Supabase documents that paid Nano is billed like Micro and is not automatically resized because doing so interrupts connections. [Official compute guidance](https://supabase.com/docs/guides/platform/compute-and-disk).

At 07:37:59 UTC, the managed-host Metrics API reported **443,285,504 available bytes of 948,191,232 (46.75%)**, with about 482 MB cache and load1 0.11. PostgreSQL has 256 MiB shared buffers, 3,500 KiB work_mem per eligible operation and a 60-connection maximum. Cache, shared memory and memory used by the platform exist even with few users; those counters overlap and must not be summed as independent allocations.

Earlier five-minute CPU counter deltas showed 3.47% busy including 0.36% I/O wait. At 07:38, the application had three idle API and thirteen idle worker database sessions in the point sample, with none active. These observations do not show current exhaustion or prove a leak. Historic long-running lookup queries, session capacity and unnecessary scheduler writes are concrete causes to correct; dropping OS caches or inflating connection/memory limits would not address them.

The lookup index's live empty-result window captured 199 calls with 1.355 ms mean execution, but no API p95 or authenticated app speedup is claimed. [Exact lookup evidence](live-voice-lookup-window.json). Production remains **NOT READY** until current artifact, route/worker, authenticated read, restore and rollback gates pass.
