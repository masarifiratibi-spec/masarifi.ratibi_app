# Voice v3 runtime investigation: root causes and evidence

## Baseline and attribution

Investigation started from clean HEAD `6a3a36d` / runtime `1975ef2`, hosted Staging API `c6daa22`. Samsung installed APK was pulled without changing app data: SHA256 `5c574e2b9ffa59d864daf7786ece0db40e9d334a73bb8429a74829a1304fc504`; install timestamp remains 21:00:07 Riyadh. At 19:30:20 UTC, posting was OFF, v3 contexts/batches/transactions/postings were zero and provider attempts remained 28. No fresh recording or provider call occurred.

The release app blocks `run-as`; bounded existing logcat has no voice trace. Thus none of the conditional native/cleanup defects below is yet attributed to the user's Samsung recording.

## Admission mismatch: reproduced through real Home flow

`voice-batch-unavailable.test.ts` now exercises HomeSummary, VoiceCaptureProvider, useVoiceBatches, createVoiceBatchApi and the actual SQLite journal. Only native recorder/network boundaries are substituted. English and Arabic both reproduce:

- Generic 503 AI_UNAVAILABLE: capture Ready, batch Checking, durable captured identity/audio retained, exactly one create request and no upload/process. Recording B starts. This is appropriate conservative handling of an ambiguous server reply.
- Precise 503 VOICE_AUTOMATIC_UNAVAILABLE: capture Ready, terminal local failure, no upload/process or Review/Confirm; recording B starts.

The baseline c6 API maps the known pre-create gate rejection generically, while the current mobile requires the precise rejection to distinguish it from a possibly accepted create. The compatible response repair already exists in 1975 and is now deployed in candidate 52b9211. Do not weaken generic-503 recovery to hide this mismatch.

## Demonstrated conditional defects: RED before repair

1. Server terminal retirement awaits native deletion before the durable phase/bodies update. Three status regressions return `blocked by cleanup`; a rejection regression leaves phase=created and createBody retained. Root boundary: finish() in voice-batch-api-service.ts. Intended repair: durable terminality first, detached bounded cleanup with retained URI and owner/revision fences.
2. Native Stop only bounds stop/completion, then awaits file inspection without a deadline. Regression reports `file check still pending` after 5001 simulated ms. Root boundary: finish() in voice-recorder-service.ts. Intended repair: bound file inspection and ignore late results after release.
3. Native release awaits discard deletion before clearing active capture. Rejected-Stop regression reports `discard still pending`. Root boundary: release(). Intended repair: release native capture ownership independently, retain bounded cleanup responsibility and preserve the original error.
4. OperationsJobRegistry's voice prefix does not include voice-media.purge. The real registry regression rejects ENGAGEMENT_JOB_UNKNOWN instead of invoking AI. Intended repair: route this exact governed key to AiWorker; no scheduler start or unrelated claims.

Evidence is in the separate ignored runtime-investigation workspace: admission-terminal-red-2.log (20 pass / 4 expected failure), native-red-2.log (12 pass / 2 expected failure), purge-red.log (18 pass / 1 expected failure). First attempts had fixture setup failures and are preserved; only corrected reproductions support these findings.

## Boundaries not yet proved as this incident's cause

Additional source hypotheses are now reproduced with RED tests before repair:

- `useVoiceBatches.test.tsx`: an older recovery snapshot replaces completed with analyzing; the completed capture reappears as pending. The hook lacks monotonic receipt and settled-capture filtering within an owner generation.
- The same suite renders two cancellation controls for one local capture/server session. The recovery API does not expose the local session association to the hook/UI.
- `presentation-red.log`: real Home removes the polished progress display after handoff even while the batch remains unresolved; the capture handoff leaves durationMs=3000 in Ready. These are independent UI/state defects, not evidence of a slow provider.

Provider accuracy, Samsung audio validity, stale receipt ordering, cold-start routing, finalizing expiration and shared-worker liveness require their own evidence. Existing CI and synthetic parser tests do not establish real speech accuracy. No provider/model/prompt/schema or financial execution change is justified by this report.

## Remaining live gate

The original verified-key SSH timeout is resolved as recorded below. Staging now serves 52b9211; the matching fresh APK and Samsung verification remain pending. Posting remains OFF throughout nonfinancial investigation.

### Access restored after diagnosis

Authenticated Hostinger web console proved SSH active/listening and UFW limited to old client IPs. Current IP 77.232.123.178 was absent. Under the user's explicit attachment authorization, one TCP22 source-specific rule was added; no broad allow, rule deletion, key rotation or service restart. Existing verified-key SSH now works. Docker confirms only Staging API/worker/ClamAV: API c6 healthy, worker Created/not running. Exact candidate alignment remains pending. Screenshot and command evidence are in the investigation workspace.

### Cold Reports root causes reproduced before repair

Two actual provider/store regressions fail: a late initial URL never navigates (zero router calls), and an early initial URL is lost during actual live owner-scoped hydration (pendingDestination becomes null). The second test substitutes a realistic owner digest so it exercises scoped storage rather than the unscoped default native test stub. Root boundaries: initial URL retained without navigation, then authenticate resets state/loads the owner destination. Intended minimal repair: retain the one safe initial link through bootstrap, apply it through current access gates after owner hydration, and fence stale destination writes/navigation. No identity/voice state is carried across owners.

### Final independent review: additional RED evidence

The fresh whole-source review found three Important gaps. `final-review-red.log` reproduces four failures before repair: Stop/cancel remain pending when capture-level deletion never settles; a newer runtime Reports link is erased during actual owner hydration; and a pause during asynchronous owner lookup still permits a stale cleanup journal write (URI unexpectedly becomes null). Root boundaries are capture-level remove() waits, runtime URL retention, and epoch comparison before the await. Required repairs are bounded retained non-journal cleanup independent of lifecycle flags, retention of the newest safe link through bootstrap, and epoch/owner comparison after asynchronous lookup. These tests do not attribute the historical Samsung incident.

Those three findings are repaired locally. The final focused run passes 77 tests, including a failed v3 journal handoff with hanging deletion followed by another recording and Stop. Non-journal cleanup retains URI ownership in process memory across component/owner changes and retries cleanup when another recording starts; durable batch cleanup remains in SQLite. Process death before journal ownership can still lose this in-memory cleanup queue and is a remaining retention limitation, not a claimed solved path.

## Source verification before candidate release

Mobile full post-review run: 460 suites / 2,578 tests passed. A final metadata-only operation allowlist additionally passed diagnostic/service checks (28 tests) after its privacy regression failed first; request logs distinguish create/upload/process/status/cancel/recovery without URLs. Mobile/API type checks and frontend quality boundaries pass. API unit 132 suites / 1,175 tests, contract 79 / 235, and nonlive integration 29 / 101 pass; 77 integration suites / 283 database-dependent tests are skipped locally and require exact candidate CI. API lint/build pass. Mobile lint has zero errors / 104 warnings; inherited Jest force-exit warnings remain. None of this establishes real Samsung audio or provider accuracy.

At 20:13:36 UTC, readonly Staging still reports posting OFF, contexts/batches/transactions/postings zero and 28 historical provider attempts. No fresh provider dispatch, transaction, Production change or merge occurred.

## Exact candidate CI and Staging verification

Runtime candidate: `52b9211e961d61a21b2169b9393da2dbba6b1e7c`. Full [CI run 37232024322](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37232024322) succeeded with `run_k6=true`. Five browser projects passed 355 tests; real database integration passed 105 suites / 380 tests (one existing opt-out suite / four tests skipped); container checks passed 10 suites / 23 tests. All 78 performance failure flags across ten summaries were false. Tag-only signed release evidence was not applicable to this branch run.

The scanned immutable image is `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:01a82a42fb27c4e87b7c8c61678c77ef71680036a970dfc765eff95c1fa4b3b4`. The guarded Staging deployment replaced the API and recreated the matching worker without starting it. Public health reports the exact candidate; all five environment-file fingerprints remain unchanged. No migrations were executed.

An authenticated bounded admission probe returned HTTP 503 `VOICE_AUTOMATIC_UNAVAILABLE` with the submitted request ID echoed. Only create was attempted; upload, process, provider and financial execution were not reached. Known rejection logging did not produce an API log entry for that request; response-header correlation is the available evidence. This is server contract verification, not Samsung acceptance.

The two historical English/Arabic media references were purged through the candidate's actual AiStorage and authoritative claim/completePurge lifecycle. Original c6 capture provenance was preserved. Bounded locks protected unrelated due rows; metadata and role membership were unchanged after release. Both subsequent reconciliation checks confirmed purge, unchanged financial snapshots and unchanged budget/unknown-cost holds. No provider dispatch occurred.

At 20:56:56 UTC, Staging remained posting OFF, contexts/batches/transactions/postings zero, and provider attempts 28. Fresh preview EAS build `19dfadfb-5c65-48f4-a11a-823bc485390b` was submitted from the clean exact candidate; its archive contains only tracked source and no investigation evidence. Installation, actual Samsung audio validity, fresh provider accuracy and complete v3 financial acceptance remain unverified.

## Samsung candidate 52b9211: observed permission-boundary defect

The fresh APK was installed in place at 00:16:04 Riyadh on October 5, retaining first installation date, login and app data. Pulled installed SHA256 is `c2a917284d29b7a42fbd54377772f463885b7fcfcbc7cba5d416ada92a3dc8d6`; all 2,340 payload entries match the exact EAS source build after compatible internal-test signing.

Granted-permission gate-OFF recordings passed: three captures each attempted exactly one create, no upload/process, terminal failed receipt and local cleanup. Native Stop took 97–119 ms, Stop-to-Ready 126–148 ms, Stop-to-terminal 1.822–2.553 seconds. Recording C started before B's terminal receipt. Automatic cutoff also completed (reported native duration 59,817 ms), with terminal rejection and cleanup. Background/navigation interruption stopped and discarded audio without journal/create. Cold Reports reached Analytics and loaded content.

Permission testing exposed a separate real device failure: both denial and first-time grant show "Recording was interrupted. Record again or use manual entry." The granted permission is confirmed by Android, but that tap does not start native capture. Screenshots/XML and bounded diagnostics are retained. The current runtime cancels `requesting_permission` when AppState backgrounds, invalidating the pending permission result; an Android system permission Activity can cross this boundary. The previous inactive-only regression does not exercise that transition. Reproduce background/active around the pending real hook permission promise before choosing a repair; preserve cancellation of an actual preparing/recording capture and never start native audio while backgrounded. Microphone permission has been restored to its original granted state. This finding requires another candidate and Samsung verification; it does not invalidate the granted-permission gate-OFF evidence above.

The actual hook reproduced three failing permission outcomes (denied, permanently denied, granted), with 38 existing tests passing. The minimal local repair preserves the permission promise across the system Activity, bounds the wait for foreground to five seconds, and checks ownership again before native start. Focused tests pass. A second callback ordering was then reproduced before its repair: if denial resolves before Activity resume, permission refresh replaces `failed` with `permission_required`, hiding the error (two RED tests). Preserve failed denial while it remains denied, and allow a genuine later grant to refresh to Ready. These repairs must be verified in a new Samsung APK; candidate 52 remains the baseline of already-passed granted-permission checks.
