# Quickstart: Validate Automatic Transaction Capture and Platform-Specific Tracking

Use this guide after the SPEC-005 implementation tasks are complete.

## Prerequisites

- Node.js supported by Expo SDK 51.
- Existing SPEC-001 through SPEC-004 checks passing.
- Android development build on an emulator or connected device for permission and settings checks.
- iOS development build on macOS for native platform-separation checks.
- Deterministic tracking fixtures reset before each scenario.

## Install and Check

From `apps/mobile`:

```powershell
npm install
npx expo install --check
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
npx jest --runInBand
```

Expected: dependency alignment, typecheck, lint, boundary checks, and tests pass without production
secrets, provider calls, a production SMS parser, or unsupported iOS SMS claims.

## Start the Application

```powershell
npx expo start --dev-client
```

For Android native permission or manifest changes, rebuild and install with:

```powershell
npm run android
```

## Scenario 1: Android Status and Recovery

1. Open `/tracking` on Android with not-requested permission.
2. Confirm education precedes the system prompt and manual entry remains available.
3. Exercise granted, denied, permanently denied, revoked, paused, interrupted, battery-restricted,
   offline, and restored fixtures.
4. Confirm each state names one appropriate request, retry, settings, resume, or manual action.
5. Confirm latest detection, latest transaction, monthly count, review count, active keyword and
   sender counts, background condition, and last update are coherent.

Expected: tracking can be enabled, paused, resumed, and recovered without blocking the app.

## Scenario 2: Confidence and Eligibility

1. Run clear eligible fixtures at 90%, 89%, 60%, and 59% confidence.
2. Run failed, authentication-code, marketing, duplicate, amount-conflict, rule-conflict, and
   multiple-obligation fixtures at high confidence.
3. Switch among automatic-clear, review-all, and paused modes.

Expected: 90% eligible auto-adds only in automatic-clear mode; 60-89% reviews; below 60% ignores;
safety overrides never auto-add; review-all reviews eligible events; paused changes no finances.

## Scenario 3: Automatic Add, Feedback, and Undo

1. Process a clear purchase and confirm one transaction appears with automatic source.
2. Confirm affected Home, account, ledger, and available projections update once.
3. Confirm in-app and mock phone-notification feedback respects privacy masking.
4. Undo before 30 seconds and confirm all effects restore atomically.
5. Repeat, restart or background the app, allow the deadline to expire, and confirm Undo is no
   longer available while Edit and Detail remain.
6. Process the same source fingerprint again and confirm no duplicate transaction is created.

Expected: one idempotent financial mutation, consistent query refresh, reversible within the exact
deadline, and safe correction afterward.

## Scenario 4: Review and Duplicate Resolution

1. Open a review item with multiple amounts, unknown merchant, low category confidence,
   ambiguous account, possible reversal, and conflicting rule reasons.
2. Confirm dismissal leaves it pending and invalid edits preserve valid values.
3. Confirm a corrected item and verify one exact ledger mutation.
4. Exercise Ignore and Report Wrong and confirm neither creates a transaction.
5. Compare a duplicate and exercise Keep Existing, Keep New, Keep Both, and Merge Details.
6. Confirm Merge keeps the existing ID, adds only approved missing metadata, and never changes
   amount, currency, date, or account without separate edit confirmation.

Expected: uncertain financial data never changes records before explicit resolution.

## Scenario 5: Pending Event and Obligation Relationships

1. Process a pending event followed by a clear completion, reversal, refund, and failure fixture.
2. Confirm each clear follow-up updates or links to the original rather than adding an unrelated
   ordinary expense.
3. Repeat with uncertain relationship signals and confirm review is required.
4. Process one clear obligation match and confirm transaction and mock obligation effects update
   together.
5. Process several obligation candidates and confirm neither area changes before review.

Expected: lifecycle and obligation effects preserve one understandable financial history.

## Scenario 6: Keywords, Senders, and History

1. Search and filter Arabic and English keyword packs; add a custom keyword and verify normalized
   duplicate prevention.
2. Try disabling the last active keyword in a group and confirm deliberate warning is required.
3. Restore defaults and confirm unrelated custom keywords remain.
4. Add, label, associate, trust, disable, and remove applicable sender fixtures.
5. Confirm a trusted sender never bypasses failure, duplicate, ambiguity, or review safeguards.
6. Clear tracking history and confirm posted transactions remain.

Expected: rule controls are understandable, searchable, reversible where required, and separate
from operating-system permission scope.

## Scenario 7: Source Retention and Privacy

1. Open status, review, duplicate, history, feedback, and transaction detail with balances shown
   and hidden.
2. Confirm source text and sensitive amounts are absent from protected accessibility output,
   notifications, errors, analytics fixtures, and app-switcher previews.
3. Advance the fixture clock to just before and after 30 days and run retention cleanup.
4. Confirm source text is purged at expiry while extracted fields, fingerprint, reasons, and the
   posted transaction remain.
5. Use clear history before expiry and verify the same separation.

Expected: full source text is local-only, maskable, user-removable, and never retained beyond 30 days.

## Scenario 8: iOS Platform Honesty

1. Open every capture and tracking entry point on iOS, including direct links to Android routes.
2. Confirm no SMS permission, inbox-reading, service-state, keyword, or sender UI renders.
3. Confirm manual and voice capture remain reachable.
4. Confirm optional Shortcuts, App Intents, Share Extension, quick actions, or widgets appear only
   when the capability fixture reports support.
5. Skip or fail optional setup and confirm Home remains usable.

Expected: iOS receives equal-quality alternatives without an Android SMS promise.

## Scenario 9: Localization, Accessibility, and Layout

Repeat the critical status, review, duplicate, rules, feedback, permission, and iOS-alternative
flows with:

- Arabic RTL and English LTR.
- Light and dark themes.
- 320 by 568 and large phone layouts.
- 200% text size and open keyboard.
- TalkBack or VoiceOver.
- Reduced motion and grayscale.
- Hidden balances and long mixed-direction sender/reference values.

Expected: no amount, reason, status, privacy explanation, or primary action is clipped or hidden;
focus order is logical; rows announce coherent meaning; no state relies on color or motion.

## Native Evidence Record

Record device, OS/API level, package version, permission result, platform, locale/direction, theme,
text scale, assistive technology, scenario result, and screenshot or UI-tree evidence. Windows can
complete Android checks; mark iOS native checks blocked until a macOS/Xcode host is available.

## Contract References

- [Data model](data-model.md)
- [Automatic tracking contract](contracts/automatic-tracking-contract.md)
- [Feature specification](spec.md)

## Implementation Validation - 2026-08-09

Automated checks:

- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npx expo install --check` after network approval; dependencies are up to date.
- PASS: `npm run check:foundation`
- PASS: `npm run check:design-system`
- PASS: `npm run check:app-shell`
- PASS: `npm run check:core-finance`
- PASS: `npx jest --runInBand --forceExit` - 181 suites, 473 tests.

Scan results:

- PASS: no production SMS parser, background reader, provider call, camera, receipt, bank connection, or AI provider was added for SPEC-005.
- PASS: new tracking UI strings are in Arabic and English catalogs.
- PASS: iOS tracking routes use manual, voice, and supported alternatives and do not render keyword, sender, inbox, service-state, or background tracking controls.
- PASS: raw color findings are limited to existing design-system token files and foundation legacy screens; new tracking feature files use shared components and tokens.
- PASS: source text stays in the tracking repository event payload only and is cleared by history clearing or retention purge.

Native scenario status:

- Android native matrix: BLOCKED. On 2026-08-10, physical device `RK8XB00N33K` and `com.masarifi.mobile` were detected, but Android reported `deviceLocked=1`; UI automation could access only System UI. T087 remains unchecked.
- iOS native matrix: BLOCKED on this Windows host; macOS/Xcode device or simulator host required.

Scenario results:

- Scenario 1 Android Status and Recovery: BLOCKED_ANDROID_NATIVE_MATRIX for device permission/settings proof; automated status and recovery tests PASS.
- Scenario 2 Confidence and Eligibility: PASS by policy/domain tests.
- Scenario 3 Automatic Add, Feedback, and Undo: PASS by financial-effect, feedback, and undo tests.
- Scenario 4 Review and Duplicate Resolution: PASS by review, duplicate, and review journey tests.
- Scenario 5 Pending Event and Obligation Relationships: PASS for review-required ambiguity and mock obligation boundary; production obligation ledger remains out of scope.
- Scenario 6 Keywords, Senders, and History: PASS by keyword, sender, rules, and retention tests.
- Scenario 7 Source Retention and Privacy: PASS by privacy and retention tests.
- Scenario 8 iOS Platform Honesty: PASS by route guard and localization tests; BLOCKED_IOS_NATIVE_MATRIX for device proof.
- Scenario 9 Localization, Accessibility, and Layout: PASS by automated accessibility/localization tests; BLOCKED_NATIVE_A11Y_MATRIX for TalkBack/VoiceOver and device-size proof.
