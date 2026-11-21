# Startup/native transport and isolated helper proof: continuation checkpoint

Read this entire continuation together with the [original full handoff](2026-11-02-performance-supabase-server-full-handoff-en.md) before taking action. The original remains historical and unchanged. This checkpoint supersedes its pending ACL/helper and mobile-investigation state, not its preservation rules or remaining production gates.

**Production remains NOT READY. No canonical backend/worker cutover or hosted compatibility/history mutation has occurred.** Existing-account acceptance remains read-only. Preserve financial data, Storage, credentials, pending operations and required services. Communicate progress in Arabic and keep technical deliverables in English.

## Repository, qualification and deployed state

- Repository: `D:/Masarifi-integration-2026-10-10`.
- Branch: `codex/voice-promoted-operating-2026-10-13`; configured upstream is `ratibi`, not `origin`. Do not change remote configuration or work in the unrelated default workspace.
- Application head: `d3789ca031a71119df4d3d0c7d14499862893246`, followed by this documentation publication. Only two application files differ from qualified2236: `apps/mobile/src/services/live/http-client.ts` and its test. The Bearer API fetch now omits native cookies. API/Admin/shared-package/Docker source remains equal to2236.
- Preserve direct-head qualification `2236b1bb83c737ebe9695b518f5f3724f404a7e2`, Foundation run41420035868, and published **undeployed** backend image `sha256:5e1f051a8f5ff95e403ed34c3a6e6bffc14c603fd5d35ab8d3bd93f0334b5b59`.
- New required CI passed in [PR run41440130996](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41440130996). Actual checkout `c91cf8c5d8e9c88006c2445462a6f7c4750c3666` has entire tree `b240871d10d3e45cda5ab13c4336f23ac99b28fe`, equal to d378. Do not call it a direct-head checkout. The PR built/scanned a local image but did not publish/deploy a new image. Signing evidence was skipped.
- Local full mobile serial run and CI both passed597 suites/4,669 tests. TypeScript, scoped ESLint,1,266 Foundation boundary checks, database, Android, all five Admin browser projects, secrets and configured image checks passed. The earlier parallel/npm asynchronous-wait failure remains preserved, superseded by passing direct serial rechecks and complete serial qualification.
- Previously deployed scoped Staging Admin remains on its prior721a artifact/runtime. Backend source fixes remain undeployed. No main merge, release tag, production activation or store publication.

## Protected phone and Metro checkpoint

The same pinned Redmi and both original packages (`com.masarifi.mobile`, `com.masarifi.mobile.dev`) remain unchanged by path and APK hash. Preserve their data, keys, sessions and pending work. All ADB calls must use the existing pinned serial from private evidence, never a generic selected device.

Installed Benchmark is restored to exact qualified2236, package `com.masarifi.mobile.benchmark`, SHA-256 `13579a24b27c8bb8e145be74f063b1215f1fb3677ec7183a28fcd52c37d6dcac`. Its existing authenticated account reached English Home after the last acknowledged restoration, with nine successful GET responses. No login, registration or data clear occurred. No native observer remains installed. Do not install d378 or an observer merely to resume this checkpoint.

Preserve Metro PID21264, parent24960, exact repository Expo command `--dev-client --localhost --port19081`, listening on127.0.0.1:19081. Never act on obsolete PID12652 or restart Metro. Both handoff reverse mappings are now present: phone8081→host19081 and phone19081→host19081. Each restoration followed fresh process/listener and pinned-device identity checks; no Metro restart or application action. Verify identity before changing either mapping. No phone benchmark is currently running.

Off-host signed APK backups, under `C:/Users/DELL/.codex/backups/masarifi-readiness-20261101`:

| Artifact | Filename | SHA-256 |
| --- | --- | --- |
| Historical815a control | `benchmark-baseline-815a029c.apk` | `2759d113a01da6f88fdd0146fe9e9657f67552b52781a3a4fc98ca1d738b6c35` |
| Installed qualified2236 | `benchmark-qualified-2236b1bb.apk` | `13579a24b27c8bb8e145be74f063b1215f1fb3677ec7183a28fcd52c37d6dcac` |
| Plain d378 candidate | `cookie-transport-d3789ca0.apk` | `9074d5bb3be321708e5906a89e20579d26fb3580debb5d6966d5ecee61ec60ef` |
| RN-only diagnostic v1 | `benchmark-native-rn-only-v1.apk` | `c1a1650a69ea6a21362ae47643233ffa250e0709d2827b7431108cedec1dd18d` |
| RN+Expo diagnostic v2 | `benchmark-native-transport-v2-32019461.apk` | `77264879b13cfde62127d1425afbf29c9e8e1d5fbcc2a97c440cfdab8b238751` |

The owned `C:/mbc7` build was restored to plain d378 native source and output APK after retaining v2. All2,938 archived source files were verified against archive SHA `71d46888e5e923f25844ed75fc071edbdd75c6494aa068fda801a6f03f6edf4f`. MainApplication and ExpoFetchModule originals were restored; the two observer sources are retained under `.kt.retained` and absent under `.kt`. Source manifest no longer claims an active overlay. Compiled diagnostic intermediates remain preserved; a future build must reconcile them normally through Gradle. Do not treat stale build logs/intermediates as plain-artifact evidence or blindly rerun consumed builders.

## What the new measurements establish

See [initialization/transport report](../performance/2026-11-02/mobile-startup-initialization-investigation.md), [cookie experiment aggregate](../performance/2026-11-02/cookie-transport-mechanism-evidence.json) and [native diagnostic aggregate](../performance/2026-11-02/native-transport-diagnostic-evidence.json).

1. Original20-launch origin cohort and cleanup/export/purge receipts were reconciled, not replayed. Offline reconstruction: Activity→first identity span median/p951203.7/1455.7ms, identity readiness613.5/948.4ms, identity-end→first fetch146.4/187.3ms. These are overlapping boundaries, not additive percentile budgets or CPU attribution.
2. One new bounded eight-second atrace identified native/runtime and API-thread Chromium slices. Its initial cross-clock analyzer was invalid and preserved; only corrected trace-relative analysis is used.
3. A specific new6/6/6 comparison tested cookie omission. All162 GETs and Home checks succeeded. Home medians before/candidate/after3723.2/3862.8/3934.6ms: **no demonstrated speedup**, no p95 qualification. Exact2236 restored. Retain original distributions and markers.
4. A first RN-only observer attempt failed its nine-call coverage guard; exact2236 restored. Its original failed count was not persisted. Empty retained logs were inspected after restoration and do not establish zero RN requests or Expo selection. Withdraw any provisional interpretation to that effect, while preserving old receipts.
5. A separately reviewed v2 observer corrected the summary-route filter, covered both clients, and persisted observations before coverage checks. Three launches yielded27 complete native calls, all RN: seven native200/twenty304 versus27 JS200. Clock discrepancy≤4ms. All nine identity requests opened new connections. Identity connect/TLS nested medians231.8/136.1ms; request-headers-end→response-headers-end447.1ms. Thirteen/eighteen ledger calls acquired a connection without connect callbacks. Missing callbacks are unmeasured, not zero; nested phases must not be added. Header wait is not database-only or exact RTT. Call-end timing includes a different body boundary from JS fetch.
6. A single credential-free desktop TLS handshake selected http/1.1 after offering h2/http1.1. Zero HTTP requests were sent. Native negotiated protocol and HTTP/2 benefit remain unproven; no shared-ingress change was made.

## Isolated compatibility proof completed

See [isolated report](../performance/2026-11-02/isolated-helper-compatibility-report.md), [aggregate evidence](../performance/2026-11-02/isolated-helper-compatibility-evidence.json), and [guarded next step](../performance/2026-11-02/guarded-hosted-compatibility-next-step.md).

- Exact owned clone ID `1fd90f9ffadb1cd25395c3df972a49a875ca3bc2f1ed160839f9138c3e94fda2`, name `masarifi-pg176-compat-630d8c4b72a15e90`. Network none,512MiB/0.5CPU/PIDs128; original protected restore containers/volumes untouched. The clone is **cleanly stopped**.
- Conservative ACL draft remains unchanged. Separate exact-trigger v2 materialized the equivalent existing owner ACL after a fail-closed SQL NULL correction. Frozen prerequisites then matched exactly; all effective grants, unrelated catalogs and physical application-relation files stayed equal. No live GRANT or disabled trigger.
- Private Supabase-CLI-created artifact `clone-helper-artifact/supabase/migrations/20261102111014_clone_only_additive_helpers.sql`, SHA `8544f0d66e294ccaea96ef53739895ed2e594c6c1891804a5ea9a4db2db56e6a`, adds exactly three absent canonical helper cores on this partial state. Do not copy it into canonical fresh-install migrations: signatures already exist there, so its absence guard should reject.
- A v2 fixture-order attempt failed the existing inactive-owner fence before helper commit. Read-only reconciliation proved absence/rollback/clean stop. v3 changes fixture order only and passed invalid/valid leases, owner derivation/isolation, actual worker/API ACLs, selector limits/eligibility,45 parser cases across three time zones, injected rollback, repeat-apply rejection, overlapping transaction-local contexts and real lock/statement timeouts.
- Helpers were committed only on the owned clone; all synthetic rows rolled back. Normalized unrelated catalogs/roles and bounded data/history fingerprints remained equal. Physical relation-file equality is claimed only for the earlier ACL-only operation, not rolled-back synthetic DML.
- Additional deletion-pending and real nonsuperuser operator tests passed in a fully rolled-back transaction. Both absent self-grant and existing all-options-false self-grant restored exact grantor-specific memberships. Temporary roles/grants/fixtures were removed by rollback.
- Clone history has171 rows; live has174. This is bounded historical prerequisite proof, **not full current-live parity**. The three newer live maintenance migrations remain protected. Hosted helpers remain absent. A Supabase-plugin read checked one additional finalizer chain link only; full finalization is still unqualified.

## Private evidence and one-shot reconciliation

Preserve the complete directory `.superpowers/sdd/2026-11-02-supabase-optimization` and all prior private directories. Do not publish raw SQL, account/device bindings, traces, APKs, keys or execution logs.

Completed records include:

- `continuation-reconciliation.json`, `existing-startup-boundaries.json`, original origin receipts.
- `clone-owner-acl-exact-trigger-materialization-evidence.json`; marker `clone-acl-exact-trigger-v2-dispatch-started.json`.
- `helper-v2-reconciliation.private.json`, `clone-helper-v3-qualification-evidence.json`, `clone-helper-operator-evidence.json`; retain all respective dispatch markers.
- `cookie-transport-full-mobile-serial.log`, `cookie-transport-ci-current.json`, `cookie-transport-ci-jobs-completed.private.json`, `mobile-d378-pr-ci.log`.
- `cookie-transport-experiment-evidence.private.json` and its state/marker; all three six-run raw arms.
- `native-transport-v1-reconciliation.private.json`; original failed observer marker/state unchanged.
- `native-transport-v2-experiment-evidence.private.json` and state/marker; three pre-guard observations and raw three-launch result; `native-transport-v2-analysis.json`.
- `native-build-restoration-evidence.json`, its consumed start marker, retained v2 manifest and original source backups.
- `continuation-final-state.private.json` read-only package/process witness and `secondary-metro-reverse-restoration-evidence.json`, which subsequently restored the original handoff's additional19081 reverse after fresh identity guards.
- `staging-alpn-readonly-evidence.json`; no retry required for this completed handshake.

All phone experiment receipts end with `installInFlight: null`, acknowledged exact2236 restoration and original-app preservation. If a later action is interrupted, read its marker/state and inspect installed artifact/installer sessions before any retry. Never infer failure from a lost local response or overwrite an externally changed package.

## Authorized next work and hard gates

1. Reconcile this checkpoint and documentation publication first. Do not repeat cleanup, registration/deletion, event retirement, old APK builds/login or completed cohorts without a specific new uncertainty. Preserve Metro and phone state.
2. Investigate the measured initialization interval and first-wave connection/response phases. Any optimization needs a bounded independent hypothesis and a preserved control/candidate comparison. The cookie hypothesis did not prove a speedup. HTTP/2, prewarming and module deferral are hypotheses, not qualified changes.
3. Before hosted additive DDL, finish exact forward/operator packaging, live prerequisite/executor recheck, migration lock `5574319470126001`, rollback/recovery artifact, one-shot acknowledgment and postcondition proof. Preserve original SQL/history provenance. Do not bypass ordered-prefix validation or run the clone-only artifact directly on live based solely on this report.
4. Qualify a separate history-only repair for the four timestamp-equivalent pairs, with exact untrimmed stored SQL hashes/names/cardinality, target absence, row/advisory locking, atomic four-row version-only update and unchanged unrelated fingerprints. That proof has **not** run. Do not replay old SQL or stamp missing whole migrations; four repairs would still leave11 missing/three hosted-only records.
5. Complete remaining partial-backport/financial-semantics/finalizer/reminder-consumer decisions and capability tests before any canonical caller/worker transition. Keep all required legacy services and pending work.
6. Production requires populated owner/business acceptance, complete warm/cache timing and cold p95≤3s, representative capacity, portable full recovery/rollback/RTO, exact deployed-artifact verification and full canonical24-hour observation. These remain open. Previous Admin observation cannot substitute for canonical observation.

Use the Supabase plugin for managed catalog/account reads and the existing strict pinned SSH configuration for isolated server work. Do not introduce a second host identity or weaken SSH checks. Existing approvals persist; do not request them again for work already authorized.
