# Online recovery and report availability — 28 October 2026

Sol Extra High personally implemented and tested this slice; review is self-review plus actual device/API/database evidence. T01–T03 stay accepted. T04 and full T06 remain BLOCKED; T05 remains NOT_STARTED. The user did not approve the proposed T05 read-only dependency exception and instead directed investigation of the actual T04 retry blocker.

## Confirmed defect and focused fix

On the connected Xiaomi, Analytics returned HTTP400 and “Report is unavailable” / “التقرير غير متاح”. The client sent `monthStartDay=1`, which the actual deployed reports API rejects. The fix omits only the redundant default day (undefined or 1); it preserves nondefault days and account filters. No API deployment, flag, UI redesign, policy or database change was made.

Read-only nginx inspection corrected an initial attribution mistake: report requests use `location /` → localhost3001, container `masarifi-assistant-reports-api-ledger-scope-20261023`, image `sha256:bde04a161f8988897117b7810e976263ec723a42a5fac6703469d5e0070cfeff`. Its DTO SHA256 is `71d21126abefaf7eea9d4895de6d8c19707b836e5240774ac794aa30d973e6f4`; accepted report parameters include accountIds but exclude monthStartDay. The earlier inspected port3000 container is not evidence of the report contract. Accordingly, account-scoped reports are **not** classified as requiring deployment: fresh device requests with accountIds returned200. Nondefault cycle-day API support remains absent from this deployed validator and was not forced by changing the user's day1 setting.

Changed files:

- `apps/mobile/src/services/live/reports-service.ts`, SHA256 `0810d369685885bf068d5f644962a6a045568e8a1b9369515b893892976816ec`.
- `apps/mobile/src/services/live/reports-service.test.ts`, SHA256 `3a7375390c96f42fb2d99e0a6bd50271dd20abee2f19b6e074f8b36b68ba0857`.

The new strict deployed-contract regression failed before the product fix, then passed. Final focused suite:14 tests PASS. It covers default reports with/without account scope and preservation of custom cycle/account parameters on rejection. An existing auth-read test initially failed because native SecureStore's Jest default returned undefined for the newly inherited logout-disposition check; its native boundary now explicitly returns null for no stored disposition. No production auth guard was changed. Mobile typecheck, two-file lint and diff whitespace checks passed. The inherited ten-file T06 manifest still matches; the241 passing navigation tests were reused without rerunning.

## Actual Xiaomi results

| Journey/state | Arabic/RTL | English/LTR | Limits |
|---|---|---|---|
| Home → Analytics, All Accounts, October | PASS, report data loaded | PASS,200 observed | Day1/SAR existing settings |
| Existing QA account scope | PASS, correct displayed scope/data | PASS,200 with accountIds | No filter dropped |
| Empty September QA report | Not repeated | PASS,200 and “No report activity yet” | Honest empty result |
| Reports → Assistant → Back | PASS, unsent Arabic question and toolbar return | PASS, All Accounts hardware return and QA-context toolbar return | No message/consent/provider action |
| Profile → Back | PASS | PASS | No fields saved |
| Security → Active Sessions → Back | PASS, current device shown | PASS, current device shown | No revocation/security change |
| Tracking → Back | PASS,113 keywords loaded | PASS,113 keywords loaded | Existing missing permissions shown; capture toggles untouched |
| Salary overview → Back | PASS, honest missing-data values | PASS, same | One QA salary profile, zero eligible received-salary anchors confirmed read-only |
| Obligations → existing QA detail/schedule/payment history → Back | PASS | PASS | Existing records inspected; no payment/Undo/Edit execution |
| Warm offline → online report recovery | PASS, cached data retained and report200 after reconnect | Not separately repeated | Sync delta/ack recovered normally; no financial submission |

These are bounded journey observations, not comprehensive acceptance of all114 route files. Some preliminary XML filenames contain intended route/locale labels despite a missed tap or an Expo Tools overlay; they are **not** pass evidence. The accompanying receipt lists only inspected successful captures. No reproducible additional navigation defect was established by those missed/transition inputs. Hidden/deferred/fixture-gated features were preserved, including Security Events live content. Auth/onboarding/reset, actual logout/account switch, refunds/payments, dynamic records without normal prerequisites and unsupported custom-cycle behavior remain NOT_RUN/BLOCKED as applicable.

## Safe reconnect prerequisite and preservation

The existing Expo SQLite development inspector, after normal private PIN unlock, accepted aggregate SELECTs against the single registered owner database. No database export, key access, decryptor, application module invocation, inspector write or queue mutation was used. At10:46:22Z and11:21:45Z there were ten applied mutations, zero pending/sending/conflict/rejected entries, one retained finance draft, zero nonterminal/audio Voice/batch entries and zero pending SMS. Native preference metadata at10:47:20Z and11:22:11Z showed no queue ciphertext or legacy records and both capture sources disabled. The native readRecent API was deliberately not invoked because it prunes and writes. Counts are snapshots, not future guarantees; refresh before any later financial test.

These positive prerequisites permitted ordinary online read testing under the latest user authorization. Normal synchronization also issued protocol acknowledgments; no financial command was submitted. At11:17:56Z, authoritative transaction/account hashes matched the10:48:25Z preimage:81 transactions,87 postings,14 accounts, ten applied mutations. Read-only report arithmetic independently matched the phone: All Accounts income5600/expense13100 minor units; QA income100/expense2600. This is bounded report-value verification, not T05 qualification.

The unrelated other-owner import is still received/retrying with TRACKING_CAPTURE_DEFERRED. The worker-wide policy stayed held. Latest investigation identifies correlation_unresolved and absent reference evidence; investigation continues under T04. No pending other-owner record was modified, force-retried or settled.

Cleanup: DEV app stopped while offline, PID absent; owned Metro child37340/parent32912 identity checked then stopped; own8081 reverse removed/listener absent. Arabic, All Accounts, October, Wi-Fi1/data0/airplane0 restored with the app stopped. Financial/authentication data and all drafts/evidence preserved. The three-hour handoff strategy and original worktree/branch/HEAD remain unchanged.

Private receipts are in the existing T04 access-restoration evidence directory; `online-recovery-report-fix-receipt.json` binds the successful observations and source hashes.
