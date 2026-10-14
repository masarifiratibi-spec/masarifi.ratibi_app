# Masarifi — complete handoff and Redmi investigation

**Documentation-only handoff, 11 October 2026. Implementation is STOPPED at the user's explicit request. This document does not authorize execution or supply a corrective implementation plan.**

Prepared for a new Astra session to independently investigate, plan and continue from the preserved recovery state. Read-only inspection began at approximately **17:36:57 UTC / 20:36:57 Riyadh**. All times below are on 11 October 2026 unless otherwise stated; Riyadh is UTC+03:00. Historical test, device and Staging results are identified as such. No new tests, CI dispatches, builds, signing, provider calls, database/SSH observations, deployments, financial operations or phone operations were performed for this handoff. Existing GitHub run conclusions and remote Git refs were read without triggering execution.

## 1. Executive status and exact starting point

The recovery product is implemented and broadly qualified automatically. It is **not accepted for full Staging/client delivery**. The latest compatible client is uninstalled; the qualified backend runtime is undeployed. Normal authenticated-user Voice Financial Auto-Posting remains unactivated. The last retained Staging policy observation is **OFF**. Physical private-journal safety remains **INDETERMINATE** because the latest approved Redmi diagnostic rejected a framework-reported same-UID peer before Application return, key access or journal access.

The exact immediate rejection is known. The historical peer's name, PID, role, actual kernel UID and liveness were not retained, so its underlying cause is **not established**. Successful stock Android disposable controls do not identify that historical Redmi process. The listener-enabled disposable experiment also remains incomplete; aggregate CI is still failed.

| Item | Exact verified state during handoff |
| --- | --- |
| Canonical repository | [masarifiratibi-spec/masarifi.ratibi_app](https://github.com/masarifiratibi-spec/masarifi.ratibi_app) |
| Active recovery worktree | `D:/Masarifi-integration-2026-10-10` |
| Active branch | `codex/voice-auto-save-restoration-2026-10-11` |
| HEAD | `0be314d9246029ea2ab5210df45a4a9a2d050c30` |
| Canonical recovery remote | `ratibi`; read-only `git ls-remote` returned the same exact HEAD |
| Configured old remote | `origin = https://github.com/abdullah-zordok/MASREFY_Final.git`; do not use its tracking state as canonical push evidence |
| Full product qualification source | `e6def119b047c54fbaf36877fdd23b3bc367ad6a` |
| Qualified runtime source | `093b5d0c42f3d68eb2de619aff94b44fbf088a02` |
| Prior completed preparation checkpoint | `15488cd7bace161d5093bd44ad8b47491dafb053` — historical, superseded by current recovery HEAD |
| Original recovery handoff checkpoint | `68e198e0e689a406b439d13e6d82f96e9a9f9312` — do not restart from it |
| Integration branch | `codex/masarifi-complete-integration-2026-10-10`, local/canonical remote `42bcb8ca93b3018d6c6e8a875de39579f0936ac3` |
| Canonical remote main | `ecfba4d7de40555c122bd3b5e53e7e7fd71f6294`, independently read during handoff |
| Local main worktree | `C:/masarifi-main-integration`, `730aa8c459d27d3849a6001d827cfa231f7ce81b`; older than canonical main |
| Desktop initial cwd | `D:/MY Work/0Part_Time/MASREFY _Final`, branch `codex/ratibi-staging-security`, HEAD `ca01a4eb34d5c97c5df34264c5b6a9bca374b041`; this is not the recovery worktree |

All completed recovery commits through HEAD are pushed to the canonical recovery branch. They are **not consolidated into Integration/main**. Current commits, all nineteen worktrees and seven stashes are inventoried in the appendices. Do not reset, clean, archive, switch or delete any of them.

### 1.1 Interrupted uncommitted work: preserve exactly

The recovery worktree was already dirty when documentation began. Three modified files comprise **35 insertions / 10 deletions**, with no staged changes:

| Modified file, relative to recovery root | SHA-256 of actual working bytes inspected for handoff |
| --- | --- |
| `scripts/android-voice-qualification/android-process-lab/probe/ProcessLab.java` | `9b5fbafac48b986726c743c7b5c194e25f406c9bc4fe14f440ba71c8d2b225c9` |
| `scripts/android-voice-qualification/android-process-lab/test-process-lab.py` | `d7cd8c8ae10850c32832ec2f5d3fd9ce6d5053f0d689a5119081a0a45a5ec84e` |
| `scripts/android-voice-qualification/tests/test-process-lab-receipt.py` | `36eedc5395866bbfaf5a5ac302880b59f131b107aabda62ce44a6157e0883f12` |

There is also an existing untracked `docs/recovery/` containing the previous full handoff. This new report is an additional untracked documentation artifact, deliberately uncommitted. Do not stage it with unfinished fixture changes.

The interrupted fixture-only change adds an authoritative `NotificationManager.isNotificationListenerAccessGranted` observation for its own public synthetic listener during pre-Application execution, immediately after the unchanged initial process survey. The host requires a strict boolean `listenerAccessGranted` and compares it with the intended mode. The previous immediate `Settings.Secure.enabled_notification_listeners` mirror comparison is removed. The independently witnessed `LISTENER_CONNECTED` event before controlled force-stop is still required. No real-client or real diagnostic guard is changed.

Prior to STOP, the session transcript recorded nine pure/mocked tests passing normally and with Python `-O`, including unknown permission values and contradictory observed permission rejection with cleanup. An offline Java fixture build and actual API35 method descriptor check passed for 17 target / 66 probe platform references. **These are prior local preparation results, not a completed CI qualification of the dirty patch.** Final review, final mutation/regression exercise, commit, push and exact-source runtime CI were not completed. A standalone retained final GREEN log was not identified in the inspected investigation directory; the RED log and build receipts are preserved. Do not infer full acceptance or silently finish this patch during handoff.

The current agent inventory shows `bootstrap_guard_review` interrupted, with earlier private-journal/readiness reviewers completed. No new agent was started. The goal service reports no active goal; a pause request returned “cannot update goal because this thread has no goal.” No goal was created. The user's STOP instruction controls independently of that service.

### 1.2 Product provenance remains unchanged

These Git tree identities were read from current HEAD and match the retained fully qualified product evidence:

| Production component | Git tree object |
| --- | --- |
| `apps/api/src` | `04bf17e81828fc3c41cdbf9c4eedb92a0585075b` |
| `apps/mobile` | `2181030b3976cb588016f8ed984f0a7eb3f1a4b6` |
| `apps/admin-web` | `0c1a8ea1e5f1dcce05a394173a846a2d0b54bf9d` |
| `packages` | `6dc5cb5af44d25c8b6b52d5487903a7194aed80e` |
| `supabase` | `4077662282bcf7a85206e40eea28e3abcd49e60f` |

The separately qualified glibc Dockerfile/container-test change is accounted for by runtime source `093b5d0c`. Later real diagnostic and disposable-process commits do not change those product trees. Broad product tests need not be repeated solely because a report or fixture host changed; new corrective changes must be independently assessed by Astra.

## 2. Complete component and functionality status

“Implemented/automated” refers to preserved source and historical exact-source tests. “Physical/live” means retained actual device or Staging evidence. Neither category substitutes for the other.

| Component | Completed and preserved implementation | Actual deployment/device boundary and unfinished acceptance |
| --- | --- | --- |
| Mobile/authentication | Standalone Staging profile, Hermes runtime, four ABIs, app lock, sign-in/session and language architecture; existing app/package/Firebase/Clerk identities retained | Redmi has older `91213b4` client. Latest e6def119 client not installed. Current-candidate authentication, app restart, sign-out/in and durable sessions remain open |
| Onboarding/accounts | Atomic/idempotent default Cash provisioning only after valid confirmed currency; zero opening balance/no invented transaction; restricted-column INSERT grants corrected; owner isolation, account availability and currency/status checks | All required migrations applied. Existing Test default resolution verified once; fresh normal-user Cash onboarding and independent second-user behavior not accepted |
| Manual Add | Durable operation journal, validation, categories/localized custom labels, owner/date/amount/idempotency checks and refresh | Prior approved 50 SAR expense produced exactly one transaction and −5000-minor posting. Its 10 October date correctly displays in Yesterday. Latest-client full expense/income/retry acceptance remains open |
| Voice recording/analysis | Original recorder, v3 upload/batch pipeline, extraction schema, authenticated active-owner admission, quotas/consent and recovery preserved; individual-owner analysis restriction removed under prior approval | A fresh Arabic coffee capture produced a valid 10 SAR expense and owned Test resolution. Earlier empty extraction remains unexplained: media/short-lived payloads expired, no separate transcript retained. No old audio may be replayed |
| Voice financial executor | Original authoritative atomic executor, event identity/duplicate reservations, account/category/currency/status/eligibility safeguards; no invented amounts | One approved bounded 10 SAR canary posted once. General normal-user operation remains OFF, compatible financial worker stopped; full device financial acceptance open |
| Multi-event Voice | Ordered independent occurrences, valid siblings, explicit owned compatible account/default/sole-account resolution or clarification; per-event outcome persistence, negotiated receipt contracts, interrupted-retry recovery | Disposable tests passed; no fresh approved physical multi-event or multi-account posting acceptance. Transfers remain rejected pending a destination-account contract; do not describe transfer support as completed |
| AI Assistant | Recovered reset/recovery/timeout behavior; configured-service admission in standalone releases; context/history/actions, honest unavailable responses, consent, quotas, deadline and bilingual contracts | Old installed release guard reproduced historically. ac7bc92 Assistant running does not establish fresh Arabic/English provider response, quota/reset/budget/session acceptance. Candidate client fix uninstalled |
| Home | Approved grouped white rounded income/expense cards and Today design preserved; complete cursor fetching and natural-height viewport windowing for populated groups; date/account scopes and custom labels repaired | Historical installed app showed coffee −10 and balance −60. Candidate immediate refresh, complete large groups/scrolling, tall Arabic text and visual review remain open. No redesign is required by evidence |
| Transactions/Reports | Ledger-derived balances, custom categories, refresh, repeated receipt reads and repeatable-read financial outcomes retained; Reports timeout fixes recovered | Historical Manual/coffee readbacks exist; current full client/API pairing and Arabic/English reporting acceptance not complete |
| Notifications | Existing owner preferences/center/routes and fresh opted-in Voice/Tracking confirmation pipeline; event-once claims and current-epoch links exclude historical replay | Migration107 applied; general worker stopped. No positive fresh OS notification delivery acceptance. Historical delivery-row count zero must not be treated as a fresh query |
| SMS/Notification Tracking | Newer parser, encrypted owner queues, WorkManager/headless/coordinator, permission/consent/capture agreement, duplicate/refund/undo/reversal, keyword governance and security retained | Natural current Redmi SMS/listener/background capture is unaccepted. Prior permissions evidence is historical, not a contemporaneous listener-state reading at the failed diagnostic. Automatic SMS/notification financial rollout remains separately disabled/governed |
| Workers | Sanitized root exceptions, failed-query connection discard, callback rollback recovery, explicit eligibility denial, fail-closed financial polling; scoped successful-poll health and bounded extraction diagnostics implemented | Analysis/Assistant running on old source with no Docker health result. Financial/general stopped. Real lifecycle, failure recovery, provider health and persistent operation not accepted |
| Operating monitor | Retained identity-pinned helpers, durable intent/exec journaling, concurrency locks, independent stop-first closure/watchdog, bounded OFF rehearsal adapter and systemd shutdown preparation | Qualified locally/disposable CI only. Actual Staging OFF monitor, financial epoch closure, watchdog/rollback and duplicate prevention rehearsal remain open |
| Backend API | Authenticated owner contracts, private capabilities/RLS/grants, negotiated onboarding/outcome compatibility, health/diagnostics and provider boundaries | Candidate7967007 API was temporarily qualified and rolled back; current live ac7bc92 is older. Latest093b5d0c runtime never deployed |
| Admin | Existing routes/auth/roles/settings/quotas/default and custom keyword governance preserved; 926 tests/build/browser qualification | No latest Admin deployment or full running-client acceptance is established. Eight high propagated dependency findings remain unwaived |
| Database | All109 migrations, including104 authenticated analysis,105 bounded canary,106 Cash,107 confirmation,108 account availability,109 event results; fresh and historical-main upgrade tests | Staging109 already applied; latest `20261011005920`. Do not reapply106–109 from obsolete phase text. Selected financial restore verified; full Supabase platform/storage-object restore not claimed |
| Savings/categories/settings | User-rejected Savings removal excluded; prior UI/designs, governed default/custom categories and settings retained | Current-candidate comprehensive regression/client review still required |
| Arabic/English/RTL/LTR | Existing language/layout/digit/date and durable-state architecture retained; mobile/browser automated coverage | Complete latest-device bilingual, font/layout, input and session feature matrix remains open |
| iOS | Existing shared architecture retained | No qualified Apple release/build/device acceptance. Android SMS/listener behavior is not evidence of iOS support; contract scope needs explicit determination |

Primary product reports: [local readiness](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/local-readiness-report.md>), [feature matrix](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/feature-acceptance-matrix.md>), [worker health/diagnostics](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/worker-health-and-diagnostics.md>), [operating monitor](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/operating-monitor.md>).

Earlier detailed recovery evidence, all preserved under `E:/Masarifi-redmi-acceptance-2026-10-10/regression/`: `Functional-Recovery-Matrix-2026-10-11.md`, `overnight-default-cash.md`, `overnight-multi-event-voice.md`, `overnight-home-recovery.md`, `overnight-persistent-operating-adapter.md`, `tracking-preservation-regression-audit.md`, `voice-runtime-original-current-parity.json` and `overnight-7967007-consolidation-evidence.json`. Their old candidate/version/security/pending states are historical and superseded where this report identifies later receipts.

### 2.1 Original work accounting and limits

The original dirty Voice tree was archived, not overwritten. Retained audit classified630 dirty/untracked entries:169 already included,10 superseded,35 integrate,1 needs decision,415 preserved evidence. The ignored-source inventory classified11,410 instances:10,238 already included,1,006 superseded,13 integrate,153 needs decision. Forty-seven unique recovered paths were preserved; historical7967007 verification found38 normalized matches and9 reviewed evolved/tested files. The historical bidirectional runtime comparison covered85 paths:80 normalized identical,zero absent,five reviewed differences.

The single dirty-source undecided item is the old automatic-v3 Metro development runner; the current standalone profile already supports its transport and it is not the server financial blocker. The153 ignored undecided entries are operational/diagnostic experiments, not automatically supported tools. Preserve them; do not blindly run/import them. This accounting does not prove exhaustive physical reproduction of every original feature.

### 2.2 Known integration/configuration causes already distinguished

Historical analysis-only operation was explained by analysis-only API/Analysis configuration, global financial policy OFF and a stopped financial worker; it was not proof that the accounting executor or Home cards had disappeared. Prior approved work corrected the single-owner session proxy route and missing API provider-admission flag. The narrow canary worker required `MASARIFI_AI_ASSISTANT_ONLY`, not the mistaken `MASARIFI_ASSISTANT_ONLY`. Failed containers/scopes remain evidence. Manual's missing-category validation and prior-day Today exclusion were distinct expected behavior. These findings do not justify rewriting accounting or redesigning Home.

The candidate now records bounded `VOICE_EXTRACTION_DECIDED` event/eligible/skipped counts and server-enumerated reason counts before persistence, and `VOICE_BATCH_ACCEPTED` only after acceptance. No amounts, commands, owner/session/account/claim IDs, transcripts, audio paths or provider contents are logged. These future diagnostics cannot reconstruct the expired older recording and do not mean financial posting occurred.

## 3. APK, runtime and diagnostic artifact inventory

Hashes are retained artifact identities unless explicitly stated as rehashed during document verification. No APK was built, signed, installed or launched for this handoff. The real client/probe signing certificate is **`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`**.

| Artifact | Absolute path / immutable identity | SHA-256 | Installation/usage status |
| --- | --- | --- | --- |
| Latest full Staging client e6def119 | [Masarifi.Ratibi-staging-e6def119-universal.apk](<E:/Masarifi-local-readiness-2026-10-11/client-e6def119/Masarifi.Ratibi-staging-e6def119-universal.apk>) | `be33158e282efa4d8ae6b5f1ad9541e1a90ac9a3a42d0d830bbbf7d601346c9f` | **Uninstalled/unlaunched**,131,853,839bytes |
| Archived installed Redmi/rollback client91213b4 | [overnight-installed-redmi-20261011T054132Z.apk](<E:/Masarifi-redmi-acceptance-2026-10-10/regression/overnight-installed-redmi-20261011T054132Z.apk>) | `0c0dd12035bd22eeb6f45b1597731462b967533cb394a23d3f9430a0d7a78685` | Installed hash matched on last approved device observation; original client preserved/stopped |
| Earlier full candidate7967007 | [Masarifi.Ratibi-staging-7967007-universal.apk](<E:/Masarifi-redmi-acceptance-2026-10-10/client-7967007/Masarifi.Ratibi-staging-7967007-universal.apk>) | `3e1ffabf69baf5ea50a1be90cc3d3b0a08cddcc0f1d0db35325570bf65c6c8de` | Historical uninstalled candidate; not latest |
| First separate probe238968b8 | [private-journal-diagnostic.apk](<E:/Masarifi-local-readiness-2026-10-11/private-journal/probe-signed-238968b8-review-only/private-journal-diagnostic.apk>) | `938da77e4750ca24165e218fe025848f30f6a5edb09418887341f4863021fe05` |3,400,241bytes; installed/attempted historically, replaced |
| Second separate probe aadff3ae | [private-journal-diagnostic.apk](<E:/Masarifi-staging-acceptance-2026-10-11/probe-signed-aadff3ae-review-only/private-journal-diagnostic.apk>) | `ab9358069e3d97b219069121a817e942f042e2e55f1b78b8c39de6bdef03d66e` |3,400,241bytes; installed/attempted historically, replaced |
| Process-survey probe e3bbeca9 | [private-journal-diagnostic.apk](<E:/Masarifi-staging-acceptance-2026-10-11/probe-signed-e3bbeca9-review-only/private-journal-diagnostic.apk>) | `b94639a95c977981a50991c3f6defb770dbfcc0e9fb43d15119bdfabcde7eb48` | Latest actually installed separate diagnostic; one consumed attempt; stopped |
| Peer-role probe2b61ab91 | [private-journal-diagnostic.apk](<E:/Masarifi-staging-acceptance-2026-10-11/probe-signed-2b61ab91-review-only/private-journal-diagnostic.apk>) | `91bd13a53333a66adc857fb4aa99e2b6d1b839ac76459332b6052f1abfbd2ea1` |3,404,337bytes; **not approved/installed/executed** |
| Qualified backend runtime093b5d0c | `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:8ee5100f2f9de7b5930867eb7cf901c94344452ba8a3ed62954223bbc8fb2bab` | Digest shown in identity; image config `d8fe374aed4f726da7f17d3e38222dd650be39ad0315bf0fbb608931867c6b7e` | Published immutable CI artifact; **undeployed** |

The full client package remains `com.masarifi.mobile`, display name `Masarifi.Ratibi`, slug `masarifiratibi`, EAS project `c8cc3dd3-a7e9-4737-ac4d-32f076107600`, versionCode1/minSDK24/targetSDK36/nondebuggable, existing four ABIs. Older installed metadata is versionName0.0.1/targetSDK35; shared version labels do not distinguish builds, exact APK/bundle hashes do. Client ZIP/signature/alignment and all92 native-library inspections passed; all46 64-bit libraries have at least16KB PT_LOAD alignment. Physical16KB-device behavior is not accepted. Staging endpoint/Clerk/Firebase and no Production/privileged-key pattern checks passed. Metro is unnecessary. In-place update must preserve package, cert, UID, persistent data and sessions.

Separate real diagnostic package: `com.masarifi.voicequalification.diagnostic`, instrumentation targeting `com.masarifi.mobile:voicequalify`, arm64 native reader, plain Application and no normal app components/permissions. It is a safety diagnostic, not a client update. Its signing provenance binds source/host/NDK/native/API35 descriptor inputs. No offline signature grants phone permission.

### 3.1 Disposable artifacts are a different trust domain

The process lab uses public synthetic packages `com.masarifi.voicequalification.processfixture` and `com.masarifi.voicequalification.processlab`. It has no client journal, existing-key, native-reader or network capability. APKs use a public disposable certificate; they must never be presented as Masarifi-compatible or installed on Redmi.

Latest interrupted offline build: `D:/Masarifi-disposable-process-lab-2026-10-11/authoritative-listener-build/`:

- `target/fixture.apk`: SHA `08a3a7c6b03b2b302b27924a4af1c20fa07d8e59f905c886297095da9cb89a2b`.
- `probe/fixture.apk`: SHA `a240e5b92311e9f92a564e6f8aa7c66de82089666e68428944af2b77a8f92f3c`.
- Both build-receipt signatures identify disposable cert `9d96a3703b03aed5834b1e3607c15adfd228ac1e0cb0ff3d471ec8e0558c8908`, CN=Disposable Synthetic Bootstrap Fixture.
- `build-receipt.json` and `api35-method-verification.json`:17 target refs /66 probe refs; target DEX `10a7d69bad518031ac6e71273de99042c8bcab3d2fc27a440c3a9c97e3ccbdb7`, probe DEX `b0ddc95111084920a9bc0b844b78df695f04ebb36fbd8b318a442dad6c4fc2d5`.

All preceding build directories remain: `offline-build`, `reviewed-offline-build`, `final-offline-build`, `closed-stage-offline-build`, `closed-stage-reviewed-build`, `active-binder-cleanup-build`, and `final-stage-classes` under the same D root. Existing disposable CI build receipts/APKs are also in each preserved `ci-<source>-run<id>/process-lab-build/` evidence tree. They were used only on disposable Android CI, not Redmi. Preserve their per-build hashes/certificates; do not assume the latest local certificate equals every separately generated CI certificate.

## 4. Completed automated qualification and exact remaining failures

All listed executions happened before this documentation task. Fresh handoff reads only obtained conclusions for existing runs. Workflow files live in `D:/Masarifi-integration-2026-10-10/.github/workflows/`, especially `voice-private-journal-qualification.yml`, `voice-bootstrap-rehearsal.yml`, `voice-posting-boundary.yml`, `voice-operating-preparation.yml`, and `backend-runtime-qualification.yml`.

### 4.1 Product/runtime/operational qualification

| Workflow/source | Actual result and scope |
| --- | --- |
| [Backend Foundation38137175993](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38137175993),e6def119 | **SUCCESS**. Mobile481 suites/2979tests; Admin87files/926tests; API160unit suites/1403tests,79contract/237tests,OpenAPI1suite/4tests; type/lint/build/quality/native profile gates |
| Same Foundation DB lanes | Fresh122suites/610tests and canonical-main upgrade122suites/610tests, zero failures/skips in those lanes; E2E81/security151/sync47; preserved ledger/Savings baselines |
| Same Foundation browser/performance | All five viewports passed;355 executed layout passes and310 planned project exclusions across jobs.301,602 outbox and300,000 stress checks100% successful; not live capacity proof |
| [Staging Client38137178320](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38137178320) | **SUCCESS**, six normal-user client regression cases |
| [Backend runtime38142445486](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38142445486),093b5d0c | **SUCCESS**,11container suites/26tests, actual image commands/Node/runtime checksums/nonroot identity/type/lint/rendered Compose/full-severity scan; immutable qualified8ee5100f image |
| [Operating preparation38138946678](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38138946678),aea34326 | **SUCCESS**,216Python executions/41Node cases; bounded retained helpers, shutdown/controller/watchdog; independent OFF adapter16normal/16optimized cases |
| [Bootstrap38143858579](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38143858579),238968b8 | **SUCCESS**, five stable framework observations, exact-six positive control, three private/plain-Application zero-effect/no-new-network runs |
| [Private38143858679](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38143858679),238968b8 | **SUCCESS**,all3jobs; portable/native/JNI/encrypted WAL/whole-store and42encrypted Android cases ×3, unchanged fingerprint, missing-existing-alias rejection |
| [Posting38143858693](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38143858693),238968b8 | **SUCCESS**,53disposable DB financial cases |

Database-less suites' integration exclusions and browser project exclusions are not accepted physical tests. Tag-only signed-release lane deliberately does not run on this branch. Earlier broad local memory/timeout interruptions are retained as incomplete, not retrospectively green. Passing HIGH/CRITICAL-only container policy historically did not imply zero findings.

### 4.2 Real diagnostic source qualifications

| Source | Private journal | Bootstrap | Posting boundary |
| --- | --- | --- | --- |
| aadff3ae | [38148350516 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38148350516) | [38148350454 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38148350454) | [38148350446 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38148350446),53pass |
| e3bbeca9 | [38150583824 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38150583824) | [38150583816 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38150583816) | [38150583829 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38150583829) |
|2b61ab91 | [38154302047 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38154302047),all3jobs | [38154327818 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38154327818) | [38154301950 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38154301950),53pass0failed/pending |

At2b61ab91 retained Linux results include31 snapshot,89 sanitized-failure,19 isolation,215 schema and98 whole-store checks; all portable suites passed. Actual synthetic encrypted Android42cases ×3 have identical unchanged fixture fingerprint **`5731ee88711ea4b128591592a4f2dbf62bac5aec6345ea4ca99a5c45a8d382f5`**. Native reader coverage includes55 safety cases and603 real SQLite/pinned-SQLCipher schema cases. Signing-source audit binds15diagnostic+18rehearsal files; actual API35 emitted-method checks passed, including Java Buffer compatibility.

Peer inventory host25pure/mocked cases passed normally/optimized. Peer-role host52cases passed normally/optimized after strict attribution fixes; zero-test filename discovery was rejected and explicit loading verified the count. These do not authorize the peer-role probe or prove the physical key/journal safe.

### 4.3 Disposable process experiment — all aggregate failures preserved

| Source/run | Actual bootstrap/process result | Companion existing workflow conclusions |
| --- | --- | --- |
|96c1dda1,[38158185015](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158185015) | **FAILURE**. Existing three bootstrap controls passed. First new disabled-listener lab emitted INDETERMINATE/code0;zero valid process-lab rows; failure stage unavailable | [Private38158184992 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158184992);[Posting38158185051 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158185051) |
|16d19ac9,[38158798496](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158798496) | **FAILURE**,closed `normal_CLEANUP / PEER_CLEANUP_UNPROVEN`;zero valid lab rows | [Private38158798465 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158798465), refreshed read-only during handoff;[Posting38158798561 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38158798561) |
|33003583,[38159287213](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159287213) | **FAILURE**,three valid listener-disabled samples,then listener connection setup timeout;zero enabled samples | [Private38159287228 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159287228);[Posting38159287264 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159287264) |
|Current0be314d9,[38159752563](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159752563) | **FAILURE**,three valid disabled samples;immediate Settings mirror mode comparison fails after quoted allow before enabled connection/control;zero enabled samples | [Private38159752556 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159752556),all3jobs completed17:33:21UTC;[Posting38159752576 SUCCESS](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/38159752576),completed17:31:22UTC;both refreshed read-only during handoff |

**Current HEAD is not green across all required experiment lanes. Dirty permission-query work has no exact-source CI run.** Three partial valid samples do not convert either330/0be aggregate into a pass and no listener-enabled force-stop conclusion is justified.

Each complete downloaded public process-lab artifact/log tree is at `E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/ci-<source>-run<bootstrap-id>/`; inspect `process-lab-runtime/runtime.log`, `runtime-receipt.json`, `process-lab-build/build-receipt.json`, and surrounding bootstrap logs. The older very large Private Journal CI archive was accessed through three selected receipt/log entries using range reads; its full archive hash was not verified. Do not claim a complete downloaded/private-archive integrity check from those selected entries. Signed artifact URLs/tokens were not retained in this handoff.

## 5. Redmi private-journal problem — highest priority technical handoff

### 5.1 Why the diagnostic is mandatory

The installed client normally resumes nonterminal local Voice work during startup. Historical server pending counts alone cannot establish that its encrypted private journal, committed WAL, owner-scoped/legacy markers, RKStorage/secure-key mappings, audio and confirmation queues contain no replayable work. A full in-place client update followed by ordinary startup/background processing can therefore expose old captures to financial operation. The journal safety gate must be cleared before that update/launch; neither empty server queues, synthetic schema tests nor a failed bootstrap clear it.

The prepared separate diagnostic intentionally avoids target `MainApplication`/React/startup providers, normal SQLite recovery, key creation/seeding, writable disk readers and historical network activity. It binds exact installed APK/cert/package/UID/user/private-process/root identity, obtains existing keys only, reads unchanged bounded snapshots into RAM, reconstructs committed WAL, qualifies complete known schemas/owners/key ambiguity/legacy markers/rollback conditions, and compares before/after fingerprints. It returns only bounded sanitized classification, never private payloads. Unknown state fails closed. Its Android bootstrap and process guard are preconditions for this reader, not the reader itself.

Approved physical target identity: **Redmi serial `f66a40694eca`, model `23076RN8DY`, API35, user0, target app UID10304** in retained preflights. The same-package rollback client and certificate are in section3. This is historical identity evidence; no new phone query was made for handoff. Do not operate Samsung or another device.

### 5.2 All physical diagnostic attempts, scopes and receipts

All paths in this subsection are beneath **`E:/Masarifi-staging-acceptance-2026-10-11/`** unless an absolute alternative is shown. Each named file is a direct preserved receipt/scope, not a proposed execution command. **Scope hashes use the executors' canonical JSON-body contract**, not the pretty-printed file hash: remove `scopeSha256`, serialize with `sort_keys=True,separators=(',', ':'),ensure_ascii=False`, UTF8-encode and SHA-256. All five canonical bodies were independently rechecked for this handoff and matched their recorded scope values. Old one-attempt approvals are consumed. Do not mistake a pretty-printed file SHA difference for a changed authorized operation.

**First diagnostic scope**: `redmi-diagnostic-exact-scope.json`, SHA-256 **`e2fbe87966e2f332953495d224d6ef72ea223ad276aefa5029644ad267aa106c`**, probe **938da77e…** from238968b8. User approved only rechecking identity, force-stopping the original client, separate probe installation and one dedicated-process RAM-only existing-key/journal diagnostic, followed by stopping it. Persistent client data/sessions/financial records must be preserved; force-stop can discard unpersisted input. No full client update, replay, financial effect, deployment or security-setting change included.

| Sequence/time in Riyadh | Exact retained result / stage | Attribution and preservation limit |
| --- | --- | --- |
|17:11:10 initial preflight | `redmi-diagnostic-result.json`:DEVICE_COMMAND_FAILED,zero instrumentation | Expected absent separate package made `pm path` return exit1/empty; host treated absence as fatal. `redmi-diagnostic-preflight-continuation.json` at14:11:46UTC documents host correction. No journal read |
|17:11:46 quiescence | `redmi-diagnostic-approved-execution-result.json`:freshIdentityMatched=true,PROCESS_IDENTITY_INDETERMINATE,zero instrumentation;cleanupVerificationFailed=true | Process NAME with spaces exceeded the parser's assumed column shape. `redmi-diagnostic-quiescence-continuation.json`14:12:35UTC documents UID,PID,remaining-NAME parsing and no running original target. This host defect is not a key/database failure |
|17:12:35 install | `redmi-diagnostic-final-result.json`:DEVICE_COMMAND_FAILED,zero instrumentation,originalClientUnchangedAndStopped=true | Exact Android installer rejection text was not retained. User reported a potentially-unwanted-apps security confirmation and selected Allow/Yes; cause cannot be inferred as certificate rejection |
|17:16:34–46 approved retry | `redmi-diagnostic-install-retry-result.json`:installation succeeded,one instrumentation,DIAGNOSTIC_RECEIPT_SCHEMA_INVALID,original unchanged/stopped | Separate direct human instruction explicitly authorized retry after phone Allow. `redmi-diagnostic-install-retry-human-approval.json`, `redmi-diagnostic-human-install-retry-intent.json` and `redmi-diagnostic-approved-retry-installer-response.json` retain scope/install evidence;14:16:43UTC installer exit0 and Push/Install success |
|17:17:51 failure metadata read | `redmi-diagnostic-failure-metadata.json`:probe/identity-failure marker,ClassNotFoundException/NullPointerException/RuntimeException types,`PrivateJournalDiagnostic.newApplication(...:39)` | Host receipt parser had rejected framework `shortMsg` failure fields. Sanitized stack establishes bootstrap failure but does not identify exact identity/process branch. Raw historical log/peer identity not retained. No diagnostic rerun |

The first failed bootstrap cannot be retrospectively assigned to one exact cause. A separate real implementation defect rejected a valid empty split-name array for an API35 base-only probe; corrected later. It is a plausible explanation for that invocation, **not proven historical causality**. The masked framework failure is also not a journal verdict. Approval and attempt latches for the first/retry scope remain consumed; do not exploit the earlier zero-attempt host exits as permission to rerun now.

**Second replacement scope**: `redmi-diagnostic-replacement-aadff3ae-exact-scope.json`, SHA-256 **`0a8a914f431cc1872a2187af895cf6ad62720c4fe0a38876c943bd8355fc024d`**, exact source **`aadff3ae785aa08f81dbf9834d34888bb7ef8f07`**, APK **ab935806…**. User approved one changed-probe attempt preserving original client/data/sessions and settings. Human approval, consumed scope, mutation intent, installer response and instrumentation intent are retained under the same `redmi-diagnostic-replacement-aadff3ae-*` prefix.

- At **18:00:29.049–18:00:35.333 Riyadh /15:00:29–35UTC**, `redmi-diagnostic-replacement-aadff3ae-result.json` records successful separate installation, exactly one instrumentation, FRAMEWORK_BOOTSTRAP_FAILED and originalClientUnchangedAndStopped=true.
- At **18:01:38 Riyadh /15:01:38UTC**, `redmi-diagnostic-replacement-aadff3ae-failure-metadata.json` records bounded/correlated dedicated crash,20 recognized window records, rawLogRetained=false and **PROCESS_SURVEY** only. Instrumentation was not rerun.
- Identity checks had returned before this stage. Retained metadata cannot distinguish service unavailable, API exception, null list/record, missing self, duplicate self, name mismatch or same-UID peer. Application substitution and key/native/journal stages were not reached. Approval consumed; journal remains INDETERMINATE.

**Third process-survey scope**: `process-survey-next-packet/redmi-diagnostic-process-survey-e3bbeca9-exact-scope.json`, SHA-256 **`62673075e7f8e5e070c9164dfb34cc9c74c7c844cd4a6b0217ff8a3841f0d678`**, source **`e3bbeca9ef289f6cc3dc13f074b61eb6a45fb931`**, APK **b94639a9…**. User approved exact identity/clock checks, stopping both named packages, replacing only separate probe, one guarded RAM-only read attempt, sanitized clock-correlated failure metadata and leaving both stopped. No phone settings, full client, replay, deployment or financial action.

- **18:35:15.144593–18:35:20.419729 Riyadh /15:35UTC**: `process-survey-next-packet/redmi-diagnostic-process-survey-e3bbeca9-result.json` records installation=true, exactly one instrumentation, FRAMEWORK_BOOTSTRAP_FAILED, verdictINDETERMINATE.
- Correlated metadata: **PROCESS_SAME_UID_PEER**, dedicatedCrashProcessObserved=true, recognizedWindowRecords=20, deviceClockAligned=true, rawLogRetained=false. Original client unchanged/stopped verification passed; both packages stopped.
- This establishes the **immediate process-guard rejection**: a returned ActivityManager record has reported UID equal to `Process.myUid()` and a PID different from `Process.myPid()`. It does **not** establish that peer's actual kernel UID, liveness, package/component or role.
- The APK/certificate/canonical root/UID/package/private component identity guard had already completed. The wrapper rejected before returning plain Application. Existing-key lookup, JNI library loading, snapshot capture and encrypted journal qualification were never reached. Therefore signing-identity rejection, failed key access and encrypted-database access are not the cause of this particular rejection.
- The intent/latch/human-approval/installer files share that directory and prefix. Approval consumed; no rerun permitted. This is the latest real diagnostic instrumentation result.

**Fourth read-only peer inventory scope**: `peer-inventory-readonly/redmi-peer-inventory-exact-scope.json`, SHA-256 **`5fd28163d4eef92197111d1d472f95c210d44d33c5af5bd39f8dea5245b5b1cb`**. User separately approved one observation-only identity/APK check, package-UID ownership and bounded kernel/framework metadata, followed by APK hash recheck. Raw names/UIDs/PIDs/dumps only in RAM. No force-stop/install/instrumentation/client launch/key/journal/replay/settings/deployment/financial operations.

- **19:01:28.104702–19:01:30.055258 Riyadh /16:01UTC**: `peer-inventory-readonly/redmi-peer-inventory-result.json` records sameUidPackageCount=1,otherSameUidPackages=0,kernelTargetUidProcesses=0,frameworkRelatedEntries=0,frameworkIsolatedDescriptors=0,frameworkZeroPidEntries=0,stableLiveSameUidEntries=0,stableLiveDifferentUidEntries=0,unconfirmedFrameworkEntries=0.
- Global kernel snapshots differed (`kernelStable=false`). Both APK identities unchanged; observationRuns=1,instrumentationAttempts=0,deviceMutations=false,rawOutputRetained=false. Journal verdict stillINDETERMINATE.
- This is a **later state observation**, after diagnostic cleanup. Zero current target processes cannot identify or prove staleness of the earlier rejected record. It is not a contemporaneous failure census or clearance. Scope consumed.

**Fifth proposed peer-role replacement: NOT APPROVED, NOT EXECUTED.** `peer-role-next-packet/redmi-diagnostic-peer-role-2b61ab91-exact-scope.json`, SHA-256 **`754b71a334f2520ec16f1d57ecdc40bee4e00e9c68abab5ac54cc12e6f24bcf5`**, source **`2b61ab91693b8c2985677cd1523a76272f4c8f71`**, APK **91bd13a5…**. The user's response to `call_5de3d6f63f6943bf9eaa889b726a8430` requested root-cause explanation and offline/disposable investigation, explicitly prohibited another Redmi operation without approval, and did **not** approve this scope.

The changed probe adds a closed role for the first rejected framework record:TARGET_MAIN,PRIVATE_PROCESS_NAME,TARGET_AUXILIARY,OTHER,UNKNOWN_NAME orINVALID_PID. It preserves rejection rules and check locations. This is evidence enrichment, not a proven remedy. The scope pins nine host tools and source/CI/APK provenance; no approved human receipt, execution latch or physical result exists for it. The earlier pre-attribution draft is retained as `redmi-diagnostic-peer-role-2b61ab91-pre-attribution-review-scope.json`. The authorization status file [redmi-operation-authorization-status.json](<E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/redmi-operation-authorization-status.json>) preserves NOT_APPROVED and zero additional operations.

### 5.3 Precise code path and UID/PID semantics

Real wrapper [PrivateJournalDiagnostic.java](<D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/android-probe/PrivateJournalDiagnostic.java:30>):

1. `newApplication` receives target context, verifies immutable identity and canonical root, then calls the process survey before permitting target class-name substitution.
2. Only the expected target class is replaced with plain `android.app.Application`; normal client startup is suppressed. Failure throws sanitized closed metadata and never returns the substitute.
3. `onStart`, only if reached, validates observed UID/approved hash, main-thread barrier, identity and process survey, stamps the existing root, loads native reader, captures/qualifies the whole store with `ExistingDatabaseKey.androidExistingOnly()`, verifies unchanged root/snapshot and repeats identity/process checks.

Shared adapter [AndroidProcessSurvey.java](<D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/android-probe/AndroidProcessSurvey.java>) obtains ActivityManager and `getRunningAppProcesses`, maps returned `(uid,pid,processName)` values to the pure policy, and rejects missing/unavailable/malformed observations. The [PrivateProbeProcessPolicy.java](<D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/src/com/masarifi/voicequalification/PrivateProbeProcessPolicy.java>) requires exactly one own record with expected private name. Any returned same-UID different-PID record rejects before self-count completion; missing/duplicate own or name mismatch rejects. Peer-role classification labels framework metadata only and does not assert kernel liveness.

There is **no retained raw historical peer PID/name/role** to publish. UID10304 is retained approved target identity. “Another PID” is a verified relation from source+closed stage, not an available numeric PID. PID/clock correlation was used in RAM for the20-record crash window, then sanitized. Do not fabricate numeric peer identities or equate ActivityManager's reported UID with kernel credentials.

### 5.4 Established host/fixture/bootstrap defects and their disposition

| Defect or failed preparation | Evidence and correction already completed | Remaining qualification boundary |
| --- | --- | --- |
|Absent package treated as fatal | Expected `pm path` exit1/empty handled as missing separate probe; preflight continuation receipt | Not an Android key issue |
|Process NAME parser assumed fixed whitespace columns | UID/PID plus remaining NAME; malformed UID/PID fail closed | Prior quiescence indeterminate preserved; no historical peer reconstructed |
|Framework failure receipt fields rejected | `shortMsg`/framework failure handling distinguishes bootstrap failure from successful journal schema;14host parser cases normal/-O | Initial masked failure's exact branch unknown |
|API35 base-only empty `splitNames` rejected | `PrivateProbePolicy.requireNoSplits` accepts null or empty; nonempty split apps still reject; primary-source metadata and identity tests retained | Initial physical responsibility unproven; subsequent latest failure is process survey |
|Signing provenance omitted changed wrapper | Wrapper/source bindings added; complete source/host/native/NDK/API35 descriptor gates precede signing | No demonstrated cert mismatch in successful latest install/identity checks; real key still untested |
|Local offline signer archived-target input path corrected | `ci-aadff3ae/sign-reviewed-offline.py` points to root `installed-target-readonly.apk`; retained `sign-reviewed-offline-correct-target-path.py` points to actual `redmi-identity-20261011T140129Z/installed-target-readonly.apk` before qualified signing |This is a local input-path correction;does not establish certificate failure or any Redmi effect. The currently retained offline-signing log does not separately expose the original path-error text |
|Java17 covariant Buffer descriptors unavailable on Android | Compatible descriptor correction and actual API35 emitted-DEX-method checker pinning | Compile-only is insufficient; later disposable runtime qualification passed |
|Fixture `Files.readString(Path)` unavailable | Fixture-only compatible bounded strict UTF8 reader, parser/provenance regressions | Production reader not replaced |
|Incremental/asset configuration disturbed positive startup control | Fully materialized fixture installation; user0 boot/unlock barriers; five stable configuration/overlay observations with total120s deadline before one positive launch | Bounded fixture precondition, not immunity to all Android configuration changes; earlier failures retained |
|Clean CI dependency/download setup | Frozen API `pg` / shared mobile contract dependencies installed without lifecycle scripts; pinned OpenSSL Maven transient failure verified before one retry | Failed runs retained, no weakened assertion |
|Survey code/fixture coverage mismatch | Real/synthetic adapters share policy; before/after-Application receipts required; twelve incomplete-observation rejection cases; e3bbeca9 qualification | Refactor/coverage does not prove historical Redmi cause |
|Failure attribution accepted ambiguous evidence | Peer-role host rejects unknown/malformed/conflicting/unclocked markers; direct markers RAM-only, recognized consistent crash tuple required;52pure cases normal/-O | Generic framework failure may defer to fully correlated crash; unapproved current packet only |
|Process lab discarded exception stage |16d19ac9 adds closed stage/kind, retains first failure and independently attempts cleanup | First96 run still lacks exact failure branch |
|Process lab passive Binder liveness proof |33003583 active ping after framework PID absence; requires ping=false and cached alive=false, retains pre-ping cache boolean | Concrete synthetic fixture defect, not Redmi process-guard root cause |
|Synthetic listener `$Listener` shell expansion |0be314d9 central `shlex.quote` at remote shell boundary for allow/disallow/setup/finally; actual local shell controls reproduced old expansion and preserved quoted literal | Old timeout's sole cause not proven; corrected runtime fails next permission-mirror gate, no enabled samples |
|Immediate Settings mirror assumed authoritative | Source shows NMS approved set differs from legacy reflected Settings timing; interrupted API-observation patch described1.1 | **Uncommitted/unqualified in CI**, not a completed fix or proof of future listener behavior |
|Local restore ACL claim on exFAT | E: cannot enforce NTFS ACL confidentiality; explicit correction note; user-approved stopped relocation to D:NTFS with all hashes/ACLs verified | Financial hash result preserved; initial confidentiality statement superseded, not silently accepted |

No key seeding, journal mutation, process-guard weakening, unsafe startup delay/retry or logging of private exception contents was used as a fix. Independent bounded reviews are preserved at `E:/Masarifi-staging-acceptance-2026-10-11/review/`: `bootstrap-guard-readonly-review.md`, `android15-package-metadata-primary-evidence.json`, `replacement-diagnostic-host-scope-review.md`, `process-survey-shared-guard-review.md`, `process-survey-host-packet-review.md`, `peer-inventory-readonly-review.md`, `peer-role-source-review.md`, `peer-role-host-parser-review.md`, `peer-role-final-packet-review.md`, `process-lab-source-review.md`, `process-lab-first-runtime-failure-investigation.md`, `process-lab-binder-cleanup-review.md`, `process-lab-listener-shell-review.md`. A clean bounded review grants only its stated scope, not physical acceptance. The latest dirty change has no final completed review claim.

### 5.5 Android lifecycle, Binder and Notification Listener investigation

Tagged upstream AOSP15 sources were inspected and saved locally before STOP. They describe upstream behavior, not independently verified Redmi OEM behavior. Files under `E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/` include `ActivityManagerService.java`, `ProcessList.java`, `ProcessRecord.java`, `ManagedServices.java`, `NotificationManagerService.java`, `LoadedApk.java`, `IBinder.java`, `BpBinder.cpp`, `adb-commandline.cpp` and `archived-target-manifest.txt`. The causal index pins source/receipt hashes; selected identities are in section5.8.

**Lifecycle/publication:** upstream ActivityThread performs synchronous `attach` before main Looper dispatch. AMS queues `bindApplication`, publishes the thread and updates LRU before the attach call returns; `newApplication` then runs when dispatched. This contradicts a routine cold-start “self not published yet” explanation. It does not prove immunity to every OEM/process race. Sleeping, retrying until PASS or moving the safety guard after startup has no supporting evidence.

**Instrumentation/force-stop:** upstream `startInstrumentation` selects the explicitly declared target process, force-stops the target and starts that selected process. It does not implicitly start the main application as a second peer merely because instrumentation is used. `--no-restart` looks up an existing main application process and is not an equivalent safe dedicated-private-bootstrap replacement. Actual Redmi force-stop/start behavior around failure remains unobserved in contemporaneous kernel metadata.

**Framework UID versus kernel UID:** upstream ProcessList filters ordinary caller visibility by actual ProcessRecord UID, while filling returned `RunningAppProcessInfo.uid` from ApplicationInfo UID. It also requires a live framework thread and excludes crashing/ANR entries; it is nullable/nonexhaustive, not a full kernel census. An isolated process can have different actual credentials while metadata has the parent logical UID if exposed by privileged/OEM visibility. Stock disposable results show that isolated child hidden from this ordinary caller; they do not prove the OEM's result. The archived installed target declares no isolated service/sharedUserId/GET_TASKS in the inspected manifest. Another package sharing the UID was absent at later inventory, not measured at the historical failure.

**Notification Listener:** archived target has `com.masarifi.smsinbox.MasarifiNotificationListenerService`, exported=false with `BIND_NOTIFICATION_LISTENER_SERVICE`, in default main process. Declaration is not consent, binding, connection or a start event. No contemporaneous retained Redmi NLS permission/connection witness identifies it at18:35. Upstream ManagedServices rebinding is asynchronous and includes a10,000ms binding-death rebind path, making main-process startup a testable hypothesis. It is not a confirmed root cause.

**Package visibility/context:** preserved upstream bootstrap review found instrumentation contexts initialized before `newApplication` and mutual target/instrumentation package visibility explicitly established. Missing manifest queries/uninitialized instrumentation context are therefore not demonstrated upstream causes. This does not establish every OEM path, nor resolve the first stage-less historical exception.

**Pre-Application service binding:** upstream ActiveServices readiness is per service-host process, not a blanket package-wide instrumentation prohibition. The synthetic direct callback executor (`Runnable::run`) delivers on Binder thread, avoiding the blocked-parent-main-looper callback deadlock hypothesis. Actual330/0be disabled-listener samples successfully bound normal and isolated children in pre-Application callback, so a universal “no services can bind until Application completes” hypothesis is contradicted in that fixture.

**Binder:** `isBinderAlive` reads cached state. LoadedApk unbind removes the framework death recipient; unlinking the last recipient can clear notification monitoring. Passive cached alive can remain true after peer process exit until a dead-object transaction changes it. This is a concrete fixture cleanup defect. With active ping added, all six child endpoints per three successful disabled runs had cached alive=true immediately before successful failed-ping/dead-cache proof, while framework PID was absent. This proves a stale-to-dead cache transition for synthetic endpoints; it does not prove a stale ActivityManager record or explain Redmi.

**ADB quoting:** official ADB client joins remote shell argv without escaping; daemon shell executes the command via `-c`. A host subprocess argv list does not protect literal `$Listener`. Prior local Bash controls with Listener unset and set to a harmless sentinel reproduced wrong expansion; quoting preserves it. Remote expansion values were not retained from the failed CI timeout, so code defect is established but exclusive timeout causality is not.

**Listener permission source:** upstream NMS `setPackageOrComponentEnabled` updates the internal approved set/rebind path; legacy Settings reflection is performed through later XML policy writing with `shouldReflectToSettings`. Therefore an immediate `Settings.Secure.enabled_notification_listeners` read is not the authoritative synchronous approval result and can race reflection. It is **incorrect to claim Settings is simply never reflected or obsolete**. `NotificationManager.isNotificationListenerAccessGranted` queries the own-component/user approved set. The interrupted fixture change records that result and retains actual connection witness separately; its runtime result does not yet exist.

Primary source URLs retained for independent source checking:

- [AOSP15 AMS instrumentation](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/services/core/java/com/android/server/am/ActivityManagerService.java).
- [AOSP15 ProcessList](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/services/core/java/com/android/server/am/ProcessList.java).
- [ManagedServices](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/services/core/java/com/android/server/notification/ManagedServices.java) and [NMS](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/services/core/java/com/android/server/notification/NotificationManagerService.java).
- [LoadedApk unbind](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/core/java/android/app/LoadedApk.java), [BpBinder cache/ping/death monitoring](https://android.googlesource.com/platform/frameworks/native/+/refs/tags/android-15.0.0_r1/libs/binder/BpBinder.cpp), [ADB command joining](https://android.googlesource.com/platform/packages/modules/adb/+/refs/tags/android-15.0.0_r1/client/commandline.cpp).

### 5.6 Disposable experiment design, actual results and limits

The new process lab tests the same three shared guard files at pre-Application callback with separate nondebuggable synthetic packages/plain Application/API35 and no INTERNET/real-client data capability. It compares actual endpoint PID/UID (RAM-only Binder metadata) with caller-visible ActivityManager fields, exercises one normal same-UID child and one isolated different-UID child, runs unchanged policy and proves cleanup through joint framework absence/active Binder death. It intentionally continues after a guard rejection **only in the public synthetic fixture** so it can observe controlled peers; the real diagnostic still rejects immediately.

Dedicated test runtime is **emulator-5580 with ADB server port15040**, qemu=true/API35, no physical USB use. NLS-enabled preparation requires a synthetic LISTENER_CONNECTED witness after setup and before each controlled target force-stop. Polling has monotonic15s propagated command deadline, finite75-sample bound and16KiB output cap. A5s peer loop is not a hard timeout on an in-flight Binder transaction; CI's outer45s instrumentation command timeout is the additional boundary. Survey/bind/death observations are sequential/non-atomic, not a simultaneous full-kernel census.

Completed disabled-listener observations in both330 and0be:

| Observation | Three accepted rows in each run |
| --- | --- |
|Initial unchanged guard |PASS_ONLY_PRIVATE_PROCESS |
|Normal child |Bound=true;actual UID matches target;frameworkVisible=true;framework UID matches;guard rejects PROCESS_SAME_UID_PEER/PEER_ROLE=TARGET_AUXILIARY |
|Isolated child |Bound=true;actual UID differs;frameworkVisible=false;framework UID match=false;otherSameUidPeers=0;guard PASS_ONLY_PRIVATE_PROCESS |
|Cleanup |All normal/isolated Gone=true;cached alive true before failed active ping/dead cache condition;framework absence required |
|Enabled listener |**No accepted sample**;330connection wait timeout,0beimmediate legacy-mirror comparison failure |
|Overall |**FAIL**,not a Redmi result,not physical journal clearance |

Earlier96zero valid rows and16zero valid rows cannot be used as process behavior evidence beyond their observed failures. The old passive Binder cleanup condition was deficient; later runtime validates the strengthened fixture proof. Latest dirty offline build/descriptor check supports only compatibility, not listener lifecycle. Neither latest CI nor the offline authoritative permission API change demonstrates an NLS-caused same-UID startup after force-stop.

The existing42encrypted Android cases ×3 and bootstrap tripwires establish disposable reader/suppression behavior. They do not establish real Redmi key availability or safety of the installed customer's journal. Complete native schema/key/WAL qualification must not be repeated from scratch simply because the physical precondition failed.

### 5.7 Root-cause status by suspected subsystem

| Suspected origin | Proven / excluded for latest18:35 attempt | Unknown or competing interpretation |
| --- | --- | --- |
|Signing/package/root identity |Separate installation succeeded and identity guard returned before survey. Certificate/APK/UID/root rejection is excluded as this latest failure stage |The earlier17:12 rejection text is missing; cert success does not prove key access |
|Existing keystore key |Not reached; no retained read attempt |Alias existence, access under private instrumentation, and real encrypted-key mapping remain untested |
|Encrypted database/journal |Not reached; no snapshot/native reader invoked |Historical private state, owner/key ambiguity, corruption/no-replay classification unresolved; neither empty nor corrupt is established |
|Diagnostic implementation |Host/split/provenance/fixture defects established and corrected as described. Latest policy deliberately rejects same-UID different-PID metadata |Whether ActivityManager data is unsuitable on this OEM or the peer was legitimate requires contemporaneous evidence; weakened guards are not justified |
|Android process lifecycle |Immediate same-UID metadata condition established |Live ordinary main/auxiliary start, stale metadata, logical-vs-kernel UID difference/OEM visibility, or other component cause remain possible |
|Application integration/NLS |Manifest listener/default-main-process declaration established |No actual Redmi permission/binding/start witness. Default listener is a hypothesis, not attributed cause |
|Force-stop |Latest cleanup original unchanged/stopped passed; later inventory empty |What happened between approved force-stop and failed bootstrap, including possible asynchronous system binding, not retained |

**Conclusion:** latest immediate failure is a fail-closed process-isolation precondition. Evidence cannot yet assign the underlying cause to application integration, Android OEM behavior or a diagnostic metadata limitation. Earlier implementation defects do not prove the cause of the latest rejection. There is no evidence-based phone-side corrective action already proved to resolve it.

### 5.8 Evidence/source map and selected immutable hashes

| Purpose | Exact local source/evidence location |
| --- | --- |
|Actual wrapper and platform survey | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/android-probe/{PrivateJournalDiagnostic.java,AndroidProcessSurvey.java}` |
|Pure identity/failure/process guard | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/src/com/masarifi/voicequalification/{PrivateProbePolicy.java,PrivateProbeFailure.java,PrivateProbeProcessPolicy.java}` |
|Whole store/key/WAL/JNI boundary | Same `src/com/masarifi/voicequalification/`: `ExistingDatabaseKey.java`, `SecureStoreKeyIndex.java`, `CommittedWalSnapshot.java`, `NativeSnapshotReader.java`, `VoiceStoreSnapshot.java`, `VoiceStoreQualification.java`, `VoiceDatabaseSchema.java`, `VoiceJournalClassifier.java`, `StrictJson.java` |
|Corresponding portable tests | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/tests/com/masarifi/voicequalification/`: matching `*Test.java`, including `PrivateProbeProcessPolicyTest.java`, `PrivateProbePolicyTest.java`, `PrivateProbeFailureTest.java`, `VoiceStoreSnapshotTest.java`, `VoiceStoreSnapshotHeapTest.java`, `VoiceStoreQualificationTest.java`, `NativeWholeStoreTest.java`, `NativeSnapshotReaderTest.java`, `ExistingDatabaseKeyTest.java`, `CommittedWalSnapshotTest.java`, schema/key/classifier/strict JSON tests |
|Bootstrap/encrypted fixture | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/android-rehearsal/`: `test-bootstrap.py`, `probe/BootstrapRehearsal.java`, `journal/EncryptedJournalRehearsal.java`, synthetic root/metadata and target tripwires/providers |
|Disposable process fixture | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/android-process-lab/`: `probe/ProcessLab.java`, `target/Peers.java`, both manifests,`test-process-lab.py` |
|Host evidence/build regression | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/tests/{test-process-lab-receipt.py,test-bootstrap-observations.py,test-probe-build.py,test-android-buffer-descriptors.py}` |
|Native RAM reader/JNI | `D:/Masarifi-integration-2026-10-10/scripts/android-voice-qualification/native/{voice_memory_reader.c,voice_memory_reader.h,voice_memory_jni.c}` |
|First/replacement actual host and parser | `E:/Masarifi-staging-acceptance-2026-10-11/{execute-approved-redmi-diagnostic-once.py,execute-approved-replacement-diagnostic-once.py,parse-private-probe-receipt.py,test-parse-private-probe-receipt.py,test-replacement-diagnostic-approval-guard.py}`; inspect source only, do not import/run |
|Process/peer-role scope and attribution tools | `E:/Masarifi-staging-acceptance-2026-10-11/process-survey-next-packet/` and `peer-role-next-packet/`: `execute-approved-process-diagnostic-once.py`, `parse-private-probe-receipt.py`, `test-process-invocation-timeout.py`, `test-process-diagnostic-approval-guard.py`, `test-process-failure-metadata.py`; peer-role also `test-peer-role-attribution.py`, `run-host-tests.py` |
|Observation-only peer host | `E:/Masarifi-staging-acceptance-2026-10-11/peer-inventory-readonly/{execute-approved-peer-inventory-once.py,peer-inventory.py,test-peer-inventory.py,test-peer-inventory-executor.py}` |
|Causal chronology/index | [causal-investigation-96c1dda1.md](<E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/causal-investigation-96c1dda1.md>), [causal-evidence-index-96c1dda1.json](<E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/causal-evidence-index-96c1dda1.json>) |
|Latest acceptance narrative | [acceptance-status-2b61ab91.md](<E:/Masarifi-staging-acceptance-2026-10-11/acceptance-status-2b61ab91.md>) updated through0be but predates dirty API change |
|Failure RED evidence | `E:/Masarifi-staging-acceptance-2026-10-11/offline-causal-investigation/{process-lab-red.log,process-lab-envelope-red.log,active-binder-cleanup-red.log,listener-shell-quoting-red.log,listener-authoritative-api-red.log}` |

The causal index still has an older currentFixtureSource=33003583 and pending330 runtime entry. Those fields are historical; section4.3 and actual downloaded runtime receipts supersede them. Its pinned original physical receipt hashes remain useful and must not be overwritten to erase chronology. The causal narrative also contains earlier next-action wording; the current documentation-only STOP controls. Do not treat either narrative as authority to execute.

Selected original receipt hashes in that index:

| Receipt relative to Staging acceptance root | SHA-256 |
| --- | --- |
|`redmi-diagnostic-preflight-continuation.json` | `6b1e7dac3e6e39eb5243c0cb57df6cd0e5e6f8ccccd21e5b95fb82c74f1d76d9` |
|`redmi-diagnostic-quiescence-continuation.json` | `33ad9621c671e2fa09f2f60f0384d3cf4e22aa55851a845492cf859baa616157` |
|`redmi-diagnostic-final-result.json` | `908a4fc03475221abac0039f4811209254499c5dc568d5fbec085bfaeb86673c` |
|`redmi-diagnostic-install-retry-result.json` | `a909717e1f77a5468eaf5943824bb8eb8d20c5c226ed216bc409c6c7db438ec8` |
|`redmi-diagnostic-failure-metadata.json` | `aff1612b2a5a636d9203602b63c18ee4459d9c03eae62e0134a6563f98823a7f` |
|`redmi-diagnostic-replacement-aadff3ae-result.json` | `9443950eb4cadf0836c236034628d79abb1cef50e449597c2823731d23053fd6` |
|`redmi-diagnostic-replacement-aadff3ae-failure-metadata.json` | `f50c7437713af6ff7031bb20ec518eea215443e9b5b4acbbb951f61751112e1a` |
|`process-survey-next-packet/redmi-diagnostic-process-survey-e3bbeca9-result.json` | `9c55c1ba653f7a53faa97f2cd0a258f6245f8e5c625d13c2fb05e3f2b617891d` |
|`peer-inventory-readonly/redmi-peer-inventory-result.json` | `6ba124edf240f023bc6666aa7221e1261098638e1e9d36a671b85091546c5085` |

Archived official source SHA-256 identities: AMS `e713ead4798bf56ec8b590202e3473384eb8d1f4986a2b05c5124c3acb824285`;ProcessList `f4ed9143138c6ef1120e53c4d019043ca0ab5763ba4b4cc2c96f0370893c7faf`;ManagedServices `5bba9381f58ed6e4b6716d6a9e5e7db641cd1bd7502dfdfc86a28e5862c39d0a`;NMS `2e9294f89aa99c3c223cdb4c04fd7281bbc713872abd79b12e01a162600ce6b5`;LoadedApk `66bf1c037a67ded027395e4200e1e5234d58684c815b50a18981c4ffdcc2bb76`;BpBinder `5faa49b04cb986753f58cfc1b5990fca418da3142f09f5dd79ea596b0ac63312`;ADB client `a8e1b307199ae70024ce9bbe9f8bf0bcad2d1e5875befd280187cfbfc2255e1d`;archived target manifest `fde5b437fb1edf576bd00c00910b54af4c9ed0f1494d66b24635b62550faa2a8`.

For file-level preservation independent of canonical authorization, the five pretty-printed scope file SHA-256 values rehashed during this handoff are:first `faf8d06671e56d8cccfb7147ed963152d550b4157d820987468177f591168390`;replacement `b8287e87816b8edec3d81d17f420d0a9f3d8463a28bd645b50bb7f91ee323daa`;process-survey `8e10d29243ebed6f194ad1d1fe68d15bdb80f8ea620b5ec3f4c2d6727d500cfc`;peer-inventory `c34959e4001d945112e5ede0b6884e397b44659176794d1b7bd7ea1da98c4211`;peer-role `e923af6c8fc6eb6a29cc9ab460ad57ffdc707bdb7c96f497355740629233edbd`. These file hashes differ intentionally from canonical scope hashes.

## 6. Open root-cause questions for Astra — evidence agenda, not a corrective plan

No experiments are launched by this document. The following questions summarize what the independent investigation must distinguish before selecting a fix. They are not a new implementation/rollout plan and do not request physical approval.

| Question / competing hypothesis | Evidence already supporting or limiting it | Evidence that would distinguish it; possible offline/disposable inquiry |
| --- | --- | --- |
|Was the historical peer a live normal main/auxiliary client process? |Reported sameUID/differentPID rejection;manifest includes default-main NLS. No historical name/role/liveness |A contemporaneous bounded relation between rejected framework tuple, actual kernel credentials/liveness and component-start timeline would distinguish live peer from stale/logical metadata. Such physical observation would require new approval; old raw peer data is irretrievable |
|Did NLS rebind cause startup around instrumentation force-stop? |Upstream asynchronous rebind possible; no Redmi connection witness;enabled fixture never ran |Independent review of the interrupted authoritative-permission query and completing an exact-source public listener-enabled/disabled control could evaluate the hypothesis on stock API35. Actual consent, witnessed connection, force-stop ordering and rejection must remain separate observations |
|Was framework metadata stale or logical UID misleading? |Upstream actual-UID filter/logical displayed UID distinction; later19:01 inventory empty/nonstable global kernel |Disposable actual endpoint UID versus returned UID under caller visibility variants could distinguish representation from actual credentials. Stock isolated child was hidden; no OEM inference. Later inventory cannot prove past staleness |
|Could another same-UID package/process explain it? |Later package count1/other0;target manifest no sharedUserId |Only failure-time ownership/metadata would establish it. Historical identity count does not exclude all OEM/framework cases; do not fabricate a package from a peer role |
|Is it a diagnostic bootstrap/process-adapter defect? |Valid-empty-splits defect fixed;latest identity passes;intentional peer refusal unchanged |Compare exact executede3 source, shared adapter/policy and Android list semantics. Review fixture negative controls and data attribution for reproducible semantic errors; no basis to skip sameUID guard or move it after app startup |
|Was pre-Application binding impossible? |Successful normal/isolated synthetic binding in330/0be contradicts blanket prohibition |No need to repeat that established baseline merely to prove feasibility. Listener lifecycle is a different uncompleted control |
|Is Binder cleanup result actually valid? |Passive cache defect proved;active ping/dead-cache runtime controls accepted |Review actual source/receipt consistency and in-flight timeout limits. It concerns fixture observation integrity, not real process-guard rejection |
|Can key/journal safety be concluded without a successful physical bootstrap? |Reader/JNI/key/WAL synthetic cases pass;physical access never reached |No. Real existing alias/read and unchanged no-replay classification remain a later mandatory protected gate, not a speculative cause of present failure |
|Can first17:16 failure be assigned to split metadata? |Offline empty-array rejection defect;stack onlynewApplication:39 |Exact historical branch not retained;cannot retrospectively confirm sole cause. Distinguish “code defect fixed” from “historical failure diagnosed” |

Ruled out only within evidenced scope: latest cert/APK/root identity guard failure; key/database access as the latest immediate failure; universal stock pre-Application child-binding prohibition; routine upstream cold publication gap; claim that private bootstrap succeeds implies whole-journal safety. Not ruled out: real same-UID activity from an integration, OEM visibility/lifecycle discrepancy, stale framework metadata, or a diagnostic assumption invalid for that OEM. No specific phone-side corrective implementation is selected here.

## 7. Financial and Staging safety: historical verified state

**No fresh Staging observation was made for this handoff.** Last retained service observation is **15:55:41.567770UTC /18:55:41Riyadh**; last retained financial observation is **15:56:17.505796UTC /18:56:17Riyadh**. These are historical verified receipts, not a guarantee of current live state at document publication or Astra startup.

Staging Supabase project: **`qcffvfbpzvpwcwxwjyro`**. Staging host identity in retained deployment evidence: **`srv2006836`**. Production is outside scope and must not be modified.

### 7.1 Last observed service topology and versions

API/Analysis/Assistant all use source **`ac7bc92ab2e6e6c2e50a969de6c69463688febae`**, image **`ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383`**.

| Service | Retained Docker ID | Last observed state |
| --- | --- | --- |
|API |`98cb120092a0685a003b42f3854523d775905451696ad0b93241706c1cb15fd7` |Running/healthy,zero restarts;analysis-only=true;readiness ready with DB/queue up;public versionac7bc92 |
|Analysis |`53ece64ce47252042e4d9462096079a9966c4f09098356ce269601d16b4e681c` |Running,zero restarts;analysis-only=true,assistant-only=false;Docker health=null |
|Assistant |`fe86e4ed35d461495e293bb5f01f15a9f3562f35bd44de4f0c0c7fe17b83e4f2` |Running,zero restarts;analysis-only=false,assistant-only=true;Docker health=null |
|Financial |`a4608d59bba916f086d199965ea7fbac6a8023eff84a1c6ebf61ed5d16f4e51c` |Stopped,retained unhealthy historical container |
|General |`a9c03b8c0d5fff02ce67013767c62ca1b422b6880654b674c5f50cbe4208637d` |Stopped,retained;no global outbox drain |

Authoritative [service receipt](<E:/Masarifi-redmi-acceptance-2026-10-10/regression/live-staging-service-status-readonly-20261011T155541Z.json>). Null Docker health/running is not a worker lifecycle/provider acceptance result. Exact current Admin deployment version is not identified by this receipt; do not infer it equals the backend/mobile candidate. Old `/opt/masarifi/current` pointing to0ad0c041 is historical and not authoritative for running images. Stopped worker old source/digests are not freshly inspected in this handoff.

### 7.2 Financial baseline and exactly-once evidence

| Quantity/policy | Last retained verified value |
| --- | --- |
|Voice automatic policy enabled |**false / OFF** |
|Active financial epochs |0 |
|Accounts / transactions / ledger postings / balance rows |5 /31 /31 /5 |
|Ledger-balance mismatches |0 |
|Aggregate pending minor balance |0 |
|Historical uploaded/processing Voice jobs |4 |
|Financial writes/service changes during18:56 observation |false /false |
|Test balance last specifically retained earlier |**−6000minor /−60SAR**,pending0;not individually re-queried in18:56 sanitized aggregate |
|Historical unpublished outbox |**497,071**,last retained earlier;not re-queried in18:56 receipt |

The [actual financial receipt](<E:/Masarifi-staging-acceptance-2026-10-11/staging-financial-baseline-readonly-20261011T155617Z.json>) states its read-only repeatable-read reconciliation predicate: for every account a balance row exists, and confirmed/pending balances equal sums of `transaction_postings.amount_minor` grouped by clearing state. Other individual account balances/private IDs are not published in this sanitized aggregate; use protected existing financial evidence, not invented values.

Earlier detailed financial receipt at13:59:51Riyadh retained Test−60SAR,43confirmed/55failed/4uploaded/1expired Voice sessions,66completed/2failed Assistant jobs,zero pending Analysis/Assistant jobs,497074total outbox/497071unpublished/379895attempted-unpublished andzero notification deliveries. A later earlier-stage observation at14:35:15UTC/17:35:15Riyadh preserved Test−60 and untouched historical queues. “Confirmed Voice session” is not synonymous with a committed financial transaction. The most recent18:56 query verifies four uploaded/processing jobs and reconciliation, not all older queue/delivery categories.

The approved fresh **10SAR coffee canary was consumed exactly once**: one confirmed source=voice expense1000minorSAR,one−1000minor ledger posting,Test−50→−60SAR. Narrow scope closed and original API/Analysis configuration restored. [Readback log](<E:/Masarifi-redmi-acceptance-2026-10-10/regression/schema-qualification-canary-check-20261011-a/canary-stdout.log>) retained13:50:19Riyadh. The approved Manual50SAR expense also remains: one−5000minor posting,10October date correctly in Yesterday. Neither canary nor Manual effect may be repeated under their consumed approvals.

Preserved canonical financial group hashes from the original schema109 checkpoint:

| Group | SHA-256 |
| --- | --- |
|Accounts |`a2ab2d257a10b7e7159dc5ccc7b0bd6458c935f2c94b43677e9a086a35255e35` |
|Transactions |`03d2d9502c92d45392a8ac75b15e47f9090083c901b99280e30f03a481e67488` |
|Postings |`e3a75e9da697202444c0099e4e9a6af8bdde2f6f85ede16463a9cf8936f37d51` |
|Balances |`d745728ad948327f022c4814af6da609bdf3521f7b7694e5c9cf4d8aaaa364a0` |

Existing backup/restore streams also have per-table hashes under their exact row/serialization contracts; hashes from different serialization methods must not be compared as if they were interchangeable. No new full row hash observation was taken during handoff.

### 7.3 Completed temporary deployment qualification, already rolled back

Historical approved scope **`1c3726952c2c625171149a3d1d4959f76bba9a2eebb3b76e1eb6890d3aac0eff`** completed at **08:15:04UTC /11:15:04Riyadh**. Candidate7967007/image **`dd8f470997111bad1d009322ff9c88f21b52b833caf6d2ac691dc1976d0ebe63`** was used for temporary API-only qualification while financial policy/analysis-only remained OFF-safe. All14 authenticated existing-user GETs returned200: profile/preferences/onboarding/accounts/Test/balance/transactions/Home/Reports/Voice recovery/session/batch/Assistant consent/availability. Migrations106–109 were applied once;105not reapplied. The exact original API/configuration was restored, temporary candidate/migrator containers stopped and retained; Analysis/Assistant/financial/Tracking unchanged.

Historical helper reporting NameError after successful GETs is preserved; finally restored the API, and a corrected verifier produced the completion receipt **without another service switch**. A route-specific public readiness404 and expiry-before-expensive-inspection helper concern were not silently waived. Future reuse requires renewed exact guard/pin/expiry review. Do not repeat this completed phase just to regenerate a clean narrative. [Canonical completion](<E:/Masarifi-redmi-acceptance-2026-10-10/regression/Staging-API-qualification-7967007-completed-20261011T081504Z.json>).

### 7.4 Historical journal/outbox exclusion and activation safeguards

Keep all old local journals, expired/unsubmitted legacy evidence, four historical uploaded/processing jobs and approximately497,000 unpublished outbox records intact. No old recording replay, queue drain, blanket publishing, general-worker activation or notification processing of historical finance is authorized. Phone force-stop/failed bootstrap has not classified private local rows and cannot clear the no-replay gate.

The goal remains **normal eligible authenticated-user operation**, not permanent analysis-only or a reused single-owner/device/account/amount canary. When separately authorized after safety acceptance, ordinary active-profile/auth/owner consent, quota/budget, category/currency/account status/ownership, event occurrence identity, atomic ledger effects, duplicate reservation and kill switch remain required. Fresh epoch captures must be distinguished from retained work; closed generations cannot silently reopen. SMS/notification auto-posting stays separately governed.

The retained controller creates bounded control and separate closure helpers per generation, with exact digest/source/imageID/environment hash/CA/nonroot65532/Staging network/readonly filesystem/capability drop/no-new-privileges/IPC/PID/memory/CPU/log constraints. It journals intent before create/start/exec, rejects drift/missing helper, does not auto-create replacements, and preserves interrupted/uncertain execution instead of blind retries. Separate locks prevent concurrent control/closure confusion. Failed/timed-out exec stops exact helper and retains unconfirmed state.

Closure stops/confirms the exact owned financial writer **first**, with at most10s per Docker boundary, then independently attempts SQL closure even if writer stop fails. All shutdown boundaries share monotonic150s inside systemd180s. Expired startup cannot suppress closure; budget exhaustion preserves an unconfirmed fence and must not claim Posting OFF. Systemd stop/failure invokes independent close; only a separately approved fresh generation may reopen. The strict OFF-only adapter has **no financial epoch-closure authority**; its tests cannot substitute for real closure/rollback evidence.

Candidate worker health uses source-bound,scope-bound,startup/failure/stopped/ready record written atomically to0600 unique non-following temp then `/tmp/ai-worker-health.json`;bounded1024byte reader rejects malformed/future/wrong/stale records. Ready means successful completed poll, not provider accuracy/capacity. Freshness accounts for existing180s Voice deadline or10–300s Assistant lease plus poll;claim limit capped to concurrency;Analysis start period310s. Old live workers do not have verified new health acceptance.

Actual OFF monitor/stop-start/failure/watchdog/epoch closure/duplicate/rollback behavior on Staging remains unperformed. Do not set dummy PASS receipts, substitute fixture results or enable policy to “test whether it works.”

## 8. Backups, restore integrity, ACL correction and preservation

### 8.1 Original protected backup: do not modify

Latest preserved complete streamed schema/row/configuration snapshot is [staging-stream-protected-backup-20261011T140218Z.dpapi](<E:/Masarifi-staging-acceptance-2026-10-11/backup/staging-stream-protected-backup-20261011T140218Z.dpapi>), SHA-256 **`d177b5d4e8743b77b85b3177a23b3e8cba8947714c2ab5b35bc594c906a25359`**. Snapshot observed **14:03:10.234UTC /17:03:10Riyadh**; filename records14:02:18UTC. Do not confuse either with14:02Riyadh.

The [verification receipt](<E:/Masarifi-staging-acceptance-2026-10-11/backup/staging-stream-protected-backup-20261011T140218Z.verification.json>) covers139tables/547004rows/109migrations from one read-only repeatable-read snapshot, Windows CurrentUser DPAPI encryption, verified decryption/entries/schema archive. Streams: schema.dump1,925,295bytes SHA`e2fd191a40368c3048b9c3156b9f710b799e5294a86769c7a685ccee50d38ba5`;rows.ndjson.gz36,598,235bytes SHA`05c4a914d9c15b5c271b753687202eeccd34ffd35ab02d8ffe46e7a99c7eb8e5`;configuration.tar.gz51,746bytes SHA`728c304ea302eedb1845bb8378103bf26ad4ebc2a85635b9fd497d05205fef91`. Retain the authorized Windows profile/DPAPI keys; copying this file alone does not guarantee another account can decrypt it. No credentials or plaintext backup are embedded here.

Storage object bytes were **not copied** and remain in protected Staging storage. Full Supabase restore requires platform extensions/roles/services and is **not claimed**. The original backup receipt's financialRestoreRehearsal=PENDING is historical and superseded by the separate later PASS below; preserve both.

Older DPAPI backups remain, including `E:/Masarifi-redmi-acceptance-2026-10-10/regression/staging-stream-protected-backup-20261011T080508Z.dpapi`, SHA`cd225013d0b875da6573378ea601f7e1db90f19091d85c1109060a276f473f59`, and older pre-schema109 backups. Do not delete them.

### 8.2 Completed isolated financial restore and stopped D: cluster

Selected financial restore completed **14:15:15UTC /17:15:15Riyadh**, PostgreSQL18/127.0.0.1:54340/SCRAM, verifying all139source streams/547004rows and restoring four selected financial tables:5accounts/31transactions/31postings/5balances with exact row hashes andzero mismatch. [Restore receipt](<E:/Masarifi-staging-acceptance-2026-10-11/backup/staging-financial-restore-20261011T141452Z.verification.json>). It is not a full platform restore and has not been restarted since its recorded shutdown.

Initial location on E: was exFAT and could not provide persistent NTFS ACL confidentiality despite `icacls` success. [Explicit storage correction](<E:/Masarifi-staging-acceptance-2026-10-11/storage-security-correction-note.json>) supersedes the initial private-ACL claim while preserving financial integrity results. User explicitly approved stopped-cluster relocation to D: after NTFS/free-space verification, security permissions and integrity checks.

Current retained path:

**`D:/Masarifi-private-staging-rehearsals/acceptance-secured-20261011T141452Z/financial-20261011T141452Z`**.

Relocation receipts at14:31:25UTC and14:44:54UTC record NTFS, **991files /43,978,870bytes**, all SHA-256 values identical, protected parent/all file+directory owner/SYSTEM-only ACLs, no accepted reparse paths, original E:plaintext directory absent, original encrypted backup unchanged, specific cluster stopped (`pg_ctl status`3,postmaster.pid absent in retained checks). Final relocation recheck free space100,399,869,952bytes. A later16:14:44UTC storage observation in the retained acceptance narrative reports99,992,064,000bytes free and unchanged backup; a separate standalone receipt for that later check was not identified in the inspected backup directory. It is narrative/transcript evidence, not a fresh check here.

Protected hash manifest: `D:/Masarifi-private-staging-rehearsals/acceptance-secured-20261011T141452Z/relocated-restore-sha256-manifest.json`, SHA **`1c45e57baa0e114059a0f909f5bb154aeb29eeea9bb2da16d1770efa730f90df`**. [Move receipt](<E:/Masarifi-staging-acceptance-2026-10-11/backup/financial-restore-storage-protection.verification.json>), [final relocation/ACL recheck](<E:/Masarifi-staging-acceptance-2026-10-11/backup/financial-restore-relocation-recheck.json>). Do not restart the completed rehearsal, widen ACLs, move/delete its files, change an unrelated Windows PostgreSQL service or touch the encrypted original during reporting/transfer.

`E:/Masarifi-staging-acceptance-2026-10-11/verify-relocated-restore-readonly.ps1` is misleadingly named: it is a **one-time writer**, not a safe repeatable read-only audit. Do not run it just to check state. Similar helper names are not sufficient authorization; inspect source first.

### 8.3 Source/worktree preservation

- [Original entire Voice archive](<D:/Masarifi-preservation-2026-10-10/Voice-entire-worktree.7z>):4,852,942,577bytes,SHA **`e5836532dcd4534903052dd022e930cef5f49ba0edb36442cbcab9443a8e9071`**. Existing CRC/full inventory/restoration verification retains630dirty entries,215source/design/helper entries,11,410ignored-source fingerprints and junction-target coverage. Entire physical inventory558580files/14226777146bytes;aliases produce730540logical entries. No new archive extraction/CRC run for handoff.
- Preservation receipts: `D:/Masarifi-preservation-2026-10-10/VOICE-VERIFIED.json`, `VOICE-COMPLETENESS-VERIFIED.json`, and `E:/Masarifi-redmi-acceptance-2026-10-10/regression/original-voice-final-7967007-preservation.json`.
- Original source dispositions and Samsung history: `C:/Users/DELL/.codex/visualizations/2026/10/10/01a1246b-1e96-7402-a61c-35bd296d00c7/`, notably `Voice-Source-Disposition.json`, `Ignored-Voice-All-Source-Disposition.json`, `candidate-complete-disposition-verification.json`. Historical Samsung evidence is not current Redmi acceptance.
- All-ref/source preservation: `E:/Masarifi-local-readiness-2026-10-11/final-preservation-15488cd7/qualified-recovery-all-refs.bundle`, [final-delivery-provenance.json](<E:/Masarifi-local-readiness-2026-10-11/final-delivery-provenance.json>), older `recovery-e6def119-all-refs.bundle`, `recovery-aea34326-all-refs.bundle` (SHA`42dc8654cdeeefa2cf822bf26e476fa51914d48e942831d84e3f44ed110225db`) and `recovery-bfe5ea7d-all-refs.bundle`. These are historical snapshots, not a claim that15488 bundle includes later0be or current dirty changes.
- Earlier68e bundle: `E:/Masarifi-redmi-acceptance-2026-10-10/regression/voice-schema-68e198e0-all-refs.bundle`,SHA`3f8f72712be971d887c0c20ca2808c6841479338c1ff86bc69a683d0cf158905`, with verification and479artifact hashes retained. Committed later recovery is pushed, but no new bundle/archive was created for this documentation task.
- Existing historical handoff: [CURRENT-RECOVERY-STATUS-AND-HANDOFF.md](<D:/Masarifi-integration-2026-10-10/docs/recovery/CURRENT-RECOVERY-STATUS-AND-HANDOFF.md>),485lines,68e state; preservation copy on E:and original pasted attachment `C:/Users/DELL/.codex/attachments/662190f1-255a-4d80-9e8c-190ca967d34f/Pasted text.txt`. Its “clean/sole untracked/unfinished JNI/old audit/latest796 APK” statements are historical, not current state.

Git bundles preserve committed refs/history, not dirty/untracked/ignored files. This active worktree, current dirty patch and all existing evidence must accompany or remain accessible to Astra; a clean new clone alone cannot reproduce the handoff state. Other worktrees' current dirty contents were not independently rehashed during reporting. No preservation file was reset/deleted/overwritten.

## 9. Security findings and unwaived release decisions

Security state is historical audited evidence, not a new vulnerability scan during handoff. [Fresh npm audit summary](<E:/Masarifi-staging-acceptance-2026-10-11/security/fresh-npm-audit-summary.json>) observed14:15:47UTC:API0,mobile53HIGH/27MODERATE/0CRITICAL,Admin8HIGH/0CRITICAL,waivers=[];all lockfiles unchanged. Counts are affected/propagated package entries, not independent advisories. Admin's eight highs trace to a single braces advisory. Passing functional CI does not waive these findings.

Completed compatible remediation preserved API js-yaml/multer/qs/scoped NYC YAML corrections;mobile matching-major brace-expansion/compression/shell-quote/source-map-js/fast-uri;Admin same-line Next16.3.8,matched Cloudflare Vite/Wrangler,undici/brace-expansion/source-map-js/fast-uri updates. Expo55.0.31,React Native0.83.10,Metro0.83.8 andmobile React19.2.0/native identity remain compatible. No `audit fix --force`, audit suppression, framework migration or tests weakened to hide findings.

| Residual package/surface | Retained risk and unresolved boundary |
| --- | --- |
|braces3.0.3,mobile/Admin |HIGH nested-pattern CPU/process termination;tooling/glob/Metro/Jest/Next/vinext paths;no patched version in retained advisory. No deployed financial API brace-pattern surface established;tooling exposure does not waive it |
|node-forge1.4.0,mobile |HIGH malformed DigestAlgorithm/low-exponent RSA signature verification;Expo CLI/code-signing tooling chain;no patched version. Financial/auth runtime use not established,signing-chain risk remains |
|decode-uri-component0.2.2,mobile |MODERATE malformed percent encoding CPU issue;React Navigation/query-string deep-link/auth callback surface relevant. Patch0.5.0 ESM breaks pinned callable CJS consumer contract;compatible backport/migration unresolved |
|sprintf-js1.0.3,mobile |MODERATE precision format RangeError through Jest/Babel/NYC/js-yaml3/argparse chain;no patched release. Ineffective scoped override removed rather than claimed fixed;coherent tooling change unresolved |
|stream-json1.9.1,mobile |MODERATE nested filters/JSONC CPU and object prototype effects through Clerk/Solana/web3/jayson chain;vulnerable Node streaming use in native app not established. Patch3.6.0 ESM/deep import/API changes incompatible with pinned jayson |
|uuid7.0.3/8.3.2,mobile |MODERATE v3/v5/v6 output-buffer bounds;inspected consumers usev4without external buffers,which narrows observed exposure but is no waiver. Patched11.1.1 outside consumer ranges;validated migration/backport unresolved |
|Qualified093b5d0c container |0HIGH/0CRITICAL,23MEDIUM/8LOW OS rows,31unfixed rows/25distinct CVEs;328Node packages withzero package findings does not establish universal Node-core/application non-exploitability |

Full [dependency-security.md](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/dependency-security.md>) includes exact primary advisories, lockfile paths, exposure and compatibility rationale. Raw JSON under `E:/Masarifi-local-readiness-2026-10-11/dependency-security/` and `E:/Masarifi-staging-acceptance-2026-10-11/security/`. Original container all-severity scan e6 digest8fea9d58 reported25medium/8low;qualified pinned libc6u4 image8ee removes exactly CVE-2026-5450/CVE-2026-5928,retains23medium/8low. Full before/after scan/provenance at `container-full-scan/`, `glibc-point-update/`, `container-full-scan-093b5d0c/`;runtime CI artifacts at `E:/Masarifi-local-readiness-2026-10-11/backend-runtime-093b5d0c/`.

**Release-blocking disposition remains open** for mobile/Admin high findings and relevant moderate runtime/tooling compatibility risks;no waiver/client release decision recorded. Existing owner/private grants/RLS tests are passed, not a substitute for dependency decisions. Preserve all raw reports. Independent review must clearly choose remediation or a separately governed explicit release decision; this handoff selects neither and weakens no gate.

The retained offline diagnostic signing runner uses the existing `apps/mobile/android/app/debug.keystore` while binding the required current certificate; its password is supplied only through a task-specific runtime environment variable. No secret is reproduced here. This preserves the installed signing identity but does not establish formal Production signing/key-custody or final client-store release governance. Any separate release-signing decision must preserve the explicitly required data/identity compatibility; no rotation, key replacement or Production release is authorized by this report.

## 10. Remaining acceptance/delivery blockers and existing dependency order

This section restates the **existing acceptance procedure**, not a new corrective plan. [Existing deployment phases](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-customer-staging-recovery/deployment-phases.md>) and [consolidation proposal](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-customer-staging-recovery/consolidation.md>) remain preserved. They are suspended by STOP and have superseded migration/version fields. Astra must independently investigate and formulate any corrective plan in a later authorized session.

| Existing gate/dependency | Status/blocker and required acceptance evidence |
| --- | --- |
|Diagnostic causal investigation |Historical peer cause unknown;disabled-only public controls qualified partially,listener-enabled aggregate failed;interrupted dirty permission API patch not committed/runtime qualified. An evidence-based fix has not been selected |
|Physical private-journal safety |INDETERMINATE;separate new exact device approval required for any further phone action. Cannot install/launch latest client before clearance |
|Security release disposition |High/moderate residual findings unwaived;compatibility/no-patch decisions unresolved |
|Fresh executable rollout baseline |Historical service/source/digest/env/CA/backup/financial pins must be reverified under allowed exact scope before protected execution;old inert packet has missing current pins |
|Posting-OFF monitor/rollback rehearsal |Actual retained-helper operation,owned writer lifecycle,shutdown/watchdog,epoch closure androllback evidence absent;fixtures do not close it |
|Persistent compatible Staging cohort |Latest API/Analysis/Assistant/required financial/confirmation processing not deployed;exact per-service compatible pins and interruption/rollback scope require approval. Avoid blanket general worker/outbox activation |
|Latest in-place Redmi client |e6APK uninstalled;journal clearance,package/cert/UID/data/session-preserving installation/rollback scope and approval required |
|Major-feature acceptance |Auth/onboarding/accounts/Manual/Voice/Assistant/Home/Transactions/Reports/notifications/SMS Tracking/background/languages/layouts/session persistence and reconciliation on latest actual client/cohort not complete |
|Normal-user financial activation |KeepOFF until mandatory safety/release/OFF rehearsal gates verified and human explicitly approves exact activation. Do not reuse consumed canary allowlist as permanent product |
|Fresh financial acceptance |Separate bounded authorized fresh single/multi-event/multi-account transactions;known owner/account/amount/baseline;actual exactly-once transactions/postings/balances/Home/Transactions/Reports/notification readbacks;safe retry/process/network interruption;no old audio/replay |
|Integration/main/client delivery |Recovery changes not consolidated;Integration/main separate approval after review/acceptance. Final delivery not ready;Apple/unsupported transfer scope not silently claimed complete |

Real providers/credentials/privacy consent, physical speech, notification/listener/SMS permissions and customer feature review are external dependencies. A future request must state exact action,scope,immutable pins,expected interruptions and tested rollback;approving an experiment must not silently approve deployment,full client installation,financial transactions or settings changes.

Existing [inert acceptance packet](<D:/Masarifi-integration-2026-10-10/docs/evidence/2026-10-11-local-delivery-readiness/staging-client-acceptance-review-packet.json>) has `executable:false`, `approval:null`, unresolved fresh runtime pins, actual OFF rehearsal and physical clearance pending, no waiver. [Read-only revalidation](<E:/Masarifi-staging-acceptance-2026-10-11/deployment-packet-readonly-revalidation-2b61ab91.json>) at16:37:23UTC pins packetSHA`8d7f8d20c90d82082df7a262b9238caae6637c8a1b49c53a5d629193e98ee2f9`,planSHA`0f09c98ed828f236c87cd11dd5628d5cc88efd3796b660e80ef35b4f8967201e`,deployment-guardSHA`e3e403420ceada067a25c627757902fcd637c49cb7e205a6f39e2d9162cf3ba2`. Its238968probe reference is historical and cannot authorize current probe. Plan's instruction to apply106–109 is superseded by actual109applied evidence.

Relevant operational sources are `D:/Masarifi-integration-2026-10-10/scripts/staging-voice/`: `customer-operating-cohort.py`, `operating-host.py`, `off-monitor-rehearsal.py`, `redmi-voice-rollback-watchdog.py`, `deploy-cohort.cjs`, `deployment-guard.cjs`, `tracking-runtime.cjs` and their retained test/review packets. `docker/staging/voice-analysis.yml` and `compose.voice-epoch.yml` preserve scoped overlays. **`deploy-cohort` snapshots/compatibility probes create remote containers**; importing/running them is not a read-only inspection and requires protected execution approval. Do not start them during “baseline review.”

## 11. Preservation instructions, completed work not to repeat and authority boundaries

### 11.1 Astra starting instructions

Start from the active recovery worktree and exact pushed0be HEAD **with its three dirty fixture files preserved**. Read this handoff, current acceptance narrative, existing phase/consolidation documents and actual receipts before selecting an approach. Distinguish tests/product/source/image/physical installation pins. Do not treat15488/68e/796 narratives as latest state or restore their obsolete pending tasks. Inspect `git status` and compare to section1.1 before changing anything. The full inventories below permit independent local ref/path checks without resetting.

The next session may independently investigate/plan only when authorized by the user's new instruction. This handoff ends current implementation. No continued task, automation, new Astra chat or scheduled execution was created here. Safe future local implementation authorization does not itself permit Redmi/Staging financial/device operations.

### 11.2 Completed work that must not be restarted unnecessarily

- Original dirty Voice preservation/accounting and selective feature recovery;do not reimport entire old tree over newer Tracking/ledger/security or remove Savings.
- Full e6 product/type/lint/build/mobile/Admin/API/fresh+upgrade DB/browser/four-ABI/performance qualification. Later fixture-only CI is a different scope.
- Complete native RAM-only/JNI/SQLCipher/key/owner/schema/WAL portable and disposable encrypted42×3qualification. Physical pre-Application failure does not mean those completed implementations are absent.
- Same-certificate full e6 standalone APK assembly/provenance;avoid rebuilding simply to renew version labels without a source reason.
- Pinned glibc/runtime image and all-severity scan qualification;retain unfixed rows rather than hiding them.
- Temporary796API14GET qualification/rollback and applied109migration inventory;never reapply106–109 or rerun service switches to clean up a reporting failure.
- Single approved10SAR Voice canary and approved50SAR Manual effect;no repeated transaction/recording under old permission.
- Protected backup/decryption/all-stream verification,financial restore/shutdown,D:NTFS relocation/hash/ACL correction;no restore restart or original-backup modification.
- Closed host/parser/split/API descriptor/attribution/quote/Binder fixture fixes and actual disabled peer controls;do not re-debug a proved fixed host defect as if it were the physical root cause.

### 11.3 Prohibited and separately approved operations

During this handoff: no product/test changes,new tests/builds/CI dispatch,phone calls,Staging queries/writes/deployment,activation,financial transactions,merges or corrective plan. Only the Markdown document is written;existing modified files remain unchanged.

For continuation, explicit fresh human approval is required at protected boundaries: **any Redmi/device operation**, separate probe install/instrumentation,full client update/launch/permission or setting changes; **Staging deployment/service lifecycle/remote helper containers**;financial epoch activation/closure scopes where applicable and **fresh financial transactions**;Integration/main ref update/merge;destructive restore/data operations. Approval must match exact reviewed operation,scope/hash/device/service pins and rollback. All listed consumed diagnostic scopes are historical;peer-role754scope remains unapproved. The user's earlier general priority prompt was expressly not blanket authorization.

Never replay old Voice recordings,drain historical outbox,clear/uninstall original client data,seed keys to make diagnosis pass,disable a real listener/security setting speculatively,relax sameUID guards,move them after normal app startup,retry until PASS,fabricate financial results or silently waive vulnerabilities. Preserve logs,failed containers,stopped restore,APKs,archives,branches/stashes/UI designs/financial records/sessions. **Do not modify Production.**

### 11.4 Missing evidence and access limitations

- Historical rejected peer raw name/PID/kernel UID/liveness/role not retained;cannot recover exact root from sanitized receipt alone.
- Initial17:12installer rejection text missing;user-reported security prompt is evidence of observation,not exact installer error.
- First17:16bootstrap stage missing;split-empty-array responsibility remains plausible,not confirmed.
- Earlier empty audio/transcript/provider payload expired;not reconstructable from token counts;no replay allowed.
- No accepted listener-enabled disposable sample,current dirty-patch exact CI/final review or physical journal/key result.
- No fresh Staging/device state observation at report time;no current Admin deployment/version verified in retained latest service receipt.
- Latest16:14storage state has retained narrative/transcript but separately located raw recheck receipt not identified;stronger14:44structured receipt remains available.
- Latest dirty nine-test GREEN was recorded in prior transcript;standalone retained GREEN file not identified. Do not equate initial RED/build receipt with complete test qualification.
- Large private CI archive only selectively read;no complete-archive hash claim. GitHub artifacts can expire;local selected/downloaded evidence must be preserved.
- DPAPI original Windows-user keys required;storage-object bytes/full platform restore excluded. No secrets/private payloads exposed here.
- Historical bundles stop at their named checkpoints;not a backup of current dirty changes. Other worktree dirty contents are unverified by this report.
- Existing APK/local evidence files are accessible in the present Windows workspace. A new Astra executor must have those same drives/profile/permissions or separately authorized transfer;cloud clone alone lacks private evidence and dirty work.

## 12. Documentation verification boundary and delivery verdict

This document was reconciled against the485-line original recovery handoff,latest acceptance/causal narratives,structured physical receipts/source policies,existing qualified artifact/build/audit/restore records,read-only Git inventory/tree objects/remote refs,and existing GitHub conclusions. Old narratives with superseded state were retained,not rewritten. Final document checks inspect only text/reference existence and preserved file hashes/Git status;they are not application tests or deployment acceptance.

Documentation-only verification at approximately **17:58UTC /20:58Riyadh** checked87expanded unique local references withzero missing paths;allnine indexed physical receipt file hashes matched;allfive canonical scope-body hashes matched and their separate file hashes were recorded;latest full client,archived installed/rollback client and latest unapproved real probe APK file hashes independently matched. The three pre-existing modified source/test files matched section1.1 byte hashes. Subsequent edits in this handoff were confined to this Markdown file. The final Git status retains the same three modified files,existing untracked recovery directory andthis new untracked report;no staging/commit/push occurred for reporting. These are document preservation checks,not newly executed product tests.

**Delivery verdict: NOT READY for full client acceptance.** Implemented/automated preparation is substantial and preserved;actual private-journal clearance,compatible deployed/installed candidate,real monitor/lifecycle/rollback,bilingual full-feature/provider/notification/device acceptance,unwaived security disposition,approved normal-user financial activation and fresh reconciled exactly-once transactions remain open. The immediate diagnostic failure mechanism is proved;its underlying historical peer cause is unknown. No corrective implementation plan is created in this handoff. Current work stops after final documentation verification and path delivery.

## Appendix A. Complete current recovery commit ledger

The following read-only Git ledger covers commits after Integration42bcb8c through current0be. It preserves full IDs and messages for independent investigation. It does not include the uncommitted fixture patch or this report.



```text
0be314d9246029ea2ab5210df45a4a9a2d050c30 test(voice): preserve literal listener component in emulator shell
33003583c58d76c639c8fb5bb72fc1f786e6f4cf test(voice): actively verify disposable Binder peer death
16d19ac9469c087b9e9121823b52116b65a66477 test(voice): retain closed stage for disposable process failure
96c1dda1cf24496203c5340b5cbcea0a5a6caa21 test(voice): investigate Android process guard with disposable peers
2b61ab91693b8c2985677cd1523a76272f4c8f71 Classify rejected private-probe peers without weakening isolation
e3bbeca9ef289f6cc3dc13f074b61eb6a45fb931 Qualify shared private process guard before probe signing
aadff3ae785aa08f81dbf9834d34888bb7ef8f07 Fix API35 private probe bootstrap metadata and preserve acceptance evidence
15488cd7bace161d5093bd44ad8b47491dafb053 Record qualified local delivery artifacts and external acceptance gates
238968b8172cd416663d5e980f244022d274c080 Require bounded Android framework stability before synthetic startup
e0bd7b3ea72a5946ac9977e419b8cfbe6fc4d588 Bound fixture metadata and verify all DEX calls against Android 35
093b5d0c42f3d68eb2de619aff94b44fbf088a02 Install shared contract dependencies for runtime qualification
4bec72959cbc85037b4b96b3adfa288b97fea257 Patch pinned glibc libraries and qualify the exact backend runtime
3082a8ed982f0658247c7123e6e95f7748a8d95d Fully materialize disposable Android fixtures before positive control
ae2181fddf0541c9d71ad8cb5999041e354eea89 Fix Android buffer descriptors and retain synthetic lifecycle evidence
aea34326f9838486432b1c6efe5d05c85fea1181 Bind offline probe signing to native and encrypted runtime provenance
2461c006320a316d0fc0d683bf1a158366fbaa14 Prepare guarded Posting-OFF helper rehearsal and isolated verification
afaec3863317468346b2fcb4faf046300fafc01c Expose bounded failure phases for disposable journal qualification
e6def119b047c54fbaf36877fdd23b3bc367ad6a fix: accept normalized compose healthcheck defaults
bfe5ea7dee678b26b451e395392bc2f926726fef fix: qualify voice journals and retained staging safety controls
68e198e0e689a406b439d13e6d82f96e9a9f9312 fix(voice): expose bounded read-only database version query
efcc28709e608a2b1c1f1b81adec9e687cbd3a4d test(voice): pin complete schema coverage and encrypted-reader gate
cddc708a64bd8d93d678fab78c7ef1cc034c1855 fix: suppress target application startup in disposable probe
691d03044562aadf4091464272134dcc6dd348b7 test: preserve instrumentation argument boundaries
56c928aea46093f2212c39806a288c7543b980e5 test: exercise four distinct startup provider components
2ee1cd9901226531c46407802982f1d18565c325 test: prepare disposable Android bootstrap tripwires
989faba9a46c72101b5a3b5c7ce6726c8ad2dc5f test: classify preserved Voice journals without recovery effects
6be30ccb9775cb87ef903aa9dd590c7bda8a1276 fix: validate encrypted SQLCipher page size without coercion
440ae154cf90fefa465df001956240a68b65fab7 fix: serialize independent diagnostic SQLCipher lifetimes
eb3ae2d527191627e5e2c42fc842ccabd0d04169 fix: initialize real mutexes for diskless Voice diagnostics
4bcf8da3a6fdc5390f22723c5f5d79ddd2d9c855 test: prepare independent RAM-only Voice snapshot reader
a149a35b73707784d262be2c1be8cd84a098b0ed test: map existing owner-scoped Voice database keys safely
6c485109097a44f961519eda4439433df02fb33c test: prepare existing-only Voice database key decryption
52eeeae7ffa7d9977a275d3eeef5bace04d3ee0d ci: expose Linux mmap declarations in isolated cipher build
fda420c0a3defca8f19a5e3e741fd83ff3e66092 ci: provide standard integer types to standalone SQLCipher fixture
2e2d0fc39c50f15a9e9aa66dfb32f24c0eb10d96 ci: match qualified Node runtime for encrypted WAL tests
c9558415610b8f59c1901204f653d0c0cf53a4fe test: qualify committed Voice journal WAL reconstruction
42565f8e44cb66e6f25b64a51d4a4bf5ab89bd89 ci: tolerate missing ripgrep and retain preparation diagnostics
1620d5b92e887999caddc10eb347bcf3da2e6d6f test: prepare bounded private Voice store qualification
7967007ab69ca84c90c67457475d12236bed5b81 test(planning): verify fixture beyond bounded backlog page
6fe519056a7d374b6f1759d32cc5e1076bdef546 fix(onboarding): provision Cash within restricted API grants
23cdb5f0cb93c50473de9d02935365b17c065769 test(recovery): pin migration inventory and phased Staging qualification
e7db54802991824fa69e53dc3648c185d98289a6 fix(voice): expose consistent per-event owner receipts and recovery
448d9764a2c1050bc0af25f8bc22bf5fb3c926e3 feat(ops): guard persistent authenticated Staging Voice operation
2ec8daf36be45ad025f65ae1aac7756b8621ad1b fix(onboarding): provision confirmed-currency default Cash atomically
30f2e8424ceb157407ff2f605d510bc5295c4e32 fix(voice): resolve compatible owned accounts per ordered occurrence
4e39b9638438eeb195b6a2d28f64283cf48e3e8b fix(voice): deliver fresh operating confirmations through existing owner pipeline
b811c3a3104906415a61188f792a4f89d8d87b01 fix(home): retain grouped cards while windowing complete Today activity
f191950fbc06a29c540d9978d82e4448c6635b69 fix(assistant): admit configured live service in standalone releases
ed4aac197b03ed50a347789de20e3438dd7ae00c ops(voice): prepare pinned independent Redmi rollback watchdog
37bb67925ed122a6b86e44b2f7069909f71c8370 test(mobile): flush Reports query notifications through React act
4d88d2920670569d6336cc6b4d2aa941da1e8795 fix(voice): preserve accepted receipts and enforce five-minute activation
c1f21ddf33bea4b2645a87c463f7dfa7f242b7a4 test(voice): cover extraction replay and database window cap
6d9552be939de89351da694c8ec107f5bcfb6316 chore(voice): pin scoped recovery and document approval and rollback
0dbed67e14aab9d69b7cbbd09fc5a0176a0af27f fix(voice): fence stale canary responses and validate Redmi approval
37a360b4880df9807f76c649b1b850f99e2a7662 fix(voice): bound Redmi acceptance to one automatic ten SAR expense
d7736cb59c640f053f9d6a0364d9f972df77b2e6 ci(voice): run isolated posting boundary on recovery branch
bd4c2d38268fe6bf13e424262ad312aa0d0c8e8f test(voice): specify one-recording financial acceptance boundary
91213b443d51b3b2264468e660f9bf78a87e74d9 docs: record functional recovery evidence and acceptance gates
d39d3816e8611a3c5a74ac7f6a6f1c4851fd55ca fix(mobile): show localized custom categories on Home
9470a7caf44275b6bb17f6e17f975eb129d0bd8c Preserve expired and unsubmitted legacy Voice evidence during batch recovery
e959f97201cbe9ea80f08b54c9bb617426840c2e fix(mobile): preserve stalled legacy Voice recovery evidence
ac7bc92ab2e6e6c2e50a969de6c69463688febae ci: retain arm64 gate while compiling all supported architectures
ced59fb434b9ce048cdfd932992ed771d8aae26d fix: stop financial polling permanently after runtime failure
e64f7e15a3e7534b7625592caf9c38f11b540f66 fix: retain app lock in standalone Staging acceptance profile
e03d8ebb9bd409a819c4f566754c668353a7dd70 test: register analysis eligibility and verify private capability grants
05340b5190f5f8b8545caedde099e3013b9c3ef3 fix: return profile eligibility denial from AI admission
4ff200420242901567fc0356ff3734dec12cf76f test: verify authenticated Voice contracts and claim-time eligibility
c6d81c9e957770a5146c01f000720ebadae6c0d0 fix: discard direct query connections after driver rejection
d9e7122f7dd884223e1846aed7d940507119ed69 fix: contain worker diagnostics before financial closure
a3bc2dbbc62a7372e4b0d27ad7ec329b77f54cec build: prepare standalone Staging client and supported Android ABIs
f337f7b4a37f3a30cd09d4e7f996e97215e822c7 feat: prepare authenticated Voice analysis without per-user allowlisting
dc88eb685b5edbda202dba557b8136b86a5fa627 fix: discard failed callback connections after rollback timeouts
3093f0a2347c588c981e4ec4d02ce1808124908e test: reproduce owner-only Voice admission for ordinary clients
4df94f0cde803ca49927eba98a5ea8dbc8279bf1 fix: retain sanitized root exceptions in scoped AI workers
46b1bd55324516aa4043a628029081b8b38c2544 docs: define authenticated Staging client recovery scope
```

## Appendix B. All preserved worktrees

Fresh read-only Git inventory; other worktrees' dirty/ignored contents were not audited. Every path/ref is preserved. No worktree was switched, archived or deleted.

```text
worktree D:/MY Work/0Part_Time/MASREFY _Final
HEAD ca01a4eb34d5c97c5df34264c5b6a9bca374b041
branch refs/heads/codex/ratibi-staging-security

worktree C:/masarifi-build-verify
HEAD c2d10b8eb37ec4d6cea0f859f0a0f94067d6e14f
detached

worktree C:/masarifi-main-integration
HEAD 730aa8c459d27d3849a6001d827cfa231f7ce81b
branch refs/heads/main

worktree C:/Users/DELL/.codex/worktrees/ai-voice-continuation/MASREFY _Final
HEAD bb9235f094b7b795f6debf25fe5f42ceca46ae16
branch refs/heads/codex/samsung-voice-acceptance-readiness

worktree C:/Users/DELL/.codex/worktrees/canonical-repo-migration/MASREFY _Final
HEAD 10cbfb54203e1847d2ab30d72b02444a58fe03c9
branch refs/heads/codex/masarifi-staging-environment

worktree C:/Users/DELL/.codex/worktrees/master-voice-repair/MASREFY _Final
HEAD a4d648ff642e77238a4c18c47fd9b84e2d9ea336
branch refs/heads/codex/staging-voice-owner-quota

worktree C:/Users/DELL/.codex/worktrees/staging-readiness/MASREFY _Final
HEAD e64f36c3b3250f928e4765dba8bd27af2bb7a0d3
branch refs/heads/codex/staging-readiness-review

worktree C:/Users/DELL/.codex/worktrees/tracking-staging-acceptance/MASREFY _Final
HEAD 3bd0c5d3149259ad69fb6a5e86083a820052b7f4
branch refs/heads/codex/tracking-final-automatic

worktree C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final
HEAD 0ad0c0410b77d83b1d665b72f2f6b9bf8c38c979
branch refs/heads/codex/voice-auto-batches

worktree C:/Users/DELL/.codex/worktrees/voice-auto-batches/MASREFY _Final/.superpowers/sdd/2026-10-08-automatic-voice/candidate-0cb
HEAD 976dd92fe73fccb0f4f9bde42e1fa41b8aa934bb
branch refs/heads/codex/voice-capture-time-and-home-order

worktree C:/Users/DELL/.codex/worktrees/voice-provider-diagnostics/MASREFY _Final
HEAD dc7d8617a7bcf8dcd372df310d4951dd7d3f402d
branch refs/heads/codex/voice-provider-diagnostics

worktree C:/Users/DELL/.codex/worktrees/voice-provider-verification/MASREFY _Final
HEAD 99eaa6c7a8534641ed704b76d7f05646da4d2993
detached

worktree D:/m
HEAD 8d07ecf8b483d11c852b2d53547a6e8a4ace9410
detached

worktree D:/Masarifi-integration-2026-10-10
HEAD 0be314d9246029ea2ab5210df45a4a9a2d050c30
branch refs/heads/codex/voice-auto-save-restoration-2026-10-11

worktree D:/MY Work/0Part_Time/MASREFY _Final/.worktrees/ai-assistant-voice-reminders
HEAD 3b3f45868a6fb9ba31efc5eecf6d6bba6e7a0019
branch refs/heads/codex/ai-assistant-voice-reminders

worktree D:/MY Work/0Part_Time/MASREFY _Final/.worktrees/backend-spec-be-001
HEAD ef1e7aea4c47a63710f8ece6fb5546e3772b1ae8
branch refs/heads/codex/backend-spec-be-001

worktree D:/MY Work/0Part_Time/MASREFY _Final/.worktrees/staging-readiness
HEAD 54cc83c60ee4ded5267c90b5bcf565746ea7c84f
branch refs/heads/codex/staging-readiness

worktree D:/MY Work/0Part_Time/MASREFY Backend Worktrees/backend-spec-be-005
HEAD b407931ca4635f1dcef3d7a9988a8fad506f1b74
branch refs/heads/codex/spec-be-005

worktree E:/Masarifi-release-verification-2026-10-10
HEAD b2a39f05f4a70c1cc73de50b884f0023115a1f56
branch refs/heads/codex/staging-release-verification-2026-10-10

```

## Appendix C. Seven preserved stashes

These remain unapplied/unpopped. Preserve the shared Git directory and all refs; a bundle is not a dirty-file archive.

```text
stash@{0} cd236fc2f1150ff10b9fcc8f7d272fb78c938c55 On codex/ai-assistant-voice-reminders-source: pre-main-merge device evidence and local plugin 2026-09-20
stash@{1} 920a79d6e625359e6adbbbd1ed4719dd2bd16384 On codex/complete-phase-06-offline-sync: transfer: phase06 verified implementation to main 2026-08-31
stash@{2} 2f6aa0a68f14524ba14bac3001046b32b07ee5d7 On main: recovery: relocate phase06 into dedicated worktree 2026-08-31
stash@{3} e15936b964ac4a260aaf751f0d7fd57657fbf908 On codex/complete-phase-06-offline-sync: recovery: phase06 after desktop handoff
stash@{4} 1f3f5d16596702b06ee128713f5cfb7dd0ccb5f3 On codex-mobile-foundation-validation: safety:old-root-before-single-worktree-2026-08-25
stash@{5} 97be511e0bfef1ea076383ffddfc3e9cceded126 On codex/r01-shared-ui-foundation: safety:r01-residual-before-worktree-removal-2026-08-25
stash@{6} 7dd099290eced31f2664dd6c47ee9d2bd9793da4 On codex/r01-shared-ui-foundation: safety:r01-before-single-worktree-2026-08-25
```
