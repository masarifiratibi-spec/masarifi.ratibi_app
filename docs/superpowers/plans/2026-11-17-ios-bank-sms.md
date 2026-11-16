# iOS Bank SMS Implementation Plan

**Goal** — Save supported inbound SMS automatically through the Masarifi Shortcuts action after one-time account and category selection.

**Architecture** — A Swift App Intent runs inside the main iOS app target and calls an iOS Expo module. The module runs the existing financial parser in JavaScriptCore, uses the existing Clerk native SDK, and sends minimized commands to the ordinary ledger API. Consent, commands and deduplication are stored in one protected owner partition.

- [x] Package the existing parser for JavaScriptCore and verify supported expenses, salaries, missing currency and excluded OTP/failure cases in Node.
- [x] Add owner and session admission, existing financial generation and ledger requests, immutable retry, and receipt validation in the iOS module.
- [x] Publish native account/category choices to Shortcuts, configure enrollment inside the app, and wire logout, deletion and reset cleanup.
- [x] Verify iOS source inclusion, Android identity, TypeScript and focused tests. Native Xcode compilation and device acceptance require the separately authorized build.
- [ ] Verify a real synthetic inbound SMS, exact replay, second account, offline retry, lock behavior, and disabled consent on iPhone. Only call the automation active after verified capture and server receipt.

An automation uses one account and one category of the appropriate transaction direction. For an account that needs both income and expense capture, configure distinct filters. The status screen records skips and queued commands without a review queue.

The action receives text. An exact body is deduplicated across the active owner's automations for 24 hours. A parsed bank reference is also checked for 30 days in its selected account. Two identical bodies without a distinguishable identifier can collapse within the text window. Use a fresh synthetic SMS that was never submitted by the previous link-based route for native acceptance.

Retries preserve the command and idempotency key for up to 24 hours and resume on the next eligible trigger or app foreground. A network change alone does not schedule an iOS launch. The separate protected state becomes available after the first device unlock. Existing Clerk Keychain accessibility remains in place, so the device test must check whether the SDK can authorize a save while locked or needs a later retry.
