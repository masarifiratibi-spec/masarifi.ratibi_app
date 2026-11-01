# Database connection incident — 1 November 2026

Status: **unresolved**. Investigate before authenticated startup qualification or production release. The independent native preference-persistence blocker has been repaired and device-verified; database admission is the current login gate.

## Observed evidence

At the later application-login preflight, the genuinely read-only owner check failed with `Connection terminated due to connection timeout`. The performance-advisor request separately failed its project-user check with the same connection-timeout class. Project management still reported `ACTIVE_HEALTHY`; that status does not establish working database admission. The public `/health/live` response remained200.

The following are log-event counts for **2026-11-01 15:15–15:49 UTC (18:15–18:49 Riyadh)**, obtained through read-only aggregate queries. No statements, credentials, financial contents or personal identifiers were exported:

| Source | Severity | Message category | Events |
| --- | --- | --- | ---: |
| PostgreSQL | FATAL | Too many clients | 4 |
| Shared pooler / Supavisor | ERROR | Too many clients | 2 |
| PostgreSQL | ERROR | Statement timeout | 33 |
| PostgreSQL | FATAL | Other messages containing timeout | 29 |
| Shared pooler / Supavisor | ERROR | Other messages containing timeout | 899 |

The too-many-clients records occur around15:15:12–15:15:16 UTC. Records from two services can describe the same failure; these are not six proven independent incidents or a count of affected requests. Generic timeout text is not yet attributed to a particular phase or query.

The first exploratory query searched structured attributes only and missed message text. The corrected counts above search the top-level `event_message` and retain severity. This distinction follows the provider's [log field reference](https://supabase.com/docs/guides/observability/log-field-reference).

## What is established and what remains unknown

Connection-capacity and statement-timeout failures are real observed signals. Their cause is not yet established. The original deployment contains25 HTTP API roles and 11 background roles, so aggregate connection budgets need review; the service count alone does not prove which process exhausted connections.

Do not solve this by dropping connections, restarting the database, increasing limits blindly, disabling isolation, or retiring a worker with unverified ownership. Collect current connection limits/activity, pool mode and configured per-role pool budgets; identify long/idle transactions and role/application attribution without exporting statement values. Compare failed-admission timing with service and queue behavior. Preserve pending work and idempotency.

SSH access from the workstation initially timed out after its egress address changed; the previous approved rule was source-specific. The user subsequently approved the new exact-source exception, and strict SSH was restored. No application service restart or route change was performed. This access problem and the database incident are separate observations; a shared cause has not been proven.

## Effect on qualification

The earlier exact-owner/default-account preflight passed, but it cannot substitute for the required immediate check before a new login. The current installed benchmark has persisted local first-launch completion and displays Google sign-in; Google has not been clicked while admission remains unresolved. No registration, account deletion or financial record was created to test the incident.

The completed isolated backup/restore evidence remains valid for its captured snapshot. Current live readiness, authenticated Release timings, cleanup eligibility and canonical cutover remain blocked. A successful health request or management status does not clear this incident.

## Later bounded diagnosis

At approximately19:36 Riyadh another read-only management SQL attempt to inspect connection-limit/aggregate-occupancy metadata failed at admission with the same connection timeout. It produced no occupancy result; no connection was terminated and no server setting was changed.

Static code/history inspection identifies external-provider awaits inside checked-out transactions in the Clerk identity repository and reminder push worker. These waits can occupy a client/transaction beyond the SQL query timeout; their involvement in this incident is unproven. The deployment inventory models340 default client slots across34 standard-source processes, or360 if two custom roles each follow the same one-pool contract. Conditionally enabled secondary pools can raise that model to360–640. These are possible client capacities, not measured sessions or a project-wide upper bound. Nine captured configuration files explicitly use maximum10 (three non-rollback and six rollback); they are not nine active process observations.

Next live evidence remains a bounded read-only collection of actual role/endpoint pool budgets, PostgreSQL/pooler admission limits, aggregate occupancy and wait classes, idle-transaction age and restart/poll timing. Do not attribute this incident or claim a speed improvement from static source patterns alone.

## Intermittent admission update

At approximately19:49 Riyadh, a new read-only SELECT1 succeeded and a subsequent exact existing-owner predicate check returned active profile and ready default account in an enabled matching currency. This is evidence of temporary successful admission, not incident resolution. At19:52 Riyadh the next bounded read-only connection-limit/aggregate-occupancy query failed admission with the same connection timeout and returned no diagnostic rows. No setting was changed or session terminated.

The benchmark then encountered an independent local first-launch preference-save failure before reaching Google sign-in. That failure was subsequently traced to R8 annotation-reference elimination and repaired; real encrypted read/write/cold persistence passed. No Google authentication or financial mutation was attempted. Intermittent database admission still blocks controlled authenticated measurement.

## Later log window:19:40–19:57 Riyadh

Read-only aggregate logs for16:40–16:57 UTC returned PostgreSQL FATAL too-many-clients99, PostgreSQL ERROR statement-timeout20, PostgreSQL FATAL other-timeout23, PostgreSQL LOG other-timeout6, Supavisor ERROR too-many-clients62 and Supavisor ERROR other-timeout622. These are log-event counts, can overlap between services, and are not unique failed requests or a controlled latency sample. They confirm continuing connection-capacity errors in this later window; they do not identify the responsible process. No session, pool budget or worker was altered.

## Bounded application attribution in the same later window

A separate fixed-window aggregate of the same62 Supavisor too-many-clients events classified every login name as having the application prefix; no raw username or peer address was exported.52 events carried the explicit session mode (12 with peer text exactly matching the existing VPS IPv4 representation,40 not matching that literal);10 had another/missing mode and did not match that literal peer representation. The nonmatching group may contain missing or differently represented addresses and does not prove a different machine. These are attributed log events, not actual open-session counts or distinct failed requests. They do not identify the responsible container or establish a safe pooler-mode change. Session-dependent workloads must be reconciled before any mode/budget change.

## Current SSH and dashboard evidence — 21:25–21:42 Riyadh

Strict SSH was restored with the explicitly approved single-source UFW exception and the existing key/known-host verification. No application service, route, database setting or pooler mode was changed.

Current container configuration shows25 API roles and 11 workers. Main `MASARIFI_DATABASE_POOL_MAX` values sum to218 for APIs and87 for workers:305 configured slots, not305 observed connections. All36 main URLs use session pooling on5432 and fall into two opaque user/database/endpoint groups. Four APIs configure privacy URLs and one worker configures a command URL; configuration alone does not prove all secondary pools are enabled. The earlier uniform10-per-process model is superseded by these current numeric overrides. `docker top` initially required a PID column; a later comm-name filter returned zero for the sampled API, which is not a verified Node-process count and is excluded from capacity calculations.

The logged-in Supabase Database Settings page shows Nano compute, connection pool size15 per user/database and fixed maximum200 client connections. These differ from PostgreSQL max_connections, which has not been retrieved successfully. The dashboard also fails schema/table queries with connection timeout. A fresh management aggregate query timed out; a separate bounded psql probe using the existing migration identity, existing CA and verify-full also reached its18-second process deadline. No occupancy or idle-transaction rows were accepted.

Bounded30-minute/150-line worker samples classified21 connection-timeout lines each in the reports and storage-runtime workers,2 in the Voice repair sample, and2 query-timeout lines in the storage-runtime sample. These are overlapping text classifications, not unique errors or requests. The Voice repair restart counter rose380→382 between snapshots; sampled Docker OOMKilled flags were false. No worker was restarted or stopped by this investigation, and the triggering failure/attribution remains unproven.

Dashboard24-hour aggregates displayed CPU31%, memory75%, disk38% and disk-I/O balance80%; peak connections itself failed SQL admission. These are provider summaries, not instantaneous readings, API error rates or a controlled load sample. Database Service Health's displayed50.3% errors is not treated as a measured application request-failure rate.

## Subsequent direct-admission discriminator

A direct TCP probe from the existing VPS reached the project's IPv6 PostgreSQL host. The workstation direct route timed out. A localhost-only strict SSH tunnel could not be used because sshd explicitly disables TCP forwarding; no SSH configuration was changed, and the owned tunnel process was stopped. The forwarding failure is not a database-query result.

A separate short-lived official PostgreSQL client container then made a direct outbound connection from the existing VPS, using the existing database-admin migration identity, exact provider CA, verify-full hostname validation, read-only default and bounded statement/connect/process deadlines. It mounted no restored state, exposed no listener, changed no database setting and exited. PostgreSQL rejected it with the connection-capacity class. This distinguishes current database admission failure from a problem confined to the workstation or shared pooler path; actual connection owners/states remain unobserved. The existing-project Metrics API independently reached its12-second HTTPS timeout and returned no accepted metrics.

One corrected container-network-namespace socket census at21:43 Riyadh found four ESTAB TCP sockets to5432 and101 TIME-WAIT entries across the sampled namespaces. These are sequential namespace observations, not an atomic provider session count. TIME-WAIT is closed-connection kernel state; it must not be counted as live database sessions. The earlier host-only/no-all-state observations were incomplete and are excluded from attribution. This sample cannot explain all server-side occupied slots or prove which workload caused exhaustion.

At21:43–21:44 Riyadh a single private origin3001 readiness read returned503 with database=down and queue=down in1.008808 seconds (N=1). Its queue indicator performs only catalog reads. A fresh exact-owner/default-account preflight again timed out; Google remained unclicked. This is a failing diagnostic, not an authenticated API baseline or a successful latency target.

## Server-cleanup scope update

The user deferred direct Supabase connection investigation. Subsequent server cleanup retired 11 unreferenced HTTP API processes, reducing 25 → 14, and preserved every worker. Earlier configured-pool totals, session observations and admission errors above are historical. No fresh occupancy or authenticated business-read measurement was accepted after that change; do not infer either ongoing failure or resolution from liveness 200. One early origin readiness GET may have probed DB/queue and was not repeated. No database/pooler/session/limit/configuration or migration change was made in cleanup scope.
