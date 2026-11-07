# Staging origin read attribution — 2 November 2026

Twenty English process-cold launches of the signed `2236b1bb` Benchmark produced 180 successful JavaScript GET Responses. A finite additional Nginx log identifies a consistent nine-route cohort for every launch. **Origin upstream p95 is 27–50 ms per measured route**, while the same cohort's Activity-create-to-HomeReady median/p95 is **3675.5/4754.6 ms**. These observations prioritize mobile initialization and transport investigation; they do not prove a startup improvement or isolate database execution time.

## Measured route observations

All durations are milliseconds. Each route has N=20; p95 uses nearest rank.

| Route group | Upstream median | Upstream p95 | Origin status counts |
| --- | ---: | ---: | --- |
| Identity profile | 28.0 | 35.0 | 1 × 200; 19 × 304 |
| Identity preferences | 24.0 | 28.0 | 20 × 304 |
| Identity onboarding | 23.0 | 29.0 | 20 × 304 |
| Active accounts | 22.5 | 28.0 | 20 × 304 |
| All accounts | 23.5 | 27.0 | 20 × 304 |
| Account summary | 29.0 | 34.0 | 20 × 200 |
| Active categories | 42.0 | 48.0 | 20 × 304 |
| All categories | 42.0 | 50.0 | 20 × 304 |
| Transaction page | 25.5 | 40.0 | 20 × 200 |

Upstream and Nginx status counts agree: 139 revalidations return 304 and 41 responses return 200. JavaScript sees 180 status-200 Responses, consistent with native HTTP cache revalidation and reuse of cached bodies. Preserve both status layers in future analysis. A 304 still reached the upstream and is not evidence that API work was skipped.

## Mobile boundary observations

N=20 launches for each row; durations overlap and their percentiles must not be added.

| Observed boundary | Median | p95 |
| --- | ---: | ---: |
| Activity create → first fetch invocation | 1984.7 | 2472.5 |
| First fetch invocation → last Response | 1428.5 | 2577.9 |
| Last Response → HomeReady | 157.3 | 300.0 |
| `startup.identity` span | 613.5 | 948.4 |
| `startup.profile` span | 779.2 | 1070.2 |

Identity fetch-to-Response has N=60, median/p95 631.7/865.9 ms. Ledger fetch-to-Response has N=120, median/p95 171.0/702.5 ms. The first-fetch interval includes native/JavaScript/provider initialization and other dependencies, rather than one proven CPU bottleneck. Comparing client and origin distributions does not yield an exact network/TLS duration because their timing boundaries differ.

## Scope, attribution and cleanup evidence

Collection permitted only allowlisted GET route enums on the exact Staging API host during 10:19:22–10:25:22 UTC (13:19:22–13:25:22 Riyadh). No route, upstream, service, cache, database or application behavior was changed. Additional logging used a fixed new file, numeric timing/status/byte fields and route enums only; identifiers, URLs, query strings, headers, tokens and payloads were excluded.

The sanitized log has 182 rows, 55,913 bytes, SHA-256 `2d6656ec2f696b9436e35d3513016a7e18f4ac66d904b67097bb0fbf80c1bf21`. Of these, 180 fall uniquely within the bounded launch windows and match the exact expected nine-route multiset per launch. The remaining unauthenticated identity 401 probe and one active-accounts 304 outside all trial windows are excluded. There is no request-ID or owner marker: same-route ambient traffic within a launch cannot be independently distinguished. Report cohort consistency, not cryptographic request identity.

At 10:25:24.613468 UTC, automatic deadline cleanup proved original configuration bytes/effective SHA-256 `b61f04efa6f90533354705a1e4f8cdd4b6c68d77433449189d505eccf50ae35b` restored, the original Nginx master preserved and old workers drained. The root-only dedicated rotated log was exported, schema/duplicate-key/byte-count/hash verified, and explicitly purged. Normal logs and root-only recovery backups were preserved. No diagnostic collector remains active.

The initial local analyzer incorrectly admitted only origin 200 responses and refused attribution. It was corrected to retain and separately count observed 200/304 responses; no new requests or repeated cohort were required. All expected route-count checks still pass. Export review also corrected hash verification to precede executing controller bytes and rejected duplicate JSON keys before preserving the raw export.

[Aggregate evidence](origin-read-attribution-evidence.json) contains only timings, counts, hashes, enums and limitations. Complete raw sanitized evidence remains in the private local diagnostic directory. This is an empty-account, warm OS/data-cache, sequential English cohort. It does not qualify populated lists, a fully uncached start, concurrent capacity, authoritative warm readiness, production signing, or database-stage latency. Production remains **NOT READY**.
