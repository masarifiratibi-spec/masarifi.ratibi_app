# Quickstart: Validate Notifications, Assistant, Subscriptions, Settings, and Support

## Purpose

Use this guide after implementation to prove SPEC-009 against its specification, data model, and
[contract](contracts/assistant-notifications-contract.md). It validates deterministic frontend
behavior and local device notifications; it does not validate remote push, production AI,
payments, support operations, export delivery, or backend account deletion.

## Prerequisites

- Run commands from `apps/mobile`.
- Install the committed dependencies with `npm install`.
- Use the committed deterministic fixtures; no API keys, tokens, payment credentials, or support
  credentials are required.
- Use an Expo development build for operating-system notification permission, categories,
  cold-start response, and quick-action checks.
- Use an Android emulator/device for the required native pass on Windows. Record iOS and
  VoiceOver evidence as blocked unless macOS/Xcode evidence is available.
- Seed dates explicitly in tests. Do not depend on wall-clock time for quiet hours, expiry,
  renewal, or stale-preview outcomes.

## Static and Automated Validation

Run the complete existing gates plus the new feature boundary and focused suite:

```powershell
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
npm run check:voice-capture
npm run check:financial-planning
npm run check:reports
npm run check:assistant-notifications
node scripts/check-assistant-notifications-boundaries.test.mjs
npm test -- --runInBand
```

Expected:

- Every command exits zero.
- The feature boundary reports no direct SQLite access from screens, AI/payment/remote-push/
  support provider import, production-success copy, raw color, feature entity in Zustand,
  unguarded protected notification action, sensitive analytics key, or unsupported iOS/SMS claim.
- Database tests prove schema version 7 and every new table/index.
- Arabic and English localization keys remain equivalent.

## Development Build

Start Metro for a development build:

```powershell
npm run start -- --localhost
```

Launch Android:

```powershell
npm run android
```

On macOS/Xcode, launch iOS:

```powershell
npm run ios
```

Never mark an unavailable native platform check as passed.

## Scenario 1: Notification Center and Source Integrity

1. Seed automatic expense, income, voice, manual, review, duplicate, refund, obligation, budget,
   salary, savings, report, assistant, security, and system events.
2. Open `/notifications`; switch All, Unread, Transactions, Obligations, Budgets, Reports,
   Assistant, and Security filters.
3. Confirm date grouping, unread count, page continuity, source/category/status wording, and empty
   states.
4. Mark one event read, mark the visible filter read, restart, and confirm persistence.
5. Create the same source event twice and confirm one notification exists.
6. Delete a transaction notification and open the transaction separately.

Expected:

- Every event has one clear category/status and typed destination.
- Bulk actions affect only the current filter and do not duplicate after retry.
- Deleting a notification removes only the notification; the transaction and every other source
  record remain unchanged.
- Removed, merged, archived, or resolved targets show a localized safe fallback.

## Scenario 2: Permission, Quiet Hours, Summaries, and Privacy

1. Exercise `not_requested`, granted, denied, permanently denied, restored, and unavailable
   permission fixtures; on native, verify the actual operating-system state and settings recovery.
2. Disable one phone category and confirm its in-app event still appears.
3. Test quiet hours within one day and across midnight in the profile timezone, then change the
   timezone.
4. Trigger a routine event and each critical access event during quiet hours.
5. Enable daily and weekly summaries and verify covered periods and no individual/summary double
   presentation.
6. Test global hidden balances on/off and lock-screen amount hiding on/off.

Expected:

- Permission and in-app preferences are never conflated.
- Only new session, session revocation, and account-access protection changes bypass quiet hours.
- Hidden values are absent from native title/body/action labels, previews, and accessibility
  announcements, not merely visually obscured.
- In-app history remains complete regardless of phone delivery.

## Scenario 3: Notification Deep Links, Quick Actions, and Unlock

1. Present a local notification for View, Edit, and Undo with the app foregrounded, backgrounded,
   terminated, locked, and unlocked.
2. Exercise both the startup last-response path and live response listener.
3. Change or expire the source action before selecting it.
4. Select a protected action while the app privacy gate is locked.
5. Repeat the same native response/operation ID.

Expected:

- Native payload contains only the local notification ID.
- Protected content/actions require normal app unlock, then fresh source/action revalidation.
- Expired or changed actions do not execute; the user receives a valid destination or explanation.
- Cold/live/repeated response handling applies an action at most once.

## Scenario 4: Assistant Consent, Answers, and Immutable Snapshots

1. Open `/assistant` with consent not requested, disabled, and enabled.
2. Ask direct, comparison, explanation, saving suggestion, plan, and obligation questions using
   complete confirmed data.
3. Ask again with insufficient, stale, partial, review-required, conflict, and missing-report
   context.
4. Inspect fact, estimate, suggestion, period/as-of time, evidence path, and limitations.
5. Change a supporting transaction after a response completes, reopen the old response, then ask
   the same question again.
6. Rename/delete a conversation and submit helpful/not-helpful/report feedback.

Expected:

- No personalized answer appears before consent or after personalization is disabled.
- Confirmed values come from canonical services; no balance, total, cause, or affordability is
  invented.
- The old response preserves its snapshot and as-of time; the new answer uses current confirmed
  context.
- Investment or out-of-scope requests receive an educational safe redirect.
- Conversation deletion never changes a financial record.

## Scenario 5: Assistant Action Preview and Confirmation

1. Generate every supported navigation and data-changing proposal.
2. Open the preview, inspect affected values/destination, edit where allowed, cancel, and confirm.
3. Change the source budget/goal/obligation/transaction or plan entitlement before confirmation.
4. Confirm while offline, force a representative failure, retry after review, and repeat the same
   operation ID.

Expected:

- Ordinary conversation text creates no financial change.
- Cancel/navigation interruption creates no change and retains relevant preview input.
- Source-version mismatch marks the preview stale and requires review.
- A current confirmed preview invokes its canonical owner once; retry/replay cannot duplicate it.
- Success links to the owning feature; failure exposes no raw error.

## Scenario 6: Subscription Catalog and Lifecycle

1. Compare Free, Basic, and Premium monthly/annual offers from one catalog version.
2. Review price/currency, billing period, features/limits, trial eligibility/duration, post-trial
   price, renewal, cancellation, and representative-payment notice.
3. Exercise purchase, trial, restore, change, cancel-at-period-end, renewal, expiry, failure, and
   cancellation fixtures.
4. Repeat each operation ID and change the catalog/state version before confirmation.
5. Open content created through a paid feature after downgrade/expiry.

Expected:

- Comparison and checkout use the same catalog version.
- Entitlement changes only on representative success; failure/cancel preserves prior state.
- Restore/change is idempotent and catalog/state conflict returns to review.
- Paid-only existing content remains visible read-only and exportable where export already exists;
  core financial data is not deleted.

## Scenario 7: Profile, Application, Security, and Privacy

1. Edit name/email/country/currency/timezone and device-local language/theme/week/default/
   dashboard/voice settings; force validation and save failure.
2. Confirm Reports and notification policy use the updated timezone instead of a hard-coded value.
3. Verify `hideBalances` changes from both Security and application settings remain one value.
4. Exercise PIN, biometrics, auto-lock, session list, one-session revocation, sign-out-all, and
   security events with pending/success/failure.
5. Disable tracking and assistant personalization and verify unaffected manual use.
6. Exercise export and account-deletion requests through review, pending, accepted, and failed.
7. Confirm local-data deletion scope, execute success and forced rollback, then restart.

Expected:

- Forms preserve entered values until save or explicit discard.
- Current session clears only after successful revocation/sign-out.
- Export/account deletion say request accepted, never file delivered/account deleted.
- Successful local deletion clears the allowlisted local user data and caches while preserving
  session, security controls, accessibility/localization preferences, profile, and entitlement.
- Forced deletion failure rolls back and claims no success.

## Scenario 8: Help, Tickets, Feedback, and Context Reports

1. Search FAQ/help/What's New with exact, partial, Arabic, English, and no-result queries.
2. Create ticket, feedback, transaction report, and assistant report drafts; navigate away,
   restart, go offline, and restore.
3. Review optional context off and on, remove it, submit, retry, and repeat an operation ID.
4. Open the ticket list/detail, reply, and rate unresolved/resolved tickets.

Expected:

- No-result search offers the shared support form.
- Drafts survive validation, interruption, offline state, and representative failure.
- Context uses the exact allowlist; unrelated amounts, account identifiers, raw SMS, conversation
  history, secrets, and attachments are absent.
- Only successful idempotent operations create a ticket/reply/report; rating requires resolution.

## Scenario 9: Recovery, Localization, and Accessibility Matrix

For every major screen, validate:

- Arabic RTL and English LTR, including mixed-direction financial names, times, prices, renewal
  dates, ticket references, and English numerals.
- Light/dark themes; 320 by 568 phone, large phone, and tablet.
- Default and 200% text; TalkBack/VoiceOver; logical focus; 44 by 44 targets.
- Standard/reduced motion; color/grayscale; values visible/hidden.
- Loading, empty, complete, dense, partial, stale, offline, permission, disabled, limit, pending,
  success, failed, expired, action-expired, and deleted-target states.

Expected:

- Status, consent, fact/estimate/suggestion, category, read state, price/period, renewal, warning,
  success, and failure never depend on color, motion, haptics, or illustration.
- Protected values are neither rendered nor announced while hidden.
- Recovery actions are localized and no raw technical/provider error appears.

## Performance Fixture

Run the focused performance test after one warm-up:

```powershell
npm test -- --runInBand src/features/notifications/assistant-notifications-performance.test.tsx
```

Fixture:

- 1,000 notifications across categories, dates, read/deleted/sync states, and duplicate keys.
- 1,000 assistant responses across conversations, periods, labels, and completeness states.

Expected:

- First useful filtered/grouped content appears within two seconds on supported test hardware.
- Filter/search/group counts are exact across page boundaries.
- Each list mounts fewer than 100 item rows at once.
- No source record, snapshot, question, answer, notification body, or protected value enters test
  logs or analytics.

## Invariants

- A notification source event produces at most one in-app record.
- Notification deletion never mutates its linked source.
- Protected phone actions require unlock and current revalidation.
- Quiet-hour bypass is limited to critical access events.
- Old assistant responses never refresh; new questions use current confirmed context.
- Assistant changes require a current preview, confirmation, and stable operation ID.
- Subscription/support/session operations change visible state only after representative success.
- Paid-only prior content becomes read-only, never deleted.
- One global hidden-balance value controls every screen and external presentation.
- Account deletion/export are request states; local-data deletion is transactional and allowlisted.
- No production secret or false provider success exists.

## Evidence to Retain

- Command output for every static/automated gate.
- Database schema v7 and persistence/idempotency test results.
- Android screenshots/recordings for permission education/system prompt, settings recovery,
  foreground/background/cold-start notification, each quick action, unlock, expired fallback, and
  hidden-values presentation.
- Arabic/English, light/dark, 200% text, TalkBack, small-phone, offline, paywall disclosure,
  assistant limitation/preview, support draft, and deletion rollback evidence.
- Performance result with fixture size, elapsed time, and mounted-row count.
- Explicit blocked note for unavailable iOS/VoiceOver native evidence.

## Stop Conditions

Stop and fail validation if any screen or test:

- Requests a remote push token or contacts an AI/payment/support/export/account provider.
- Shows a protected amount in native/app-switcher/accessibility output while hidden.
- Executes View/Edit/Undo before unlock and revalidation.
- Rewrites an old assistant response from live data or applies a conversational change directly.
- Changes entitlement/ticket/session/privacy state after failed, cancelled, stale, or repeated
  operations.
- Deletes source data when deleting a notification or paid-only data after downgrade.
- Claims real payment, support processing, file export, account deletion, or background delivery.
- Marks unavailable native evidence as passed.
