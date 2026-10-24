# Shared Android native repairs and pending-import recheck — 2026-10-22

The user authorized the first two DEV parity repairs: guarantee the pinned
SQLite/Screens repairs in ordinary APK builds, and promote the single extra
pending-import read to the ordinary runtime. Preserve DEV data and verify before
producing a new APK. Other DEV parity findings remain outside this change.

## Build integration

`scripts/native-stability-fixes.mjs` reuses the existing version- and SHA256-pinned
patchers. Postinstall applies both repairs; `prepare:android` can reapply them,
and `check:android-native-fixes` verifies without rewriting sources. Lockfile
metadata records the install script; no dependency versions changed.

The registered Android config plugin also prepares clean dependencies during
prebuild, covering CI installations with `--ignore-scripts`. It generates a
Gradle configuration check that throws before release tasks if either repair is
absent, changed, or on an unqualified library version. Repeated prebuild retains
one guard, including CRLF files. The older single-patch manual commands retain
their DEV admission; the shared automatic entry point serves ordinary and DEV.

CI runs the shared bootstrap and existing patch regression tests. Both vendor
READMEs now explain the shared path. Existing native projects need their intended
prebuild once to receive the guard; do not prebuild over another app's project.

The ordinary external build tree `D:/mc22/native` was independently checked for
the ordinary package before adding the same generated guard. Its prior root
Gradle file is preserved in the evidence folder. The external build supplies
`masarifi.mobileRoot` because its Android directory is outside the JS project.
No DEV native project was regenerated.

## Pending imports

Removed the DEV package opt-in from the shared live coordinator. An import with
zero accepted effects and status `received` or `processing` gets at most one
additional owned status read in the existing pass. Accepted or terminal results
do not wait for an extra read. Existing owner/consent fences, stable submission
keys, queue receipts, and durable follow-up remain in place. The extra read does
not submit another import or execute a financial operation.

## Verification

- Before the change, five existing recheck cases failed without the DEV opt-in;
  the ordinary install/prebuild tests also failed because no shared hook existed.
- Four tracking, confirmation, background, and status suites: **133 passed**.
  Covers completed reads, slow results, failed/foreign receipts, owner and consent
  changes, stable submission keys, concurrent calls, and notification deduplication.
- Shared bootstrap, two pinned patch suites, and ordinary/DEV/privacy configuration
  suites: **27 passed**. Uses pristine dependency files in disposable directories,
  actual ordinary postinstall, the plugin registered in app.json, real Expo mods,
  repeat preparation, and CRLF regeneration.
- Real Gradle in an isolated fixture rejected missing SQLite and missing Screens
  separately before its release task, then accepted both repaired sources.
- Real extracted SQLite lifecycle code: **four passed**, including closing later
  connections after one close throws.
- TypeScript passed; targeted lint has zero errors and one existing require-import
  warning in the background runtime test. Diff whitespace check passed.

Two older background-auth test fixtures needed complete live configuration and
an invalid tracking-context value limited to its actual SecureStore key. This
retains their original failure/ownership assertions with the already-promoted
ordinary deletion fences; no production authentication logic was relaxed.

Windows C: was full. Temporary files, compiler output, and the new Jest cache were
placed under the evidence directory on D:. No unrelated files were deleted.
An initial external build failed closed because its custom project-root property
was split by PowerShell; quoting the property fixed the build invocation.

## New artifact

- APK: `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-shared-fixes-arm64.apk`
- SHA256: `e8567c019e74878dcf7d07ced2f88e579e555bfbf0f237b3acb2c969e121f6c8`
- 64,678,952 bytes; `com.masarifi.mobile`; standalone Staging; arm64; non-debuggable.
- Existing certificate SHA256:
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Build succeeded in 4m33s. Actual packaged JS/source-map verification matches ten
  changed runtime sources, including the promoted coordinator.
- Actual packaged DEX shows SQLite takes a connection-list snapshot before
  clearing its cache. The packaged Screens ELF contains the listener set/clear
  ownership backport; all five installed native source hashes match pinned repairs.
- Previous APK files were preserved. No server configuration, schema, financial
  queue, account, DEV installation, or DEV data was changed.

**Not installed. No new physical SMS test was performed.** Tracking verification
used isolated test data; this is build/parity acceptance, not full app acceptance.
The phone's last known installed ordinary APK remains the unified-deletion v2
artifact, on the welcome screen after the previously authorized account deletion.

Evidence: `D:/Masarifi-preservation-2026-10-18/shared-native-tracking-20261022/`.
Changes remain in the working tree based on
`6d7619c03cf8c981232244c2d07d46a6fac3cb77`.

## Physical installation follow-up — 22 October 2026

The owner subsequently requested installation and a fresh real-SMS test. Installed
the shared-fixes APK above with `adb install -r` on the same Xiaomi Android 15
phone. ADB returned `Success`; hashing the installed ordinary base APK matches
`e8567c019e74878dcf7d07ced2f88e579e555bfbf0f237b3acb2c969e121f6c8`.
No uninstall or data clear was used. The package inventory contains the ordinary
app and the separate voice diagnostic app; no DEV package is present on this
phone. Neither DEV data nor the diagnostic package was changed.

The owner completed Google sign-in. Inspected the loaded tracking screen and
enabled SMS tracking; a subsequent UI dump confirms the switch is checked.
READ_SMS and POST_NOTIFICATIONS are granted, notification-listener access is
enabled, and the existing saved-alert channel has importance 4 with sound and
vibration. The account screen and owned backend agree on one active default SAR
cash account, eligible for automatic tracking. Baseline: zero transactions,
zero import sessions, zero durable notices. Notification capture remains off;
this run targets SMS capture.

Backgrounded the app and requested a fresh carrier SMS with a unique synthetic
reference, a short hyphenated date, and SAR 0.01. At the last bounded observation,
no fresh owned import session or ordinary app notification had appeared. Arrival
confirmation is pending from the owner. **Fresh SMS save, visible save alert,
and exact-replay deduplication are NOT RUN, not passed.** No historical messages
or queues were replayed. Private installation/baseline evidence:
`D:/Masarifi-preservation-2026-10-18/shared-fixes-physical-tracking-20261022/`.

### Fresh carrier SMS — verified on the installed shared-fixes APK

The owner subsequently confirmed the requested synthetic SMS arrived. Background
capture created one import session at 15:55:52Z; it completed accepted=1,
rejected=0 with no error. The single confirmed transaction is SAR 0.01 at
TRACKING TEST. The short `22-10-26` date resolves to 22 October in Asia/Riyadh.
Its one confirmed posting is -1 minor unit, with one durable transaction-created
notice linked to that same transaction.

Android has exactly one ordinary-package notification on
`masarifi-tracking-saved-v1`. Opening the notification shade visibly showed
`دفع · 0.01 SAR` and `TRACKING TEST · التسوق النقدية`. Opening the transaction list
showed the one automatic expense on the default cash account with no financial
sync error. These are actual device observations, separate from prior automated
tests. Background capture, parsing, posting, local list display and visible save
notification pass for this case.

The app was backgrounded again and an exact replay of the same SMS/reference was
requested. Replay acceptance was initially pending, and is recorded below after
the owner's subsequent arrival confirmation. Evidence includes
`fresh-sms-server.json`, `fresh-posting-server.json`, `10-fresh-shade.xml`,
`11-transactions.xml`, and `notice-before-replay.txt` in the private directory.

### Exact replay — physical acceptance completed

The owner confirmed the exact resend. A second background import session was
created at 18:38:42Z (21:38:42 Asia/Riyadh) and completed accepted=1, rejected=0,
with no error. Both distinct captured items link to the same original transaction.
At 18:39:46Z the owned server state has exactly one confirmed transaction, still
version 1, one confirmed posting of -1 SAR minor unit, and one durable notice.
There are two complete import sessions and no pending session for this test.

Android still has the original single ordinary-app notification. Its record,
stable tag, creation time, update time, and interruption time match the saved
pre-replay observation exactly. No notification was reposted for the replay.
The current phone transaction list contains one TRACKING TEST row, amount -0.01
SAR, with no visible financial sync error. DEV data and the separate diagnostic
package were untouched; the phone still has no DEV package installed.

**PASS for this bounded real-device case:** background fresh SMS capture,
short-date parsing, one saved financial effect, local transaction display,
visible Android save notice, and exact-replay deduplication without another save
notice. This does not constitute overall app acceptance, all message formats,
or banking-app notification coverage. The synthetic 0.01 SAR transaction remains
in the tested account; no cleanup/delete or historical queue replay was performed.

Final private evidence: `replay-sms-server.json`,
`12-after-replay-transactions.xml`, `notice-after-replay.txt`, and
`replay-device-check.json` alongside the first-delivery evidence.

### Same operation with date removed — physical acceptance completed

At the owner's request, backgrounded the ordinary app again and requested the
same synthetic SMS with only `on 22-10-26` removed, retaining amount, merchant and
provider reference. The owner confirmed arrival. A third background import
session was created at 18:42:52Z (21:42:52 Asia/Riyadh), completed accepted=1,
rejected=0 and has no error. Its accepted item links to the same original
transaction as both earlier dated deliveries.

At 18:43:11Z there are three complete sessions but still exactly one confirmed
version-1 transaction, one confirmed -1 SAR minor-unit posting and one original
durable notice. Android has one original ordinary-package notice, with unchanged
tag, creation/update/interruption times against the fresh pre-undated baseline.
The phone transaction list again shows one TRACKING TEST row, -0.01 SAR, and no
visible financial sync error. No pending import remains for this test.

**PASS for the same-reference undated variant:** no duplicate transaction,
financial effect or save notification. No application/server code change, data
clear, historical replay or DEV operation was needed. This case retains the same
provider reference; it does not establish deduplication for unrelated or
reference-free messages. The raw undated import's merchant field includes its
reference suffix; the existing ledger title/merchant/version were not changed.

Private evidence: `undated-baseline.json`, `undated-sms-server.json`,
`notice-before-undated.txt`, `notice-after-undated.txt`,
`13-after-undated-transactions.xml`, and `undated-device-check.json` in the same
physical evidence directory. The synthetic 0.01 SAR transaction remains in place.

### Distinct new Arabic EGP operation — physical acceptance completed

The owner requested a new operation in Egyptian pounds to ensure duplicate
protection does not suppress new transactions and that currency selects the
Egyptian account. Created one bank-type `EGP TEST` account through the ordinary
phone UI: EGP, zero opening balance, tracking enabled, no card suffix and not the
default account. The original SAR cash account remains default. Confirmed both
accounts in the phone list and owned backend before requesting a carrier SMS.
Baseline: three import sessions, one SAR transaction/posting/notice, zero EGP
balance. No opening-balance posting was introduced.

The owner sent the consented Arabic test: `تم خصم 0.02 جنيه مصري للشراء من متجر
اختبار مصري، مرجع EG2210N02`. Background import at 19:00:07Z (22:00:07 Asia/Riyadh)
completed accepted=1, rejected=0, no error. A distinct confirmed version-1 EGP
transaction for 2 minor units has exactly one confirmed -2 minor-unit posting
to EGP TEST, whose account currency is EGP. The previous SAR transaction/posting
is unchanged. There are now two transactions, two postings and two durable
transaction-created notices total, each linked to its own transaction.

Observed the new notice in the actual Android shade: `دفع · 0.02 EGP`, with the
Arabic merchant and EGP TEST account. Android retains two individual notices and
adds its automatic group summary; that summary is not a third financial event.
Opened the new transaction on the phone: -0.02 EGP, account EGP TEST, automatic
source, `تمت المزامنة`. The account list shows EGP TEST at -0.02 EGP and the
default SAR cash account still at -0.01 SAR.

**PASS for this distinct new Arabic EGP case:** duplicate protection permits the
new operation, it posts once to the Egyptian account even while SAR is default,
and its own save notice is visible. No application/server code change, DEV/data
operation, unrelated package change, or historical replay was used. The Egyptian
test account and both small test transactions remain in place. The merchant title
retains the Arabic reference suffix; this does not establish clean merchant-name
extraction or general coverage for all Egyptian bank message formats.

Private evidence: `new-egp-baseline.json`, `new-egp-server.json`,
`new-egp-verdict.json`, `23-egp-account-verified.xml`, `25-egp-save-notice.xml`,
`26-egp-transaction-detail.xml`, `27-egp-account-balance.xml` and the before/after
ordinary notification record snapshots in the same physical evidence directory.
