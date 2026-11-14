# Native owner-scoped Tracking foundation — 4 November 2026

Status: native foundation qualified locally; JS integration and actual-device acceptance are pending. Production remains NOT READY. This is not a replacement APK release or a claim that customer Tracking is complete.

## Behavior

The Android module now offers a V4 bridge for storage-format v3. Admission has durable per-owner prepare records and an atomic active-owner/generation/commit receipt. Preparation suspends intake; commit validates the exact prepared owner/generation, disabled capture and any same-owner legacy proof before accessing payloads. A native commit alone is not authentication: the JS consumer must complete its verified account/profile admission before acknowledging the native record.

New owner-scoped contexts, encrypted notification queues, presentation records, capture consent, diagnostics and counters use separate namespaces. Foreign/unattributed legacy bytes and keys are retained. Eligible same-owner migration copies pending payloads without modifying original ciphertext. Returning to an admitted owner does not copy old data over newer pending work. Missing retained keys never trigger key recreation or ciphertext replacement.

Legacy unscoped bridge operations cannot operate on admitted v3 storage. V4 operations require the current owner/generation lease. WorkManager continuation producers and consumers carry and verify that lease before queue reads or scheduling. Explicit current-owner cleanup is retryable; deletion has its own durable journal/completion receipt and never clears another owner's selector, queue or keys. These cleanup tests ran only against synthetic Robolectric data; no phone data was cleared or deleted.

## Verification

- Complete native module suite: 10 classes / 75 tests, zero failures, errors or skips; Gradle exit0 after the final source change.
- Mobile TypeScript and targeted native-bridge ESLint: exit0. No dependency, build-profile, signing or hosted configuration changed.
- New regression groups were observed RED before their corrections: legacy owner-switch erasure; prepared/admission failure recovery; source/metadata isolation; lost-key preservation; deletion/retry; malformed selectors/receipts; prepared-proof tampering; stale native continuation jobs; cleanup retry after suspension/deletion.
- The unavailable JVM AndroidKeyStore boundary uses public synthetic keys; real preferences, AES/GCM and actual native runtime/worker code execute. This does not qualify physical Android key storage, an APK signature transition, R8 or phone lifecycle behavior.

Private commands, terminal receipts, source hashes and XML results remain under `.superpowers/sdd/2026-11-04-production-apk-readiness/`. Raw private device/auth material is not part of this report.

## Remaining acceptance

Connect JS durable intents, owner-bound preferences/queues and authoritative profile admission; prove every cross-store crash window, no historical inbox backfill, cleanup/logout behavior and native leased adapters. Then qualify production installation consent, hosted compatibility, signing, a clean exact-source APK and real Redmi capture-to-Ledger-to-confirmation. The installed phone and delivery artifacts have not changed during this native task.
