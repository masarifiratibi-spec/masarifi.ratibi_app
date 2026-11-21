# Masarifi complete continuation handoff — T04 R18

Prepared 28 October 2026, from read-only runtime/queue snapshots at 14:33–14:37 UTC / 17:33–17:37 Asia/Riyadh, followed by file/history verification through 14:46 UTC. This replaces the *resume point* in older handoffs; their timestamped evidence and historical approvals remain intact. It does not accept a task, authorize deployment, or restart the project.

## 1. Resume here

**T01–T03 are accepted. T04 source and its real queued-reauthentication/exactly-once/restoration slice have passed their recorded gates. Full T04 is BLOCKED on R18: the two serving Staging APIs still sign/validate sync cursors with the shared push-token hash key.** Two corrected, tested, scanned API images are now built and inactive. No R18 secret has been generated, protected configuration changed, or API deployed. The concrete rollout runner/packet, required user approval, and real deployed/Xiaomi cutover verification remain unfinished.

T05 is NOT_STARTED and depends on accepted T04. T06 has completed approved navigation slices and bounded online Xiaomi evidence, but full T06 remains BLOCKED by T04/T05 and its remaining criteria. T07 onward is NOT_STARTED. No dependency was silently waived. Preserve all **62 client requirements, 69 original references and 88 acceptance units**, plus separately identified findings and all 29 task gates.

**Next safe action:** verify sole ownership, branch/HEAD, current phone/queues and unchanged serving APIs read-only. Reuse the exact qualified images below. Finish the bounded, reviewable two-API/key rollout action and rollback controls, perform Sol self-review and the independent evidence gate, and request its specific user approval. Execute no protected action before approval. Following approved execution, verify normal old-cursor recovery on this Xiaomi and authoritative preservation; close T04 only when every applicable criterion passes. Then proceed T05, T06 and the remaining dependency chain.

## 2. Authority, ownership and workspace

- Sole responsible model for planning, implementation, actual Xiaomi testing, Staging verification, self-review, acceptance and handoffs: **GPT-6.1 Sol Extra High (`gpt-6.1-sol`, `xhigh`)**. The latest user instruction supersedes older Astra/Terra/Sol High routing. No substitution or future delegation. Historical Astra independent approvals retain their attribution. Current Sol review is **self-review**, never independent code review.
- Only checkout: `D:/Masarifi-integration-2026-10-10`.
- Only branch: `codex/voice-promoted-operating-2026-10-13`.
- HEAD: `e7ad90e8b91c118e6365f57cc6cc542f94873595`.
- No branch/worktree/account/environment creation, staging, commit, push or merge. Preserve the complete inherited dirty tree and ignored private evidence. The desktop may open the chat in `D:/MY Work/0Part_Time/MASREFY _Final`; explicitly set the correct workdir for every command.
- Root was the sole active writing/device agent. At handoff, collaboration inventory showed root running and historical `sol_lead` completed; no current subordinate was dispatched. At final return root stops work and relinquishes writing/device control. Check for an unexpected other owner before continuing; remain read-only if uncertain.
- Follow the approved [simplified execution strategy](../superpowers/plans/2026-10-26-simplified-execution-strategy.md): one focused execution/self-review loop, real device evidence, independent evidence gates for sensitive changes, and safe-boundary handoffs around three hours where supported. Do not interrupt an operation to meet the interval.
- Production, billing/payments/checkout/subscriptions and intentionally hidden/disabled/deferred features remain untouched. Preserve screenshots being allowed, current UI/typography, Savings and existing non-billing functionality. No PIN/auth bypass, logout/purge, destructive current-owner test, financial submission, provider message, Voice retry or permission/capture activation is approved by this handoff.
- Keep the existing financial worker restricted to **`sync-mutations.retry`**. Frozen T03 **V7** must never be restarted, modified, given a new budget/journal/deadline or replaced with another temporary consumer/framework.

## 3. Read these sources in this order

1. This handoff and [continuation prompt](T04-R18-state-2026-10-28/continuation-prompt.txt).
2. [Fresh local processes/device](T04-R18-state-2026-10-28/local-runtime-device.json), [Staging runtime](T04-R18-state-2026-10-28/staging-runtime.json), [hosted DB](T04-R18-state-2026-10-28/hosted-database.json), [financial metadata](T04-R18-state-2026-10-28/hosted-financial-metadata.json), [Xiaomi queue/cursor fingerprints](T04-R18-state-2026-10-28/xiaomi-queue-cursors.json), [full Git/file inventory](T04-R18-state-2026-10-28/git-snapshot.json), [literal Git status](T04-R18-state-2026-10-28/git-status.txt).
3. [Current T04 reauth report](../evidence/2026-10-25-astra-remediation-review/execution/T04/hosted-reauth-results-2026-10-28.md), [T04 evidence.json](../evidence/2026-10-25-astra-remediation-review/execution/T04/evidence.json), [bounded other-owner retry repair](../evidence/2026-10-25-astra-remediation-review/execution/T04/tracking-retry-repair-2026-10-28.md), and the private R18 receipts listed below. The existing public T04 evidence still says BLOCKED; its pre-build next-step text is older than this handoff.
4. [T06 first slice](../evidence/2026-10-25-astra-remediation-review/execution/T06/navigation-exception-results.md), [expanded audit including its later Reports/Assistant addendum](../evidence/2026-10-25-astra-remediation-review/execution/T06/expanded-navigation-audit.md), [later online recovery/report fix](../evidence/2026-10-25-astra-remediation-review/execution/T06/online-recovery-report-fix-2026-10-28.md), their manifests/receipts, and [route inventory](../evidence/2026-10-25-astra-remediation-review/execution/T06/navigation-audit-inventory.md).
5. [Approved simplified strategy](../superpowers/plans/2026-10-26-simplified-execution-strategy.md), immutable [original 29-task plan](../superpowers/plans/2026-10-25-astra-readiness-remediation.md), [62-ID crosswalk](../evidence/2026-10-25-astra-remediation-review/client-62-crosswalk.md), [69/88 crosswalk](../evidence/2026-10-25-astra-remediation-review/requirements-crosswalk.md).
6. Historical details only when their branch is needed: [13:40 UTC T04 checkpoint](T04-reauth-complete-R18-checkpoint-2026-10-28.md), [older post-rollout history](T04-post-rollout-checkpoint-2026-10-27.md), prior source/Astra reviews and immutable approval packets. Do not mistake older BLOCKED snapshots for later completed work, or older approvals for current authorization.

The original plan SHA-256 remains `dde83afd481bb9d5f1f68e0be12c39eaa1c5b221c33b4ad49caf48f2b95bf189`. Its old HEAD, model assignments, 174-history expectation and “No implementation has started” footer are dated baseline statements, not the present state. Likewise the old T03 summary/review-round-3 BLOCKED labels predate accepted hosted T03 evidence. Preserve those files rather than rewriting their history.

For the actual later T03 acceptance, read `W/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/normal-sync-2026-10-26/FINAL.md` and the final 26 October 19:05 UTC addendum in `T03/session-consumer-prep/CURRENT.md`. Normal-worker/Xiaomi acceptance superseded the frozen consumer's incomplete journey without restarting it; independent Astra review SHA-256 `d82ae71f845b35e9b68ffad19c0cf77634e13a8f9f2d9d8263e1a7645324b8b2` is retained. The old public T03 evidence.json is also a historical snapshot, not a reason to reopen T03.

## 4. Git and evidence preservation

At the handoff read, **68 tracked paths were marked modified by Git status, none staged**, while the textual diff has **67 files**, 4,734 insertions / 702 deletions. The one status-only path is inherited `apps/mobile/src/features/shell/ProtectedRouteGate.tsx`, with no textual diff; do not normalize or rewrite it. There are many inherited untracked source, test, migration, evidence and plan files. The complete final counts/status, every changed path and available file SHA-256 are in `T04-R18-state-2026-10-28/git-snapshot.json` and `git-status.txt`; use these rather than a truncated console listing. Tracked diff SHA-256 remains `95f5577da3315a392ff357c1310d5bace6637ea360d537ef346ceb00adcce633`; all 43 progressive source hashes still match. The snapshot identifies its own excluded self-hashes explicitly.

This R18 continuation changed no TypeScript product source, lockfile, migration or existing Git index entry. It prepared private runtime overlays/qualification artifacts, an App-Lock-preserving Metro wrapper, and this documentation/snapshot bundle. All current tracked changes were inherited. The former progressive 43-path source manifest is `P/sol-t04-final-source-preservation.json`; compare hashes to determine reuse, not to claim new device acceptance. Exact R18 private file hashes are in [R18 artifact inventory](T04-R18-state-2026-10-28/r18-artifact-inventory.json).

Definitions for the rest of this handoff (expand literally):

```text
W = D:/Masarifi-integration-2026-10-10
P = W/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/access-restoration-2026-10-27T0735Z
R = P/r18-cursor-api-artifact-prep
S = /opt/masarifi/qa-t03/uploads/8937ba09919a4e94ee7179bf354fc4697dfad6b9105b2c3bce210f7c61e09f83
```

`P`/`R` are existing private ignored evidence/artifact directories, not additional environments. A new Git clone will not automatically contain them. Resume on this same filesystem; preserve their bytes and raw private/customer-bearing evidence. Do not publish raw XML, cursor tokens, financial record payloads or logs. No PIN/password/verification code/JWT/signing-secret value is included in this handoff.

## 5. Completed T04 work — do not repeat

### Applied schema/worker history

- The original two-schema v2 attempt failed with PostgreSQL 42501 and no commit. Read-only reconciliation established unchanged financial/schema state; separately approved original-worker restoration completed. Do not retry either action.
- Corrected v3 rollout approval SHA-256 `5060d99b4ef81450504a466004397fc1840a1fdd879588f720b3c03302c0e340` was consumed: both qualified bodies/history records committed atomically on 27 October at 09:24:41 UTC; qualified normal sync-only worker started. The two body hashes and reconciliation are in the historical post-rollout handoff. No schema rollout remains pending.
- The later approved reference-free review repair packet SHA-256 `52049e932490b08e8179707747d9dfa0281f51b0a1a177f25e32b724e169c46c` was consumed at 12:06:01.822 UTC on 28 October. Additive migration `20261028114000_tracking_reference_free_correlation_review.sql` SHA-256 `84e6a9d2355b03f7949516886b7ab0e2a53b8fe2573361b713e6129d52b6eb40` moved history to 169. Natural tracking attempt 705 completed at 12:10:13.141 UTC and moved the same reference-free correlation hold into exactly one existing-owner pending duplicate review. The retry scheduler/worker was operating; missing safe manual-review exit was the defect. Payload/source/canonical identities and finances stayed unchanged. No forced retry, accept/reject/settlement or worker restart was used. That review remains **pending by design**, not runnable automatic work. Full tracking integration was NOT_RUN; bounded SQL/stub and runner-path qualification limits remain in the repair report.

### Real reauthentication and exactly-once proof

- Exact v8 test approval SHA-256 `972310763d5d19ce14b38a7c8da3d86d17f73611730f2f9a5f49e0b50128434e` and focused cleanup recovery approval `763cc0e187a42dfd938434da59909a58ac3abbe9b31d64ca2c8a45c01b760ec2` were consumed successfully.
- Existing QA20 operation `905bc741-cbeb-4c81-9772-498f542c04ba`, base 5, produced authentic `RECENT_AUTH_REQUIRED`. After the user's private normal SDK verification, the **same operation UUID/body/base/hosted row** applied once at 13:04:22 UTC, with one idempotency effect/revision 6.
- V8's full balance-row hash guard correctly halted cleanup on metadata drift. Investigation showed the existing zero-effect ledger revision legitimately updated balance version/time; monetary amounts and postings did not change. The separately approved recovery explicitly corrected the guard; no silent baseline repin occurred.
- The one distinct restoration operation `64075a4e-7785-4225-8cca-ce2c6e89fa76`, base 6, also completed through normal human verification and applied once at 13:23:27 UTC. It restored the NULL note, producing exactly one further idempotency effect/revision 7. **Do not replay either operation, Save the expense again, or repeat the policy test.**
- QA20: existing title `QA-20261025-EXPENSE-20`, transaction `85753de8-510f-4315-bfe9-04058ccf13c6`, 20 SAR, version 7, NULL note, seven revisions, one original posting. Account `e2b630f2-c975-49e6-89e3-efaafa1a15b9`: confirmed 2,525 minor units, pending 0, ledger version 17. The financial invariants and original-ten-operation hashes matched the approved preimages in completed receipts.
- Normal six-file configuration and original threshold-free sync-only worker were restored at 13:25 UTC. Temporary policy is **absent**. There is no outstanding restoration operation or policy cleanup.
- `P/sol-t04-v8-FINAL.json` binds the completed receipts/source preservation. `P/sol-t04-v8-final-authoritative-settlement.json`, `sol-t04-v8-local-final-settlement.json`, `sol-t04-v8-normal-restored-polling.json` and final actual synced Details XML retain their producer/scope. Reuse this accepted slice.

Fresh handoff DB metadata at 14:34–14:36 UTC: **169 migrations; 81 transactions; 87 postings; 14 accounts; 12 balance rows; 12 applied mutations; 0 received/processing mutations; import sessions 25 complete / 1 review / 0 runnable.** QA20/account values remain as above. These are read-only snapshots, not guarantees about future activity.

## 6. R18 diagnosis and exact serving services

Nginx `/etc/nginx/sites-enabled/masarifi-staging` actually splits sync routes. This continuation resolved the earlier ambiguous port attribution:

| Role | Actual routes/port | Current container | Current image |
|---|---|---|---|
| sync-readiness | Regex `/api/v1/sync/(?:bootstrap|delta)/?$`, including the `staging-development` header path → loopback **3020** | `ae727700013ef9bc9e7b3cbaea595143baebd9e7bae5c6f22fd54dfcc862ac73`, `/masarifi-dev-sync-readiness-20261019` | `sha256:53d890f0d8f8f8ed6cac7ed5a32889d9f4710a3d1badc7d440123a2bf2dbdcbd` |
| reports-ledger | `/api/v1/sync/ack` and ordinary fallback/report routes → loopback **3001** | `4e9bc21d1475dff650b606e4c1627e12f603fd2b6a94bd15fe48a33a9790be05`, `/masarifi-assistant-reports-api-ledger-scope-20261023` | `sha256:bde04a161f8988897117b7810e976263ec723a42a5fac6703469d5e0070cfeff` |

Both running APIs are healthy/restart 0; both `/health/live` and `/health/ready` returned 200 at the fresh handoff read. Node is v24.20.0. The old normal API on port 3000 is **not** either relevant upstream; replacing it alone would leave R18 unfixed. Preserve routing and the reports/ledger behavior. Do not broadly replace either API with the worker image.

Both actual compiled SyncService modules are identical: SHA-256 `2997e1ade138e1c6cb072b90f8537217b1e56428d96e19f455537008223cb63a`, three cursor-key reads from `MASARIFI_PUSH_TOKEN_HASH_KEY`. Their old config validators neither allow nor require `MASARIFI_SYNC_CURSOR_KEY`. Adding only an env variable is insufficient and would be rejected by the old schemas. Both API environments, protected `api.env` and `worker.env`, and the normal worker lack a dedicated key/key-file configuration. **An existing dedicated key does exist in the separately approved isolated T03 file `/etc/masarifi/qa-t03-api.env`; it is not active in these serving APIs.** The final history cross-check found and verified it read-only; see section 9. Prefer assessing that already-provisioned material for the specifically approved R18 binding instead of unnecessarily generating another key. Do not load the whole older T03 env file over either current API configuration.

Minimal correction is already implemented in the **prepared runtime overlays**: exactly three service reads use `MASARIFI_SYNC_CURSOR_KEY`, byte-identical to the already qualified current module SHA-256 `e544771b20c4f6eb7999997708518dfcba84215c71b524ec440bc3852a39acbf`. Each older API schema has only the R18 allowlist/required-API-key/Joi/canonical-32-byte/distinct-from-push validation added. Canonical TypeScript source already contained these semantics before this phase; no duplicate product edit was needed.

### Qualified inactive images — reuse these exact IDs

| Role | Qualified candidate image | Schema module SHA-256 |
|---|---|---|
| sync-readiness | `sha256:6569dd9087ab58bed5a3c8dc7ca1d65fcd6354547642f63786af0438939351e0` | `233702b222c1c3e4dbb746900fb654e979015645acf7e7046a8c4596e28a3315` |
| reports-ledger | `sha256:a4456b3dc7fc8e883e50879f1f6291aae5140700b0cf1136e2190cc70f5da721` | `5195399006323d41d9bd1176955593b5927d4fec2e5ad5b46894dfab5204a3c4` |

Tags are respectively `masarifi-t04-r18-sync-readiness:8937ba09919a4e94` and `masarifi-t04-r18-reports-ledger:8937ba09919a4e94`. Identity means the full image ID, not a tag alone.

Authoritative source archive: `R/r18-secure-api-overlays-v4.tar`, 1,290,240 bytes, SHA-256 **`8937ba09919a4e94ee7179bf354fc4697dfad6b9105b2c3bce210f7c61e09f83`**. Build manifest SHA-256 **`9bd60a69874cba5b0af54b568d85151d3bf329f4332ee70119570b154d84450e`**. `R/secure-overlays-v4/build-manifest.json` binds 104 archive files; `R/secure-package-receipt.json` and `secure-upload-receipt.json` bind the archive to `S`. Upload/build/qualification are complete; no restart/rebuild/re-upload is owed unless a relevant change/drift requires it.

The first two-module-only image failed the vulnerability gate: inherited body-parser 2.3.0 (`CVE-2026-111181`) and multer 2.4.0 (`CVE-2026-113872`). It is NOT deployable. The final images additionally contain registry-SRI-verified body-parser 2.4.0, its scoped content-type 2.1.0 / qs 6.16.1, and multer 2.5.0. All 48 package files per image match the manifest; all direct resolution ranges and scoped qs dependencies pass. Old package trees have no obsolete non-nested files left behind by the merge. Scoped qs avoids changing the global inherited qs 6.16.0. This does not claim the repository's inherited global lock resolution was changed or fully requalified.

Each image preserves its own baseline Config except provenance labels and adds exactly three layers: SyncService, config schema, narrowly fixed package overlay. Entrypoint/Cmd/User/env defaults/healthcheck and unrelated app/authentication files are unchanged. The candidate is an API-specific overlay, not a broad current-source backend replacement.

## 7. R18 tests and limitations

Do not rerun successful unchanged suites merely because a new conversation starts. Results below are separate scopes and not a total coverage sum.

| Evidence | Result and boundary |
|---|---|
| `R/runtime-regression-red.json` | Both actual old serving modules failed 5/9 relevant cursor/config scenarios; defect reproduced using actual compiled modules and synthetic in-process repository boundary, no DB connection |
| `R/runtime-regression-green.json` | Minimal modules/schema passed 9/9 each in fresh children of existing serving runtimes; no service mutation |
| `R/qualified-sync-readiness-runtime.json`, `qualified-reports-ledger-runtime.json` | Final built images passed all nine scenarios each under existing nonroot/read-only/cap-drop/no-network qualification controls, loading actual image modules, no in-memory replacement |
| `R/focused-api-sync-security.log` | Four existing codec/bootstrap/delta/security suites, **18 tests PASS**; live DB tests explicitly off |
| `R/focused-key-config.log` | Existing independent API key config test, **1 PASS**, 64 intentionally filtered |
| `R/focused-mobile-cursor-recovery.log` | Existing transport cursor recovery/pending-preservation cases, **6 PASS**, 111 filtered; no broad navigation rerun |
| `R/focused-http-middleware.log` | Existing HTTP validation/raw Clerk body contracts, two suites/**11 PASS** |
| `R/qualified-middleware-regression.json` | Five bounded raw-body/body-limit/malformed-gzip/aborted-upload/subsequent-request smoke observations per exact image, all PASS. The same smoke on the baseline also passed; **it did not reproduce the advisory exploits**, and is not represented as such. Scan/package version evidence established the security gate failure/fix |
| `R/qualified-runtime-compatibility.json`, `runtime-compatibility-verified.json` | Against actual existing process env in isolated children using a synthetic dedicated key, all other 89 / 92 parsed config fields are equal, including Clerk/push values. Values were not printed or written |
| `R/package-closure.json` | 48 file hashes per image and all reported dependency ranges pass; no package install/startup scripts executed |
| `R/qualified-build-qualification.json` and per-role qualification receipts | Both final image scans: **HIGH 0 / CRITICAL 0**, targeted glibc CVEs 0, retained MEDIUM 27 / LOW 8 / UNKNOWN 1 each; no ignores. Full scan reports remain at `S/*-vulnerabilities.json` |

The pinned existing Trivy binary SHA-256 is `93f9da8e4ba5e0c1c76d8234ed2494cf9afb0a96fd21953e424bb795f3299b8e`, archive SHA-256 `c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f`. Its existing cache is `/opt/masarifi/qa-t03/uploads/f00163437d5b60a7649ebabfd6d3cc90c2a64ba972e65ae0d3d72ae2a7bf0203/trivy-cache`. Build used existing default Docker driver/buildx infrastructure, no new builder/environment. Full final scan report hashes: sync `053d51f6543eb3f717f26f6581a68035d2c07af3ed3bab5b653272e9ba4f867b`; reports `fc80f7d9d032bfd75fbeaa38ba72eda9ac805373b25c444c7bb5ba697276d905`.

Preserve failed preparation evidence. Initial cache-path assumption failed before any build; actual existing cache was located. First artifact-preparation path handling failed before completion and then hit Windows MAX_PATH; extended paths fixed it. Partial v2 and inactive v3 package artifacts remain as history. Final v4 preserves package directory traversal/file permissions. Initial config-object strict comparison failed on object representation; normalized value comparison showed no changed fields. A first semver probe failed because production images deliberately lack the dev-only semver package; actual dependency metadata was then checked through the existing local semver with no image install. The smoke's expected baseline-crash assertion failed because baseline did not crash. A Node-REPL SSH cursor probe exited 255 without a product result; the ordinary existing strict SSH transport later completed it successfully. These are harness/preparation failures, not unresolved product findings; do not blindly rerun their scripts.

The local R18 preparation/build/upload helpers are **not a rollout runner**. `build-qualify-secure-r18.py`, `prepare-security-overlay.py` and `upload-secure-artifact.py` are one-shot artifact tools with exclusive-create guards and already-consumed outputs. No finalized R18 deployment/rollback runner or approval packet was saved before the user requested handoff.

## 8. Xiaomi queues, three existing cursors and compatibility

Phone `f66a40694eca`, Xiaomi 23076RN8DY, Android 15; DEV package `com.masarifi.mobile.dev`, version 0.0.1/code 1, minSdk 24/targetSdk 36. Current session uses the existing signed-in QA account; user privately unlocked the normal PIN gate. No key, PIN, code or auth token was extracted. DEV/Metro provenance is preserved; exact loaded native-byte hash and standalone release qualification remain UNVERIFIED.

The existing Expo SQLite inspector performed SELECTs only against the one registered protected owner DB (`masarifi-cf8bf8b051f58c923f0b4634.db`). No exporter/decryptor/new bridge/logout path/DB writes were used. Latest 14:36:54 UTC read: 12 applied, **zero other queue statuses**, all three cursor fingerprints unchanged. 14:25:55 UTC producer/draft read: one retained finance draft, zero Voice operation journal, zero unfinished Voice batches, zero batches retaining audio, zero SMS queue. Existing retained completed Voice batch is not unfinished work. Native metadata at 14:28:24 UTC: no encrypted queue ciphertext, legacy records 0, SMS/notification sources false, capture false. Do not invoke native `readRecent` as a read-only shortcut: it prunes/writes.

| Domain | Existing position, accepted by BOTH old API codecs | Bytes | Current cursor SHA-256 |
|---|---|---|---|
| accounts | 2 | 162 | `6a15cacedf778a8885b83f9705f5fa29a7636a8c611cf896d5419b974dce434d` |
| categories | 0 | 164 | `e6d858e36ed55ded75f6323514e7676512300d08a15ed1cde521fcdebf9dc41d` |
| transactions | 17 | 168 | `772c93fdad9220b0ac8d786c3595109cce7bf9d354675a7ab545121e5c58b7a4` |

`R/xiaomi-old-cursor-runtime-compatibility.json` proves the existing three actual cursor signatures decode under each existing shared-key configuration, with the existing QA owner/device scope, at 14:28:23 UTC. This pure codec check did not call authenticated API routes, mutate sync state or expose the signing key. Raw signed cursor input exists only as private `R/xiaomi-cursor-probe-private.json`; keep it private and out of public handoff/console output. Fingerprints above are sufficient for preservation comparisons.

Compatibility requirements:

- Both API roles must use the **same dedicated 32-byte canonical base64url cursor key**, distinct from their existing shared push key. Keep shared push hashing/encryption keys, Clerk credentials/session semantics, device/owner binding, domains and protocol shape unchanged. No unnecessary rotation or legacy shared-key fallback.
- Switching keys deliberately retires old shared-key cursors. Old tokens must receive typed HTTP 400 `SYNC_CURSOR_INVALID`, and the existing client must rebootstrap reads without deleting/replacing pending work, drafts, receipts or authentication. Do not manually reset cursor rows or manufacture an invalid phone cursor. Exercise its currently stored tokens through normal synchronization after approved deployment.
- Auth/session compatibility is established structurally and through existing successful reauth evidence; **fresh authenticated behavior on the deployed candidates remains NOT_RUN**. Verify the same normal SDK session after rollout, without logout or reading its token.
- Hosted metadata has five unrevoked Android devices reporting version 0.0.1, five sync state rows per domain, and two owners with sync activity within 24 hours at the earlier bounded read. Last recorded sync is the QA settlement at 13:23 UTC; last device seen 14:00:14 UTC. Version 0.0.1 alone does **not** prove all five use this corrected recovery implementation. Other active-client compatibility remains a rollout consideration to disclose/resolve, not assume from pooled DB connections or aggregate counts.
- The user’s historical quiet-window confirmations covered earlier tests; do not treat them as a permanent exclusivity guarantee. Refresh queues/producers/current activity and include actual impact, bounded downtime and older-cursor behavior in the concrete approval request.

## 9. Current processes and infrastructure — leave intact for handoff

At 14:33 UTC Windows snapshot:

- Owned Metro wrapper **PID 25284**, child **32992**; child is the sole listener on **127.0.0.1:8081**. Wrapper `P/sol-t04-r18-metro.mjs` and `sol-t04-r18-metro-receipt.json`; stdout/error logs alongside. App Lock is explicitly true and normal public projection matched the retained baseline SHA-256 `4b16185f65cc3c1b00a61ae55c0efb3b984710409bcf1eaff04d03372dd7b350`.
- Own ADB reverse `tcp:8081 → tcp:8081`; phone DEV PID **24113**. Wi-Fi **0**, mobile data **0**, airplane **0**, active default network **none**. Historical pre-test baseline is Wi-Fi 1/data 0/airplane 0; it has **not** been restored during this handoff because the app/Metro were deliberately left running offline. Do not enable networking reflexively or start another Metro.
- The existing app was opened through its ordinary localhost launcher entry; previous direct development-client link launch had an automatic-review rejection “blocked by policy.” Do not retry/bypass that rejected path. No credential screen was captured during private unlock. The passive SQLite WebSocket was left open; all queries finished, no device action is pending. New chat may need a fresh inspector connection/normal PIN unlock; old REPL variables are not a handoff mechanism.
- No build, scan, migration, rollout, financial operation or test session remains in flight. Unified exec sessions 90198 (initial scan gate failed), 61668 (final image qualification complete), 54039 (18 tests complete), 58058 (6 tests complete), 1390 (11 tests complete) are historical completed sessions; do not replay commands after an “unknown process” poll. Background Metro alone is deliberately active.
- No listener on the owned PG17 fixture port **55473**. That retained fixture system `7700634956601963652` is stopped; no PG17 lifecycle occurred in R18. Windows has other PostgreSQL processes (parent 8056 in snapshot) and unrelated Node/Codex/ADB processes; ownership is not established. Do not stop them or infer they are this fixture.

The positively identified retained fixture root is `W/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17`, data directory `data`, binary directory `runtime/pgsql/bin`. Identity receipt `P/sol-correlation-existing-fixture-identity.json` and existing `scripts/qa/t03-exact-sync/fixture-common.ps1` bind this path/system/port. Existing synthetic T04 DBs are retained; do not reset/drop them or create another environment. Use its approved ownership/lifecycle controls only when T05/new changed verification actually requires a run, not to repeat T03 or R18 preparation.

Fresh Staging snapshot: **36 running containers**, the two old APIs above unchanged, normal sync-only worker container **`4d995ec0a2355be8a34b5549078ba709c2f4a4c75ae1a0c08e633cc5e15307e3`**, image **`sha256:f1ea1557383d70cd3e78e361c18412171bb0ae002ea53314eefaddbd20495bf4`**, start 13:25:22.831070081 UTC, restart 0, threshold absent, scope `sync-mutations.retry`. It has no Docker health status in this fresh inspect; previous normal poll-success evidence is preserved, not replaced by an invented current health assertion. Frozen V7 container `e4d369becec7e34e5dc2d588383233cc272d9348bc6bc2d9f77c5a6acacc0bab` remains stopped.

Strict SSH remains supported with no expanded access:

```text
C:/Windows/System32/OpenSSH/ssh.exe
  -i C:/Users/DELL/.ssh/masarifi_staging_ed25519
  -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile=C:/Users/DELL/.ssh/known_hosts_masarifi_staging
  -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8
  masarifi@187.77.81.97
```

Use existing authorized `sudo python3 -`/Docker read APIs carefully; no firewall/key/host-verification weakening. Supabase Staging project is `qcffvfbpzvpwcwxwjyro`; official connected execute_sql read-only transactions are available. SQL must not be used for server files/OS. Images are distroless; use supported `/nodejs/bin/node` for public compiled-module reads, not unavailable `cat` inside them. Docker Engine API version 1.56 was read; no Engine mutation was performed.

Fresh protected bytes match the earlier restoration:

| File | SHA-256 |
|---|---|
| `/etc/masarifi/worker.env` | `3420c2018e9454bbf4cef4d42aa7f46f613e3f04075834bca85a63d575c42847` |
| `/etc/masarifi/api.env` | `abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef` |
| `/etc/masarifi/migration.env` | `75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1` |
| `/etc/masarifi/supabase-ca.crt` | `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7` |
| Frozen `/run/masarifi-t03/journal/t03-qa-bc2c323a66641b97/00003.json` | `ffec183e5eab6bfed4e8107728e315b671b8854689eeba167819e37e7f926563` |
| Nginx Staging site | `1f4ebba134ca22dd28c7f41fda44972061cb6d9f4e3dde304ed4b017867f8990` |

An earlier preparation idea considered `/etc/masarifi/sync-cursor-r18.key`; that path is **absent** and is not a finalized/approved location. The final T03-history cross-check supersedes the earlier incomplete “no existing dedicated material” assessment: `/etc/masarifi/qa-t03-api.env` was explicitly provisioned under prior T03 isolated-configuration approval and remains unchanged, 2,057 bytes, UID/GID 1000:1000, mode 0600, whole-file SHA-256 `06506707b7a28c3817fb6afb577a1c9ab84ba11e39962755bd9d612e1984a077`. Read-only metadata at 14:45:47 UTC confirms a canonical 32-byte dedicated key distinct from both serving APIs' push hashes. No value or individual key digest was emitted, no file changed and no R18 key was generated/activated. See [existing isolated key metadata](T04-R18-state-2026-10-28/existing-isolated-cursor-key-metadata.json). Its historical isolated approval does not authorize binding/restarting the two serving APIs; include the existing-key reuse in the new exact rollout approval. Preserve the frozen consumer and this original file byte-for-byte.

## 10. Exact unfinished rollout/acceptance work

These are the required remaining steps, **not authorization to execute**:

1. **Reconcile ownership and drift read-only.** Match both original IDs/images/security/ports/config hashes from `R/runtime-compatibility-verified.json`, actual nginx route hash, qualified images/archive, protected files, frozen V7, worker scope, current financial/queue state and current phone owner/cursor fingerprints. Refresh activity since these timestamps. If unexpected pending work exists, stop and identify it; do not force, replay or settle it.
2. **Prepare one bounded rollout/rollback action using existing Docker infrastructure.** No such final runner/packet yet exists. Preserve each API's complete existing Config/HostConfig/network/CA binding, env values, flags and source behavior. Runtime hashes and nonsecret properties are recorded in `R/qualified-runtime-compatibility.json`: both nonroot 65532:65532, read-only rootfs, all capabilities dropped, no-new-privileges, init, pids 256, memory 512 MiB, 1 CPU, existing backend network, loopback port mappings, existing healthchecks/restart/log policy. Avoid printing secrets or putting them on command lines; keep any required protected values in memory or root-only storage using existing supported mechanisms.
3. **Key scope:** first assess and propose reuse of the already-provisioned dedicated cursor key in unchanged `/etc/masarifi/qa-t03-api.env`, shared by these two APIs through a narrowly reviewed binding. Preserve each API's actual current env; extract only the dedicated key in protected memory rather than substituting the old T03 env file wholesale. No push/Clerk rotation, frozen-consumer/file change or new secret is necessary merely because the serving APIs lack the binding. Verify equality across the two serving processes and inequality to push hashing in memory; record booleans only. Bind the exact supported injection/persistence mechanism and permissions in the approval packet. If a genuinely distinct new key is necessary after scope assessment, explain why and obtain its specific approval; do not generate one automatically.
4. **Coordinated two-API cutover and rollback:** preserve original containers/images/config for rollback; graceful non-forcing hold, no forced kill/retry. Because bootstraps/deltas issue cursors on 3020 and ACK validates on 3001, do not issue dedicated cursors while the ACK service still uses the old key. A proposed ordering is hold bootstrap first then ACK, start qualified ACK/readiness first then qualified bootstrap, with a short disclosed fail-closed maintenance interval. Two Docker container changes are not an atomic database transaction; do not claim atomicity. Preserve nginx routing and the worker. Define bounds, journals/intent receipts, fresh guards before mutations, cleanup and known/uncertain failure handling. An uncertain action stops for read-only reconciliation, not blind retry.
5. **Review and ask once for the exact sensitive action.** Bind full image IDs, archive/manifest SHA, both targets, new-key handling, client compatibility/retirement, expected downtime, rollback and the final runner/packet hash. Label Sol's self-review separately; satisfy the independent verification gate with named automated/image/authoritative database evidence producers and the required human approval. Self-review alone does not satisfy that gate, and no separate model delegation is authorized. Existing scan receipts remain reusable within their scope. No earlier approval below covers this deployment/key activation. Wait for the specific answer.
6. **After approval only**, execute the reviewed bounded action with drift guards. Verify both intended images/key configuration, health/readiness, security/config preservation and untouched worker/protected unrelated files. No migration, policy threshold or financial test is needed for this correction.
7. **Actual hosted/Xiaomi verification:** refresh local/native queues first; retain the three original stored cursors. Permit only ordinary signed-in online reads/sync metadata acknowledgments under the reviewed scope. Observe typed old-cursor failure, successful bootstrap/delta and ACK across the actual two services, and replacement cursor fingerprints without manual reset. Verify same owner/auth/session/App Lock, 12 applied/original operation identities, one draft, QA20 version 7/NULL note/20 SAR, authoritative posting/account/balance invariants, no new mutation/idempotency/financial revision, no unexpected capture. Use safe correlated status/domain/request-ID evidence, not tokens. Check affected navigation/read recovery in Arabic/RTL and English/LTR where applicable; reuse prior successful unchanged route journeys. If a PIN/factor is genuinely needed, user enters it privately through the actual supported UI.
8. **T04 acceptance:** reconcile original 2.1/R5/R10/R17/R18/R19, historical source/Astra approval, isolated owner/logout/key-loss fixtures and the successful actual reauth slice against deployed R18 results. Prohibited destructive current-owner journeys remain fixture-only/device-unverified under the user's approved scope; never bypass this by deleting real data. Label Sol's conclusion self-review, bind independent evidence producers/candidate IDs and obtain any required human gate. Update current T04 evidence/report/strategy checkpoint only after the criteria truly pass. If a criterion remains unverified, T04 stays BLOCKED with its exact reason.
9. Only after accepted T04, **start T05**, then complete full T06 and the remaining original chain. Continue safe independent authorized work without another dependency-exception cycle. Preserve the handoff interval and original denominators.

## 11. Approval ledger and no-repeat boundaries

| Approval / decision | Current disposition |
|---|---|
| 25 Oct original sequential remediation plan and 26 Oct simplified strategy | Approved; task criteria/dependencies/denominators preserved; latest Sol-only routing overrides future old model assignments |
| T02 remaining 30/60-minute PIN tests | User-accepted testing exception; do not resume cancelled duration tests or claim untested expiry PASS |
| Single SSH `/32` rule for the then-current IP 5.163.148.193/32 → 187.77.81.97:22 | Historical specific access approval only; no new/broader rule authorized |
| Initial v2 rollout `a1239f014e63da6ee3ea2c9bf3812a906cadd2b8ec25f951b13ecc5a3b1896e7`, original-worker restore, corrected v3 `5060d99b…c0e340` | Consumed/reconciled; no replay or additional migration approval |
| Earlier conditional policy test `32e5421b5d5d6cab8cab950291e11d30c68f8030f66120cc6fd2e40cb8786f3f` and quiet windows | Historical bounded approvals/aborts; not reusable blanket policy authority |
| Held policy proposal v7 SHA `8a0ca2a4cf771364f2a044905e65b4d5eb41a72910ad56b2a15c0731efe78611` | Inert/unapproved; do not repin/execute. Distinct from frozen T03 consumer V7 |
| Reference-free review repair `52049e93…c46c` | Applied once and natural retry completed; owner review remains pending, no financial settlement approval |
| V8 `97231076…8434e` and cleanup `763cc0e1…60ec2` | Consumed successfully; QA restoration/policy cleanup complete; do not repeat |
| Limited T06 exception `3936bf2238ec33326b691dc292ebc78d614cac462bbf45272e3384596d84f370` | Approved two entry-point repairs/offline evidence only; full T06 still gated |
| Expanded active T06 exception `51224a79dc271a35ede4b1e81f35e1e15eb48ed599c8d86a8c535f4ec20f8d81` | Approved currently enabled navigation/Back/error-state slice; hidden/deferred flags, finances/security/infrastructure excluded; later safe online reads were verified under subsequent explicit user direction |
| Proposed T05 read-only exception `07ebc484bb21c67b5468a9ebafbb6360256017c92a7d5607eb897fae4ceeb449` | **Not approved/not used**; user directed actual blocker repair instead |
| Historical isolated T03 `/etc/masarifi/qa-t03-api.env` dedicated key provisioning | Approved and completed historically; unchanged file/key metadata verified at handoff. Not approval to activate it in serving APIs |
| Current R18 API replacements/dedicated-key binding (or any necessary new key) | **NOT APPROVED. No final packet/request sent.** Artifact builds/scans/pure tests and safe read-only checks completed under current authorization |
| Current request | Handoff/documentation and read-only snapshot only; stop after saving. Does not authorize operational changes |

Do not repeat accepted T03 warm/cold saves, applied operations, completed reproduction, successful unchanged 241 navigation tests or PG17 qualification. Do not reset/purge queues, force another owner's retry/review, revive frozen V7, recreate an environment/account, retry interrupted Voice, submit/send a financial or assistant/support action, broaden access, or treat a fixture/DEV/health-200 as full device/release acceptance.

## 12. T06 implementation and Xiaomi evidence already completed

Full inventory: **114 route files = 97 screen wrappers + 17 layout/control files**. Inventory completeness is not proof that every screen is reachable or accepted. Keep per-route evidence scope.

Implemented navigation corrections (inherited, preserved):

1. Existing Security Settings now displays the existing Events entry outside fixture mode; protected route/live-content gating retained. Main transaction list opens Details, with explicit Edit retained. Product paths: `apps/mobile/app/security/settings.tsx`, `apps/mobile/src/features/transactions/TransactionListScreen.tsx`.
2. Shared `TransactionCard` now opens Details for account activity, retaining explicit Edit.
3. Existing return sanitizer admits the currently visible `/categories`, `/salary`, `/obligations` roots, preserving query/sensitive-route rejection; actual Categories background/lock/unlock returns to Categories.
4. Transactions wrapper validates scalar `accountId` and applies existing account selection; View all retains selected account scope.
5. Account View all supplies sanitized caller context; contextual toolbar/hardware Back uses supported `dismissTo` and clean AR restart unwinds Details → Accounts without history cycle.
6. Later report compatibility fix: `reports-service.ts` omits only redundant `monthStartDay` undefined/1 because actual deployed reports DTO on 3001 rejects that parameter. Nondefault days/account filters remain intact. This fixed actual report HTTP400; no API/feature flag change. Custom cycle-day support remains unverified/unsupported by that deployed validator, not silently discarded.

Expanded product/test paths, in addition to the first slice: `apps/mobile/app/(tabs)/transactions.tsx`, `src/features/accounts/AccountDetailScreen.tsx` and its test, `src/features/transactions/TransactionCard.tsx`, `TransactionsRoute.test.tsx`, `src/features/home/HomeScreen.test.tsx`, `src/features/shell/navigation-context.ts` and its test, `NavigationJourney.test.tsx`, `ProtectedNavigation.test.tsx`. Reports fix: `src/services/live/reports-service.ts` / `.test.ts`. All paths are relative to `W/apps/mobile` except the first fully prefixed path.

Focused tests: initial four suites/62 tests; expanded final **12 suites/241 PASS**, mobile typecheck and affected lint 0 errors/2 preexisting warnings; last return refinement two suites/23 is overlapping evidence. Later strict report adapter **14 PASS**, typecheck/two-file lint/whitespace passed. No new navigation test rerun was necessary in R18. Preserve failed expectations and intermediate history-cycle/test-fixture corrections with their limited scope.

Actual Xiaomi results already observed:

| Journey | Verified scope |
|---|---|
| Transactions QA20 → Details → Edit/close → Back | AR Details identity/amount/account/synced status, Edit opened and closed without Save; account activity Details also AR/EN |
| More → Security → Events → Back | Existing route/unavailable gate offline; protected live-content restriction intentionally retained, not a defect to remove |
| QA Account Details → View all → Back | AR/EN correct account label/scope; clean AR restart returns Details then Accounts without cycle |
| Categories → background/reopen → private PIN | EN returns Categories after correction; Salary/Obligations lock-return variants only automated, not separately phone-tested |
| Accounts/pickers/categories/form sheets/settings | Bounded AR/EN existing routes/Back; empty new forms closed, existing fields unmodified; retained transaction draft preserved, no Save |
| Clean Reports → Assistant → toolbar/hardware Back | AR/EN, All Accounts and QA contexts; account/date/SAR context retained; EN five report actions prepared unsent questions. Earlier rapid-input ambiguity is superseded, not a remaining confirmed defect |
| Online Analytics → All Accounts/QA report | AR/EN report200 after redundant default-day fix; accountIds retained. EN empty September honest empty state |
| Online Reports → Assistant → Back | AR/EN bounded scoped return; no message, consent or provider action |
| Online Profile / Active Sessions / Tracking / Salary → Back | AR/EN; current device shown, 113 tracking keywords loaded, honest missing salary anchors, no changes/capture activation |
| Online Obligations → QA detail/schedule/payment history → Back | AR/EN existing reads only, no payment/Undo/Edit execution |
| Warm offline → online report recovery | AR cached data retained, report200 and normal delta/ACK recovery; EN not separately repeated |

Later online recovery/queue visibility supersedes earlier UNKNOWN-queue and offline-only reports **at their later timestamps**. Today's offline R18 queue snapshots supersede earlier ten-applied counts with 12 applied. The earlier interrupted Voice banner was not retried/cleared/uploaded; later actual inspector metadata established no unfinished/audio work. Do not infer all future queues stay empty.

Outstanding T06 acceptance: T04/T05 prerequisites; actual eligible owner-scoped Events content/pagination/retry/empty/recovery within its intended capability gate; remaining enabled conditional routes/dynamic record/error-state journeys; unsupported nondefault report cycles; true auth/onboarding/PIN-reset/logout/account-switch paths only under safe authorization/prerequisites; refund-review navigation without financial execution; any untested locale variant. No hidden menu/route may be manufactured to fill inventory coverage. Home shared-card reuse lacked a current-day row to tap and is automated/source-only evidence. R18 deployed online compatibility remains its own task gate. Later QA20 exact-title search/filter observation (clear chip/scroll finds it) remains **UNDIAGNOSED**; no data loss established. Do not call a root cause or fix from coordinate misses.

## 13. All original 29 task gates and remaining work

Execution order is the original chain below. “NOT_STARTED” means not started as an acceptance task; existing implemented features, prior source and useful tests must be preserved and qualified rather than rebuilt. Original detailed assertions/files/gates remain in the immutable plan and both crosswalks.

| ID | Depends | Current status | Remaining acceptance/work |
|---|---|---|---|
| T01 | none | ACCEPTED | Preserve admission/62–69–88 mappings, historical independent Astra approval |
| T02 | T01 | ACCEPTED with explicit testing exception | Preserve existing PIN/native/biometric/relock evidence; unperformed 30/60-min expiry stays UNVERIFIED, not a new blocker |
| T03 | T02 | ACCEPTED | Preserve real warm/cold supported edits, same-operation financial receipts/restoration and frozen consumer/PG evidence; no replay |
| T04 | T03 | BLOCKED; R18 artifacts qualified/inactive | Finish exact two-API/key approval, deployment, actual cursor/auth/sync/financial preservation proof and all original task acceptance; completed reauth slice reused |
| T05 | T04 | NOT_STARTED / dependency blocked | Qualify exact current fresh/upgrade migration chain, checksum/history/hosted drift, RLS, fees/minor-unit/currency/transfer/refund/card/planning/idempotency invariants on the positively identified existing disposable fixture. Historical plan says 174; the handoff filesystem has **176 SQL migration files / 176 checksum entries**, while hosted history is **169**. Reconcile exact names/bodies/wrappers, never guess parity or bulk-apply. Nullable source_version CHECK follow-up stays separate added finding; any fix additive/direct regression/approved target |
| T06 | T05 | PARTIALLY IMPLEMENTED/VERIFIED slices; full BLOCKED | Complete enabled navigation/conditional/API/error/retry/Events/refund-review and required AR/EN device cases, preserving listed passes/hidden gates; no broad 241 rerun |
| T07 | T06 | NOT_STARTED | Budget invalid retained 2026-13 draft recovery, real keyboard and durable first-save/replay; onboarding, Arabic/Persian 0/2/3-decimal/overflow/opening boundaries; safe QA only |
| T07a | T07 | NOT_STARTED | Preserve/qualify existing Savings CRUD/movement/history/account/progress, payable/receivable rich fields and planning round-trip/restart AR/EN; no real repayments/external transfers |
| T07b | T07a | NOT_STARTED | Existing card terms/calculator, percent scale/rounding/non-payoff/legacy terms/dates/reminders/liability truth, actual safe QA forms/calculator; payment execution deferred |
| T07c | T07b | NOT_STARTED | Category usage/kind/history/stale version/archive/merge and remittance-versus-internal-transfer identity; approved unused QA/cancel paths, no destructive real-category changes |
| T08 | T07c | NOT_STARTED; supporting default-report repair exists | Diagnose remaining report failures with correlation, timezone/bounds/cycle-rollover cache identity and owner/account/currency isolation; actual retry/range/zone. Existing day1 fix does not accept T08 |
| T09 | T08 | NOT_STARTED | Honest ranges/cycle1/25/account/currency, refund/transfer/net worth/FX/comparison/drill-down, preview/download/schedule/history; email requires explicit recipient/send authorization |
| T10 | T09 | NOT_STARTED | Support statuses/translations, idempotent draft/refresh, mobile→Admin→mobile recovery; no support/Admin message without explicit send authority |
| T11 | T10 | NOT_STARTED | Export retained500 correlation, supported re-verification preserving request identity, status/package/owner/expiry/download/retry; actual approved phone export |
| T12 | T11 | NOT_STARTED | Cooling-off/cancel/erasure/provider/retention/public truth; isolated approved disposable identity only for destructive lifecycle; no current-account deletion or implicit new account/environment |
| T13 | T12 | NOT_STARTED | Existing theme/localization/cross-year labels/long names/hour-cycle; AR/EN RTL/LTR, Light/Dark/System and required font scale/accessibility on Xiaomi; restore settings |
| T14 | T13 | NOT_STARTED | Actual bilingual keyboard/Back/picker/lock/restart and agreed edit/composer/planning/support draft persistence with owner fences and local failures; preserve working drafts |
| T15 | T14 | NOT_STARTED | Existing JS/native/server SMS parsing/discovery and published policy; malformed/filtered/tied/OTP/promotion/amount/currency/owner cursor cases plus controlled expressly approved actual SMS/permissions, no bulk historical import |
| T15a | T15 | NOT_STARTED | Merchant normalization/rule precedence/learning and per-account/card opt-out at proposal/replay; controlled phone/settings/capture with no unintended posting |
| T16 | T15a | NOT_STARTED | Native notification queue ACK/>200 retention/compaction, preferences and actual OEM screen-off/restart/reconnect/permission/delivery/privacy/locale; extra hardware gaps explicit |
| T16a | T16 | NOT_STARTED | Actual authenticated notification actions: owner/lock/recent-auth/expired/replay/cancel/retry and Gulf-day dedup; financial effects fixture-only unless exact QA scope approved |
| T17 | T16a | NOT_STARTED | Actual assistant provider/model/tenant/quotas/Gulf Arabic/structured bilingual dates, mixed-data honesty, timeout429/cancel/retry/multiturn; unsent question/navigation is not provider acceptance |
| T17a | T17 | NOT_STARTED | Existing allowlisted action preview/reject/confirm/expiry/version/replay/owner and canonical parity; actual confirm only finite approved QA, no payment/subscription actions |
| T18 | T17a | NOT_STARTED | Voice account/currency/owner freeze, permission/settings/real approved capture/upload/result/cancel/interruption/restart/provider/quota; interrupted old capture not replayed; any posting separately approved |
| T19 | T18 | NOT_STARTED | Existing Admin permissions/live recovery/provider/export/support/security/dashboard across browser viewports, no fixture leakage/redesign/billing; read local Admin agent/Next docs before edits |
| T19a | T19 | NOT_STARTED | Feedback separately from ticket workflow, Admin-only moderation/edit/delete, owner visibility and actual authorized synthetic phone/browser states; no invented ratings/customer edits/messages |
| T20 | T19a | NOT_STARTED | Effective exact-candidate CI/native/PIN gates, preservation workflow signer conflict without weakening, affected performance/stress, identity checker and rebuilt Xiaomi native install/PIN smoke |
| T21 | T20 | NOT_STARTED | Exact existing-signer/minified/nondebuggable/API36 standalone APK/AAB, real phone journeys, ZIP/ELF16KB plus supplemental platform proof; preserve SMS/notification permissions and explicit publisher/Play/privacy/deletion/DataSafety/testing publication-only blockers |
| T22 | T21 | NOT_STARTED | Reconcile all IDs/added findings/exceptions for same candidate, Sol self-review with required independent evidence under current routing; concrete separately approved PR9 merge and post-merge verification. Original title mentions Astra but future routing is Sol-only. Merge never deploys/publishes |

Keep the nine business-rule mappings: internal transfers excluded from income/expense; linked refunds reduce expense; card liability not double-counted in net worth; distinct card payoff ledger intent (fixture while payments deferred); stored monthly-interest scale; reconcile legacy card interest with delivered calculator; stable custom/remittance budget categories; Gulf-day reminder dedup; Admin-only feedback moderation. Preserve approved scope decisions for Home/avatar/import/recurrence, Android versus iOS, screenshot/archive privacy, VAT/zakat/family/referrals/investments and deferred billing as recorded in the crosswalk/plan. A historical hidden feature is not a missing-route defect.

## 14. Ready-to-use continuation prompt

The exact copy is also saved as [continuation-prompt.txt](T04-R18-state-2026-10-28/continuation-prompt.txt):

```text
Continue Masarifi from D:\Masarifi-integration-2026-10-10\docs\handoffs\T04-R18-continuation-handoff-2026-10-28.md. Read it fully, then its current snapshots, R18 receipts, T04/T06 reports, approved simplified strategy, original 29-task plan and both crosswalks. Treat older evidence by timestamp.

Use GPT-6.1 Sol Extra High (gpt-6.1-sol, xhigh) as the sole planner, implementer, real-Xiaomi tester, reviewer and handoff owner. No delegation or model substitution. Use only D:\Masarifi-integration-2026-10-10, branch codex/voice-promoted-operating-2026-10-13, HEAD e7ad90e8b91c118e6365f57cc6cc542f94873595. Preserve all inherited changes/evidence, data, auth/settings and hidden/deferred features; one writer/device controller. Verify ownership and current state read-only first; stay read-only if uncertain.

Resume the prepared T04 R18 correction, not completed T03/reauth/rollout work. Both exact corrected API images are built/scanned but inactive. Reuse them and the verified three existing Xiaomi cursors/12-applied queue evidence. Finish the concrete coordinated two-API/dedicated-cursor-key rollout and rollback packet, obtain its specific approval before protected changes, then verify actual Staging and Xiaomi normal cursor recovery/session/sync and authoritative financial preservation. No R18 deployment/key approval exists yet. Keep the worker sync-mutations.retry-only; frozen V7, Production and billing untouched. No financial submissions, logout/purge, interrupted-Voice retry, new branch/worktree/account/environment or hidden-feature activation.

Do not repeat unchanged passing tests, 241 navigation cases, accepted T03 journeys, applied operations, completed reauthentication/restoration or PG17 qualification. Reuse the currently running owned Metro and offline phone after checking identities; do not start a duplicate or reconnect unsafely. Preserve three-hour safe-boundary handoffs. Mark incomplete criteria BLOCKED/UNVERIFIED, never PASS. Accept T04 only with all required evidence, then continue T05, complete remaining T06 acceptance, and proceed through the original eligible task chain. Continue safe authorized work autonomously; request only genuinely necessary specific approvals or human private authentication.

Begin with a concise status and exact next safe action, then proceed from this checkpoint.
```

This handoff was requested at a safe preparation boundary. No R18 rollout/controller is running or approved. The active Metro/app session and intended Staging services were deliberately left intact; the outgoing root performs no further remediation after returning this handoff.
