# Supabase optimization and recovery — 2 November 2026

**Live recovery changes applied and verified. Production decision: NOT READY.** Work remains on `codex/voice-promoted-operating-2026-10-13`. Current evidence supersedes the earlier failed deployment attempts. No financial rows, users or Storage objects were deleted. The user separately approved retirement of 408,734 exact old operational success notifications after encrypted archival and full restoration verification; other pending events remain protected. The API/worker source corrections are tested but not deployed.

## Completed changes

| Change | Verified live result |
| --- | --- |
| Nano → Micro | User-approved upgrade completed; 1 GB RAM; confirmation quoted $9.68/month before and after, +$0.00/month. Database restarted at 06:49:03 UTC. |
| Voice-confirmation lookup index | Valid/ready 16,384-byte partial index on `(aggregate_id, created_at, id) WHERE event_type='transaction.created'`; canonical migration `20261101223723`. |
| Redundant queue index removal | Removed only the 30,179,328-byte `outbox_events_claim_idx`; retained the valid/ready `(available_at,id)` claim-order index. |
| Table maintenance | Set only Outbox `autovacuum_vacuum_scale_factor=0.05`; autovacuum completed at 07:10:13 UTC. Dead-tuple estimate fell from 95,934 to zero at 07:22:28. |
| Runtime login defaults | Both existing runtime login roles now have `statement_timeout=2s`; connection limits remain 20. Applied in an explicit transaction through verify-full TLS and verified by the plugin at 07:23:09 UTC. Existing pooler backends are not retroactively reconfigured. |

Database size was 465,284,243 bytes before queue maintenance and 435,170,451 afterward: **30,113,792 net bytes less**. The removed index itself occupied 30,179,328 bytes; background growth explains the difference. Autovacuum makes dead space reusable; it does not guarantee disk-file shrinkage. This index-maintenance phase deleted no rows. The subsequently approved operational-success retirement is documented below; no `VACUUM FULL` or broad pruning was performed.

Both migrations preserved the complete `pg_auth_members` fingerprint `c47ffe096cd56bba3e213241d59cde5e`. MCP generated different timestamps, so only the two exact newly inserted history rows were reconciled to canonical source versions after matching name, statement count and SQL MD5. Other historical backports remain unreconciled: do not run the entire migration chain automatically.

## Why one or two users still produced pressure

The paid organization retained legacy Nano compute (up to 0.5 GB). Supabase documents that Nano in paid organizations is billed like Micro but is not automatically resized because resizing interrupts connections. The completed upgrade obtains the useful RAM increase without an incremental compute charge in the reviewed quote. [Official compute guidance](https://supabase.com/docs/guides/platform/compute-and-disk).

Background jobs run independently of user activity. The earlier isolated restore contained about 550,000 Outbox events, predominantly operations job bookkeeping; most were unpublished durable work. Their age does not establish that they are disposable. The deployed voice-confirmation lookup lacked an appropriate leading index, and live samples found its SELECTs active for 10–32 seconds. Its missing access path was a measured defect.

There are also 14 API and 11 worker processes using session pooling across two login roles. Their configured main pool maxima total 195, which is **not** 195 measured connections. A session pool has 15 backends per user/database pair; the 200 pooler-client limit is not 200 Postgres connections. Capacity errors caused repeated voice-worker restarts. Service consolidation requires feature/owner/lease reconciliation, not stopping necessary workers by age.

The source previously had a two-second client timeout without matching server cancellation. Tested source changes enforce a server deadline and handle only the provider's exact capacity error through existing bounded retry/revalidation. These changes preserve stricter deadlines, owner isolation and epoch/lease rules; they still need a qualified deployed image. [Runtime report](runtime-query-deadline-report.md).

## Current managed-host resources

Two privileged Metrics API samples used the existing protected key, verified HTTPS, bounded response size and no new monitoring service. At 07:17:41 UTC, MemAvailable was 456,826,880 / 948,191,232 bytes (**48.18%**); at 07:22:46 it was 416,227,328 (**43.90%**). The latter sample also had about 468 MB cache and load1 0.02. Low MemFree alone is not memory exhaustion; reclaimable cache contributes to available memory.

CPU counter deltas over those five minutes yielded **3.47% busy**, including **0.36% I/O wait**. Swap existed, but these samples do not establish current swap thrashing or a memory leak. They are descriptive snapshots, not a representative-load benchmark or a paired before/after experiment. Supabase metrics are separate from the VPS's roughly 75 GB free disk and more than 4 GB available RAM. [Sanitized live evidence](supabase-live-recovery-evidence.json).

## Verification and performance limits

The exact deployed lookup's inner read was tested on the prior isolated restore, with all ownership/epoch/profile/notification predicates retained. Six samples per phase had median **745.546 → 8.618 ms** after the partial index; result hashes matched the same empty-result case. One EXPLAIN per phase measured 716.837 → 0.559 ms and Outbox shared hits 82,877 → 50. This is an isolated access-path improvement, not live API p95 or delivery qualification.

Queue cleanup passed exact restored-schema and deployed-claim-function tests, including ordering, future/published/leased exclusions, concurrent disjoint claims, expired lease recovery, stale completion rejection and preservation of unrelated data. Exact canonical SQL also passed non-superuser membership restoration, transaction rollback and a conflicting-lock timeout. No queue throughput improvement is claimed from its one-sample plans.

The post-change live statistics window from 07:23:47 to 07:25:27 UTC captured **199 naturally occurring lookup calls**, 269.631 ms total execution and **1.355 ms mean**, with zero returned rows and unchanged statistics-reset identity. This establishes current server execution cost for that empty-result window, not API latency, p95 or a comparable live before/after speedup. [Exact counter evidence](live-voice-lookup-window.json).

Post-Micro advisors became readable: 97 INFO foreign-key index candidates, 59 INFO unused-index candidates, one RLS-initplan warning and six multiple-policy warnings require workload-specific review. Tiny relations and intentional owner policies are not automatically defects. Security notices concern private RLS-enabled tables without policies; default-deny remains intact. No blanket index creation/removal or access-policy weakening was performed.

## Best value within the existing Pro plan

Micro was the useful same-price compute correction. Daily backups are present, including the post-resize 2 November backup. Database backups exclude Storage object bodies, so the independent encrypted database and Storage recovery material remains protected. [Backup scope](https://supabase.com/docs/guides/platform/backups).

The primary gp3 allowance includes up to 8 GB disk, but the current allocation is 2 GB with approximately 0.74 GB provider-reported usage: capacity expansion is unnecessary. Keep default 3,000 IOPS / 125 MB/s provisioning, the existing shared IPv4 pooler and Spend Cap. Use included reports, advisors and the existing Metrics API before buying capacity. Do not treat the $10 organization-wide compute credit as $10 per project. [Compute usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [disk billing](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size).

No replicas, branches, PITR, dedicated IPv4, log drains, higher compute or other paid add-ons were enabled. Pro access to an add-on is not proof it is free. A dedicated pooler also consumes the same database resources and does not justify switching this session-role-dependent application to transaction pooling.

PostgreSQL 17.11.0.011 is offered, but the isolated target clone did not start and the target tests did not run. **The patch upgrade was not performed.** Existing 17.6 recovery witnesses do not qualify a new target version. Resolve the isolated startup failure and repeat the recovery/owner/query checks before upgrading the hosted database.

## Outstanding gates

The [space attribution follow-up](supabase-space-root-cause.md) identifies 90.2% of initial database bytes in Outbox/job/provider bookkeeping. The reviewed `20261102073431` correction is live: nine natural zero-claim sync runs retained their job history while producing zero redundant success events in the documented first window. An additional 5,760 expired provider checks were archived, restored/hash-verified and deleted under the existing 35-day policy. The separately approved 408,734 historical success notifications have now been archived, restored/hash-verified and retired. No additional filesystem shrink is claimed; other pending events remain protected. [Retirement evidence](old-success-event-retirement-evidence.json).

Rebuild and qualify the source fixes, reconcile required route/worker capabilities and hosted history, then deploy gradually with rollback. Renew the existing-owner/default-account preflight before benchmark login. Authenticated Arabic/English app timings and business-API measurements remain incomplete. Twenty Arabic guest launches have native Activity-draw p95 530 ms; that is not usable account readiness. Production remains **NOT READY**.

## Authenticated continuation

The existing-owner/default-account preflight passed before admission. The [authenticated mobile baseline](authenticated-mobile-baseline-report.md) now has 40 process-cold launches and 360 successful GETs across Arabic/English, plus 40 separate native HOT resumes and empty-state read-screen smoke observations. Cold p95 remains above 3 s. At 09:05:47 UTC, managed MemAvailable was 404,303,872 of 948,191,232 bytes (42.64%) and load1 was 0.22; this point-in-time sample is not a memory-leak verdict. A 09:06:53 catalog check retained 13 accounts/80 transactions/22 profiles, with 0 rows left in the exact approved old-success group. Outbox physical bytes remain 327,630,848 and database physical bytes 436,890,771: row retirement did not physically shrink the file. No additional cleanup or compaction ran.
