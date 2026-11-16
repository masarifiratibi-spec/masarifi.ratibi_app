# iOS Shortcuts assisted capture — design and execution plan

Scope: E:\Masarifi-iOS, existing iOS branch. No Android behavior/configuration changes, production database changes, OTA or Apple upload. One explicitly authorized AdHoc build 12 has been installed; no second build is authorized. The owner authorized selecting and implementing the practical free iOS path in the handoff.

## Device finding and corrected decision (build 12)

The owner explicitly authorized ONE AdHoc build despite the outstanding Face ID constraint. Build 12 (EAS e6550597-970f-4046-b9dd-2326e02c0746, source dba66e22) was installed as an update. Native Shortcuts delivery and local classification of the synthetic 12.34 SAR expense succeeded. The legacy v1 import returned a processing receipt; no ledger save was proved. The source review had missed the global tracking opt-in required by the legacy SQL helper, and the stale legacy aggregate acceptedCount behavior. The previous source qualification does not establish financial acceptance.

Correct the iOS-only confirmed action to the EXISTING ordinary ledger API, source platform_assisted, with explicit account/category confirmation. Keep the minimized immutable command in the existing owner queue and derive one stable operation UUID from the capture identity. Use the existing live ledger/category factories directly with a final dispatch guard; do not create a second offline sync lane. Offline or ambiguous delivery retains that same command/key for retry. Verify an actual synchronized server transaction before declaring saved. A previously queued legacy identity must NEVER be rerouted into the separate ledger idempotency scope; retain read-only reconciliation for its receipt. Do not change Android preferences, backend, SQL, roles or deployment. No second binary or OTA is authorized.

Corrected source qualification: 641 suites / 5459 tests, natural exit 0 in 856.852 seconds, no skips, timeout increases or forceExit. Mobile/API typechecks, scoped ESLint with zero warnings, frontend quality, config 34/34 and Android identity 35/35 plus actual verification passed. The isolated local PostgreSQL DTO/repository/receipt contract passed 3/3 with automatic tracking opted out. Independent review has no remaining Critical/Important findings. These are source/local-contract results; the corrected native financial save is NOT PROVEN on installed build 12.

The corrected enrollment rotates legacy tokens and preserves a monotonic same-owner ledger cutover after the legacy decoder's future timestamp allowance, including disable/reenroll and session changes. New iOS confirmations store local category IDs in iOS metadata without relaxing the shared queue UUID schema. Actual captured SDK owner/session identities are checked at ledger/category transport, with no additional default Android guard.

The earlier design below describes the installed build 12 and is retained as history, not as the corrected route's acceptance.

## Original decision (build 12)

Use a private `masarifi://capture-ios?payload=...` URL opened by Shortcuts, with a bounded JSON dictionary containing body, sender, receivedAt, messageId and an installation token. Sanitize the URL before Expo navigation. Hold the input in memory, bound to the enrollment owner and Clerk session; never persist or log the raw URL/message. Require in-app confirmation of the parsed amount/direction/account. Queue only minimized financial fields through SmsImportQueue and submit through the existing authenticated, generation-fenced v1 assisted/manual import contract, labeled ios_shortcut. This is assisted capture, not inbox access or Android's attested automatic v3 capture.

Alternatives: App Intent could avoid opening the app but requires a native build and an authenticated background design absent from the installed app. Share extension also requires a native build and remains interactive. Neither provides retrospective access to Messages or other apps' notifications. Opening the app may require unlocking; Run Immediately on the trigger does not remove this restriction.

No account/owner/amount supplied by the URL is authoritative. Local classification rejects OTP, nonfinancial, failed, ambiguous and unsupported accounting lifecycles. The user chooses an owned eligible account of matching currency. Incoming salary and outgoing purchase/fee are the initial supported actions. Other lifecycles remain in the existing manual flow. Use sender + stable original message identifier + original receive timestamp + content digest for replay identity; do not generate a fresh UUID/time for retries. Distinct identifiers preserve two genuinely distinct identical purchases. Server duplicate review remains authoritative.

## Tasks and checks

- [x] Write failing boundary tests for malformed/oversize/OTP input, replay/distinct IDs, minimized queue and owner/session changes.
- [x] Implement bounded decoder and assisted capture coordinator using the real parser and existing owner queue/import service. Offline work contains no source text and resumes only with current consent/session and after reset reconciliation. Reconcile submitted receipts independently of new capture permission.
- [x] Wire iOS-only native URL sanitization; preserve synchronous launcher and SSO branches and Android behavior.
- [x] Add bilingual setup/review/status UI with explicit enrollment, disable, retry, current receipt status and no false activation claim.
- [x] Run focused tests, typecheck, scoped lint, frontend boundaries and full mobile suite. Final source: 639 suites / 5430 tests, natural exit 0, 1067.614 seconds, no skipped tests or forceExit. Android identity checks: 35/35 plus actual identity verification; config/production: 34/34. Independent review reports no remaining Critical/Important findings.
- [ ] Device acceptance: connection restored and iPhone18,3 / iOS 27.2 / app 1.0.0 (10) verified. Message trigger and default Allow Running When Locked observed; disabled QA draft retained. Synthetic 12.34 SAR purchase, retry same identity, distinct second identity, foreground/background/cold/locked/offline/logout/disable still require a binary containing this receiver. Never mark device PASS from Jest.
- [x] Preserve Face ID/RTL/remaining QA and document the installed-source/build constraint in the Arabic acceptance report.

## Evidence boundaries

Installed AdHoc10 is source 5b5d3c7; current starting HEAD d62bfe0. It cannot execute a new receiver without a new app binary or OTA, neither authorized by this task. The remaining Face ID-before-build constraint applies. Source tests and a prepared Shortcut cannot establish installed-device activation. Any unavailable device case stays NOT RUN with its blocker.

Apple references (checked 2026-11-16):
- https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/ios
- https://support.apple.com/en-om/guide/shortcuts/apdfbdbd7123/10.0/ios/27
- https://developer.apple.com/documentation/appintents/appintent/authenticationpolicy
- https://developer.apple.com/documentation/appintents/appintent/openappwhenrun
