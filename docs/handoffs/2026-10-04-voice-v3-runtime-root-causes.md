# Voice v3 runtime investigation: root causes and evidence

## Baseline and attribution

Investigation started from clean HEAD `6a3a36d` / runtime `1975ef2`, hosted Staging API `c6daa22`. Samsung installed APK was pulled without changing app data: SHA256 `5c574e2b9ffa59d864daf7786ece0db40e9d334a73bb8429a74829a1304fc504`; install timestamp remains 21:00:07 Riyadh. At 19:30:20 UTC, posting was OFF, v3 contexts/batches/transactions/postings were zero and provider attempts remained 28. No fresh recording or provider call occurred.

The release app blocks `run-as`; bounded existing logcat has no voice trace. Thus none of the conditional native/cleanup defects below is yet attributed to the user's Samsung recording.

## Admission mismatch: reproduced through real Home flow

`voice-batch-unavailable.test.ts` now exercises HomeSummary, VoiceCaptureProvider, useVoiceBatches, createVoiceBatchApi and the actual SQLite journal. Only native recorder/network boundaries are substituted. English and Arabic both reproduce:

- Generic 503 AI_UNAVAILABLE: capture Ready, batch Checking, durable captured identity/audio retained, exactly one create request and no upload/process. Recording B starts. This is appropriate conservative handling of an ambiguous server reply.
- Precise 503 VOICE_AUTOMATIC_UNAVAILABLE: capture Ready, terminal local failure, no upload/process or Review/Confirm; recording B starts.

The deployed c6 API maps the known pre-create gate rejection generically, while the current mobile requires the precise rejection to distinguish it from a possibly accepted create. The compatible response repair already exists in 1975; its deployment remains pending. Do not weaken generic-503 recovery to hide this mismatch.

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

The original verified-key SSH timeout is resolved as recorded below. Staging still serves c6 and candidate artifact alignment/device verification remain pending. Posting remains OFF throughout nonfinancial investigation.

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
