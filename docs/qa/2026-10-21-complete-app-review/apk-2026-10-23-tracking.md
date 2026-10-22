# Ordinary APK rebuild and fresh SMS — 23 October 2026

Rebuilt clean committed `dd4f693aad91c2125655f6d33731639dad12c433` on
`codex/voice-promoted-operating-2026-10-13`, matching the freshly checked remote.
The staging-client arm64 build succeeded; the actual bundle matched current
production sources, the signing certificate matched, and packaged SQLite/Screens
repairs passed bytecode/native inspection. Installed with `adb install -r` on
the same Android 15 phone. Cold launch rendered the signed-in home in 877 ms;
existing accounts, balances, SMS/notification permissions and source toggles
were retained. SMS tracking was on; notification-source tracking was off both
before and after installation. No DEV package/data operation was performed.

## Carrier SMS result on dd4f693a

Requested the consented 0.01 SAR APK TEST message with reference QA2310DD4FA1.
The owner confirmed delivery. A read-only, narrowly filtered inbox check found
one matching SMS ending at the word `reference`, without the requested code.
The owner subsequently confirmed intentionally sending no reference code;
reference-free messages are valid input, not an owner error.
Do not treat this as acceptance of that exact requested reference or of replay.

The actual SMS was captured in the background at 22:29:06Z on 22 October
(01:29:06 Asia/Riyadh on 23 October). One import session completed with one
accepted item, no rejection/error and one linked version-1 confirmed expense.
It produced one confirmed -1 SAR minor-unit posting to the owned default cash
account and one durable transaction-created notice. SAR balance changed from
3 to 2 minor units; EGP remained 1 minor unit. Total transactions changed from
13 to 14. Android had one ordinary-package save notification on
`masarifi-tracking-saved-v1`, whose tag matched the durable notice ID. The
actual shade showed `دفع · 0.01 SAR`, the APK TEST merchant and cash account.
The phone list and direct transaction detail showed one automatic 0.01 SAR
expense dated 23 October with `تمت المزامنة`.

**PASS for capture, single financial effect, sync and save notification for this
one delivered SMS.** No historical replay, financial correction or deletion was
performed. The small consented test transaction remains. Repeat delivery has
not been tested on this new build.

## Incomplete provider-reference defect discovered during inspection

The shared parser backtracked from `reference` to its `ref` alternative and
extracted `erence` as a provider code. The captured digest matched that suffix,
not the requested test code. An incomplete `reference number` label could also
become a false identity. Such invented references can affect deduplication.

The repair adds label/token boundaries and excludes the empty `number` label
from the capture. Missing codes remain absent while valid English/Arabic codes
remain supported. It changes the shared classifier rather than a DEV condition.
It does not rewrite existing captures, transaction identities or ledger rows.
The live SMS path supplies its classification from the app; the API's direct
classifier call is used for administrator corpus validation. No server schema
or configuration change is needed for this SMS repair.

Verification: the new parser regression failed first with `erence !== null`;
after repair all 102 parser tests passed. Four mobile tracking/import/queue
suites passed 214 tests, including absent/present provider-digest assertions;
two API tracking unit suites passed 29 tests. The first mobile run caught a
wrong sign in the newly written assertion (nominal expenses are negative),
which was corrected; production amount handling was unchanged.
Mobile TypeScript and the changed test's ESLint check passed. TypeScript needed
a 3072 MB heap after the intentionally reduced 512/1024 MB caps exhausted it.

The initial dd4f693a artifact did not contain this additional repair; it has
now been superseded by the replacement below.

A read-only list-row edit opened a form displaying an older TRACKING TEST
description/date. No save or change was made. The direct route for the new
transaction rendered its correct immutable detail and synced state. Editing
form/draft correctness is not established by this SMS smoke test. A subsequent
direct route to the new transaction's edit screen showed its correct description
and date as well, with no save. The earlier list-tap discrepancy was not reproduced
through the direct route and does not establish its cause.

## Replacement containing the repair — physical acceptance completed

Committed and pushed the repair on the same branch as
`86bd926e1842b675b8bf76e51f3bc6a146a80957`; checked the live remote SHA.
Built `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-23-86bd926e-arm64.apk`, SHA256
`2364ada06fe4301a6209446d09e5b127de587dd6bb6365a517e036449d84f475`.
Actual APK contents matched the current generated Hermes bundle and all eleven
checked production sources, including the repaired shared classifier. Ordinary
package, release flags, original certificate, Staging endpoint and packaged
SQLite/Screens repairs passed again.

The first native build itself succeeded in 6m36s (confirmed in its Gradle daemon
log), but Windows PowerShell treated SDK XML warning stderr as terminating, so
its wrapper did not record an exit receipt. Corrected the private wrapper to
retain stderr and check the native exit code. The subsequent package rebuild
returned exit 0, BUILD SUCCESSFUL in 1m21s, reusing the freshly compiled bundle.
No SDK, dependency, production config or DEV build/data change was needed.

Installed in place at 01:49:30 Asia/Riyadh. The installed APK hash matched;
cold launch returned Status ok in 550 ms and rendered the signed-in home at
0.02 SAR. Accounts, permissions, source toggles and all 14 existing transactions
were retained. No old message replay or extra financial effect occurred.

After installation/backgrounding, requested a **different new** 0.01 SAR test:
`Paid SAR0.01 at REF FIX TEST reference`, deliberately ending at the label with
no code. The owner confirmed delivery. Background SMS import completed at
22:51:09Z on 22 October (01:51:09 local on 23 October), accepted=1, rejected=0,
error=null. Its provider-reference digest is absent, reproducing the original
input shape and confirming the repair on the physical device.

Exactly one new version-1 confirmed expense, one confirmed -1 SAR minor-unit
posting to the owned cash account and one transaction-created notice exist.
SAR changed from 2 to 1 minor units; EGP stayed 1 minor unit. There are 15 owned
transactions total. The previous APK TEST transaction remains version 1 with
its single original posting and durable notice. Both distinct test operations
appear once in the phone list. The new detail shows the cash account,
23 October, automatic source and `تمت المزامنة`.

Android posted one matching save notification tagged with the new durable
notice ID on `masarifi-tracking-saved-v1`; its actual shade showed
`دفع · 0.01 SAR` and REF FIX TEST/cash. It appeared about 10 seconds after the
server ledger event; it was not present in the first check four seconds after
that event. Do not describe the notification as instantaneous.

**PASS for installation, opening, background capture, incomplete-reference
handling, single financial effect, sync and visible save notification for this
new SMS.** The small synthetic test entries remain. Repeat delivery of this
reference-free SMS was **not run**; this result does not establish general
deduplication for messages without a provider reference. DEV data is untouched.

Replacement private sanitized evidence:
`D:/Masarifi-preservation-2026-10-18/client-reference-fix-20261023/` —
build result/logs, artifact/installed identities, `physical-acceptance.json`,
before/after backend counts, `backend-fresh-sms.json`,
`backend-old-operation-after-repair.json`, `notices-after-fresh-sms-delayed.json`,
`notice-shade-sanitized.json` and phone transaction/detail UI dumps.

Private sanitized evidence is in
`D:/Masarifi-preservation-2026-10-18/client-dd4f-20261023/`:
artifact identity, before/after package/permissions and backend counts,
`backend-fresh-sms.json`, `notices-after-fresh-sms.json`,
`notice-shade-sanitized.json`, `consented-sms-shape.json`, and phone UI dumps.
Evidence excludes sender numbers and unrelated notification contents.
