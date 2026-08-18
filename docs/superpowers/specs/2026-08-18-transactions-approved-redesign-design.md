# Approved Transactions Screen Redesign

**Date:** 2026-08-18  
**Status:** Approved for implementation planning  
**Primary target:** `apps/mobile/src/features/transactions/TransactionListScreen.tsx`

## Goal

Replace the current dark, individually-carded Transactions presentation with the supplied approved light composition while preserving Masarifi's real data, canonical design system, filters, privacy behavior, pagination, and direct edit navigation.

## Product and Visual Direction

The screen is an Arabic-first, high-density financial ledger used for quick scanning. The approved reference is the primary composition target: a light neutral page, compact shared header, centered month pill, paired summary cards, horizontal category chips, and time-grouped transactions.

The visual world remains Masarifi Gulf Premium. It uses the canonical dark teal, financial income green, financial expense coral, neutral page surface, white elevated cards, semantic borders, shared radii, shared typography, and existing category visuals. No feature-level raw colors, emoji mappings, fabricated merchants, or sample totals may be introduced.

The defining visual move is a single continuous rounded card for each real time group. Transactions are rows inside that visual card, not separate outer cards.

## Chosen Architecture

Retain the existing virtualized `FlatList`, infinite transaction query, flattened section-header/transaction-row model, and `groupedPosition` metadata. Consecutive transaction rows will visually join into one group card:

- `first`: top corners and outer top/side border;
- `middle`: shared surface and side borders with an inset internal divider;
- `last`: bottom corners and outer bottom/side border;
- `only`: all outer corners and borders.

This produces the approved group-card composition without rendering an unbounded historical section as one non-virtualized child tree. Pagination and row virtualization remain owned by the existing list.

Rejected alternatives:

1. Rendering a whole time group as one list item would match the component hierarchy literally but would sacrifice row-level virtualization for a potentially large Earlier group.
2. Replacing the list with `SectionList` would create unnecessary query, pagination, and test churn without improving the rendered result.

## Screen Composition

### Header

Use `PrimaryShellHeader` for the tab-root header and the existing back callback for embedded/deep contexts. On the light page treatment, the shared header retains avatar and navigation ownership. The center area composes the Transactions title with accessible icon-only search and quick-filter actions in one compact row. Arabic places the title and navigation on the reading edge and actions/avatar on the opposite edge; English mirrors the physical composition.

Search keeps the existing draft/apply/clear behavior and appears immediately below the header when expanded. The overflow action opens the existing shared Transactions filter sheet. The redundant All Filters entry remains absent.

### Month Selector

Place a centered rounded month pill immediately below the header with the existing calendar icon, localized period label, and dropdown affordance. Pressing it opens the shared `DateRangeSheet`; no new picker or period state is introduced.

Applying a period patches only `periodStart` and `periodEnd`, preserving unrelated filters. The same period is supplied to the Transactions summary query so totals and the visible month cannot diverge.

### Summary Cards

Render income and expense as two compact sibling cards on normal text sizes and stack them when large text requires more width. Each card contains:

- localized label;
- real period total from the existing summary query;
- semantic directional icon;
- shared financial color and masking behavior.

Cards use canonical semantic surfaces, borders, radii, and colors only. Values, currency formatting, signs, accessibility labels, and privacy reveal state continue through `AmountText` and the existing sensitive-visibility owner.

### Category Filters

Keep the existing horizontally scrollable quick-scope logic and real active categories. The sequence begins with All, includes the supported Transfer type scope, and then uses available supported categories. The selected chip uses the canonical dark-teal interaction treatment; inactive chips use neutral surfaces and subtle borders.

Advanced active-filter removal chips remain available without duplicating the quick category/type choice.

### Time Groups

Continue using `buildTransactionSections` and real `occurredAt` timestamps for Today, Yesterday, Last Week, and Earlier. Empty groups are not rendered. Historical selections naturally collapse into deterministic applicable groups rather than forcing empty present-day headings.

Each localized section heading sits outside its group card. Transaction-count pills are intentionally omitted because they are optional and the current localization layer does not provide a complete Arabic plural contract.

### Transaction Rows

Reuse the shared `TransactionRow`, `projectTransaction`, `CategoryIcon`, `AmountText`, and category visual registry. For Arabic RTL:

- category visual and merchant hierarchy sit on the right;
- amount and localized time/date sit on the left;
- category is secondary and account is tertiary;
- source and sync/status metadata remain accessible but visually quiet.

English mirrors the full physical layout. Long merchant names and large amounts wrap at large text sizes rather than shrinking or clipping. Every actionable row maintains the platform touch target and opens `/transactions/{id}/edit` directly, preserving router return context.

Internal dividers are low-contrast and inset from the group card edges. Rows have no independent outer radius, gap, or full border except where their grouped position owns the card boundary.

## Data and State Ownership

The redesign changes presentation only. It does not change:

- `useInfiniteTransactions`, query keys, page fetching, deduplication, or `onEndReached` behavior;
- account/category queries or lookup semantics;
- `useCoreFinanceViewState` filter draft/apply/cancel/remove ownership;
- sorting, sources, statuses, review flags, amount filters, or search semantics;
- sync, API, persistence, or calculation implementations;
- balance masking and temporary reveal behavior;
- direct transaction edit navigation.

Loading, error, empty, pagination-error, and protected-content states continue through the existing shared components.

## Accessibility and Responsiveness

- Preserve accessible names, button roles, selected chip state, and transaction announcements.
- Maintain at least 44-point touch targets and clear focus order.
- Treat Arabic RTL and English LTR as structural mirrors, not text alignment variants.
- At 200% text, allow summary cards and transaction row columns to stack, labels to wrap, and row/card height to grow.
- Keep amounts and currency together and fully visible.
- Support compact phones, large phones, and Expo web preview using existing adaptive primitives.
- Retain light/dark semantic token support even though the approved reference establishes the light-mode acceptance target.

## Test Strategy

Implementation follows test-first changes:

1. Replace the independent-card assertion with a regression proving adjacent rows use first/middle/last positions as one visual group and no per-row outer wrapper.
2. Assert the selected period drives both the visible label and period-specific summary query.
3. Preserve category quick-scope, advanced filter, search, privacy, pagination, and direct-edit tests.
4. Add or update RTL/LTR structure assertions for the header, chips, and transaction row physical ordering.
5. Keep the existing transaction-section date classification tests.
6. Verify large-text summary/row stacking without clipped fixed heights.

After automated checks, render Arabic and English at a phone viewport and compare directly with the approved reference. Perform one bounded correction pass covering top spacing, summary proportions, chip density, section rhythm, group-card width/radius, row height, divider insets, visual size, hierarchy, and amount placement, followed by one confirmation capture.

## Acceptance Criteria

The production Transactions route clearly reproduces the approved hierarchy and density with real application data. It has a light Masarifi page, shared header, shared month flow, paired semantic summary cards, category chips, real date groups, one continuous card per group, clean internal transaction rows, direct edit navigation, full privacy/filter behavior, RTL/LTR mirroring, and usable 200% text. No parallel experimental route or legacy independent-card layout remains.
