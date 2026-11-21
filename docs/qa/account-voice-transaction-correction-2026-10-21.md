# Selected-account voice and manual kind correction — Staging acceptance

Date: 2026-10-21. Worktree: `D:/Masarifi-integration-2026-10-10`. Branch: `codex/voice-promoted-operating-2026-10-13`.

Runtime source: `7a18a54730e8c8f896dcf7f179ff467a137ba19c`. Follow-up changes contain tests and documentation only. Production was not deployed or enabled.

## Manual correction

The mobile service, strict API DTO and versioned database revision previously rejected kind changes. They now allow manual income/expense correction through the existing PATCH operation. The original postings remain unchanged; reversing the old effect and applying the new effect happen atomically on the same transaction. Existing owner, currency, recent-auth, refund and version checks remain enforced.

Receipt validation checks the net effect of adjustment postings. Reversed originals retain their own financial effect because compensation belongs to a separate reversal transaction; only deleted originals have zero net effect.

On the Samsung DEV installation, a new synthetic manual EGP expense of 3 was created, changed to income, changed back to expense, then changed to income again. Both directions completed and returned to the list after final routing. The same ID reached version 4 with seven append-only postings and a net income of 300 minor units. The synthetic manual transaction was deleted through the normal app UI; version 5 had zero net effect and its account balance returned to the pre-test value. No pre-existing customer transaction was edited.

Changing type clears its incompatible category; the user must choose a category for the new type before saving.

Physical acceptance caught a deployment dependency: `/api/v1/accounts/:id/summary` still used an older API whose income mapper required an original destination posting. That caused a refresh error after a successful correction. Its Staging route now uses the same corrected API as transaction reads and writes. Integration coverage now reads the account summary after each correction.

## Voice capture and posting

The selected account is frozen when recording starts, persisted in the durable batch journal and included in session creation. The server validates active ownership and enabled currency before saving the context. Missing selection retains the server default. The selected account is included even beyond the twenty-account reference window; the separate assistant branch remains unchanged.

Staging's prior public voice ingress was analysis-only, with a separate DEV-owner exception. A new Staging API candidate uses normal automatic admission without a configured owner restriction. Existing operating worker, epoch, provider, quota, idempotency and authorization controls were preserved.

The user made two fresh physical recordings with account and currency omitted from speech:

| Selected account | Result | Server evidence |
| --- | --- | --- |
| Non-default EGP wallet | Expense 1 EGP | Contract 3 session confirmed, batch completed, event committed, source voice, posting account matched captured account |
| Non-default SAR card | Income 2 SAR | Contract 3 session confirmed, batch completed, event committed, source voice, posting account matched captured account |

Both appeared on the phone with the expected balance change. The two explicitly requested voice test transactions remain. Independent-owner admission, foreign/archived rejection and account-window coverage were tested with synthetic database rollback fixtures and service tests; physical recordings used one signed-in user. This is evidence for the general owner-scoped path, not a claim that every device or every customer has been physically tested.

After a cold reopen, there were still exactly two new sessions and two committed events, with no duplicate posting. The operating epoch remained active with a fresh worker heartbeat.

## Verification

- Mobile: 6 suites / 275 tests passed; standalone DEV journal/header suite rerun: 55 passed.
- API final: 5 suites / 110 tests passed, comprising 106 unit and 4 actual PostgreSQL receipt integration tests.
- OpenAPI: 3 contract suites / 21 tests passed.
- Mobile/API typechecks, API build, scoped lint and migration checksums passed. Mobile lint has three existing require-import warnings and no errors.
- Both forward migrations applied to the Staging project. Synthetic voice and kind-revision SQL rollback scripts passed against deployed functions, leaving zero fixture profiles.
- Review findings fixed: accidental assistant alias substitution and reversed-original net validation.

## Deployment and build

API candidate: `masarifi-account-voice-api-7a18a547`, loopback port 3026, healthy. Existing containers retained their IDs, images and start times. Only the Staging transaction, voice and account-summary routes changed. Nginx validated before reload; snapshots for rollback are retained in `/opt/masarifi/account-voice-staging-7a18a547/`.

Admission configuration: analysis-only false, no DEV-owner restriction, AI provider enabled. The existing voice operating worker remained healthy.

DEV package: `com.masarifi.mobile.dev`. APK: `D:/Masarifi-preservation-2026-10-18/voice-account-edit-20261021/masarifi-dev-7a18a547.apk`.

APK SHA-256: `5c245ce22142b850df5c26b463781995ec016bcf228e5a8723b5ce114750e7e6`.

All six changed mobile runtime files matched the embedded source map. The APK signature matched the existing DEV certificate. Installation used `adb install -r`, and the installed APK hash matched the artifact. No app data was cleared.

Local evidence, screenshots, logs and deployment helper are in `D:/Masarifi-preservation-2026-10-18/voice-account-edit-20261021/`. They are not committed because physical screenshots and financial evidence may contain private user data. No credentials or audio content are included in this document.
