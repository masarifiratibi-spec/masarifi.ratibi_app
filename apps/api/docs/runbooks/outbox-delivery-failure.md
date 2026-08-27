# Outbox Delivery Failure

Platform Operations owns this runbook. Alert warning when unpublished depth is
above 10,000 or oldest age exceeds 5 minutes for 5 minutes. Alert critical when
depth exceeds 50,000, oldest age exceeds 15 minutes, terminal failures are
nonzero, or publication throughput is zero while eligible rows exist for 2
minutes. Page the Backend on-call; escalate a confirmed Supabase Queue outage to
the managed Supabase owner.

## Diagnose

1. Confirm API financial writes remain available and worker readiness/logs are
   bounded and free of payloads.
2. Compare unpublished depth, oldest age, active/expired leases, claim P95,
   retry/failure rate, queue latency, worker CPU/memory, event-loop lag, and pool
   saturation.
3. Check the logged `platform-events` queue and worker database role. Never use
   a client credential, `pgmq_public`, or expose queue contents to clients.
4. Sample only IDs, event types, attempt counts, safe error codes, and lease
   timestamps. Do not inspect or export payloads into tickets or chat.

## Recover And Replay

Stop new claims before changing worker capacity. Restore the queue or database,
then restart one worker and let expired leases become eligible through
`private.claim_outbox_batch`. At-least-once replay can duplicate delivery;
consumers must use `eventId` idempotency. Increase workers only after claim P95
remains below 50 ms and pool headroom is healthy. Terminal rows remain the
recoverable source and are replayed by an approved forward operation after the
root cause is fixed. Never delete, truncate, rewrite payloads, reset attempts,
or mark rows published by hand.

## Close

Close only after depth and oldest age return below warning thresholds for 30
minutes, terminal failures are reconciled, every sampled source ID remains
queryable, duplicate delivery is a deterministic no-op, and P50/P95/P99 plus
EXPLAIN evidence is attached to the incident. Backend on-call and Platform
Operations both approve closure.
