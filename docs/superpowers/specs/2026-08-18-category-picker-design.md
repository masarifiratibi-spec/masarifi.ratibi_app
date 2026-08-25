# Canonical Category Picker Design

**Date:** 2026-08-18  
**Status:** Awaiting written-spec review

## Goal

Replace normal financial-category selection controls with one dedicated full-screen Category picker while preserving existing category data, business rules, form state, localization, and navigation context. The Transactions quick filter remains a separate lightweight filtering interaction.

## Existing System

- `useCategories` is the canonical category query.
- `CategoryIcon` is the shared category visual component, but it currently renders initials and does not consume `iconKey` or `colorKey`.
- `CategoryPicker` already filters active categories and ranks favorites, but its route wrapper only navigates back and does not return the selected category.
- Transaction Add/Edit and Voice Review render local category radio lists.
- Budget Allocation renders local category choices for its source and destination fields.
- Budget category-limit inputs display an amount field for every eligible category; they are not category selection controls.
- Salary, obligation, and savings forms currently expose no normal category chooser.
- Transactions filtering is owned by `TransactionFilters` and its view-state store.

## Chosen Architecture

### One route and one picker component

Create one normal stack route at `/category-picker`. It renders the existing shared `CategoryPicker`, redesigned as a full-screen navigation surface. Remove the obsolete generic modal route after all callers migrate so there is only one canonical entry point.

The screen uses the existing foundation providers, theme tokens, localization, directional icons, `CategoryIcon`, and category query. It does not own category data, persistence, IDs, or business rules.

### Ephemeral selection request

Add one small non-persisted Zustand selection store because Expo Router route parameters cannot safely carry callbacks or update arbitrary mounted origin routes.

A request contains:

- the currently selected category ID;
- an optional allow-list of category IDs;
- a completion callback owned by the originating form.

The origin registers the request and pushes `/category-picker`. Selecting a row invokes the callback, clears the request, and calls `router.back()`. Pressing Back clears the request without invoking the callback. The origin screen remains mounted beneath the picker, preserving every local form value without route-specific return destinations or globalizing entire form drafts.

Only one picker can be active in the navigation stack, so the store intentionally supports one pending request. No queue, persistence, or generic picker framework is needed.

## Screen Composition

The picker renders inside a safe-area full-screen container using the page background token.

1. A navigation header with a mirrored Back action, centered localized title, and an equal-width trailing spacer.
2. A large search field with a search icon and localized placeholder.
3. A localized `Most Used` heading and one rounded grouped surface.
4. A localized `Others` heading and one rounded grouped surface.

Each group contains category rows separated by dividers. A row contains the shared `CategoryIcon`, localized category name, and the shared check icon when selected. Selected rows use semantic teal emphasis in addition to the checkmark. Rows have a minimum 56-point touch target and may grow for long names or 200% text.

RTL changes the complete row/header direction and reading-edge alignment rather than only changing text alignment.

## Category Grouping and Search

The app has no real usage-count or recency ranking for categories. The existing `isFavorite` field is therefore the deterministic data-backed approximation:

- `Most Used`: active favorite categories;
- `Others`: all remaining active categories;
- within each group: localized alphabetical order;
- no category appears in both groups.

Search matches both Arabic and English category labels using the existing case-insensitive filtering behavior. Search filters the two groups in place. If a filtered group is empty, it is omitted; if both are empty, the existing localized empty state is shown.

## Shared Category Visuals

Extend `CategoryIcon` as the single owner of category visuals. It accepts the category's existing `iconKey` and `colorKey`, maps known system icon keys in that shared component, and falls back to localized initials for custom or unknown categories. The picker does not define any icon mapping.

The extension remains backward compatible with current `CategoryIcon` callers. It uses existing theme/design tokens and the category's real visual keys; it does not change category records or localization data.

## Migrated Consumers

### Transaction Add and Edit

Replace the inline category radio list with one category field row. The row opens the canonical picker with the effective current category. Completion updates only `categoryId`. Transfer transactions continue to omit category selection.

Both Add and Edit use the same `TransactionForm`, so this single migration covers both routes. Add's existing persisted draft behavior and Edit's local transaction state remain unchanged.

### Voice Review

Replace each proposal's limited eight-category radio list with a category field row. Its callback updates that proposal's `categoryId` and marks the category assessment resolved using existing `resolveField` logic. Other proposal fields remain mounted and unchanged.

### Budget Allocation

Replace the source and destination category radio lists with two category field rows. Each request is restricted to the budget's allocated category IDs. The destination request excludes the selected source. Completion updates only `fromId` or `toId`; the existing draft and preview logic remain unchanged.

### Explicit non-migrations

- Transactions quick filter remains unchanged and never opens `/category-picker`.
- Budget category-limit amount fields remain unchanged because they edit values for all categories rather than choose one.
- Category management, report dimensions, read-only transaction/category labels, and support-ticket categories are separate responsibilities.
- No salary, obligation, or savings selector is created where none exists.

## Loading, Empty, and Error Behavior

The picker uses the existing category query states:

- loading: existing localized loading state;
- error: existing localized error state with retry;
- no eligible/search results: existing localized empty state;
- missing pending request: Back returns safely without changing any origin.

Archived and merged categories are never selectable. An optional allow-list is intersected with active query results.

## Localization

Add only the picker UI strings required by the approved request:

- title: `Category` / `الفئة`;
- search placeholder: `Search categories...` / `ابحث عن الفئات...`;
- section labels: `Most Used` / `الأكثر استخداماً`, `Others` / `أخرى`.

Existing category names and business localization remain unchanged.

## Testing

Use focused existing Jest and React Native Testing Library patterns:

- picker search, favorite/other grouping, no duplication, selected checkmark, allowed IDs, loading/error/empty states, and selection callback;
- Add and Edit transaction forms open `/category-picker`, use the same request mechanism, update the category, and preserve other entered values;
- Voice Review and both Budget Allocation fields use the same picker request;
- Back cancels without mutation;
- category icon visual-key handling and fallback remain accessible;
- Transactions quick filter does not navigate to the full-screen picker;
- RTL direction and large-text-compatible row layout receive focused structural assertions where supported.

Run the affected tests, mobile typecheck, lint, and relevant boundary checks. Then render the screen in English and Arabic Web preview at phone widths and compare it directly with the supplied reference for header placement, search size, section spacing, grouped-card radius, row height, dividers, icons, selection mark, page background, and density.

## Rejected Alternatives

### Route-specific return parameters

Passing hardcoded return paths and values through URL parameters would duplicate logic for each form, risk remounting and losing local state, and violate the requirement to preserve arbitrary origins.

### Globalizing all form drafts

Moving every consumer's full form state into global stores would preserve navigation state but substantially expand scope and ownership. A single ephemeral selection request solves the actual problem with less code.

### Generic picker framework

A reusable framework for accounts, categories, and future entities is speculative. This design implements only the category selection contract requested now.
