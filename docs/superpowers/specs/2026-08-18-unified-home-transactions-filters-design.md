# Unified Home and Transactions Filters Design

## Goal

Give Home and Transactions one Masarifi filter language while keeping their existing state and query owners. Home remains period-focused; Transactions exposes its supported advanced filters directly and no longer shows `All Filters / كل الفلاتر` in the quick-filter sheet.

## Source of truth

Implementation targets the existing `codex/r01-shared-ui-foundation` worktree. Its Home period sheet is the approved visual and interaction baseline. The root worktree still contains the older screens and is not part of this change.

## Architecture

The current Home period model and sheet move to shared filter ownership under `apps/mobile/src/features/filters/`. The shared date-range sheet retains the existing three-step flow: choose a mode, select a month, or apply an inclusive custom range. Home and Transactions import this same component and the same UTC month/custom-range helpers; there is no second month picker or date calculation.

Existing design-system primitives remain the shared visual foundation: `AppSheet`, `ChipSelector`, `PickerField`, `ActionButton`, icons, spacing, radii, and theme tokens. No new navigation layer or dependency is introduced.

Transactions keeps `useCoreFinanceViewState` as the owner of applied and draft filters. Opening either transaction filter surface begins a draft session. Applying a period patches only `periodStart` and `periodEnd`, then applies the draft, so search, sort, types, categories, accounts, sources, statuses, review state, and amount limits remain unchanged.

## Shared date flow

`DateRangeSheet` accepts a current period plus `onApply` and `onDismiss`. It is presentation-only and does not know about Home or Transactions stores.

- Home keeps its existing local period state and filtered Home summary query.
- The Transactions month control derives a shared period from the applied transaction dates, defaulting to the current month when no dates are applied.
- Selecting a month or custom range updates the visible Transactions label and its existing transaction query through `useCoreFinanceViewState`.
- The Transactions summary query receives the selected period without changing summary calculation semantics.

## Transactions filter sheet

The existing Transactions quick sheet remains the single entry point from the overflow action. Its contents use the same sheet, section spacing, chips, picker rows, selected dark-teal treatment, and actions as the shared filter language.

The sheet exposes only already-supported filters: sorting, types, categories, accounts, sources, record/sync status, review state, and amount range. Period selection uses the shared date-range sheet instead of text date fields. Category and account selection reuse the existing pickers.

The existing advanced-filter route and filter logic remain available for compatibility, but its content is shared with the quick sheet. The quick sheet does not navigate to it and does not render `All Filters / كل الفلاتر`.

## Directionality and accessibility

Layout uses the stored `rtl`/`ltr` direction for row order, chip order, writing direction, and mirrored directional icons. Shared controls keep semantic button roles, selected states, accessible labels, minimum touch targets, and the existing dismiss behavior. Directionality is structural rather than text-alignment-only.

## State and data guarantees

- No API, repository, persistence, filter schema, or sorting semantic changes.
- Home and Transactions keep separate state owners.
- Opening and cancelling restores the applied Transactions state.
- Applying a period changes only the two period fields.
- Applying another Transactions filter does not reset the period or unrelated selections.
- Reset affects the draft until the user applies it, matching current behavior.

## Focused verification

Tests will prove:

- Home and Transactions render the same `DateRangeSheet` flow.
- Month and custom-range selection update the correct owner.
- A Transactions period change preserves unrelated filters.
- The quick sheet opens and directly exposes sorting, types, categories, accounts, and sources.
- Existing supported advanced filters remain reachable.
- `All Filters / كل الفلاتر` is absent.
- Arabic uses RTL structure and English uses LTR structure.
- Existing Home period, transaction filter-state, query, and route tests remain green.

Visual comparison will use the current Home period sheet and supplied month-pill screenshot as the baseline in both Arabic and English.
