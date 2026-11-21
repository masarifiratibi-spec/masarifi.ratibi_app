# Mobile startup initialization and transport investigation

**No startup speedup is established. Production remains NOT READY.** The Bearer API transport correction is committed as `d3789ca031a71119df4d3d0c7d14499862893246` and passed local tests and required CI checks. A new bracketed comparison did not demonstrate a latency improvement. Separate native diagnostics locate connection/TLS and response-wait costs without attributing them to database execution. Exact signed `2236b1bb` remains the restored installed Benchmark with its existing account.

## Existing-cohort decomposition

The completed20-launch English origin cohort permits narrower per-launch reconstruction from recorded end timestamps and durations. Activity-create and Home log alignment follow the original monotonic methodology. All values are milliseconds; p95 uses nearest rank.

| Reconstructed interval, N=20 | Median | p95 |
| --- | ---: | ---: |
| Activity create → first recorded identity span start | 1203.7 | 1455.7 |
| Identity span start → Clerk readiness | 613.5 | 948.4 |
| Identity readiness → first API fetch | 146.4 | 187.3 |
| Restore span start → first API fetch | 143.4 | 184.5 |
| Profile span start → first API fetch | 93.5 | 125.1 |
| Three identity request invocation spread | 1.4 | 2.8 |

These intervals overlap, and their distribution summaries must not be added. The first three intervals partition individual launches only. The approximately1.2s before the first measured identity span includes native/runtime/JavaScript/module work; it is not a demonstrated1.2s CPU hotspot. The identity span includes asynchronous provider/cache work and scheduling. Token reads remain submillisecond in the original cohort. Three identity requests start almost together, so generally sequential JavaScript dispatch does not explain their shared first-wave delay.

## One new native diagnostic launch

One finite8-second Android trace addressed the newly isolated pre-identity gap. No APK rebuild, data clear, login, original-app launch, or old20-run cohort replay was involved. The unchanged signed Benchmark reached Home with nine GET200 responses; tracing stopped. Private trace:4,080,459bytes, SHA-256 `15f2d05a93dda136d2a520e70d9343e8aa0ee72be3e6fa7fc2447beaabc05a13`.

The instrumented launch reached Home at5259.5ms. It is a diagnostic observation with tracing overhead and different conditions, not a comparative performance baseline. Trace-internal slices include native application/React initialization, Expo crypto attachment, mounting and Chromium initialization on an API-host transport thread. Nested slice durations must not be summed into a startup estimate.

Android atrace uses a different boot-clock domain from the recorded JavaScript/Android event-log monotonic anchors. An initial local analyzer incorrectly attempted cross-clock slice selection and produced an empty subset. It was retained and explicitly superseded by trace-internal relative timing; no exact trace-to-JavaScript delay attribution is claimed.

## Narrow transport correction

Installed React Native0.83.10 defaults XMLHttpRequest `withCredentials` to true. Its fetch polyfill's default same-origin mode leaves that value true. Native NetworkingModule selects `CookieJar.NO_COOKIES` when credentials are omitted; otherwise its forwarding cookie handler lazily obtains Android WebView's CookieManager, loading Chromium. The observed API-thread Chromium initialization and slower first identity wave support investigating this path. They do not quantify its causal share of transport time.

The shared application API client already requires a token and explicitly constructs Bearer Authorization before every request. Its source correction sets `credentials: 'omit'` for that transport, including a recent-auth retry. Clerk provider/SSO/session networking is a separate path. The correction retains fresh token acquisition, read-only Benchmark admission, cancellation/deadlines, JSON validation, idempotency/body identity and explicit204/304 handling. It does not disable HTTP caching or change native cache-revalidation policy.

Test-first verification observed the new boundary case and retry assertions fail against the old client (2failed/41passed), then111 tests pass across the two focused suites. Independent review found no source/test blocker. One broad local run did not receive its intended serial option through PowerShell/npm and failed two suites/three asynchronous waits; direct serial rechecks passed72tests across those two suites and the HTTP client. The complete direct-Jest serial run then passed **597 suites/4,669 tests**. Direct TypeScript, scoped ESLint and1,266 Foundation boundary checks passed. All failed logs remain preserved. No native avoidance, iOS/browser integration or startup speedup follows from Jest alone.

The original two installed applications/package bytes and the Benchmark session/candidate are preserved. Metro process identity21264 and listener127.0.0.1:19081 were verified; the missing phone8081→host19081 reverse was restored after identity checks, without restarting Metro. No server, cache policy or API routing change was made for this transport investigation.

## Source qualification and artifact identities

All required checks passed in [Foundation PR run41440130996](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/41440130996), including database, Android,597 mobile suites/4,669 tests, all five Admin browser projects, secrets, image contracts and configured security scanning. Signing evidence was skipped. The actual checkout was PR merge `c91cf8c5d8e9c88006c2445462a6f7c4750c3666`; its entire tree `b240871d10d3e45cda5ab13c4336f23ac99b28fe` equals candidate head d378. This is tested identical-tree evidence, not a direct-head checkout. The PR image was built/scanned locally in CI; this run did not publish or deploy a new backend artifact. The direct-head2236 qualification and its published, undeployed backend image remain separate historical identities.

The source change is retained as an explicit Bearer transport contract, without a speedup claim. Its plain APK SHA-256 is `9074d5bb3be321708e5906a89e20579d26fb3580debb5d6966d5ecee61ec60ef`. Manifest, signer, native libraries and DEX payloads match qualified2236; bundled JavaScript changes. Both artifacts remain preserved off-host.

## Bracketed cookie-transport comparison

A new6/6/6 experiment tested this specific hypothesis: qualified2236 before, plain d378 candidate, qualified2236 after. Existing-account Home and all162 GET responses succeeded. The original two installed applications' paths/bytes stayed equal. No login or data clear occurred. Exact2236 was restored with terminal installation acknowledgment.

| Activity create → HomeReady, ms | 2236 before, N=6 | d378, N=6 | 2236 after, N=6 |
| --- | ---: | ---: | ---: |
| Median | 3723.2 | 3862.8 | 3934.6 |
| Minimum | 3413.6 | 3531.3 | 3392.5 |
| Maximum | 7434.6 | 5486.5 | 4428.5 |

The candidate sits within drifting controls. Six-sample arms do not qualify p95 or establish an improvement. Identity fetch medians were698.4/671.9/628.9ms; the later control was faster still. See [aggregate comparison evidence](cookie-transport-mechanism-evidence.json). Original cohorts and measurements remain unchanged.

## Native transport diagnostic

A private bounded observer build distinguished RN and Expo clients and recorded native phases. It is **d378 plus a private native overlay**, not the exact source-qualified artifact. APK SHA-256: `77264879b13cfde62127d1425afbf29c9e8e1d5fbcc2a97c440cfdab8b238751`; overlay SHA-256: `32019461eed9c1508cf654ed3112aab0ffdb3fd3f235c55fb7ef9a21aa337b96`. Existing client builders, authentication, TLS, caches and interceptors were retained. Each observer was limited to15seconds,12calls and24 fixed numeric/enum records per call. No URL, identifiers, headers, body or credentials were recorded.

Three diagnostic cold launches yielded27 complete native calls, all through **React Native**, with three identity and six ledger requests per launch. JavaScript saw27 status200 responses; native network responses were seven200 and twenty304. Native uptime/logcat clock discrepancies were at most4ms. First JS invocation and earliest native call start were within a few milliseconds at clock resolution; raw submillisecond differences do not prove a submillisecond bridge or per-request ordinal identity.

| Native interval, ms | Identity, N=9 median | Ledger, N=18 median |
| --- | ---: | ---: |
| Call start → request headers start | 364.9 | 6.7 |
| Connect including TLS | 231.8 (N=9) | 392.8 (N=5) |
| TLS nested inside connect | 136.1 (N=9) | 203.8 (N=5) |
| Request headers end → response headers end | 447.1 | 214.2 |
| Call start → call end | 825.3 | 244.7 |

All nine identity calls had new-connect callbacks. Thirteen of eighteen ledger calls acquired a connection without connect callbacks, consistent with reuse. Missing DNS/connect/TLS callbacks are unmeasured, not zero. Connect includes TLS; their medians must not be added. Call end can include body consumption after JS fetch resolves and differs from the original fetch-to-Response boundary. Header return combines network, server, scheduling and header processing; it does not isolate database time or exact RTT. These observations support investigating connection reuse/protocol and initialization separately, without claiming either is fixed. Three observer launches do not qualify p95. Full distributions and limitations: [native evidence](native-transport-diagnostic-evidence.json).

The first RN-only diagnostic attempt failed its nine-call coverage guard and restored2236. Retained logcat was inspected after restoration. Empty retained logs do **not** prove zero RN calls or Expo selection during that earlier trial; that provisional interpretation is withdrawn. The failed collector did not persist its original count. The second observer corrected the account-summary route filter, added both client observers, and persisted observations before the coverage guard. All consumed markers and original evidence remain preserved.

One certificate-verified desktop TLS handshake offered h2/http1.1 and selected http/1.1, with zero HTTP requests and no credentials. This is desktop ALPN evidence only; it does not identify the native negotiated protocol, demonstrate HTTP/2 benefit or qualify shared-ingress reconfiguration.

## Preserved state and remaining gates

The three diagnostic launches ended with acknowledged restoration of exact2236 APK (`13579a24b27c8bb8e145be74f063b1215f1fb3677ec7183a28fcd52c37d6dcac`) and one existing-account Home read smoke. Both original installed applications remained unchanged. No diagnostic observer remains installed. The owned local build's native sources and output APK were restored to plain d378 after preserving the diagnostic artifact. Compiled diagnostic intermediates remain retained and require normal Gradle reconciliation before a future build.

Final read-only verification rechecked all three APK bindings, Metro21264 and phone8081→host19081. The original handoff's additional phone19081→host19081 mapping was then restored after fresh Metro/listener/device guards, without launching an application or restarting Metro. Both reverse mappings are present.

No server/API/cache routing change, financial mutation, live helper/history change or canonical backend/worker cutover occurred. Initialization CPU/module attribution, populated reads, complete warm/cached readiness, cold p95≤3s, full recovery/rollback and canonical observation remain open. The [isolated compatibility proof](isolated-helper-compatibility-report.md) is a separate prerequisite, not cutover permission. Continue from the [exact checkpoint](../../handoffs/2026-11-02-startup-native-helper-proof-continuation-en.md).
