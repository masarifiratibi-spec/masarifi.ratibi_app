# S1 — consolidated Masarifi Staging change for review

**Prepared for specific human approval; nothing in this packet has been deployed or activated.** N1 (DEV signing/Xiaomi upgrade/source activation) is a separate pending approval. Legal documents remain **1.0-draft**, with mandatory registration consent OFF. This packet does not approve legal wording, a public release, Production, Billing, hidden Events or task acceptance.

Work remains on `codex/voice-promoted-operating-2026-10-13`, HEAD `e7ad90e8b91c118e6365f57cc6cc542f94873595`, with an empty index and earlier work preserved. Original task order and 62/69/88/29 acceptance denominators remain unchanged. The source groups and offline capability matrix are qualification evidence, not Xiaomi acceptance or measured speed improvements.

## Exact artifacts

| Purpose | Immutable binding |
| --- | --- |
| API candidate | `sha256:137aeb426ade43b9d45af4c8bd24fd8e9bbc8d3104f58f0f3fad3a0f66e68fd6` |
| API qualified base, preserved | `sha256:3083c6ef24d7a9cf5587310fbec6ffd0f03a0d8900e349bdc1602f8a89605bcd` |
| Assistant candidate, unchanged since original qualification | `sha256:90f18ac87a1adbf18ba3602edfc764a6384cac77e7b6773e183610f005d82f7a` |
| New private-export overlay/consumer archive | `91e06cebf3a046e2f757703eb6aaa133b5cb2900c9cdf4d3a1cc33cb21514258` — 112,640 bytes / 13 regular files |
| Outer manifest | `7231ae17f60349684db3e3995a76fe7be42308db85bf490134c19140bf5bb4a6` |
| Private-export consumer manifest | `3265c474a71c39ab5736b363520f9b78c43e300923454dfb28b0c62031734449` |
| Existing finite PDF consumer archive | `9b26eea3cc18f0ce00cd2517883eb558e5030770a3ab635df156ce676047d92d` |
| Existing PDF consumer manifest | `1bbfda2033237f1682a41aa30b1e0798ab9ddbdb99050d3f1102b70bd8a230d6` |

The new API adds one COPY layer containing only `security.worker.js` and `export-storage.js` to the qualified Reports/PDF base. The selected method overlay preserves all other method ASTs, constructors, imports and dependencies. It includes the branch's reviewed active-profile claim protection, deletion compensation only after a confirmed new upload, strict decimal HEAD size verification, and redirect refusal. No unrelated backend branch changes are promoted.

The qualified base retains the existing Reports renderer, Arabic fonts, filter/currency/period handling and ordinary-session policy for an owner's download PDF. **Activating that ordinary PDF policy is specifically part of S1 approval.** Private account ZIP export and other sensitive actions retain their existing recent-auth requirements. No client bypass is introduced.

## Two existing services and exact configuration changes

The GET-only observation at **2026-10-29 22:29:30 UTC** verified all 36 original service identities, configurations, running states, start times and restart counts. Its source receipt is `E10/staging-runtime-proposal-readonly-v2.json`, SHA `ff6680fe32b7e1d44968c433f12cc284f7b5701e958a848677be867f32764557`. The earlier v1 projection omitted Docker's inherited image labels and **must not be used for activation**.

| Existing target | Current image / runtime SHA | Proposed effective runtime SHA |
| --- | --- | --- |
| API `e778fb2f00a396b9c570584f8baf50ae6e679d396e9000be342880fd64da3e5a` | image `a4456b3dc7fc8e883e50879f1f6291aae5140700b0cf1136e2190cc70f5da721`; runtime `45bd6e2d30245321bc4b357b59c5289a5379c6bfaa345adf6db73d5b58c29e22` | `036d4306c11269f845307ab532181d73de6c44743c4cafd2d01aed044879fcc2` |
| Assistant `6f0b29ff05b2f93923049592660e201eb8cbf520ccc04c42ce7e40c771b72940` | image `ed41237521d5f8403dc7a29c79bce4f0bced88a0b964edd29e59505238b40b94`; runtime `73e25daf699326c03e4cb734493f1ce1dd838278bf7e95f912d1ddd0689b41da` | `cd488b0ba00c95fef032c16f509b58e957bf67a1651e87e7874ca99f4958a6b0` |

API: replace only the image, add the verified public `MASARIFI_PRIVACY_HANDLER_MANIFEST=ai@1,engagement@1,identity@1,tracking@1` (value SHA `14d4da2452e4287e65a125f15517b12e44dbbae9c63495ca8dd839859236dfd8`), and inherit the three pinned image provenance labels. Existing environment entries, credentials, endpoint, HostConfig, resource/security limits, healthcheck, entrypoint `/nodejs/bin/node`, command `dist/src/main.js` and user `65532:65532` remain identical. Proposed Config SHA `702b5cd6e5a9fa46b5af5e9ebfd12ed258fa2e67f3b4fb66365b985436b256f3`; unchanged HostConfig SHA `3284e924230c8c7a9968dc432e942100dec9c8273dfeef683d66327243c62a31`. Preserve `127.0.0.1:3001 -> 3000/tcp`, existing backend network and explicit API alias.

Assistant: replace only the image and inherit its one pinned provenance label. Preserve every existing environment entry and HostConfig, including public-assistant-only scope, `MASARIFI_AI_ASSISTANT_ONLY=true`, command `dist/src/assistant-agent-worker.js`, user `65532:65532`, and no published ports. Proposed Config SHA `8efb90a9735ead5a04f8e9471245a779abc20612efa45b1402e9b2430bcfbf8c`; unchanged HostConfig SHA `d02fb0f794bf2780acbb781a0b671c919996053b66963970fe719db68cf57abd`. No new provider request is submitted as a deployment healthcheck.

Both keep `masarifi-staging_backend`; static endpoint configuration is bound in the v2 receipt. New container IDs, endpoint IDs, IP addresses and timestamps are expected runtime identities, not permission to change network policy. Preserve all old containers, images and evidence. A stopped original may receive only a deterministic `-preserved-s1` backup name so the replacement can retain its original service name; restore the original name during rollback.

**Untouched:** generic worker `4d995ec0a2355be8a34b5549078ba709c2f4a4c75ae1a0c08e633cc5e15307e3` remains `sync-mutations.retry` ONLY (runtime `6a27e1d97567a84c8476ba9ebde74530c4a1d479fa15333ac5956b7ff6ad4c45`); sync API `5ba09a5b36366ec707726f5e23d73e93b3b36ec0f50147100d4ab51beb3d9747` runtime `f85bf41d332919a8966bc2988e73624265a933ba0c77c57412d9c5705b81d697`; all other services, cursor keys, Nginx, firewall, TLS and CA. No new infrastructure or hosted migration is requested. Supabase remains `qcffvfbpzvpwcwxwjyro`, with the existing 169 hosted migrations; local schema16 belongs to separately approved N1.

## Two finite consumers, sequential and separately fenced

Approve these narrow consumers only after the service deployment is healthy and current client/financial gates pass. They use the pinned API candidate, existing private Staging database/storage, and only unchanged journal/canonical utilities in **new** approval-bound session directories. No consumed T03/T04 approval, session, journal, cursor key or old runner is reused.

1. **PDF:** at most six first-attempt fresh owner `cf8bf8b051f58c923f0b4634d504b47f1183ae86207fbe4d803b869ef6d77790` financial-summary/PDF/download/nonadmin outputs in one fresh ten-minute window. Existing consumer's SQL, transition, storage-key and event guards apply. Durable consumption precedes each first transition. No stale requests, retry, restart, resume, email, schedules or background job expansion.
2. **Private account ZIP:** at most **one exact newly verified request UUID**, same owner hash, exact scope `ai@1,engagement@1,identity@1,tracking@1`, requested within its own fresh ten-minute window. Durable consumption precedes the single claim; failed, empty or uncertain admission consumes the attempt. At most128 owner-bound reads, 20MiB, 100entries, one no-upsert PUT, verified HEAD, one ready event. Compensation can delete only the exact confirmed newly uploaded object after its failed export. Existing configured24-hour request status retention is retained; no physical deletion guarantee or expiry worker is activated.

Private ZIP scope covers these four existing domain handlers. It does **not** claim full finance/planning or device-only data coverage. Actual archive contents, normal recent-auth, private download, five-minute URL expiry and retry behavior remain original T11 verification gates.

Consumer containers: `uid65532`, read-only root/code/CA, cap-dropALL, no-new-privileges, existing backend network, one DB connection, Node heap128MiB, memory/swap384MiB, CPU0.5, PIDs64, no ports/restart, separate new private journal mount. Credentials stay on the existing server and are supplied only to the relevant admitted existing DB/storage capabilities; never printed or copied into this public packet. Only explicit existing report-processing or `privacy.export-generate` is callable. No Nest/generic worker bootstrap/start/runOnce; no erasure, global expiry, mail, support send, capture or financial transaction.

Expiry, uncertain upload/claim/commit, unknown rows, owner changes, journal loss, heartbeat failure or process interruption are terminal: inspect and report, **never automatically replay**. A consumed finite window is not renewed under the same approval. Any later additional attempt needs a new specific approval.

## Preconditions, sequence and rollback

- Bind a new actual human S1 reply to the final machine packet SHA. This document is not an approval. N1, fresh Xiaomi owner/session/current source, preserved draft/financial fingerprints, pending queue and capture state must be observed before the affected device/consumer tests. Historical8rows/12applied/zero pending/captureOFF are expectations, not current observations.
- Immediately refresh every service baseline, exact candidate images/packages/CA/Nginx, existing storage policy, hosted schema compatibility, free resources (at least15GiB Docker storage and1400MiB available memory) and client/financial gates. Abort on drift, unknown state or insufficient resources. Do not change privileges, keys, account lifecycle or storage policy to satisfy a check.
- Confirm all-owner assistant queued/processing jobs are zero via the existing authorized read-only database channel. Direct worker access to `assistant_agent_jobs` is deliberately revoked; do not grant it or call a claiming function as a diagnostic. Stop accepting new work through the existing API during the bounded handover, recheck quiescence, and do not stop an in-flight assistant/provider operation. Any race/uncertainty aborts the change.
- Recreate only the two named services with the bound effective configurations. Inspect full Config/HostConfig, image, static network/alias, mounts and ports **before** start; refuse any unreviewed default/merge difference. Preserve stopped originals for rollback. Use normal bounded graceful stops; no force kill or broad compose restart.
- Allow approximately90–120seconds for the coordinated handover; abort rather than widening the window indefinitely. Verify actual `/health/live`, required API readiness, existing assistant Docker health and routed Staging health. Health probes do not submit AI questions, private exports or financial actions. Recheck untouched services, keys/config hashes and financial fingerprints.
- On failure, stop only owned replacements normally, retain them for diagnosis, restore original names and start the exact preserved original image/config services. Verify original health and untouched identities. Do not delete blobs/rows, clear queues, repeat uncertain requests, reset data or conceal failed qualification. Rollback restores service code/config; it does not undo already created private rows/files or vendor work.
- After successful service checks, run only the sequential approved finite windows and normal owner UI actions. Private reauthentication, Android folder choice and sensitive reader/share destination selection use normal human UI. A chooser opening is not delivery; a browser opening is not a completed file download. New sensitive destinations require their own explicit approval.
- Complete Xiaomi AR/RTL and EN/LTR enabled-route/journey offline/online/reconnect testing, actual cache/ownership/financial comparison and measured timings. A Metro-loaded DEV session cannot prove standalone offline cold-start/release acceptance; that still needs an approved standalone signing/build path. No percentage or speed claim without genuine measurements and an available before baseline.

## Evidence and remaining limits

E10 is `.superpowers/sdd/2026-10-29-reports-artifact-continuation`. `private-export-source-and-inactive-qualification.json` freezes eight source/doc files, API3suites25cases, actual image13consumer cases, full API typecheck and exact4file lint. The inactive test ran without credentials/network/business bootstrap and refused missing approval. The final scan compared the full scanned image Config and all rootfs layers with the built image: **High0 / Critical0**, with **Medium27 / Low8 / Unknown1** retained and no exclusions. Actual scan report SHA `851f0aa015a11cd72281dc2fd4606907aca625e5bc83afba72ff8a16c5ce6c2b`. All36 services remained unchanged during preparation. Exact owner/role READ ONLY EXPLAIN evidence exists for two PDF queries and eight private-export queries; this is not runtime or index-performance acceptance.

The mobile offline groups remain frozen at108 cumulative files, n09 Hermes bundle `f21c64065e7fc8b8ac315181e23146a862d43dd61dbf3fd24aa44dc81d663c14`,118 production source-map matches and272 legal strings. Unsigned n10 DEV APK `a0447b7556c7029d59ee0956412ccc0d1dc1ef78bba6b41612fd641651ac24b7` remains unsigned/uninstalled. No mobile rebuild is needed for the two backend-only module fixes. Matrix:95route files plus17embedded journeys, with current-source Xiaomi NOT_RUN and performance NOT_MEASURED until actual execution.

Final legal approval, registered operator identity, UAE professional/full-text minors/privacy applicability review, exact operational retention/transfer/deletion confirmations and a release signer remain separate unresolved gates. All documents stay1.0-draft and registration blocking stays OFF.
