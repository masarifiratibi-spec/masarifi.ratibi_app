# Voice v3 processing and accuracy repair — complete handoff

Snapshot: **2026-10-04, 18:45 Asia/Riyadh**. Read this document before older handoffs. This packet supersedes their pending-CI, uninstalled-APK and five-event statements. It does not certify release readiness.

## Instructions for the next chat

Work, implementation notes, plans, progress updates and the final engineering report must be **in English**. Use Superpowers systematic-debugging, executing-plans, test-driven-development and verification-before-completion. Use the Supabase skill for database/Storage work. Follow the [repair plan](../superpowers/plans/2026-10-04-voice-v3-processing-and-accuracy-repair.md) without redesigning the accepted batch architecture.

The user wants the recording to produce a real result promptly, rather than remain indefinitely in Processing. Fix the actual boundary; changing a label or restarting an unrestricted Worker is not sufficient. Continue already-authorized nonfinancial engineering autonomously. Request a new human recording only after the controlled test is ready and its result/cleanup path has been proved.

Do not touch Production or integrate branches. Automatic financial posting stays disabled until nonfinancial gates pass and the existing explicit first-financial-canary approval is obtained. The earlier word “Approva” approved only bounded operational-history maintenance, not financial posting. Reconnection and recording acknowledgments also did not approve financial posting.

## Product contract — retained

`Voice Session → Batch → 0..10 independent events → eligible expense/income auto-commit → unsafe/incomplete/unsupported events silently skip`.

- One valid event creates one normal transaction/card. A single transaction is a one-item batch.
- No v3 Review, Save, Confirm, needs-details, follow-up questions or correction questionnaire.
- Genuinely omitted account uses the saved default account; omitted date uses capture-local date. Explicit ambiguity must not default.
- Safe taxonomy resolution, canonical validation, ownership/RBAC, recent-auth/rate safeguards and ledger rules remain enforced.
- Repayments/transfers/loans/obligations without an implemented automatic workflow skip; never relabel them as income/expense.
- A skipped event has no financial draft, transaction, posting or balance effect. Retain only minimal operational codes and opaque identities.
- Completed results show actual cards and “Added N transactions.” or “No transactions were added.” Unknown outcomes must remain recoverable, never become a false zero-result success.
- Preserve `google/gemini-3.5-flash-lite`, provider `google-vertex/global`, accepted compact structured output, M4A/AAC, Arabic/English, ZDR, `data_collection: deny`, retry limits and current budgets.
- Limits remain **10 events, 60 seconds, 1,200 output tokens**. No truncation, merging to fit, uncontrolled fallback, token increase or budget increase.
- Keep v2 manual compatibility. Never auto-execute a legacy proposal.

## Workspace and exact release state

Use the existing worktree, not the older initial checkout:

```text
C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final
Branch: codex/voice-auto-batches
Acceptance remote: ratibi
Repository: masarifiratibi-spec/masarifi.ratibi_app
```

`D:\MY Work\0Part_Time\MASREFY _Final` is the original workspace. Do not reset either checkout or create a replacement worktree without need.

| Identity                         | Exact value / disposition                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| User's accepted input            | `deb6611e3102c8222908389547a34c5bd1e6b35b`                                                                                 |
| Currently deployed Staging SHA   | `c6daa220fdbe8c866d97879087c7215856c4a31d`                                                                                 |
| Tested Storage repair            | `1b1d5558221939b3655b5992546a1d8a98452779`                                                                                 |
| Current frozen runtime candidate | **`30984cfd3e2a9606d63588c23802147bbbb492df`**                                                                             |
| Candidate immutable image        | **`ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:5cfbe8122651fcddae2d80cf9bb07a3d4a142940049c19baa85de8110c34e306`** |
| Candidate Mobile tree            | `cc2f39c89b9b1f568fcb34aeb589cfba61c62958`                                                                                 |
| Candidate API tree               | `acbed592df5087b423865455b56c1b736bf26ab7` — identical to1b1                                                               |
| Deployed image                   | `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:81446fbec22b8c1cc259a7b4f84ed147d82bc3dbd04dbad61aa617f79b417042`     |

At packet preparation the runtime worktree was clean. The handoff may be followed by a documentation-only commit; do not confuse that SHA with the tested runtime image. Verify runtime tree equality before using309's artifact for a docs-only successor. Any further runtime change needs fresh exact-SHA CI/image/build evidence.

The old `origin` points to `abdullah-zordok/MASREFY_Final`. A prior1b1 push/workflow accidentally targeted it. That workflow37209050898 was cancelled; no merge/deploy occurred. It is not acceptance evidence. Always specify `--repo masarifiratibi-spec/masarifi.ratibi_app` for `gh`, and use `git push ratibi`.

### Newly verified CI — green

[Exact30984cf CI](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37211453396) succeeded, with k6 enabled:

- Mobile457 suites /2,541 tests.
- Real PostgreSQL/Supabase integration105 suites /379 tests; one suite/four existing opt-out tests skipped.
- Ledger integration33, ledger security17, ledger recovery6 tests.
- Five browser projects355 passed /310 viewport-specific skips; no flaky/retry result in retained log.
- Container10 suites /23 tests; configured Trivy, secrets, sentinel, application/admin gates passed.
- Ten performance summary files:78 threshold failure flags, allfalse (the exporter usesfalse to mean passed).
- Tag-only signed-release-evidence skipped by design. This is not a signed Production release.

Full log SHA256: `ae76f07fa31ff8325b39510843f851ea21c3e6db64299ab4a293ce3b40805d7e`.
Storage-only1b1 also has [green full CI](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37209079816); its image is `sha256:c20cde3093229ef26f5f701eb360f3e3ab397318b765d851afe41ffa97fe98b9`. Prefer309 for the next complete candidate deployment.

## Findings — distinguish four separate problems

### 1. Long wait in the managed test, not a proven slow Gemini call

Controlled human recordings used the old APK's **v2 carrier**. The bounded shadow harness invoked actual compiledc6 `AiWorker.voice`, `AiStorage`, `AiGateway`, references and real provider accounting, but intercepted v3 batch acceptance to prevent financial persistence. It deliberately did not persist a normal v2 proposal. Therefore the legacy Mobile poller could not complete its normal proposal transition.

The ordinary Worker was intentionally paused. Arabic submit→manual dispatch was161.646 seconds; English58.933 seconds. The actual provider receipts were3065ms and3077ms. That proves the measured wait was before provider execution in this test setup. It does **not** prove a general production latency cause or SLA. Do not claim that label changes fix end-to-end processing.

### 2. Actual v3 gate-off/uncertain-result presentation

The installedv3 APK attempts create while `private.voice_automatic_policy.enabled=false`. Staging returns503 before the new session exists. Mobile retains the operation because a generic503 may also represent a lost/unknown create outcome. UI originally showed **both** “Analyzing recording...” and “Checking the result…”.

309 fixes only that misleading presentation: `VoiceBatchStatus` shows analysis when `processing && !uncertain`. Unknown-outcome recovery, journals, cancellation and financial idempotency are unchanged. Four EN/AR user-visible regressions had two RED failures, then passed. Full Mobile suite and independent review passed. **This fix is not yet installed on Samsung.**

Current code maps SQL `VOICE_AUTOMATIC_UNAVAILABLE` to generic `AI_UNAVAILABLE`503. `AI_UNAVAILABLE` may also arise after session creation commits, so never classify every503 or everyAI_UNAVAILABLE as a terminal no-create failure. The plan specifies a narrow, separately tested definitive gate-off response if the reproduced indefinite retry remains. Keep unknown results recoverable.

Also test definitive rejection plus failed local audio removal before extending retirement behavior: current `retireLocal` removes audio before persisting the terminal phase, while recovery retries nonterminal rows. No such removal failure was observed on Samsung; this is a source-derived failure hypothesis, not another claimed incident. The plan requires a regression proving a failed capture cannot later resurrect when availability returns, while its audio remains owned for cleanup.

### 3. Proven Storage cleanup defect, repaired in code but not hosted

Hosted Storage repeated DELETE on an already deleted exact object returnsHTTP400 with `code=NoSuchKey`, `statusCode=404`. c6 rejects it asVOICE_STORAGE_UNAVAILABLE. Audio deletion already happened, but database media-reference reconciliation remains pending for the two controlled recordings.

1b1/309 recognize only404 or the precise bounded legacy400 NoSuchKey shape for **DELETE allowMissing**. Body limit4096 bytes; existing10-second timeout/abort; other400/403/500, NoSuchBucket and malformed content still fail. Download/upload behavior is unchanged. Storage23 tests, independent review, fresh real-PG/container/CI passed. No hosted success claim yet.

Old purge helper claimed only the pinned Arabic sample while23 unrelated due rows were briefly locked and unchanged. DELETE failed underc6; completion was not called. Lease expiry is natural. Do not clear DB references manually or delete Storage metadata via SQL.

### 4. Human speech accuracy failed — root cause remains open

Expected four fictional events: cash breakfast25SAR; cash taxi40; card household120; cash salary5000. Capture-local date and supplied taxonomy/account aliases were fixed. User explicitly confirmed every Arabic clause, and English “twenty-five” / “five thousand”.

| Test                | Result                                                                                                                                       | Actual receipt                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Arabic,21.315s M4A  | 3 provider events /3 decisions; first two fully matched; a third eligible income did not establish full expected fixture agreement. **FAIL** | 2799 input /318 output tokens; USD0.0016347;3065ms |
| English,44.471s M4A | 4 events /4 eligible decisions; taxi and household matched, breakfast/salary amount checks failed. **FAIL**                                  | 3379 input /218 output tokens; USD0.0015587;3077ms |

Every provider event keeps a slot through normalization/validation, even when skipped. Arabic's3 decisions therefore do not arise from dropping a fourth invalid decision in the harness. Responses were complete, below1200tokens; retained evidence does not indicate token truncation. Exact expected-occurrence matching also checked across events, so event count alone cannot pass the gate.

No raw extraction, transcript, actual wrong amounts or audio content was retained. Exact media objects were deleted. Capture acoustics, audio/container integrity, model interpretation and amount scaling cannot be distinguished conclusively from the retained booleans. Do not claim the missing item was definitely household, guess the wrong amounts, fetch provider-retained output, or retry the deleted recording. Do not change prompt/schema/model/token cap on this opaque evidence alone.

### Ten-event capacity remains accepted

Synthetic bilingual real-provider evidence: English10 used597 output tokens /3467ms /USD0.0023484; Arabic10 used610 /2758ms /USD0.0024172. Eleven events returnedcomplete=false,1032tokens; whole envelope rejected, no prefix commit. No limit reduction or cap increase is justified. Capacity is distinct from human-device accuracy, which still blocks financial acceptance.

## Samsung — what is and is not proved

ADB: `C:\platform-tools\platform-tools\adb.exe`; device `RK8XB00N33K`, SamsungSM-A165F/a16, Asia/Riyadh. Fresh inventory found it authorized (transport5). Inspect only Masarifi and task-specific capture metadata; do not inspect other apps, unlock PINs or token logs.

Installed at17:27:11Riyadh, in-place update without data clearing:

- `D:\Temp\masarifi-voice-v3-278e6f0-compatible.apk`
- SHA256 `b97c612e7d821773626077041249c2a34ec87c51299b095ce8831bf1652cfce7`.
- EAS build `9f0927a2-d573-4c5d-9b1c-309c01cfc129`, source278e6f05bf5bb226dae830b6debc908233e707e8; Mobile tree `f7ced382038d9e6e5665e3e6ed3fce12b0d5de23` matchesc6/1b1, **not309's label fix**.
- Internal test certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. EAS certificate differed, so the existing matching local test key re-signed it;2105 payload entries unchanged. Not Production signing.
- Packagecom.masarifi.mobile, version0.0.1/code1,target36, nondebuggable. Login/onboarding/Home preserved.

Verified legacy backup: `D:\Temp\masarifi-voice-v3-before.apk`, SHA256 `f6d3fcdb050f07914c536003830ee89c9f90ba9d96d03cad607eeecfbf4ee9a8`. It may serve only a clearly labelled, temporary non-posting legacy-carrier diagnostic after signing/compatibility checks; restorev3 afterwards. Do not claim its UI is v3 acceptance.

Native measurements (fixed-stage timing only):

| Capture                            | Tap→Recording | Native release→durable handoff | Handoff→Ready |
| ---------------------------------- | ------------: | -----------------------------: | ------------: |
| Initial                            |         253ms |                           28ms |           0ms |
| Repeat with earlier result pending |         179ms |                           29ms |           0ms |
| Repeat with two results pending    |         188ms |                           20ms |           0ms |

First sample automatically stopped at60s because UI automation stalled while recording; second manual sample was approximately42.5s; third deliberately2s. All were local gate-off samples, no provider call or hostedv3 session. All three were cancelled through normal UI; remaining Cancel controls0. Ready<=250ms passes these samples. **B recording while A is actually in Gemini, real successful cards and completedv3 UX remain unproved.**

`uiautomator dump` may fail waiting for idle while recording. Do not read an old XML file as fresh state or let instrumentation accidentally extend a fixture. Use a fresh task-specific screenshot or bounded input, verify stop immediately. No arbitrary sleeps in product code.

## Hosted state, access and safety

Supabase Staging: **`qcffvfbpzvpwcwxwjyro`**, PG17.6, eu-central1, Free. Public API `https://api.staging.masarifiratibi.com/health/live` still reportedc6 at packet preparation. API/ClamAV healthy; Admin unchanged. `masarifi-staging-worker-1` last verified created/not-started. No global scheduler/backlog drain.

SSH is currently timing out, while public health and Supabase queries work:

```powershell
ssh -i C:/Users/DELL/.ssh/masarifi_staging_ed25519 -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=C:/Users/DELL/.ssh/known_hosts_masarifi_staging masarifi@187.77.81.97
```

Keep host-key verification. Prior SCP/deploy attempts never connected, so no transfer/partial deploy happened. Diagnose connectivity; do not rotate keys, disable host verification, open ports or repeatedly retry blindly.

At18:45Riyadh fresh read-only reconciliation:

- PolicyOFF; v3 context/session count0; transactions0; postings0; all3account balances confirmed0/pending0/ledger version0.
- Provider attempts28. Monthlyvoice usage24completed /USD0.0485566;6reserved /USD0.7896;18released historical reservations /USD2.3688 (not billing).
- Four unknown-cost holdsUSD0.5264 remain protected; two cancelled undispatched reservations account for the remaining reserve. ConservativeUSD2 budget remaining **USD1.1618434**. Preserve holds and recheck before each new call; max per-call reservationUSD0.1316.
- Database323980435bytes, below500000000 quota. No new inference/financial action during handoff preparation.

Test references: active SAR Cash default and SAR debit Card, zero opening balances, no opening transaction;19 active categories including Food/Restaurants, Transportation, Shopping and Salary. Owner identity is private in host controls, not this document. Owner pinSHA256: `e8a7dda4e09c741322e4e2ee3d1f4c4cb8d1950749e0f524854e560fc074c2c3`.

Migrations82 entries; immutable checksums:

- `20261003145030_voice_automatic_batches`: `8a503b35247fd6636715905c241968b6ed9cf139dd09671dc5bd01e0e7130e25`.
- `20261004093000_voice_ten_event_capacity`: `0860cc4d32309e34077f64edba7f3e5214801b4debaea5eb9992459154de04f3`.
- Ordinals0..9. No PUBLIC-executable application SECURITY DEFINER functions. Last security advisor: fiveINFO default-deny private RLS notices, noWARN/ERROR.

Admission is **not a DB owner-scoped policy**. A temporary Nginx loopback3002 create-route filter admits only the pinned owner for contract3; actual API still validates Clerk signatures. It preservesv2/unrelated routes, handles uppercase/trailing slash, fails closed. API3000 is loopback-only. Filter service `masarifi-voice-canary-ingress.service`; backup `/etc/nginx/sites-available/masarifi-staging.pre-voice-canary`. Reverify before any financial gate; forgedJWT admission is not authentication.

### Capacity/outbox history — do not repeat cleanup

Approved completed pre-cutoff operational history archive/removal/compaction is DONE:483862runs/496940attempts removed,65newer runs/75attempts and2retrying runs kept. Database813427859→323964051bytes at completion. Archives mode0600/directory0700 under `/opt/masarifi/operational-history-archive/20261004-111600`, retain through2027-01-02. No financial/audio/provider/outbox purge.

Protected proof:125 exact original matches; three append-only original hashes plus identified activity; profile heartbeat requires a fresh baseline and lacks a complete original-field preimage. Do not claim all129 tables unchanged. Temporary index/ACL restored.

Typed PGMQ1.5.1 publisher fix proved three bounded existing nonfinancial messages, one publish each. Last queue snapshot3queued/496941unpublished. Full drain could add300–350MB, exceeding current headroom. Never claim queues empty, delete backlog or start ordinary Worker merely to make Processing finish. Use pinned, bounded one-shot acceptance; normal growth/backlog strategy remains a separate operational gate.

Existing env SHA256 fingerprints (verify, never print contents):

```text
api.env       abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef
worker.env    968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29
migration.env 75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1
compose.env   73cf9a1abe1cc1e9f925cb43586f83c224f480c4bec1b7884f371ad7ced4040a
admin.env     44e47f9303c93240193e8d3cac6efb0229fa524313b9a93a5ffdff095f683234
```

## Security/onboarding disposition

Read [Mobile dependency exposure](2026-10-04-mobile-dependency-exposure.md). Moderate decoder remains bundled; native-intent guard and22 actual Router cold/live regressions mitigate the assessed inbound path. Do not describe the dependency as patched or certify unknown alternate consumers. No blind ESM override or Expo/Clerk upgrade. Keep valid Arabic/literal-percent/auth callbacks and independent original native events intact. Physical native-link validation remains required.

Browser shared-timeout regression was split into16 routes without assertion/timeout relaxation. Fresh five-project CI is green; old missing artifacts do not establish the historical blank-page root cause. Reopen only if new evidence warrants it.

Accepted hosted onboarding remains `tracking_intro`, completedStepswelcome/version2, completedAtnull; existing local behavior entersHome. Do not “repair” it again.

## Code map

| Responsibility                    | Files                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Session API/error translation     | `apps/api/src/ai/ai.service.ts`, `ai.repository.ts`; `apps/api/src/platform/http/safe-exception.filter.ts`                                 |
| Provider/compact extraction       | `apps/api/src/ai/ai.gateway.ts`, `ai.worker.ts`, `voice-batch.ts`                                                                          |
| Storage deletion repair           | `apps/api/src/ai/ai.storage.ts`; `apps/api/test/integration/ai/voice-storage.spec.ts`                                                      |
| Independent financial execution   | two migrations above; `apps/api/test/integration/ai/voice-batch.spec.ts`                                                                   |
| Mobile durable operation/recovery | `apps/mobile/src/services/live/voice-batch-api-service.ts`, `apps/mobile/src/storage/voice-batch-journal.ts`                               |
| Mobile aggregate status           | `apps/mobile/src/features/voice/useVoiceBatches.ts`, `VoiceBatchStatus.tsx`, `VoiceBatchStatus.test.tsx`                                   |
| Recorder and instrumentation      | `apps/mobile/src/features/voice/VoiceCaptureRuntime.tsx`; `apps/mobile/src/services/platform/voice-recorder-service.ts`, `voice-timing.ts` |
| Native-link security              | `apps/mobile/app/+native-intent.tsx`, `apps/mobile/scripts/deep-link-decoder.test.mjs`                                                     |
| Full CI/deployment                | `.github/workflows/backend-foundation.yml`, `docker/staging/compose.backend.yml`                                                           |

## Evidence locations and operator traps

Local private/ignored evidence directory:

```text
C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\voice-v3-staging-acceptance
```

Read `acceptance-report.md`; latest observations supersede historical snapshots. CI files `ci-309-full.log`, `ci-309-image/`, `ci-309-performance/`; device `samsung-v3-timing.log`; provider `ar-33178bdf8d5ea813-provider-evidence.json` and `en-c578176143d6b3f1-provider-evidence.json`; capacity receipts, `activity-reconciliation.json`, `hosted-outbox-receipt.json`.

Host private probe: `/tmp/voice-v3-capacity-3976774`, mode0700/0600. Its filename is historical, not current candidate. `control.json`, manifests/baselines contain private owner/capture metadata: do not print or commit them. Do not download archives or raw financial/audio content.

AR capturehash `33178bdf8d5ea813e34e4680e7a92f7aa8838da34f169d09d029a1612baedddf`; receiptgeneration hash `6d8239a96d1af4e936c50be9657b6161bdde37f6decf99390267960169c2bbe2`.
EN capturehash `c578176143d6b3f15b5e4932825892585ad5b7f696de8ac87b339770c21e96d9`; generationhash `a00e0bf3d93d59ffe1438f265abc269bdc83536af8ac6c2088b1db57e5a92244`.

`run-samsung-shadow.sh`, `run-shadow-purge.sh`, `lock-shadow-purge.cjs` and deployment wrappers currently pin oldc6/image. **Do not run them unchanged after deployment, lie about MASARIFI_RELEASE_VERSION, replace historical baselines or remove once-only dispatch markers.** Create a separately versioned recovery/test context with original-capture provenance, fresh candidate/image/module fingerprints and reviewed guard changes. Existing temporary migration-role authority must always be transaction-scoped and restored; no persistent grants.

`deploy-1b1d555.sh` is only a prepared wrapper; it never ran remotely. For309, use its proven digest, current deployedc6 as old target, fresh archive/checksum and stopped Worker checks. Do not blindly reuse its1b1pins.

## First financial canary — proposed, NOT approved

Only after accurate nonposting English/Arabic and technical gates pass: one fictional English capture, ten events under60seconds: cash breakfast25, cash taxi40, card groceries120, cash lunch30, card pharmacy65, card phonebill80, cash books45, card household55, cash parking10, cash salary5000SAR. Fix category/account aliases before speech.

Expected10cards (9expenses/1income), cash+485000minor,card−32000minor,total+453000minor. Verify every amount/account/category/date, normal cards, ledger receipts/postings/balances and same-identity replay; no Review/Confirm. Max reservationUSD0.1316. Recheck owner ingress, queues/idempotency, leases, recent-auth, quota, accounting holds, migrations and disable controls immediately before asking the existing explicit approval. Global policy is not owner-scoped; restrict admission and execute only pinned work. Stop on discrepancy; ordinary audited corrections only, no erased financial history or automatic inference rerun.

The final report must record exactSHA/image/APK/certificate, migration checksums, CI, provider receipts/cumulative budget, physical timing, committed IDs/counts, independent balance effects, exactly-once/cancellation/recovery/owner/privacy proof, security disposition and remaining blockers. Release is currently **not ready**.
