# Performance baseline — 1 November 2026

Status: **incomplete**. Accepted authenticated startup, screen and business-API samples: **0**. No speedup is claimed.

## Environment

Repository `D:/Masarifi-integration-2026-10-10`, branch `codex/voice-promoted-operating-2026-10-13`, candidate `815a029ccb562164be60447ecd1e69017b222507`, original baseline `f957cb3df1c1e8b096561fc3114cf16d97379270`. The same Redmi and existing account are required; the physical device binding and owner identifier remain private. Both original application packages and APK paths were reverified unchanged; no data was cleared.

The independently signed `com.masarifi.mobile.benchmark` is installed in Release mode with bundled Hermes JavaScript, R8/minification/resource shrinking, Staging authentication and API. APK: 49,420,701 bytes, SHA-256 `2759d113a01da6f88fdd0146fe9e9657f67552b52781a3a4fc98ca1d738b6c35`; certificate SHA-256 `68fd00ac6ef649e053a2bfcd571b4316fda0f484cf23460e3fcac8dcd8122e8a`. All 2,938 archived source files were verified; archive SHA-256 `f217780cab8838122e9761504c16a5035d24a5c3b17f766c7b2daf9147e50a88`. The actual installed APK matches. Temporary File Explorer installation permission was revoked and appops deny verified.

Original Metro PID12652 had disappeared externally. The user approved replacement and then temporary port19081 because Windows reserved8081. Metro PID17540 and phone8081/19081→host19081 forwarding were preserved. This Release APK does not use Metro.

## Accepted descriptive observations

| Probe | N | Durations in ms | Meaning |
| --- | ---: | --- | --- |
| Public health from workstation | 5 | 415.630, 307.882, 308.008, 302.525, 292.259 | All200; includes network/TLS; excludes authenticated business work |
| Origin health on port3001 | 5 | 6.616, 2.709, 1.697, 1.970, 2.101 | All200; health handling only |
| Current Release guest native launch | 1 | Android Activity TotalTime514; WaitTime518 | Installation/native smoke; excludes usable-screen/data readiness |

No percentile or comparative improvement is supported by these samples. Earlier guest builds and historical cumulative frame statistics are excluded from before/after claims. A DEV token-gated observation reached an observer deadline without an accepted API response; it is not an API-latency measurement.

## Functional acceptance and measurement blocker

An actual Release startup failure was diagnosed to R8 eliminating an Expo Record annotation reference before SecureStore method execution. A targeted annotation-interface keep rule repaired it. Actual encrypted preference read, local first-launch write, and read after cold relaunch all succeeded without clearing keys/data, plaintext fallback or changing encryption. Welcome completion remains persisted and the Google sign-in screen is visible.

The current benchmark uses an existing-account-only Google helper (`signUpIfMissing:false`), strict callback/nonce validation and exact SDK owner/session checks. It never invokes the generic SDK flow's automatic sign-up transfer. Native Google roundtrip remains untested: **Google has not been clicked**. Immediately before login, renew the read-only active-profile and ready-default-account predicate in the enabled matching currency. It briefly passed at19:49 Riyadh, then subsequent admission checks failed. At21:32 Riyadh a connection-pressure query again timed out; a separately bounded verify-full psql probe also timed out. See [incident evidence](current-database-incident.md).

The benchmark-only fixed-schema sink caps attempted metric events at400/process, exporting no raw URLs, tokens, bodies, owners or financial values. It covers startup stages, first protected-route readiness, Home outcomes and GET/HEAD outcomes. Transport timing is fetch-to-Response, excluding preceding authentication and subsequent decoding; optional bytes are Content-Length metadata. Runtime `atMs` origin is unverified and must not be treated as process-start elapsed time. The harness still needs a verified launch/readiness clock alignment and adequate warm-resume observation.

## Remaining controlled methodology

Measure Arabic and English separately on the same device, account and network, at least20 runs per startup scenario. Separate process-cold/warm and cached/uncached; preserve app data. Record first rendered/usable screen, owned-data visibility, transitions, request count/duplicates/status/retries/payload metadata, frame delays and memory over a defined window. Cover Home, accounts, transactions, reports, planning, settings and cached reads; document skipped flows. Empty-data reads do not qualify populated lists. Report N with every percentile; no p99 below1,000 samples.

Targets remain unqualified: authenticated cold p95≤3s, warm≤1.5s, cached transitions≤300ms, simple origin reads≤300ms while retaining stricter budgets, memory≥25% available/no OOM. Latest pre-Storage-pull disk headroom was13,143,601,152 bytes (88% used), below25GB and normalized≤75% targets.

No concurrency test ran against existing services. Only an isolated qualified candidate may receive ≤5 virtual users for3minutes, aborting for sustained CPU>85%, available memory<1GB, new OOM/restarts or failed reads>1%. Writes, registration/deletion replay, ingestion, paid AI and message delivery remain outside this read-only scope. `/me` can touch last_seen_at and can provision a missing default account; predicate admission is mandatory.

Historical pre-cleanup, post-tool-pull OS sample: available disk11,702,063,104 bytes,89% used; available memory1,795,878,912 of8,321,167,360 bytes (about21.6%). Earlier values above are explicitly dated/pre-pull snapshots, not current reclaimed capacity.
