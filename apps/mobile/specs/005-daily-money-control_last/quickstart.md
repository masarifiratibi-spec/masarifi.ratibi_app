# Quickstart: Validate Daily Money Control

## Purpose

Run the smallest automated and native checks that prove the feature's financial, trust, platform, RTL, accessibility, privacy, and offline contracts. This guide assumes implementation tasks are complete; it does not replace the acceptance scenarios in [spec.md](spec.md).

## Prerequisites

- Node.js and npm versions supported by the existing mobile workspace.
- Dependencies installed from the committed lockfile, including the Expo SDK 51-compatible audio recording package selected in [research.md](research.md).
- Android development build or emulator for SMS/microphone permission and app-lifecycle checks.
- macOS/Xcode and an iOS development build for final iOS microphone and platform-honesty checks; these cannot be proven on the Windows host.
- Synthetic fixtures only. Do not use real bank messages, accounts, phone numbers, or voice recordings.

## Setup and Static Validation

From `apps/mobile`:

```powershell
npm install
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm test -- --runInBand
```

Expected outcome:

- Every command exits successfully.
- Boundary checks report no route-to-database, route-to-native-provider, raw-token, hard-coded user-string, or unsupported platform access.
- Automated tests prove money arithmetic, validation, repository migrations, state transitions, filters, idempotency, permission mapping, masking, and critical component journeys.

## Development Build

Android:

```powershell
npm run android
```

iOS on macOS:

```bash
npm run ios
```

Use development builds rather than a generic preview client for real SMS and microphone permission behavior.

## Scenario 1: Home and Privacy

1. Load the populated bilingual fixture with two currencies, recent transactions, one review item, and one planning preview.
2. Open Home in Arabic, light mode, normal text.
3. Verify total, estimate label, salary-cycle preview, review action, recent transactions, and quick actions follow the UI contract.
4. Hide balances and inspect Home, Accounts, Transactions, transaction detail, review, and voice proposal surfaces.
5. Enable a screen reader and confirm no masked value is announced.
6. Background the application and inspect the app-switcher preview.

Expected outcome: the current position is understandable within the success target; estimates retain original currency context; masking applies visually, accessibly, and externally.

## Scenario 2: Dense Ledger Discovery

1. Load at least 500 records spanning every supported transaction/source/status meaning.
2. Open Transactions and scroll through multiple date groups.
3. Search for a known merchant/title.
4. Combine period, account, category, type, source, status, amount, and review filters.
5. Remove one chip, clear all, then create a valid filtered-empty result.
6. Open transfer, refund, reversal, failed, pending-sync, and review-required details.

Expected outcome: scrolling remains responsive, ordering is deterministic, matching records appear within the success target, filtered-empty differs from first-use empty, and each financial meaning is clear without color.

## Scenario 3: Manual Entry, Draft, and Offline Sync

1. Start an expense, enter amount and partial fields, trigger validation, and confirm entered values remain.
2. Attempt to leave and choose Keep Editing; repeat and explicitly discard.
3. Complete expense and income records.
4. Attempt a same-account transfer, then complete a valid transfer with fee and currency estimate.
5. Create a linked refund and verify it is not counted as salary/income.
6. Disable connectivity, save a manual record, edit it while pending, then restore connectivity.
7. Exercise sync success, failure/retry, and conflict fixtures.

Expected outcome: validation is specific, no draft is lost, multi-record changes are atomic, offline state remains editable, and totals change exactly once.

## Scenario 4: Accounts and Categories

1. Load duplicate account names, credit/cash accounts, multiple currencies, a default account, and an archived account.
2. Search, open detail, adjust balance with preview, archive, restore, and attempt to select archived data in a new transaction.
3. Search a dense category tree in Arabic and English.
4. Create a bilingual custom category using named icon/color choices.
5. Archive an unused category and merge an in-use category after reviewing impact.

Expected outcome: duplicate names remain distinguishable, archived entities preserve history but cannot be used incorrectly, balance adjustment is confirmed, and category identity never depends on emoji/color.

## Scenario 5: Android Automatic Tracking and Review

On Android, test these states separately: not requested, granted, denied, permanently denied, revoked, paused, interrupted, battery restricted, and sync failed.

For each state:

1. Open Tracking.
2. Verify exact state copy, valid primary action, and manual/voice fallback.
3. Run synthetic clear, multi-amount, OTP, failed, unknown-sender, reversal, ambiguous-account, and duplicate fixtures.
4. Reprocess the same source reference.
5. Resolve review through edit/confirm, keep existing/new/both, merge, ignore, and report-wrong paths where valid.
6. Undo one clear automatic addition.

Expected outcome: education precedes first request; raw permission scope is honest; uncertain data never mutates the ledger; duplicate processing is idempotent; applied items expose view/edit/undo.

## Scenario 6: iOS Platform Honesty

On iOS:

1. Open onboarding recovery, Tracking-related entry points, Home quick actions, and Add.
2. Search all visible copy and accessibility actions for a direct SMS enable/request claim.
3. Use manual entry and proceed to voice permission.

Expected outcome: no direct SMS permission or inbox-tracking action exists; manual, voice, and approved platform alternatives remain first-class.

## Scenario 7: Voice Capture and Confirmation

On both native platforms:

1. Exercise microphone not-requested, denied, permanently denied, and granted states.
2. Record, stop, cancel, re-record, interrupt, reach maximum duration, and return from background.
3. Run clear single, missing optional field, missing required field, unknown merchant, multiple transaction, income, transfer, obligation, unsupported language, no-speech, and failed-analysis fixtures.
4. Review transcript and proposals; edit, remove, select, confirm selected, and confirm all.
5. Inspect development diagnostics and cache after terminal paths.

Expected outcome: permission recovery is specific, manual fallback remains available, transcript precedes proposals, confirmation is explicit, no duplicate submission occurs, and audio cache files are removed without entering logs or analytics.

## Scenario 8: Arabic, English, Themes, Scale, and Motion

Repeat Scenarios 1–7 across this minimum matrix:

| Dimension | Required values |
|---|---|
| Language | Arabic RTL, English LTR |
| Theme | Light, dark |
| Device | 320×568 logical phone, large phone, adaptive tablet |
| Text | Default, 200% |
| Screen reader | TalkBack; VoiceOver on macOS/iOS |
| Motion | Standard, reduced |
| Contrast | Full color and grayscale review |

Expected outcome: no hidden amount/status/action, logical focus order, correct mixed-direction values, adequate touch targets/contrast, no color-only state, and equivalent reduced-motion outcomes.

## Scenario 9: Financial Invariants

Use deterministic fixtures to assert:

- Expense, income, fee, refund, reversal, adjustment, obligation payment, and transfer affect balances and summaries according to [data-model.md](data-model.md).
- Transfer never increases income or expense; fee remains separate.
- Refund/reversal never becomes salary.
- Undo restores every affected account, transaction relation, Home total, and companion invalidation scope exactly once.
- Failed, rejected, previewed, cancelled, and unresolved operations do not alter financial totals.
- Original multi-currency values remain available and aggregates are marked estimated.

Expected outcome: every invariant passes with integer minor-unit arithmetic and no partial database write.

## Evidence to Retain

- Automated command output.
- Test matrix result with device/platform versions.
- Arabic/English light/dark screenshots for Home, ledger, entry, review, tracking, and voice review.
- TalkBack/VoiceOver notes for combined financial announcements and focus order.
- Permission-state screenshots without real sensitive content.
- Proof that raw message, transcript, audio URI, amount, merchant, and account data are absent from analytics/error output.

## Stop Conditions

Do not mark the feature complete if any test shows:

- A silent, partial, duplicated, or unrecoverable financial change.
- An uncertain automatic item applied without review or a voice proposal saved without confirmation.
- Direct SMS tracking shown or implied on iOS.
- Sensitive content in notifications, app-switcher previews, analytics, logs, or raw errors.
- A primary task blocked by permission denial or offline operation.
- Arabic/English, 200% text, screen-reader, contrast, or reduced-motion failure.
