# Authenticated mobile baseline — 2 November 2026

Status: **baseline measured; startup target not met; no application speedup claimed**. The existing account was admitted and tested on the unchanged independent Release APK. Arabic and English each have 20 completed process-cold launches and 20 separate native HOT resumes. The cold samples produced 360 GET responses, all200.

## Environment and method

Same Redmi, existing owner, network and installed `com.masarifi.mobile.benchmark`; bundled Hermes/R8 Release source `815a029ccb562164be60447ecd1e69017b222507`, APK SHA-256 `2759d113a01da6f88fdd0146fe9e9657f67552b52781a3a4fc98ca1d738b6c35`. Device and owner bindings, screenshots and raw fixed-schema logs remain private. Both original applications and their data were preserved; Metro remains on 19081 with listener PID 21264 and is not used by this APK. The account has an active default account and empty current Home/list data; this is not a populated-list benchmark. The active/default-account read-only predicate was renewed before admission. `/me` may update last_seen; no registration or financial mutation was exercised.

Cold runs use `am start -W -S` for Benchmark only, preserving application data, login and OS/filesystem caches. Android event-log monotonic process/Activity-create anchors were empirically aligned to every fixed-schema HomeReady metric, with per-sample clock guards. `/proc/uptime` includes suspend on this phone and was not used as the app clock. HomeReady means the actual Home data/header/notice/layout loading boundary has released; native Activity draw is a different event. Percentiles use nearest rank with N=20, without p99.

## Process-cold results

All durations below are **median / p95 milliseconds, N=20 per language**. The cold target is p95≤3000ms; it is not met from either conservative Activity-create anchor.

| Measurement | Arabic | English |
| --- | ---: | ---: |
| Native Activity draw | 426.5 / 447.0 | 444.0 / 496.0 |
| Process start → HomeReady | 3267.8 / 3519.4 | 3297.8 / 3911.4 |
| Activity create → HomeReady | 3316.8 / 3564.4 | 3336.8 / 3940.4 |
| Process PSS, KiB, one second after ready | 236806.5 / 238478.0 | 239641.0 / 240876.0 |

Each launch issued 9 distinct GET reads. Identity requests (`/me`, preferences and onboarding) were already parallel for this admitted existing owner. The six ledger-group reads include different active/all account and category variants, today transactions and account summary. Equal response byte counts alone do not establish duplicate endpoints. No failed status or transport retry was observed in the 360 cold fetch outcomes.

| Fetch-to-Response group | Arabic median / p95, ms | English median / p95, ms | Samples per language |
| --- | ---: | ---: | ---: |
| identity | 599.1 / 724.0 | 558.8 / 946.8 | 60 |
| ledger | 168.2 / 596.0 | 169.1 / 573.0 | 120 |

These are mixed-endpoint client transport distributions, not per-endpoint origin handling budgets. They include network/HTTP service time and exclude token acquisition, JSON decoding and local projection. No backend/database/external-service latency split is available from these records.

## Startup attribution

| Interval | Arabic median / p95, ms | English median / p95, ms | N per language |
| --- | ---: | ---: | ---: |
| Process start → first HTTP fetch | 1700.4 / 1939.6 | 1731.0 / 1897.3 | 20 |
| First HTTP fetch → final HTTP Response | 1367.1 / 1574.7 | 1332.4 / 1899.4 | 20 |
| Final HTTP Response → HomeReady | 158.3 / 226.3 | 168.1 / 216.6 | 20 |

Stages overlap; do not sum their separate percentiles or blame the entire pre-HTTP interval on one module. Native/JS initialization, cached Clerk restoration and owner-local work precede the first fetch. Existing telemetry does not fully separate native/module evaluation and local storage work. The near-identical cold medians do not establish a material Arabic-versus-English regression; sequential batches and network tail variation limit that comparison.

## Native warm resume

The app was backgrounded to the launcher for 2 seconds, then resumed without force-stop. The PID stayed unchanged. Graphics counters were reset for each observation; native intent anchors and post-resume renderer FrameCompleted timestamps were matched. Home was visually checked, but a renderer frame is not authoritative refreshed-data readiness or physical display presentation.

| Native warm observation | Arabic median / p95, ms | English median / p95, ms | N per language |
| --- | ---: | ---: | ---: |
| Android HOT TotalTime | 179.0 / 267.0 | 179.0 / 221.0 | 20 |
| Intent → first completed renderer frame | 253.6 / 344.7 | 267.0 / 336.8 | 20 |

The p95≤1500ms warm usable-screen target remains **unqualified**, because long idle/session expiration and refreshed-data readiness were not instrumented by this APK.

## Read-screen and layout smoke

Home, Accounts, Transactions, Reports/Analytics and More were opened once in each language. Each bounded six-second observation returned successful observed GETs: 9, 4, 7, 6 and 8 respectively. Both layouts were visually inspected on the actual device; current empty values, list empty states and the default account rendered. English salary-cycle and application-settings views were also inspected without setup, consent, delivery or financial changes. These are N=1 smoke observations per language/screen, not transition percentiles. The fixed wait is not a screen loading time.

Cached reads were exercised during navigation and warm resume, with application data retained. Fully uncached scenarios, long or populated lists, repeatable cached transition timing, app CPU/frame-delay profiling and origin API/database/external-service splits remain incomplete. Writes, registration/deletion replay, ingestion, paid AI and delivery remain outside the authorized read-only acceptance.

## Next correction and release boundary

Prioritize measured pre-HTTP initialization and slow identity/category/transaction reads, collecting origin-stage evidence before changing auth or freshness behavior. A trial category pending-read coalescer reduced transport count in a synthetic paging test but failed cancellation/invalidation freshness; the entire trial was removed. No unsafe caching change is present. A separate small resource correction is under qualification to avoid automatic currency/time-zone SecureStore writes when validated values already equal the hydrated preferences; it is not a measured startup speedup.

The earlier backend candidate passed Foundation qualification, but its image is not deployed and [hosted schema compatibility](hosted-schema-compatibility-report.md) still blocks canonical backend/worker cutover. Decision: **NOT READY** for production. Summary-only measurements and source evidence hashes are in [the baseline evidence](authenticated-mobile-baseline-evidence.json).
