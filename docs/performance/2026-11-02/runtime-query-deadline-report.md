# Runtime resource fixes and measured guest startup

Status: **NOT READY. Two source fixes are tested; neither is deployed to the live API/worker services. Micro, the lookup index, queue maintenance and new-login deadlines are now applied and verified; current live evidence is linked below.** Work remains on `codex/voice-promoted-operating-2026-10-13`, based on `d1eaa7be`. No production cutover, main merge, financial/domain-data deletion or mobile replacement occurred. The later [space follow-up](supabase-space-root-cause.md) records verified expired-provider-check cleanup and live suppression of redundant zero-claim sync success events.

## Proven causes and corrections

The deployed `PoolService` has a two-second client query timeout but no corresponding server statement timeout. Earlier live samples found worker SELECTs still executing after 10–32 seconds. Client rejection and connection disposal do not prove cancellation through a session pooler. The corrected source initializes each checked-out physical client once with a PostgreSQL deadline of at most 2,000 ms, retaining a stricter existing deadline and the original least-privilege runtime role. Initialization failure still destroys the client. This does not shorten a loading animation or increase a request deadline.

The same live voice worker restarted repeatedly: the 23:41 UTC sample recorded 60 restarts, and the 23:42 sample recorded 62. Its heartbeat received SQLSTATE `XX000`, attempted epoch closure and exited; Docker restarted it. The recorded message SHA-256 exactly matches the provider's specific session-capacity error with pool size 15. Supavisor's [capacity-error implementation](https://raw.githubusercontent.com/supabase/supavisor/main/lib/supavisor/errors/max_connections_error.ex) and [wire formatter](https://raw.githubusercontent.com/supabase/supavisor/main/lib/supavisor/error.ex) explain why this availability failure uses generic `XX000`.

The source now maps **only** that exact capacity-message format plus `XX000` to a safe `DATABASE_POOL_CAPACITY` reason. Continuous voice processing uses its existing bounded retry/revalidation path. Unknown internal errors, permission failures and authoritative scope rejections retain their previous behavior. No epoch activation, ownership predicate, financial finalization, lease or replay rule changed. The earlier restart loop is historical evidence; source-level future protection still requires a qualified deployed artifact.

Fresh SQL at 23:24:53 UTC confirmed both separately provisioned runtime logins have connection limit 20 and no role configuration. The previously inspected session pool allows 15 backend connections per login/database. These limits and the existing split deployment constrain service connections independently of the number of people using the app. Configured pool maxima are not measured active connection counts.

## Verification and live outcome

- A real, synthetic PostgreSQL 17 fixture reproduced the missing server cancellation before the source fix. Afterward, 13 focused integration tests passed: API/worker/untyped-client cancellation, stricter 100 ms preservation, connection recovery and transaction/owner-setting isolation.
- The observed capacity failure reproduced unwanted epoch closure before correction. All 45 voice-worker and safe-error tests passed afterward, including recovery after heartbeat revalidation and rejection of generic `XX000` and `42501` with a misleading provider-message prefix. The affected sync-composition test separately passed all four cases.
- Operator SQL for future runtime-login sessions was tested on synthetic PostgreSQL: cancellation around two seconds, preservation of unrelated role options, atomic rollback, stricter database settings and database-role overrides. It is an operator configuration script, not an out-of-order schema migration.
- One bounded, certificate-verified SSH/psql attempt to apply the operator configuration timed out without accepted SQL results. It was not replayed. Plugin reconciliation at **23:36:38 UTC** confirmed both role configurations remain null and connection limits remain 20. **That earlier operator attempt did not persist.** A distinct post-Micro attempt succeeded at 07:22:46 UTC on 2 November, and plugin metadata confirmed both defaults at 07:23:09 UTC with unchanged memberships and connection limits. Existing pooler backends would require separate enforcement even after a role-default change.
- A subsequent bounded worker-identity `SELECT 1` probe also timed out; no financial query ran. Performance advisors still failed admission. No clean-advisor result is claimed.

The [live recovery report](supabase-optimization-report.md) records the subsequently completed Micro resize/restart, partial index, queue cleanup and operator defaults. Both newly applied migration versions were reconciled individually; unrelated historical backports remain unqualified.

The broad local API test run completed with 2,658 passes, 18 failures and 1,077 skipped tests. Seventeen failures across six container suites require the unavailable Docker Desktop daemon. The remaining sync-composition expectation was corrected and its four tests passed separately. An initial unrestricted attempt exhausted the test runner's 2 GiB heap; the completed run used two workers with bounded worker recycling. These are workstation qualification limitations, not live server OOM events. Full current-candidate CI and deployment qualification remain required; see the accompanying evidence for final checks.

After the final source changes, **all 2,080 unit tests across 194 suites passed**. Type checking and API/worker/migration builds passed. The synthetic local database is stopped; its files were retained after automatic policy review rejected local recursive cleanup. The temporary VPS fixture and its diagnostic client were removed without touching persistent volumes. The previous Metro listener disappeared during an external restart. The approved wrapper was restored on port19081 (listener PID21264), with phone 8081→19081 and 19081→19081 forwarding restored.

## Actual phone measurements

Twenty controlled **Arabic guest process-cold** launches used the same installed Release APK, package `com.masarifi.mobile.benchmark`, with its existing data preserved. No Google, registration, deletion, paid-provider or financial action was invoked. Both original applications and the then-current Metro listener on 19081 were preserved during those samples; the later approved listener restoration is recorded above.

| Measurement | N | Median | p95, nearest rank |
| --- | ---: | ---: | ---: |
| Android Activity draw (`am start -W`) | 20 | 473.5 ms | 530 ms |
| Identity initialization stage | 20 | 869.053 ms | 1,113.311 ms |
| Font loading stage | 20 | 156.652 ms | 196.688 ms |
| Local restore stage | 20 | 14.461 ms | 18.570 ms |
| Process PSS after the three-second observation point | 20 | 171,916.5 KiB | 172,452 KiB |

There were four measured identity-cache reads per launch, 80 in total, with p95 63.865 ms. They are not proven duplicate reads of the same key, so no token-cache workaround was introduced. No encrypted-preference failure or instrumented business-transport event was observed in these windows.

**Activity draw is not usable React-screen readiness or authenticated account-data visibility.** Stage clocks are not aligned to native process launch and their durations cannot be added. These samples have warmed OS/filesystem caches, retain app data, cover Arabic guests only and provide no before/after speedup pair. Authenticated startup, English, warm resume and business-API latency remain unqualified. [Sanitized samples](guest-startup-evidence.json) preserve all 20 observations.

## Space, health and next gate

No financial/domain events or Storage objects were removed. The redundant-index removal reclaimed **30,113,792 net database bytes**. Later cleanup deleted 5,760 expired provider checks only after encrypted export and hash-verified isolated restoration. The user then explicitly approved archival and retirement of 408,734 exact old operational success notifications; that completed after full restoration verification. Neither row cleanup is claimed to shrink files. Other pending events remain protected; existing owner relationships remain intact. [Retirement evidence](old-success-event-retirement-evidence.json).

The separate VPS sample at 23:41:25 UTC retained approximately 75.15 GB available disk and 4.43 GB available RAM; all 14 protected API liveness checks returned 200 and there were no failed systemd units. CPU measurements are short snapshots, and the voice-worker restart loop is a material exception to healthy service operation. VPS memory is not Supabase-host memory.

Dashboard access was restored and the user approved the exact Nano→Micro change. The resize completed with the reviewed +$0.00/month quote. New-login role deadlines were applied afterward through verify-full TLS; reused session-pooler backends are not automatically updated. Source initialization remains necessary. [Live evidence](supabase-live-recovery-evidence.json) records current resource snapshots and maintenance; PostgreSQL patch upgrade and authenticated application/API acceptance remain blocked on qualification.
