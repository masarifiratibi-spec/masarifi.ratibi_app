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

Replacement APK build/install and new physical SMS acceptance are pending.
The tested dd4f693a artifact does not contain this additional repair.

A read-only list-row edit opened a form displaying an older TRACKING TEST
description/date. No save or change was made. The direct route for the new
transaction rendered its correct immutable detail and synced state. Editing
form/draft correctness is not established by this SMS smoke test; the observed
form discrepancy remains a separate investigation item.

Private sanitized evidence is in
`D:/Masarifi-preservation-2026-10-18/client-dd4f-20261023/`:
artifact identity, before/after package/permissions and backend counts,
`backend-fresh-sms.json`, `notices-after-fresh-sms.json`,
`notice-shade-sanitized.json`, `consented-sms-shape.json`, and phone UI dumps.
Evidence excludes sender numbers and unrelated notification contents.
