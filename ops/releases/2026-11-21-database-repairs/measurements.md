# Local database qualification, 21 November 2026

Performance replays used isolated PostgreSQL 18.6 fixtures. Both branches also applied all 198 migrations in sequence on PostgreSQL 17.6 with PGMQ 1.5.1, matching the recorded production versions. These combined fixtures provided local storage metadata tables. Each passed 109 live integration tests for voice, reports, N+1 and imports, plus SQL checks for retention/restore, receipts, idle completions and scoped claims. Measurements use synthetic records. Times are elapsed database or worker times for the indicated operation.

| Workload | Android | iOS |
| --- | --- | --- |
| Voice, 20 arrivals after idle, extraction pickup P95 before → after | 469 → 488 ms | 473 → 455 ms |
| First pickup after a separate 43-second idle period / restart | 230 ms / 5 ms | 319 ms / 4 ms |
| Four changed imports among 10,000 completed sessions and 40,000 historical items, median before → after | 22.288 → 1.413 ms | 22.359 → 1.481 ms |
| Same change count among 1,000 sessions, median before → after | 3.221 → 1.605 ms | 3.228 → 1.661 ms |
| Eight sessions of 10,000 items each, worst of 25 calls with a 2-second statement timeout | 512 ms | 190 ms |
| 1,000 empty scoped scheduler calls with 25,000 completed runs and attempts, median of five repetitions after warmup | 63.8 → 30.7 ms | 65.9 → 34.6 ms |
| Bounded archive, 27,320 eligible runs with one attempt each out of 375,000 runs, P95 time per batch | 46.3 ms | 38.7 ms |

In a matched 43-second driver-level voice replay, SQL requests including transaction control fell from 2,953 to 482 (83.7%). Empty source and delivery selectors each fell from 86 to 11. Heartbeats fell from 180 to 30. The replacement read-only probe ran 75 times. Across the paired voice arrival trials each fixture produced one financial transaction and one confirmation per capture. After a sender crash the old lease expired before redelivery. The separate branch-specific idle tests saw maximum heartbeat gaps of 4.05 seconds. Financial pickup and delivery recovery have different schedules.

In each import fixture the ninth fully populated session remained queued after the first eight were reconciled. Tests checked rollback, concurrent writers, competing workers, recovery from historical drift and one completion per transition. The high-fanout application call included the normal pool and worker role, finishing in 115 ms on Android and 452 ms on iOS. The scheduler can process a maximum of eight sessions per call by default; measure saturation and the oldest outstanding marker during release.

For the earlier requested-PDF change, a 32-second idle window reduced selectors from 126 to 2 and database commands from 630 to 11. The local SMTP acceptance P95 changed from 543 to 85 ms on Android and from 540 to 80 ms on iOS. This measures transport-server acceptance.

For each branch, 1,440 synthetic empty deletion completions produced 1,440 outbox events before the change and zero afterward. All 1,440 runs and attempts survived. Checks cover successful work, pending uploads, lease competition, failed attempts, retries and nonnumeric summaries. In PostgreSQL, the queue consumer recorded 96 distinct SMTP acceptances in three batches of 32 with two concurrent consumers. Transaction rollback restored the queue and receipt together. Malformed messages were isolated, duplicates were deduplicated and both historical boundaries held.

The history replay archived 27,320 runs plus their attempts in 110 calls, keeping 347,680 newer pairs live. The typed archive occupied about 10.8 MiB including its indexes. Local restoration matched all checked fields and preserved retry ancestry. At 250 runs per five-minute slot the upper bound is 72,000 runs/day. Actual throughput depends on worker availability and locks.

The production ledger had already recorded the Nov 20 routine-success migration. Both branches now include its exact checksum-verified historical SQL so that the release inventory matches that ledger. Runtime and ownership decisions for the 45 overdue registry entries use the release inventory, verified job scopes and feature-owner policy. The prior 272,138 outbox events remain protected. Production cron dispatch, API p95 at peak and actual queue lag are still measured at rollout.

The initial iOS run exposed the missing OpenAPI contract for the bank SMS endpoint. After documenting the existing route and checking its runtime operation ID, the API unit and contract suites passed 2,642 of 2,642 tests on Android and 2,631 of 2,631 on iOS. The PostgreSQL 17.6 integration run passed 109 of 109 on each branch.

## Primary production verification

At 14:05 Riyadh time, the primary server matched all six migration checksums. The API and five release workers were running with zero restarts. Both public health endpoints returned 200. An unauthenticated JSON POST to the bank SMS receipt endpoint returned 401. The rollout readiness check initially rolled back the application containers because the database connection string supplied the production-specific listener name. After the check accepted that name and verified the actual listener query, the same bundle completed. The migrations ran once.

The receipt consumer committed at 14:00 and 14:05. The import reconciliation execution counter advanced from one to two, and its pending marker count was zero after each cycle. Receipt health reported zero issues and no lag alert. History retention, import parsing, account deletion, financial reset cleanup, outbox dispatch and sync retry each recorded a successful run after activation. The operating voice heartbeat was under 12 seconds old.

The production email selector ran twice in a 43.2-second idle window, down from 170 calls in the earlier 43-second sample. Both samples returned zero rows. A longer post-release sample recorded 14 calls in 199.3 seconds. Delivery latency above comes from the local SMTP acceptance tests.

## Sync retry scheduler

Production applied migration `20261121143500` once at 19:32:55 Riyadh on 21 November. Before deployment, a 61.3-second sample had six mutation claim calls, six empty runs and zero claimed rows. After deployment, a 100.4-second sample had zero mutation claims and zero runs. Mutation table insert, update and delete counters stayed flat in both windows. The scoped scheduler, shared by several workers, still averaged five calls per second across those workers. These samples contained no real arrivals.

The subsequent worker change uses one SQL command for a scoped poll on an initialized worker connection. In a local PostgreSQL 17 replay on each branch, 600 idle polls required 3,000 driver commands before the worker change and 600 afterward. Both versions recorded zero empty runs. A new mutation and an expired lease were picked up on the first due poll on both branches. A separate two-worker test under a restricted login produced one claim and verified that worker claims were visible during the insert and the previous session context was restored afterward. These worker measurements are local.
