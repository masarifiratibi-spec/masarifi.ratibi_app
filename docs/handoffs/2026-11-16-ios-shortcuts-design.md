# iOS Shortcuts assisted capture — design and execution plan

Scope: E:\Masarifi-iOS, existing iOS branch. No Android behavior/configuration changes, production database changes, OTA, IPA build or Apple upload. The owner authorized selecting and implementing the practical free iOS path in the handoff.

## Decision

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
