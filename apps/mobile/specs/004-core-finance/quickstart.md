# Quickstart: Validate Home, Accounts, Transactions, and Categories

## Purpose

Run the smallest automated and native checks that prove SPEC-004 financial, privacy, offline,
RTL, accessibility, and correction contracts. This guide assumes implementation tasks are
complete and uses synthetic fixtures only.

## Prerequisites

- Node.js and npm versions supported by the existing mobile workspace.
- Dependencies installed from the committed lockfile; SPEC-004 adds no runtime dependency.
- Android development build or emulator for keyboard, lifecycle, offline, and TalkBack checks.
- macOS/Xcode and an iOS development build for final VoiceOver and iOS checks.
- No real accounts, identifiers, merchants, transactions, or exchange rates in fixtures.

## Static and Automated Validation

From `apps/mobile`:

```powershell
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm test -- --runInBand
```

Expected outcome:

- Every command exits successfully.
- Boundary checks report no route-to-database access, hard-coded user-facing strings, raw brand
  values, production secrets, or unsupported platform claims.
- Tests prove integer money arithmetic, balance derivation, migrations, atomic mutations,
  validation, filtering, delete expiry, currency exclusions, merge, conflict resolution, masking,
  and query invalidation.

## Development Build

Android:

```powershell
npm run android
```

iOS on macOS:

```bash
npm run ios
```

## Scenario 1: Home and Sensitive Values

1. Load a populated fixture with active and archived accounts, two currencies, recent records,
   one pending-sync item, one review item, and later-feature previews.
2. Open Home in Arabic, light mode, and normal text.
3. Verify total, estimate label, excluded-currency warning, period movement, account count, recent
   records, review/sync status, and one clear next action.
4. Hide balances and inspect Home, Accounts, ledger, details, previews, and dialogs with TalkBack.
5. Background the application and inspect the app-switcher preview.
6. Repeat with empty, partial, stale, error, and offline fixtures.

Expected outcome: the current position is understandable within 10 seconds; estimates state what
they omit; masked values are absent visually, accessibly, and externally; every state has recovery.

## Scenario 2: Dense Ledger Discovery

1. Load 500 deterministic records spanning all specified types, sources, statuses, currencies,
   review states, and sync states.
2. Scroll through multiple date groups and open several details.
3. Search for a known title in Arabic and English.
4. Combine period, account, category, type, source, status, amount, and review filters.
5. Remove one filter, clear all, and create a valid filtered-empty result.
6. Inspect refund, reversal, transfer, failed, deleted-marker, pending-sync, and conflict records.

Expected outcome: the first page and changed filters appear within 300 ms on the fixture; no page
duplicates or omissions occur; filtered-empty differs from first-use empty; meaning is not color-only.

## Scenario 3: Manual Entry and Durable Drafts

1. Start an expense, enter partial data, trigger validation, and verify valid values remain.
2. Attempt to leave; choose Keep Editing. Repeat and explicitly discard.
3. Restart with a meaningful saved draft and resume it.
4. Complete expense, income, and obligation-payment records.
5. Attempt repeated submission while save is pending.
6. Open the keyboard on the smallest supported phone and at 200% text.

Expected outcome: amount remains dominant, validation identifies and focuses the exact issue, no
draft is lost, one save creates one ledger event, and keyboard/text scaling never hides save.

## Scenario 4: Transfers, Refunds, Adjustments, and Delete

1. Attempt a same-account transfer and verify it is blocked.
2. Complete a valid transfer with a fee and verify both derived balances change atomically while
   income and expense totals do not count the transfer itself.
3. Create a linked partial refund and verify it remains distinct from salary/income.
4. Adjust an account balance and verify an adjustment transaction appears.
5. Delete an eligible transaction, undo before 30 seconds, then delete again and allow expiry.
6. Restart during the second undo window and verify the deadline is not extended.

Expected outcome: no partial write occurs; relationships remain explicit; undo restores effects
exactly once; expiry leaves a deletion marker outside active totals.

## Scenario 5: Accounts

1. Load duplicate names, cash, debit, credit, wallet, savings, multi-currency, default, and
   archived accounts.
2. Search, create, edit metadata, set the default, and open each detail.
3. Attempt to edit currency after posted activity.
4. Preview and confirm account archive, then attempt to select it in a new transaction.
5. Compare displayed current balance with opening balance plus fixture transaction effects.

Expected outcome: duplicate names remain distinguishable; only one active default exists; balance
cannot be overwritten; archive preserves history and blocks unsupported new use.

## Scenario 6: Categories

1. Search the default hierarchy in Arabic and English.
2. Create a custom category with both labels and named icon/color choices.
3. Try missing labels, duplicate sibling labels, and a cyclic parent selection.
4. Favorite, archive, restore, and select recent categories.
5. Preview a merge with affected records, confirm it, and inspect historical transactions.

Expected outcome: labels, not color/icon, identify categories; invalid hierarchy is blocked; merge
reclassifies every source transaction atomically, archives the source, and leaves only the target selectable.

## Scenario 7: Offline and Conflict Resolution

1. Disable connectivity and create then edit a valid manual transaction.
2. Exercise pending, syncing, failure, retry, and restored-connection fixtures.
3. Introduce a later conflicting version and open comparison.
4. Test keep local, keep later, and keep both separately.
5. Dismiss conflict resolution without choosing.

Expected outcome: local work stays editable; both snapshots survive conflict; no dismissal or
timeout overwrites either version; each explicit resolution returns correct records to pending sync.

## Scenario 8: Language, Theme, Scale, and Access

Repeat Scenarios 1-7 across this minimum matrix:

| Dimension | Required values |
|---|---|
| Language | Arabic RTL, English LTR |
| Theme | Light, dark |
| Device | 320x568 logical phone, large phone, adaptive tablet |
| Text | Default, 200% |
| Screen reader | TalkBack; VoiceOver on macOS/iOS |
| Motion | Standard, reduced |
| Contrast | Full color and grayscale review |

Expected outcome: no amount, status, validation, filter, or primary action is hidden; focus order
is logical; mixed-direction values read naturally; touch targets and contrast pass; motion and
color are never required for meaning.

## Financial Invariants

Use deterministic fixtures to assert:

- Current balance equals opening balance plus eligible posted transaction effects.
- Expense, income, fee, refund, reversal, adjustment, obligation payment, and transfer follow
  [data-model.md](data-model.md).
- Transfer never inflates income or expense; refund/reversal never becomes salary.
- Delete and undo update account, Home, ledger, and relationships exactly once.
- Failed, deleted, draft, and unresolved-conflict records do not affect active totals.
- Category merge reclassifies all source references or writes nothing.
- Multi-currency totals retain original values and identify every excluded balance.

## Evidence to Retain

- Automated command output and migration/invariant test results.
- Device/platform matrix with versions.
- Arabic/English light/dark screenshots for Home, ledger, entry, account, category, and conflict.
- TalkBack/VoiceOver notes for financial announcements, masking, errors, and focus order.
- Offline, delete-expiry, currency-exclusion, and conflict-resolution evidence using synthetic data.

## Stop Conditions

Do not mark SPEC-004 complete if any check shows:

- A stored balance diverging from ledger-derived effects.
- A silent, partial, duplicated, or unrecoverable financial change.
- A conflict overwriting either version without explicit choice.
- An estimate implying excluded currency was included.
- Sensitive content in external previews, accessibility output while hidden, analytics, or errors.
- Manual entry blocked offline or by an automation state.
- Arabic/English, 200% text, screen-reader, contrast, keyboard, or reduced-motion failure.
