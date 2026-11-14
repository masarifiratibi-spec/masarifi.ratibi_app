# Second-phone SMS tracking repair — 2026-10-22

The bounded second-phone SMS cases below passed on the final installed repair. Overall application acceptance remains incomplete.

## Scope and device

The owner confirmed the original dated SMS and later undated SMS describe the **same** financial operation. Keep one ledger effect. The owner authorized phone control, tracking repairs, a preserving APK update, and one distinct small test operation. Do not replay historical SMS or financial queues. Preserve DEV data.

Ordinary package `com.masarifi.mobile`, Xiaomi `23076RN8DY`, Android 15/API 35, Riyadh timezone. READ_SMS, notification-listener access and notification presentation permission were independently granted. These permissions are separate.

## Evidence and repairs

- The original short-date SMS reached session `4adb980a-7856-4f2b-a192-108a76dccc42` but was repeatedly deferred with `date_ambiguous`. The parser did not support its unambiguous short hyphen-separated date without time. Support now covers provable day/month order and receipt-anchored short years. Unknown senders use the device timezone; a known provider's timezone takes precedence. Ambiguous and impossible dates remain reviewable.
- The server deferred an ambiguous date without creating actionable review. The additive finalization wrapper now routes this specific case through the existing review creation function under its claim/lease fence. Review date editing also covers invalid embedded dates.
- Review rejection previously left its import status/counters stale. Normal reconciliation can now close terminal reviews; the existing review decision transaction also updates its import immediately. The migration's bounded reconciliation updates receipts and counters, without submitting financial commands.
- The original first capture was opened on the phone and rejected because the owner identified it as the same operation already saved from the second SMS. Both sessions now read `complete`: first rejected=1/accepted=0, second rejected=0/accepted=1. Exactly one linked transaction, `4f9b9511-3029-4b31-863e-be9eace7acad`, remains confirmed.
- Ordinary Staging builds previously skipped verified-save presentation because it was restricted to DEV. Both ordinary and DEV Staging builds now use the owned posted-ledger verification and encrypted durable notice deduplication. The native alert channel also supports the ordinary package.
- The installed repair presented the original durable notice `4bfec2b4-a1c0-48a3-8cd5-4f7a2353db17`. Android reports channel `masarifi-tracking-saved-v1`, importance 4. This is a notice recovery, not another financial write.
- Source switches previously remained locked while full capture/sync finished. They now refresh from persisted source preferences and release while synchronization continues separately. Activation/deactivation has explicit progress copy. Pending status reads are cancelled before updating the saved preference cache.
- Removed the manufacturer/battery warning link and its misleading permission-page navigation. The three explanation rows and notification description are shorter. Scan, processing and sync failure have distinct text. Physical SMS off/on observations retained the independent notification toggle; both switches were enabled again within the first UI dump (approximately 5–6 seconds including ADB and dump overhead, not a precise animation latency measurement).

## Deployment and final validation

Staging migrations: `20261022114825_tracking_deferred_date_review`, `20261022115801_tracking_resolved_review_completion`, `20261022121206_tracking_review_decision_completion`. Their local filenames match server migration versions. Existing execution grants remain restricted.

- Parser: 100 tests passed.
- Mobile tracking: 7 suites / 265 tests passed on the final source, including 25 save-confirmation tests.
- Native notice: 3 tests passed.
- Real disposable Postgres tracking integration: 86 tests passed, including ambiguous-date review, immediate review closure, correct local calendar day, and repeated-reference deduplication.
- Mobile/API type checks and scoped lint passed. Migration checksums and `git diff --check` passed.
- Final release build succeeded in 7m20s. The JS-only final rebuild reused native code whose release lint and three presentation tests had already passed; final rebuild skipped release lint.
- Final APK: `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-tracking-repaired-arm64.apk`, SHA256 `b86b9cbfb3dacbc6d0e07eaa112ea0da842689f33b3db92a110f4ebd6c363db7`, 64,679,108 bytes. Ordinary `com.masarifi.mobile`, arm64, non-debuggable, standalone Staging. Signing certificate matches the existing installation. Nine changed runtime files matched actual packaged source-map contents. The installed `base.apk` independently has the same SHA256.
- Installed with `adb install -r`, retaining data. DEV was not operated on. This is a working-tree build based on `6d7619c03cf8c981232244c2d07d46a6fac3cb77`, not a pushed clean commit.

## Fresh physical test and repeated carrier SMS — passed

The owner sent a distinct small test SMS after installation and source reactivation. A bounded inbox read confirms native row 355, received `2026-10-22T12:16:55.342Z`, with the short date and a reference. Only structural/sanitized metadata was emitted. Local parsing produces SAR 0.01, completed outgoing payment, no reason codes, and `2026-10-21T21:00:00Z` (22 October in Riyadh).

Initial capture of this retained SMS was blocked before submission because confirmation of an older accepted receipt awaited whole-finance cache synchronization, which failed with `INTERNAL_ERROR`. Bounded diagnostic logging identified the `confirm_saved` / `finance_sync` path without logging messages, senders, credentials or responses. The ordinary qualified Staging path now verifies the owned posted ledger and presents its durable native notice independently; finance synchronization retains its separate refresh/retry path. No historical inbox replay or financial queue replay was performed.

After the final preserving update, the retained SMS reached session `b468ed23-956c-436e-9b83-fcbcf1a0a84b`, item `9d964a4f-94cf-4694-967b-677d9850a886`, and transaction `a9bdc873-b171-4338-93d2-9abde8f8adf8` at `2026-10-22T13:00:46Z`. The session is complete, accepted=1/rejected=0. The transaction is confirmed, SAR 0.01, occurred at `2026-10-21T21:00:00Z`, correctly representing 22 October in Riyadh. Native Android presentation was observed for notice `3da44002-6c5f-490f-ae7e-b816f0ab34d3`, channel `masarifi-tracking-saved-v1`, importance 4.

The owner then resent the exact same synthetic SMS with its same reference while the app was in the background. Session `7a86a3f8-6444-45f4-a2eb-ba5c88b9053f`, item `12fcc81d-01af-4a30-a7ef-675a10e24c94`, was captured at `2026-10-22T13:02:36Z` and completed accepted=1/rejected=0. It links to the same transaction. Final bounded server evidence at `13:07:17Z` confirms two accepted observations, one distinct test transaction, and one durable notice (linked through `notification_events.data.targetId`). Android still has exactly the same one active notice after returning to the application. The original dated/undated operation likewise retains one linked transaction and both sessions are complete.

On final resume, both source switches are on and enabled. The temporary scan state clears. The shortened three-row explanation is visible; the marked manufacturer link and its navigation are absent. No persistent loading or tracking sync-error banner appeared at the final screen observation. Final screenshot: private `phone-tracking-final.png`.

## Remaining limits

The subsequent [local finance sync repair](local-finance-sync-repair.md) resolved the separate `INTERNAL_ERROR` by promoting the already-correct snapshot-read API for ordinary Staging sync requests. All three domains acknowledged local application after app resume and cold restart, with the transaction count unchanged. Offline financial browsing was not tested. Broader notification-source coverage, second-owner registration, overall application acceptance and client release remain outstanding. The physical duplicate case proves the exact repeated SMS/reference tested here, not all independent messages with equal amounts or arbitrary historical variants.

Private local evidence: `D:/Masarifi-preservation-2026-10-18/second-phone-tracking-repair-20261022/`. Do not commit private backups, message bodies or credentials.
