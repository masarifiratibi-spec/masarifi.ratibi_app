# Ordinary second-phone local finance synchronization — 2026-10-22

Status: **passed for the bounded physical cases below**. This supersedes the local-cache sync limitation in `second-phone-tracking-repair.md`; it does not establish overall application acceptance.

## Cause and repair

The installed ordinary app called the default Staging sync bootstrap/delta ingress, which still selected port 3001. That API used `BEGIN ... REPEATABLE READ READ ONLY`. Its `private.get_sync_bounds` call invokes `private.assert_active_profile`, which takes `SELECT ... FOR SHARE` to fence profile suspension/deletion. PostgreSQL correctly rejected that protection lock in a read-only transaction (SQLSTATE 25006), surfaced to the client as `INTERNAL_ERROR`.

The source repair already existed in commit `e72a99b172424973eaa2c5a2dedfcc8be308d015`: retain repeatable-read isolation while permitting the profile protection lock. It had been deployed to the isolated snapshot-read API on loopback port 3020, but ordinary sync requests still used the old default. No database function, profile protection, role grant, or ledger data needed changing.

Using the owner's Hostinger web terminal after direct SSH timed out, verified the running target's Staging project, API process, exact loopback port, non-root/read-only container configuration, health 200 and compiled sync module SHA256 `bdd9624c64df869c6e942314f7c2537946d0c78093e8ab2aee82b4fcad2faae9`. Target container: `ae727700013ef9bc9e7b3cbaea595143baebd9e7bae5c6f22fd54dfcc862ac73`.

At `2026-10-22T13:32:49Z`, changed exactly the default upstream assignment in the existing `/api/v1/sync/(bootstrap|delta)` location from port 3001 to port 3020. The DEV condition, other routes, containers and financial writes were unchanged. `nginx -t` passed before/after, nginx reloaded, unauthenticated public bootstrap still returned 401, and container IDs/states were unchanged. The patch rejects missing, repeated or already-promoted route anchors.

- Before config SHA256: `2e2b58e9ebe5acc5ecbec4605bbaed81802d6517860066b4fe4f55fade3637e1`.
- After config SHA256: `31301e27c668b660fda091df199f1d84d544f0fb0a72062b0fc45dde17832727`.
- Server backup/receipt: `/opt/masarifi/ordinary-sync-readiness-20261022/` (private; failed activation restores the saved config and reloads nginx).

## Same-phone acceptance

Ordinary `com.masarifi.mobile` on Xiaomi `23076RN8DY`, Android 15, ADB serial `f66a40694eca`. Retained the previously installed tracking repair, SHA256 `b86b9cbfb3dacbc6d0e07eaa112ea0da842689f33b3db92a110f4ebd6c363db7`; installed `base.apk` was independently matched again. No APK replacement, data clearing, DEV-package action, historical SMS replay or financial queue replay was needed for this repair.

Before the route change, the owner had five non-deleted server transactions, zero client mutation receipts and zero sync-domain states. After normal app resume, all three domains bootstrapped. A second resume then fetched deltas and received the server acknowledgements that follow successful transactional application to the local database:

| Domain | Acknowledged cursor | Issued cursor | Acknowledgement after cold restart (UTC) |
| --- | ---: | ---: | --- |
| accounts | 1 | 1 | 13:34:35.198392 |
| categories | 13 | 13 | 13:34:36.015599 |
| transactions | 5 | 5 | 13:34:36.954942 |

The cold restart stopped and relaunched only the ordinary app. The transaction list still showed exactly one `TRACKING TEST` row for SAR 0.01 with no error text. Its detail showed 22 October 2026, cash account, mapped Shopping category, Automatic source and Synced status. The test's two accepted capture items still link to one transaction `a9bdc873-b171-4338-93d2-9abde8f8adf8`. The total remained five transactions; client mutation receipts remained zero. The one durable save notice `3da44002-6c5f-490f-ae7e-b816f0ab34d3` was unchanged. No new save notice was created; Android cleared the previously active shade notice when the app was force-stopped.

Post-deployment database logs contained zero instances of the original read-only lock error in the bounded `13:32:49Z–13:34:45Z` verification window. Successful domain acknowledgements, including after cold restart, are the primary end-to-end evidence.

## Checks and evidence

- Real disposable PostgreSQL integration: two sync suites, four tests passed, including owner fencing, ordered pagination and monotonic acknowledgements.
- Guarded ingress transformation: two tests passed after the failing baseline, covering scoped promotion and rejection of missing/repeated/already-promoted anchors.
- Existing transport tests: five passed during diagnostic preparation. Temporary diagnostic logging was reverted after server logs established the cause. A diagnostic APK build was aborted by a PowerShell/native-stderr SDK warning; nothing from that attempt was installed, and no new client build is needed for the ingress repair.
- `git diff --check` passed. No new runtime source change remains for this follow-up; prior tracking repairs remain uncommitted.

Private sanitized evidence: `D:/Masarifi-preservation-2026-10-18/local-finance-sync-repair-20261022/`, including sync integration results and `phone-test-detail-final.json` / `.png`. Broader application acceptance and offline browsing behavior were not claimed or tested here.
