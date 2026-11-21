# Handoff — second-phone SMS tracking

## Workspace and branch

- Repository: `D:/Masarifi-integration-2026-10-10`
- Branch: `codex/voice-promoted-operating-2026-10-13`
- Remote: `ratibi` — https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git
- Verified local HEAD and local remote-tracking ref both: `6d7619c03cf8c981232244c2d07d46a6fac3cb77`. Working tree was clean before this handoff. No fresh remote fetch in this handoff turn.

## Installed APK

- File: `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-7d93eec2-arm64.apk`
- Package: `com.masarifi.mobile`; Android arm64, standalone, Staging backend.
- APK source: `7d93eec2f2507cc76541837878472b189f1b2914`.
- SHA256: `6049cb673288bd2ece046bc103a3f216a5e536a4b63ec3b780f5a05069b365c4`.
- Preserve the separate DEV package `com.masarifi.mobile.dev`. No new build or reinstall requested now.

## Latest user report — current priority

The user installed and opened the ordinary APK on a second phone. Android initially blocked notification/message access. The user now reports granting permissions, but SMS tracking still did not read a message.

**Status: unresolved; second-phone tracking acceptance NOT RUN.** Permission state, device model/Android version, message arrival time and capture outcome have not been independently inspected. Restricted settings were a hypothesis, not a confirmed root cause. Do not classify this as a pass or request disabling Play Protect.

Next steps:

1. Establish whether the missing SMS was received after enabling tracking or was already in the inbox. Distinguish a real SMS from a banking-app notification.
2. Obtain phone model/Android version and inspect app SMS permission, notification-listener access, tracking toggles, selected account, source/sender/keyword filters and capture history. SMS permission and notification access are separate.
3. Trace one uniquely identified, consented test from capture through sync/parser/review/posting to the owned ledger. Check existing captures before retrying to prevent duplicates. Use sanitized evidence; never request phone numbers, passwords or OTPs.
4. Diagnose from evidence, make the smallest repair if needed, and retest the original failure. Do not replay historical messages or financial queues blindly.

## Recent completed work / remaining limits

- Ordinary-user Assistant now uses the deployed semantic model/read-tool path on Staging. Eight bounded Arabic/English physical cases passed, including ledger details, advice, ambiguity and finance scope. This does not prove all formulations or all features.
- Latest source includes a clarification-badge fix that is **not embedded in the installed APK**. Minor duplicated Arabic currency wording remains open.
- Overall application acceptance and client release remain incomplete. Second-owner registration, broader tracking/notification coverage and remaining plan cases are still outstanding.
- Main QA records: `docs/qa/2026-10-21-complete-app-review/`; detailed Assistant evidence: `assistant-semantic-review.md` there.
- Keep DEV and standalone results separate. Payments activation and app lock remain agreed exclusions; preserve DEV data.

This handoff is documentation only; no phone, server or application configuration was changed.

## Subsequent live diagnosis — 2026-10-22

The user subsequently authorized connecting to and controlling the attached phone to investigate. This section records that later investigation; the original handoff above remains its earlier snapshot.

- Attached phone: Xiaomi model `23076RN8DY`, Android 15 / API 35. Installed ordinary package SHA256 matches the APK recorded above. No build or reinstall was performed.
- Independently verified `READ_SMS` granted and AppOps allowed, notification-listener access enabled and service bound, and both in-app SMS/notification toggles enabled. The owner's default SAR cash account is active with automatic tracking enabled.
- One SMS received at `2026-10-22T11:08:16.195Z` (14:08:16 Riyadh) reached an import session at `11:08:28.505370Z`. A bounded inbox read for that exact timestamp returned one row; only the date's structural shape was emitted, never the message body or sender.
- The message contains a short hyphen-separated `NN-NN-NN` date without an adjacent time. The retained classification has `timeProvenance=ambiguous`, `occurredAt=null`, disposition `review`, and reason `date_ambiguous`. A fictional local message with that date shape reproduces the same classification.
- The server item remains `parsed` with `diagnosticReason=date_ambiguous`; the session is `received`, with `TRACKING_CAPTURE_DEFERRED` after ten attempts at the final read. There is no linked transaction and no review item for this capture. The app history shows one detected event, while its status panel continues showing the loading message. Capture/intake therefore occurred; successful posting did not.
- The remaining defect is unresolved date interpretation plus a deferred capture that is neither actionable in review nor explained by the loading UI. Do not invent the date, alter the stored classification, bypass safeguards, or resubmit the original SMS. Inspect the provider's date convention and repair through the normal parser/review flow before retesting.
- Staging SSH timed out; the connected Supabase tools supplied read-only database evidence. A read-only diagnostic function call was denied; no privileges were changed. No server configuration, tracking setting, review decision, ledger write, queue replay, or DEV-package operation was performed by the investigator.

**Status: root cause diagnosed for this capture; repair and end-to-end acceptance remain incomplete.** The individual source record and server capture were correlated by exact receipt time and date shape; an independent native fingerprint comparison was not performed.

## Final repair and bounded physical acceptance — 2026-10-22

This later result supersedes the unresolved status and original installed APK above. The owner authorized repair, a preserving update, and a distinct SAR 0.01 synthetic SMS plus an exact duplicate carrier SMS. Detailed evidence and remaining limits: [second-phone-tracking-repair.md](../qa/2026-10-21-complete-app-review/second-phone-tracking-repair.md).

- Repaired provable short dates/device timezone handling, actionable ambiguous-date review, terminal review completion, ordinary-package save notices, and source-switch locking during full synchronization. Shortened the three explanation rows and removed the marked manufacturer link/navigation.
- The owner identified the original dated/undated messages as one operation. The dated review was explicitly dismissed on the phone; both sessions are complete and one original transaction remains confirmed.
- The distinct dated test and its exact repeated carrier SMS were both accepted. Their two sessions link to one confirmed SAR 0.01 transaction with the correct 22 October Riyadh date. The repeat was captured in the background. One durable notice and one matching native Android notice remained after app resume; no extra financial effect or save notice appeared.
- Final installed ordinary APK: `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-tracking-repaired-arm64.apk`; SHA256 `b86b9cbfb3dacbc6d0e07eaa112ea0da842689f33b3db92a110f4ebd6c363db7`, independently matched against the phone's installed `base.apk`. Nine changed runtime files matched its source-map contents. Based on HEAD `6d7619c03cf8c981232244c2d07d46a6fac3cb77` plus uncommitted repairs. DEV data was not manipulated.
- Three additive Staging migrations were deployed through normal migration tooling. Final verification: parser 100, mobile 265, disposable real-Postgres integration 86, native presentation 3 tests passed; type checks, scoped lint and migration checksums passed.
- Separate whole-finance local cache sync still returns `INTERNAL_ERROR`; ordinary verified tracking acknowledgements/notices no longer wait for it. Do not claim offline cache repair, overall application acceptance or general release readiness. Broader tracking coverage and second-owner acceptance remain outstanding.

## Follow-up: local finance synchronization repaired — 2026-10-22

The owner explicitly requested repairing that remaining synchronization error and retesting the same phone. This supersedes the preceding `INTERNAL_ERROR` limitation. Root cause was stale ordinary sync ingress selecting an API whose repeatable-read transactions were also read-only, conflicting with the required active-profile `FOR SHARE` lock. Promoted only the existing bootstrap/delta default route to the already-correct API on port 3020; retained profile protections, DEV routing condition and other runtimes. No database migration or new APK installation was required.

On the same phone, accounts/categories/transactions acknowledged local application at cursors 1/13/5. The acknowledgements advanced again after a cold app restart. The test transaction appeared once with SAR 0.01, 22 October, mapped category, Automatic and Synced labels. The owner's server transaction count remained five, test financial effect and durable notice remained one each, and no client mutation upload was created. Two real-Postgres sync suites/four tests and two ingress guard tests passed. Full bounded evidence and rollback location: [local-finance-sync-repair.md](../qa/2026-10-21-complete-app-review/local-finance-sync-repair.md). Overall app acceptance and offline browsing remain outside this result.

## Follow-up: ordinary account deletion — 2026-10-22

The user requested unified ordinary/DEV confirmed account deletion with a loading
popup and no additional OTP. They explicitly superseded the earlier protection
of the current phone account and authorized deleting it. That account has now
been deleted; its earlier tracking and sync results above are historical evidence.
The phone is intentionally left on the welcome/sign-in screen.

Both ordinary and regular DEV now select the existing completion/recovery flow
against exact Staging, using `/account-deletion`. Two guarded Nginx routes target
the existing immediate-deletion API on port 3027. Legacy aliases and the previous
sync repair remain intact. The first physical run completed server deletion
without OTP but exposed an additional native DEV-only purge gate. A Robolectric
regression reproduced that failure; the ordinary package was then admitted while
retaining unknown-package rejection and foreign-owner isolation.

The corrected APK is
`D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-unified-deletion-v2-arm64.apk`,
SHA256 `a86e0f0ab30660d620037f995d65d952ef608d83ead711477d06d09696f1f2df`.
It is installed as an ordinary standalone Staging arm64 release with the same
signing certificate. DEV package/data were not touched. Its actual installed
hash matches. The previous APK without the native correction must not be used.

On the same phone the server-completed checkpoint finished local cleanup after
the corrected upgrade. The error banner disappeared; cold restart and a protected
old transaction deep link both showed the clean welcome screen. No second delete
POST or replacement account was used. Staging has exactly one completed deletion;
the target's financial records are zero, and its Clerk identity returns 404.
Other owners' 19 transaction rows and versions have an unchanged checksum.
Mobile deletion/recovery suites passed 77 tests, API suites 54, real-Postgres 13,
and native purge five. This is bounded deletion/recovery acceptance, not a new
logged-in tracking test after deleting the account or overall release acceptance.
Details: [ordinary-account-deletion.md](../qa/2026-10-21-complete-app-review/ordinary-account-deletion.md).

## Follow-up: shared native build repairs and import recheck — 2026-10-22

The user authorized two findings from the read-only DEV parity review. SQLite
and Screens now have shared automatic preparation at install and Android
prebuild, plus a generated Gradle guard that refuses an unpatched release. The
single bounded recheck for zero-accepted received/processing imports now runs in
the common live coordinator without a DEV package gate. No extra submission or
financial queue replay was introduced. Other parity findings were not changed.

Before producing the artifact: 133 tracking-related tests, 27 native preparation
and configuration cases, three real Gradle guard cases, four extracted SQLite
lifecycle cases, and TypeScript passed. Actual packaged DEX/ELF and bundled
coordinator source were checked. DEV app data and native projects were untouched.

New **uninstalled** candidate:
`D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-shared-fixes-arm64.apk`, SHA256
`e8567c019e74878dcf7d07ced2f88e579e555bfbf0f237b3acb2c969e121f6c8`.
It retains the ordinary package, certificate, Staging backend and earlier repairs.
The last installed phone APK remains unified-deletion v2; no fresh logged-in SMS
test was performed. Full evidence and build limits:
[shared-native-build-and-tracking.md](../qa/2026-10-21-complete-app-review/shared-native-build-and-tracking.md).

## Latest: shared-fixes installed and real SMS replay verified — 2026-10-22

Supersedes the earlier uninstalled/pending status above. Installed the shared-fixes
ordinary APK using `adb install -r` on the same Xiaomi Android 15 phone. Installed
base APK SHA256 matches `e8567c019e74878dcf7d07ced2f88e579e555bfbf0f237b3acb2c969e121f6c8`.
The owner signed in; SMS tracking was enabled and verified, permissions inspected,
and the active default SAR cash account confirmed. Baseline financial/import/notice
counts were zero. No DEV app/data or diagnostic package was changed.

A fresh consented SAR 0.01 carrier SMS with short date and unique reference was
captured in the background, completed, posted once, displayed in the local
transaction list, and produced a visible Android save notification. The owner's
exact resend was independently captured in a second complete session. Both items
link to one unchanged version-1 transaction: one confirmed -0.01 SAR posting, one
durable notice. Android retains the same notice with unchanged creation/update/
interruption times; the local list still shows one transaction with no sync error.

Physical tracking acceptance **PASS for this specific fresh-SMS/exact-replay case**.
Overall release and broader message/notification coverage remain incomplete.
The synthetic test transaction remains in the tested account. No historic inbox
or financial queue replay, data clear, uninstall, or server modification was used.
Details and evidence:
[shared-native-build-and-tracking.md](../qa/2026-10-21-complete-app-review/shared-native-build-and-tracking.md).

## Latest extension: same-reference SMS without date — 2026-10-22

The owner sent the same synthetic operation again with its date removed and its
provider reference retained. Background capture produced a third complete,
accepted session at 21:42:52 Asia/Riyadh, linking to the same original transaction.
Verified on the server and phone: three complete sessions, one unchanged
version-1 transaction, one confirmed -0.01 SAR posting, one durable notice, and
one displayed transaction row. Android notice creation/update/interruption times
match the pre-undated baseline; no save notice was reposted. No pending test
session or visible finance sync error remains.

**PASS for this same-reference dated/undated case.** DEV and diagnostic data were
untouched; no code/server change or financial cleanup was needed. Broader
reference-free/message-format coverage and overall release remain incomplete.
Evidence is in the shared physical QA record above and its private evidence
directory (`undated-*`, notice snapshots and `13-after-undated-transactions.xml`).

## Latest extension: distinct new Arabic EGP operation — 2026-10-22

Created the owner's requested EGP TEST bank account through the ordinary phone UI,
zero opening balance, tracking on, no card suffix; kept the original SAR cash
account default. The owner sent a new Arabic SMS for 0.02 Egyptian pounds with a
new test reference. Background import completed at 22:00:07 Asia/Riyadh, accepted=1,
rejected=0, no error. A new confirmed EGP transaction posted once to EGP TEST;
the original SAR transaction is unchanged. The new Android save notice is visible.
Its transaction detail shows EGP TEST and `تمت المزامنة`. Account balances are
-0.02 EGP for EGP TEST and -0.01 SAR for the original default cash account.

**PASS for this bounded distinct-operation/currency-account-selection case.**
Duplicate protection did not block the new transaction. There are two financial
transactions/postings/notices total. Android also displays an automatic notice
group summary. DEV and diagnostic data were untouched; no code/server repair or
historical replay was needed. The test account and synthetic transactions remain.
Broader Egyptian bank-message and merchant-extraction acceptance is not implied.
See the shared physical QA record and `new-egp-*` evidence in its private folder.

## Latest extension: shared planning repair and replacement ordinary APK

Shared SQL migration `20261022191918` is deployed on Staging. Payment ownership
is now stored on INSERT, so returned payment versions match persisted rows.
Ordinary transaction revision reconciles existing automatic salary receipts
atomically; manual receipts and historical discovery behavior are preserved.
135 backend integration cases passed, including two independent owners × SAR/EGP;
88 scoped mobile cases and TypeScript/lint checks passed before the new build.

New ordinary arm64 APK installed in place on the same phone:
`D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-shared-planning-arm64.apk`, SHA256
`4ef1b6ee80777bb0e000a16a30882e3170c0ff9118cff60dedfb1ef58772d3ff`.
The pulled installed base matches. The bundle includes currency-aware obligation
account selection; native SQLite/Screens backports were verified in the APK.

On this final APK, SAR and EGP payments each saved once; each undo created exactly
one compensating transaction and restored its pre-payment balance. Automatic EGP
salary detection and a 22→21 October transaction-date edit passed: one income,
one posting, corrected receipt date matching the transaction. Salary amount and
the complete two-owner/two-currency matrix passed on disposable PostgreSQL;
physical SAR salary/physical salary amount revision are not claimed as passed.

Temporary base currency was restored to SAR; default account remained SAR cash.
The two synthetic obligations are paused; salary-test automatic detection is off.
Their audit/payment history and the small 0.04 EGP test salary income remain.
DEV/diagnostic packages and data were not operated on. No historical queue replay
or account-authentication bypass was used. Prior SMS follow-ups remain separate;
this result does not establish full client-release acceptance.

Full evidence and limitations: `docs/qa/2026-10-21-complete-app-review/shared-planning-payment-salary.md`.

## Latest extension: outstanding physical salary cases completed

Completed on the same ordinary installed shared-planning APK: EGP income amount
0.04→0.05, new SAR salary income 0.03 with automatic receipt detection, SAR date
22→21 October, and SAR income amount 0.03→0.04. Date revision corrects the same
automatic receipt; amount revision invalidates the old mismatched expected
receipt (`undone`, received date cleared). The ledger updates only by the amount
difference. Reopening and saving unchanged preserves one income transaction and
one historical receipt per QA operation, with no extra posting or balance effect.

The phone details display the proper account/currency/amount/date and synced
state. Final balances: 0.03 SAR cash and 0.01 EGP TEST. These include retained
synthetic incomes of 0.04 SAR and 0.05 EGP. The disposable salary setup was reused
sequentially between currencies; final `QA_SAR_SALARY` auto detection is off,
version 4. The two synthetic obligations remain paused. DEV and diagnostic data
were untouched. No new APK or hosted mutation outside the ordinary UI was needed.

Fresh publication checks: 420 mobile, 221 real-PostgreSQL integration, 100 parser,
16 native-preparation, and 46 Android module tests passed; API/mobile type checks
and changed-file lint passed (one pre-existing test warning). The older local
disposable clone needed the existing three tracking review migrations before
the complete integration rerun. Only test-query typing and QA records changed
during this follow-up. All pending ordinary tracking/deletion/native/planning
repairs are targeted to the same ratibi branch; verify remote commit equality
after push. The detailed planning QA record above contains current evidence and
separates this result from remaining SMS and overall release acceptance work.
