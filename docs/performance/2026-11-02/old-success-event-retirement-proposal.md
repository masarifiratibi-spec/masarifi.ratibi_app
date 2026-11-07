# Proposed retirement of historical operational success notifications

**Completed after explicit user approval on 2 November.** The original plan protects pending operations, so this specific approval retired only the exact historical success-notification group below. All 408,734 rows were encrypted off-host, restored/hash-verified, then removed in 409 bounded committed batches after a first-batch rollback check. Postflight at 08:08:49 UTC found zero eligible rows remaining. [Execution and recovery evidence](old-success-event-retirement-evidence.json).

The 07:49:19 UTC live inventory identified **408,734 candidate rows** out of 551,154 total Outbox rows. The exact proposed predicate is:

```sql
event_type = 'operations.job-succeeded'
and aggregate_type = 'job_run'
and created_at < '2026-10-03T00:00:00Z'::timestamptz
and published_at is null
and (locked_until is null or locked_until < now())
and not exists (
  select 1 from public.notification_events n where n.source_event_id = o.id
)
```

No foreign-key references to Outbox were found. That alone does not prove that an unpublished event has no intended recipient. The source's current platform queue has no implemented downstream consumer, and Admin history reads job tables rather than these notification rows. Treating these exact historical success notifications as archived terminal telemetry is a policy decision, not an automatic repair of `published_at`.

If approved, implementation must first export the exact candidate snapshot to the existing encrypted off-host recovery destination, record per-batch IDs/content hashes and an overall manifest, and restore/hash-verify it in isolation. Delete only matching archived unchanged rows in bounded transactions, rechecking leases and references. Preserve all failures/dead letters, financial/domain events, newer success notifications, job-run/attempt history and other pending work. Do not enable consumers, replay events or falsely mark them published.

The first pass is a fixed-cutoff retirement, not a new automatic age-based deletion policy. Ordinary vacuum may make space reusable without shrinking disk files. Physical compaction, if needed, requires separate tested maintenance; no filesystem-reclaimed-byte promise is made here.

The new live zero-claim success suppression already stops the proven unnecessary event generation independently of this decision. Existing required application services and their data remain unchanged by the proposal.
