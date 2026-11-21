# Shared payment and salary repairs — 2026-10-22

## Scope and result

Promoted the qualified payment-version/ownership repair and automatic salary-link
reconciliation to the ordinary Staging command path. No account allowlist or DEV
header is required for these shared repairs. Existing DEV entry points remain.

**PASS for the bounded automated matrix:** two independent synthetic owners,
each with SAR and EGP financial accounts; created and linked-existing payments,
undo, replay, salary date/amount revision, manual-receipt preservation, and owner
isolation. **135 backend integration tests and 88 mobile tests passed.**

**PASS on the physical ordinary app:** payment and undo in both financial
accounts/currencies; automatic EGP/SAR salary detection, date revision and amount
revision. The final follow-up below verifies both currencies on the same phone.
The two-owner/four-combination matrix was tested against disposable PostgreSQL;
physical testing used two financial accounts under one ordinary Google login.

## Implementation

- Migration `20261022191918_shared_planning_payment_salary_reconciliation.sql`
  stores payment ownership in the initial INSERT. The returned payment version
  now matches the persisted row; undo uses the current version and creates one
  compensating ledger transaction.
- `private.revise_transaction` reconciles existing automatic receipts linked to
  the revised transaction within the same command transaction. A valid date
  revision corrects the receipt date; an invalid amount/date/kind/status undoes
  the automatic receipt. Explicit manual confirmations remain unchanged.
- Reconciliation does not discover historical incomes or replay financial
  queues. The private core/helper cannot be called directly by API, worker,
  anonymous, or service roles. Existing ownership and ledger guards are retained.
- `ObligationPaymentScreen` selects an active account in the obligation's
  currency, preferring its funding account, then a matching default account.
  Display and preview use the same selection; the picker filters by currency.

## Verification before building

- New integration regression: 8 failures before the repair; 17/17 pass after it.
- Full planning compatibility: 14 suites, 135/135 pass on disposable local
  PostgreSQL. This includes worker, sync, payment and salary compatibility.
- Mobile payment journey: 2 new account-selection regressions failed before the
  repair; full file 7/7 pass after it.
- Live planning-service, obligation and salary journeys: 81/81 pass.
- API/mobile TypeScript and changed-source lint checks passed. Migration checksum
  matches the SQL file; targeted diff whitespace checks passed.
- The initial broad worker run encountered an inherited synthetic backlog in the
  new clone. Only that new disposable clone was reset; the original fixture was
  preserved. The complete compatibility rerun passed.

## Staging deployment

Applied version **20261022191918**, SHA256
`3bab9f9d6fd1a3d10a4e6d8a224ff2b34396899632181f54904752f96f4a43c2`.
Before/after counts and row fingerprints matched for all ten financial/planning
tables during deployment. This is function-only DDL; no existing financial rows
were rewritten. Shared API routes already call these functions, so no API image,
nginx routing or DEV container replacement was required.

The security-advisor findings before/after are the same informational group:
ten pre-existing private tables with RLS and no policies. Observation timestamps
differ. No new advisory finding was introduced by this migration.

A separate synthetic Clerk session probe could not create a session in this
Clerk environment. Its one temporary test identity was removed. An additional
rollback-fixture probe was denied SET ROLE before inserting fixtures; its
one-off process was stopped. Neither probe is counted as passing authenticated
two-owner hosted acceptance. Authentication/role permissions were not weakened.

## Physical evidence and artifact

Phone: Xiaomi 23076RN8DY, Android 15/API 35, ordinary package
`com.masarifi.mobile`. DEV and diagnostic package/data were not operated on.

The final APK is
`D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-shared-planning-arm64.apk`,
64,679,168 bytes, SHA256
`4ef1b6ee80777bb0e000a16a30882e3170c0ff9118cff60dedfb1ef58772d3ff`.
Staging standalone, arm64, non-debuggable, original signing certificate. Build
passed; actual bundled sources match, including the new payment-screen change.
SQLite and Screens native fixes were verified inside the artifact. Installed
with `adb install -r`; the pulled installed base APK has the same SHA256.

Two initial hosted payment/undo runs used the preceding ordinary shared-fixes
APK. Both were then repeated using the final shared-planning APK:

| Final APK case | Result |
| --- | --- |
| SAR cash / 0.01 payment | Correct account selected automatically; saved once, version 1 |
| SAR undo | Payment version 2; exactly one reversal; balance restored to -0.01 SAR |
| EGP TEST / 0.01 payment | Correct EGP account; saved once, version 1 |
| EGP undo | Payment version 2; exactly one reversal; pre-payment EGP balance restored |
| Currency-filtered payment picker | SAR case offers SAR cash, excludes EGP TEST |
| EGP salary / 0.04 income | Worker automatically linked one existing income; no new salary transaction |
| Salary date 22 → 21 October | Receipt corrected atomically; date equals transaction date, one transaction and one posting |

Four distinct reviewed payment operations were created across the initial and
final APK runs. Each was reversed once. These are separate test operations, not
retries of one operation. Duplicate-request replay is covered by the integration
matrix. The date-only salary edit retained amount 0.04 EGP and transaction version
2; its receipt reached version 3/status `corrected`.

The phone's base currency was temporarily EGP to create its synthetic obligation,
then restored and verified as SAR. The default account remained SAR cash.
Automatic detection on `QA_EGP_SALARY` was disabled after the test (profile v2).
Both synthetic obligations were paused through the ordinary UI after testing
(version 6); all their payment history and reversals remain for inspection.
The synthetic 0.04 EGP income and its corrected receipt remain as evidence;
attempted decimal amount edits were not saved. Final verified balances were
-0.01 SAR and 0.00 EGP, including the retained test salary income. Prior SMS test
transactions, including the unresolved abbreviated-message extra, were preserved.

Private evidence: `D:/Masarifi-preservation-2026-10-18/planning-shared-20261022/`:
red/green and compatibility logs, deployment fingerprints/function hashes,
`client-final-artifact-identity.json`, numbered UI XML, and
`physical-final-server.json`. No passwords, phone numbers, OTPs or auth tokens
are needed in this record. Overall application/client-release acceptance remains
incomplete; this bounded planning result does not resolve prior SMS follow-ups.

## Physical salary follow-up and publication checks — 2026-10-22

Completed the previously outstanding cases on the same installed APK, without
another build, reinstall, DEV operation or server change. All financial writes
were performed through the ordinary signed-in phone UI. Management SQL was used
only to read the resulting evidence.

| Physical case | Verified result |
| --- | --- |
| EGP income 0.04 → 0.05 | Same transaction; EGP balance 0.00 → 0.01; posted sum 5 minor |
| EGP automatic receipt | Existing expected-4-minor receipt becomes `undone`, clears `received_at`, version 4; it does not misreport the revised income as the old expected salary |
| SAR income 0.03 | One new confirmed income in SAR cash; worker automatically links one receipt; cash balance -0.01 → 0.02 SAR |
| SAR date 22 → 21 October | Same income; receipt becomes `corrected`, date matches income, balance stays 0.02 SAR |
| SAR income 0.03 → 0.04 | Same transaction; cash balance 0.02 → 0.03; posted sum 4 minor; expected-3-minor automatic receipt becomes `undone` and clears its received date |
| Reopen and save each income unchanged | One transaction per QA title; balances and posted sums stay unchanged; no additional posting or receipt |

Amount revision adds an append-only adjustment posting for the difference. Each
income therefore has two posting entries after the amount edit: original plus
adjustment, with sums 5 EGP minor and 4 SAR minor. These are not duplicate income
transactions. An unchanged save advances transaction revision to 4 but adds no
posting; both receipt versions remain 4. The phone transaction details show the
correct account/currency, revised amount, 21 October, and `تمت المزامنة`.

The single disposable salary setup was edited through the UI between the EGP
and SAR scenarios (new SAR occurrence on day 21). This is sequential testing,
not a claim of multiple simultaneous salary profiles or historical profile-
currency-change acceptance. Its final name is `QA_SAR_SALARY`, amount 0.03 SAR,
day 21, cash account, automatic detection off (profile version 4). The two QA
obligations remain paused. Retained synthetic incomes are 0.05 EGP and 0.04 SAR;
final account balances are 0.01 EGP and 0.03 SAR. Prior SMS records are preserved.
No broader queue replay or direct diagnostic financial mutation was performed.

Fresh checks for publishing all pending ordinary-app repairs on
`ratibi/codex/voice-promoted-operating-2026-10-13`:

- Mobile: 14 suites / 420 tests passed.
- PostgreSQL planning and financial-content integration: 15 suites / 221 tests
  passed. The older disposable clone initially lacked the three 22 October
  tracking review migrations; after applying those source migrations to that
  guarded local clone only, the full rerun passed. Hosted/DEV data was untouched.
- Transaction parser: 100 tests passed; native preparation/backports: 16 passed.
- Android ordinary tracking module release unit tests: 7 suites / 46 passed,
  no failures, errors or skips; Gradle succeeded.
- API and mobile TypeScript passed. Changed API/mobile lint has zero errors;
  one existing `require()` warning remains in a mobile background-runtime test.
  Four unsafe-query typing lint errors in the new tracking regressions were
  corrected with typed query results; integration and type checks were rerun.
- Changed migration checksums match; credential-pattern scan and diff whitespace
  checks pass. Production sources in the installed APK are unchanged by this
  follow-up; only test typing and evidence documentation were edited.

Private additional evidence: `egp-salary-amount-verified.json`,
`sar-salary-date-verified.json`, `salary-followup-final-server.json`, numbered UI
XML/screenshots from 110 onward, `publish-*-result.json` and `publish-*.log` in
the evidence folder above. Git remote identity is checked after publishing;
the final commit identity is reported separately, rather than embedded in itself.
