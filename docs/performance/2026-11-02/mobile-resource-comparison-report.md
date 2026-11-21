# Mobile resource comparison — 2 November 2026

The signed candidate proves fewer preference writes on the actual phone, but these sequential samples do **not** establish a startup speedup. Keep the latency target **NOT MET / NOT READY**.

Candidate source `2236b1bb83c737ebe9695b518f5f3724f404a7e2`, APK SHA-256 `13579a24b27c8bb8e145be74f063b1215f1fb3677ec7183a28fcd52c37d6dcac`. The certificate, Android manifest and 25 native DEX/library payloads match the previous independent Benchmark APK. All 2,938 candidate source files were verified. The original APK is preserved off-host; byte/path witnesses confirm both original installed applications are unchanged. The same existing account/session/data and network were retained; no application data, keys, financial records or pending operations were cleared.

Only the expected APK digest and separate result filename differ between the baseline and candidate harness. Reversing those substitutions reproduces the original measurement source exactly. Both use identical 20-run process-cold definitions, Android monotonic anchors, HomeReady clock guards and one-second-after-ready PSS observations. OS/data caches remain warm, and the account/list is empty.

## Actual resource result

For every one of the 40 baseline launches, preference writes were 3; for every one of the 40 candidate launches, they were 1. This is a **66.7% reduction in preference writes per unchanged-owner launch**, not a 66.7% application-speed improvement. Each candidate language produced 180 GETs, all 200, with the same 9 reads per launch. Authentication and readable empty-account Home restoration passed.

The separate real SQLite regression fixture reduces 207 ordered category upserts to 3 bounded native SQL invocations, preserving 205 distinct final rows and all rollback/pending/ownership controls described in the [source correction report](mobile-resource-optimization-report.md). Actual Android SQLite call counts and CPU savings were not separately logged.

## Comparable observations

Each cell is **median / nearest-rank p95**, with N=20 per phase/language. Durations are milliseconds; PSS rows are KiB.

| Locale / measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Arabic: Activity create → HomeReady, ms | 3316.8 / 3564.4 | 3759.3 / 4557.1 |
| Arabic: Native Activity draw, ms | 426.5 / 447.0 | 446.0 / 513.0 |
| Arabic: Process PSS, KiB | 236806.5 / 238478.0 | 220755.5 / 237012.0 |
| Arabic: Category preparation including transport/decode/local work, ms | 642.5 / 861.4 | 674.3 / 894.3 |
| Arabic: Identity fetch-to-Response, ms; N=60 per phase | 599.1 / 724.0 | 684.1 / 1546.5 |
| Arabic: Ledger fetch-to-Response, ms; N=120 per phase | 168.2 / 596.0 | 193.0 / 692.8 |
| English: Activity create → HomeReady, ms | 3336.8 / 3940.4 | 3590.6 / 4061.0 |
| English: Native Activity draw, ms | 444.0 / 496.0 | 439.0 / 498.0 |
| English: Process PSS, KiB | 239641.0 / 240876.0 | 232843.5 / 234893.0 |
| English: Category preparation including transport/decode/local work, ms | 649.5 / 758.8 | 685.5 / 965.0 |
| English: Identity fetch-to-Response, ms; N=60 per phase | 558.8 / 946.8 | 716.6 / 841.2 |
| English: Ledger fetch-to-Response, ms; N=120 per phase | 169.1 / 573.0 | 186.9 / 635.8 |

The client transport distributions changed between sequential batches and include network/backend work; they cannot isolate the code effect. Native/local-work savings must not be inferred from total startup or the category stage, which also includes Response-body decoding, validation, owner checks and queue waits. Point-in-time PSS differences do not establish sustained RAM savings. No startup improvement is claimed, and the 3,000 ms cold p95 target remains unmet.

Subsequent [bounded origin attribution](origin-read-attribution-report.md) is complete: measured upstream route p95 is27–50ms in a separate20-run English cohort. Prioritize pre-HTTP initialization and native transport investigation, preserving authoritative revalidation and Query invalidation. Database-only timing remains unqualified. A narrower loading animation, cache-staleness exemption, lower timeout or skipped owner check is not a fix. Full canonical backend/worker transition remains blocked by [hosted schema compatibility](hosted-schema-compatibility-report.md), restoration and route/worker acceptance. [Summary evidence](mobile-resource-comparison-evidence.json) contains only counts, durations, hashes and status outcomes.

## Later original-APK reference control

The candidate Arabic p95 was 27.85% above the initial baseline, so Benchmark was reversibly updated back to the preserved original APK, without clearing data. A new 20-run Arabic reference batch used the identical harness and original digest; all 180 GETs succeeded and preference writes returned to 3 per launch. This was a new regression-control experiment, not an overwritten baseline.

| Arabic Activity create → HomeReady | Median / p95, ms | N |
| --- | ---: | ---: |
| Initial original APK | 3316.8 / 3564.4 | 20 |
| Resource candidate | 3759.3 / 4557.1 | 20 |
| Later original-APK reference | 3627.1 / 4167.0 | 20 |

The later original-APK p95 is 16.90% above its earlier observation. Candidate p95 is 9.36% above this later reference, while client API distributions also differ. These sequential A/B/A observations establish variable conditions; they neither isolate a code-caused regression nor demonstrate a speedup. Retain the resource-count evidence, withhold performance acceptance, and collect bounded origin-stage timings before another correction. No public traffic was switched and no production application was updated.

## Exact-source functional qualification

Source `2236b1bb` passed [Foundation qualification 41420035868](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41420035868), including 597 mobile suites/4,668 tests, database, Android, all Admin browser projects and the configured image security checks. Its backend image is published as `sha256:5e1f051a8f5ff95e403ed34c3a6e6bffc14c603fd5d35ab8d3bd93f0334b5b59` and is not deployed. After the reversible reference control, the same signed Benchmark candidate was restored for continued read-only profiling; performance acceptance remains withheld. [Qualification evidence](mobile-resource-qualification-evidence.json).
