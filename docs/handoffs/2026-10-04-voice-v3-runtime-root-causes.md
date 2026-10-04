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

## Candidate 4521214: exact release and Samsung gate-OFF verification

Runtime `45212149cb798a4ad2c52fb4affee2119cba6efb` passed [full CI 37237147797](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37237147797), including 460 mobile suites / 2,585 tests, database integration, five browser projects and container checks. All 78 performance failure flags were false. The existing mobile test worker-exit warning remains; this is not a leak-free test claim.

Staging serves the scanned immutable image `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:6d63135dbdb2398d91ff596c25912907ec5b47526fede5724e7de62844e0eaf5`. API health and the authenticated one-create admission probe identify this exact release. The precise gate-OFF rejection echoes its request ID. Five environment fingerprints were unchanged; the matching worker was recreated without starting it. No migration, Production change or merge occurred.

Fresh EAS build `e7c521ff-d2e4-4a03-b004-69aad3b4167b` came from the clean exact candidate. Its verified archive contains 2,580 tracked mobile files and no investigation/private files. Compatible internal signing preserves all 2,340 payload entries. Installed and pulled APK SHA256 is `51b994826cc5c380045851a85de99f95846f27fb3eddb05f8833ac20b6dc9100`. In-place installation completed at 01:15:47 Riyadh on October 5; first installation remains September 30 at 14:31:23. Login and the two zero-balance accounts were preserved.

Actual SM-A165F results:

- Ordinary denial: "Microphone access was denied. You can try again or enter the transaction manually." Permanent denial: settings guidance. Neither produced the former interruption error. Metadata traces show the permission Activity crossing background/active around the pending permission result.
- Grant: native recording starts once after Active; a 26,502-ms recording stops, hands off, reaches the definitive failed receipt and cleans up. Android granted permission and its original USER_SET flags were restored.
- Three online captures each attempt one create and zero upload/process requests. Native Stop is 100–115 ms, Stop-to-Ready 125–148 ms, Stop-to-terminal 1.400–2.808 seconds, then cleanup 26–34 ms. Recording B starts before A's terminal receipt. Processing presentation was observed after handoff, then resolves to "Some processing could not finish." No retained timer or Review/Confirm was shown.
- Offline process-death case: durable handoff occurs before force-stop. After Wi-Fi restoration and relaunch, a new process submits the same hashed capture identity once, receives 503, persists its terminal result and cleans up. This tests death after handoff, not the previously documented pre-journal orphan limitation.
- Arabic locale: the capture resolves to "تعذر إكمال بعض المعالجة." with one create, no upload/process and successful cleanup. This is Arabic UI/admission evidence, not Arabic speech accuracy. English locale and original Wi-Fi/mobile-data settings were restored.
- Cold Reports on this exact APK reaches Analytics. The earlier candidate's settled-content/background/navigation/cutoff evidence remains separately labelled; none is presented as new exact-candidate provider evidence.

At 22:14:57 UTC, posting remained OFF; v3 contexts/batches/transactions/postings remained zero and provider attempts remained 28. These device results verify the gate-OFF lifecycle and the permission repair. They do not prove provider extraction, server-terminal cleanup on a created v3 batch, or automatic financial acceptance. The original incident has no retained trace proving which conditional defect occurred.

### Remaining accuracy investigation

A separately versioned, nonposting diagnostic helper uses the production gateway, worker, compact parser and decider, with acceptance intercepted before financial/output persistence. Its initial independent review found cancellation skipped when a claim acknowledgement is lost, and insufficient identity binding of reviewed English evidence. Both were reproduced in offline regressions before repair; the combined parser/isolation/cleanup suite subsequently passed 22 tests in the exact image with network disabled and no environment credentials. Further operator-wrapper review and current-accounting checks are in progress.

No fresh provider request has been made. A fresh cancellation-only carrier/purge probe, exact audio decoding and reviewed dispatch prerequisites must pass before requesting English speech. Any legacy-carrier projection is explicitly partial-path evidence, never successful end-to-end v3 verification. Existing unknown-cost holds stay reserved; automatic posting remains OFF and the financial canary still requires explicit approval.

### Latest exact-candidate evidence and remaining human dependency

Additional Samsung checks on runtime 4521214 passed: background and navigation interrupt recording and discard audio without a create request. Automatic cutoff reports 59,816 ms, native Stop 19 ms, Ready after 48 ms, definitive gate-OFF result after 3.184 seconds and cleanup after another 34 ms. This remains admission/lifecycle evidence, not provider extraction.

The scoped diagnostic review's additional findings were reproduced and repaired in the isolated helper: cancellation after an unknown claim acknowledgement, binding reviewed English evidence to its actual identity, full environment/worker image guards and explicit recovery attempts that preserve earlier failed evidence. The exact-image, network-disabled harness passed 23 tests. Actual wrapper probes rejected 18 mismatched preconditions and allowed the explicit recovery attempt, with no network or database access.

A fresh cancellation-only legacy-carrier probe completed with zero provider calls. Its exact owned audio was cancelled and purged through the production storage and authoritative claim/complete lifecycle. Reconciliation confirmed no persisted extraction outputs, unchanged financial/accounting snapshots and prior unknown-cost holds, restored temporary role membership, and unchanged metadata for 23 protected unrelated sessions. The global worker stayed stopped. This establishes the cleanup prerequisite for a diagnostic, not successful v3 extraction.

The first audio adapter attempt failed before download because it treated a PostgreSQL bigint string as a number and incorrectly assumed the storage key's final UUID was the session UUID. The corrected adapter validates the actual production key format, exact owned baseline, bounded numeric length and hash. A second attempt decoded the cancellation-only Samsung AAC sample (17,201 bytes, 1,233-ms declared duration, 975-ms container duration, stereo 44.1 kHz). No intelligible speech was asserted; its human-fixture flag remained false. The raw sample was purged. That check used FFmpeg's permissive error behavior and must not be represented as strict error-free audio verification.

An independent negative test then proved that damaged AAC with valid container metadata could pass the diagnostic decoder. Before any paid dispatch, the decoder was changed to make decoding errors fatal, impose 15-second decode / 10-second probe deadlines, suppress raw decoder errors and emit bounded safe failure codes. The damaged fixture now produces no final proof; valid synthetic one-second AAC still passes the actual decoder and metadata normalization. These are diagnostic admission safeguards, not changes to the mobile recorder or provider prompt/parser.

The repaired 4521214 APK was restored in place after the cancellation-only carrier test at 01:56:53 Riyadh on October 5. A new pull independently matches SHA256 `51b994826cc5c380045851a85de99f95846f27fb3eddb05f8833ac20b6dc9100`; first installation remains September 30 at 14:31:23. Samsung is connected and authorized. At 23:06:06 UTC on October 4, posting was OFF, v3 contexts/batches/transactions/postings were all zero, and provider attempts were still the original 28. No fresh paid call has occurred.

The next dependency is the user being available to speak the fictitious English fixture. The current repaired v3 build rejects admission while posting is OFF, so recording that fixture on it cannot demonstrate extraction. Once availability is confirmed, prepare the reviewed temporary legacy carrier, collect exactly one consented English recording, bind the user's fixture confirmation to its exact session/audio hash, strictly validate it before the single guarded provider dispatch, then cancel/purge/reconcile and restore the repaired build. Stop if prerequisites fail; do not hide failures with retries. Arabic follows only after reviewing English. Any such result is partial-path production gateway/parser/decider evidence. Full v3 automatic financial acceptance still requires a separately approved canary and Samsung verification.

Remaining limitations: attribution of the original untraced Samsung incident, fresh English/Arabic speech accuracy, server-terminal cleanup on an actual created v3 batch, and process death before durable journal ownership. Conditional backend expiration/worker liveness hypotheses remain unproved and unchanged. No Production change, branch merge or financial write is authorized.

### User-reported recordings reproduced on October 5

The user reported fresh Arabic and English recordings that ended with "Some processing could not finish." A screenshot at approximately 02:17 Riyadh shows that exact terminal message and an available Voice control. Preserved metadata for the two fresh captures proves native durations of 4,864 ms and 30,900 ms; both passed file inspection and durable handoff, attempted exactly one create, received HTTP 503, then published terminal failure and completed cleanup. Stop-to-terminal was 2.688 / 3.079 seconds. Neither reached upload or process. The metadata does not independently identify the spoken language or establish intelligibility; the bilingual attribution is the user's report.

The request IDs are `5e8c446a-4a14-45c7-9ad8-9af04902fca7` and `db0df399-9a0a-4693-8350-8521b35fe78f`. A separate recovery request, `e3ddac63-a9ec-411f-99a7-64ca3c881f70`, returned 200. That status means status recovery succeeded; it does not mean audio analysis succeeded. At 02:19:00 Riyadh, posting remained OFF, contexts/batches/transactions/postings were zero and provider attempts remained 28.

The failing boundary for these fresh captures is admission before server session creation. The current SQL raises `VOICE_AUTOMATIC_UNAVAILABLE` before create when policy.enabled is false; the API maps it to 503. The precise-code mobile branch retires that known rejection, unlike ambiguous generic 503. This explains the observed terminal UI without attributing the older untraced incident or claiming an extraction defect was exercised. Repeating ordinary v3 recordings while this gate is OFF will not invoke analysis.

An explicit ongoing goal now tracks real Samsung Arabic/English recording and analysis, expected successful API responses, and up to ten independent events. Financial posting remains OFF and the first financial canary still needs separate explicit approval. A successful unrelated route or a mocked parser result cannot satisfy that goal.

Before paid diagnostic work, the separate human-fixture confirmation was completed: it binds the actual user's confirmation to candidate, locale, fixture version, exact session hash, decoded audio hash, size and duration. Raw decoder evidence stays immutable with humanFixtureConfirmed=false; provider admission validates a transient confirmed copy before authorization. One failing missing-function regression became green, and all 24 isolated harness tests pass. Scoped independent review found no Critical or Important defects in this delta. No real fixture confirmation or fresh paid dispatch has occurred. Await availability for the controlled English fixture, then test Arabic only after English results and cancellation/purge/accounting are reviewed. Keep the repaired 452 APK installed while waiting.

### First fresh English extraction diagnostic: passed, partial path

After the user confirmed availability, the verified legacy carrier was installed in place at 02:25 Riyadh. Read-only preparation identified exactly one new owned English v2 upload, duration 18,826 ms, with zero attempts. The user replied to the quoted breakfast/salary fixture that they had recorded it; this reply was treated as confirmation of that fixture. Session hash is `61c91b72f7cfabbcd04ee5c2c78bae287e51984d66bc9fb7387c18f13279f3ee`. Strict decoding passed: 301,520 bytes, hash `50d476c09fd3575f00e2e6220ad03e177af55aa21bc9b505105ad8416a014e34`, AAC stereo 44.1 kHz, container duration 18,552 ms. The diagnostic download emitted an extra-CA-file warning because the previously prepared wrapper mount had not yet been uploaded; default TLS verification was not disabled. The corrected wrapper is now uploaded; no audio or provider replay was performed.

The 452 APK was restored before dispatch. Exactly one production gateway call returned HTTP 200, with 2,737 input / 208 output tokens, recorded cost USD0.0013411, gateway latency 2,268 ms and worker duration 3,714 ms. The provider declared complete English output with two events. Both expected occurrences and every compared kind/amount/account/category/currency/date/source field matched. Raw provider values, actual compact parsing and canonical decisions agreed; production acceptance was intercepted before output/financial persistence. No prompt, provider, model, cap or budget change was made. This sample does not reproduce the historical missing/wrong-amount complaint.

Cancellation, storage deletion and subsequent authoritative purge/reconciliation passed. All 23 protected foreign-session snapshots and temporary membership were unchanged/restored. The diagnostic had exactly one accounted provider attempt, no uncertain current cost, no persisted extraction outputs, unchanged financial fingerprint and prior cost holds, and policy OFF. At 02:33:07 Riyadh, v3 contexts/batches/transactions/postings remained zero; attempts increased only from 28 to 29. A fresh pull of the restored APK again matched `51b994826cc5c380045851a85de99f95846f27fb3eddb05f8833ac20b6dc9100`. The leftover legacy diagnostic error was preserved in a screenshot, then cancelled through its existing safe UI to return the capture to Ready; no Retry/Confirm was pressed.

The initial English review marker mistakenly contained a 17-character run suffix and failed before Arabic authorization. Its marker/log were preserved; the corrected suffix is derived from the actual full session hash. The production prerequisite validator subsequently passed against the exact provider and after-purge receipts. No second English call or hidden retry occurred.

Evidence proves native English audio and actual production gateway/parser/decider accuracy for this two-event fixture through a legacy carrier. It does not prove a created v3 batch, full result presentation, automatic financial execution, Arabic accuracy or ten-event acceptance. The ongoing goal remains incomplete. Arabic preparation may proceed only because the reviewed English cleanup/accounting prerequisite now passes.

### Arabic recording dependency: closed window and restored device

The Arabic carrier/locale and read-only references were prepared, opening a capture window at 02:38:10 Riyadh. Across consecutive goal turns, ownership-scoped checks at 02:39:42, 02:43:00, 02:44:18 and 02:52:02 each found zero new captures. No human Arabic recording confirmation arrived. No Arabic session was pinned, no Arabic provider call occurred, and no automatic retry or synthetic speech was substituted.

The window was closed by preserving its preparation as `samsung-ar-prepared-window-1-closed.json`; no active Arabic manifest exists. English locale was restored, then the repaired 452 APK was installed in place at 02:51:08. Its new pull again matches `51b994826cc5c380045851a85de99f95846f27fb3eddb05f8833ac20b6dc9100`. First installation remains September 30 at 14:31:23, login/data are preserved and Home Voice is available. At 02:53:00, policy remained OFF, contexts/batches/transactions/postings zero and provider attempts 29. The ordinary worker remains stopped.

The active goal is blocked on the required human Arabic recording after the same dependency persisted across three consecutive goal turns. It is not achieved. Resume with the user available and an explicit "Ready for Arabic" reply; prepare fresh read-only references in the canonical context, preserving the closed window and the reviewed English receipts. Do not ask the user to record on the currently restored v3 build while admission remains OFF. After the controlled Arabic result, continue the unverified ten-event and full v3 gates without treating this partial English diagnostic as completion. The first financial canary still requires separate explicit approval; no such approval has been given.
