# Canonical Category Picker Design

**Date:** 2026-08-18

**Status:** Approved in chat; awaiting written-spec review

## Goal

Create one canonical full-screen Category picker for every normal single-category selection flow in the Masarifi mobile app, while retaining compact category controls for Transactions filtering.

## Scope

The dedicated picker becomes the standard selection experience for:

- Add Transaction
- Edit Transaction
- Budget category selection
- Voice Review category correction
- Category parent selection
- Category merge-target selection
- Any other existing normal single-category selector found during implementation

The following remain filter-specific and do not navigate to the full-screen picker:

- Transactions three-dot Quick Filter category control
- Transactions full-filter category control

Category management, creation, persistence, IDs, system/custom rules, transaction relationships, API contracts, localization architecture, and filter behavior remain unchanged.

## Architecture

### Canonical route

Add one ordinary Expo Router screen at `/category-picker`. It is a real navigation screen under the root stack, not a modal, bottom sheet, or floating overlay. The obsolete general-purpose `/modals/category-picker` route is removed after all normal selection consumers migrate.

### Selection sessions

Normal consumers cannot pass callbacks through Expo Router and must not encode whole form state or hardcoded return routes in URL parameters. A small shared selection-session owner will bridge this boundary.

Each consumer:

1. Creates a category-selection session with a generated request ID.
2. Supplies the current category ID and any excluded category IDs.
3. Pushes `/category-picker?requestId=<id>`.
4. Remains mounted underneath the pushed route, preserving its local form state.
5. Receives the chosen category through the session callback.
6. Applies only the category change.

The picker resolves the request ID, renders the session constraints, calls the registered selection callback once, removes the session, and immediately runs `router.back()`.

Pressing Back without a selection removes the pending session and returns without changing the originating form. Unmount cleanup prevents abandoned sessions from accumulating.

Only ephemeral UI navigation state belongs in the session owner. Category data and business state continue to come from the existing core-finance query/service path.

### Alternatives rejected

- **Return-route URL parameters:** rejected because they require hardcoded origin routes, leak form data into navigation, and can replace rather than preserve mounted form state.
- **Per-flow drafts:** rejected because they duplicate persistence logic across Edit, Budget, Voice, and Category management flows and broaden the change into business state.

## Category Data and Grouping

The screen uses `useCategories(true)` and the existing category presentation/search functions. It includes only active categories and applies caller-provided exclusions before grouping.

`Most Used` uses the existing `Category.isFavorite` signal because the application does not currently expose a usage-count or recent-category ranking. No synthetic analytics or fake ranking is introduced.

`Others` contains every remaining active category. A category appears in exactly one section. Empty sections are omitted. Search applies to both sections using the existing localized label/parent search behavior, then preserves the same grouping rules.

The limitation is intentional: `Most Used` is favorite-based until a real usage-ranking source exists.

## Screen Composition

The visual target is the supplied approved mobile reference, adapted to Masarifi's existing design tokens and shared components.

### Header

- Normal Back action, mirrored correctly in RTL/LTR
- Centered title: `الفئة` in Arabic and `Category` in English
- No floating close icon
- Stable centered title even when the Back action occupies one side

### Search

- Large rounded search field below the header
- Arabic placeholder: `ابحث عن الفئات...`
- English placeholder: `Search categories...`
- Existing category search logic and real category data only

### Sections

- Reading-edge section headings: `الأكثر استخدامًا / Most Used` and `أخرى / Others`
- One rounded grouped surface per section
- Hairline dividers between rows
- No unrelated floating card per category

### Category rows

- Existing shared `CategoryIcon` is the only category visual owner
- Localized category name
- No `System category`, `Custom category`, or `Favorite` metadata in this selection surface
- Selected row uses the shared check icon, semantic teal treatment, and subtle selected background
- Minimum accessible touch target
- Row height grows for long names and 200% text instead of shrinking typography

### Responsive behavior

- Natural mirrored composition for Arabic RTL and English LTR
- Correct icon/text/checkmark physical order in both directions
- Usable at 320px-wide phones, standard phone sizes, and web preview
- Scrollable content with safe bottom spacing
- Long localized names wrap without clipping

## Shared Component Ownership

The current `CategoryPicker` mixes normal selection and filtering responsibilities. Implementation will separate them:

- `CategorySelectionScreen`: canonical full-screen normal-selection UI
- A small selection-session module/hook: navigation result ownership
- Existing compact picker logic retained for Transactions filtering under a filter-specific name/owner
- `CategoryIcon`, category presentation, search matching, and `useCategories` remain shared sources

The existing management-oriented `CategoryRow` keeps its metadata for category management lists. The dedicated picker uses a selection-focused row because its decision surface intentionally omits origin/status/favorite metadata.

## Consumer Migration

### Transactions

- Add Transaction saves its existing manual draft before navigation, as it does today.
- Edit Transaction keeps its mounted local form state and applies only the returned category ID.
- Transfer transactions continue to omit category selection.

### Budget

The budget form opens the canonical picker with salary, other-income, and transfer categories excluded. Returning updates only the active budget category; all period, limits, targets, rollover, and draft values remain intact.

### Voice Review

The canonical picker returns a category to the existing proposal update callback. The existing assessment-resolution behavior remains unchanged.

### Category management

- Parent selection opens the canonical picker, excludes the category being edited, and retains an explicit `No parent category` action on the full screen when the session permits clearing.
- Merge-target selection opens the canonical picker and excludes the source category.

### Filter exception

Transactions Quick Filter and Transactions full filters retain compact multi-select category interactions. They reuse the existing active-category data/search behavior but never create a category-selection session or navigate to `/category-picker`.

## Failure and Edge States

- Loading, empty, no-results, and retry states reuse existing Masarifi feedback components.
- An unknown or expired request ID returns safely without applying a selection.
- If the currently selected category is excluded, archived, merged, or unavailable, no active row is falsely marked selected.
- Selection is idempotent: repeated taps cannot apply multiple category updates.

## Accessibility

- Header title retains the correct heading semantics.
- Back and category rows expose descriptive accessibility labels and roles.
- Selected rows expose `accessibilityState.selected`.
- Search uses the localized label/placeholder.
- Check icons are decorative when selection state is already exposed semantically.
- Large text reflows without horizontal clipping or reduced font size.

## Testing

Focused tests will prove:

- Add Transaction opens `/category-picker` and preserves its manual draft.
- Edit Transaction opens the same route and preserves all non-category form values.
- Budget, Voice Review, Parent Category, and Merge Target use the same canonical route.
- Back without selection leaves origin state unchanged.
- Selection returns once, applies the chosen category, and returns to the origin.
- The current category is visibly and semantically selected.
- Search uses existing matching behavior.
- Favorites populate `Most Used`; non-favorites populate `Others`; no category is duplicated.
- Empty `Most Used` is omitted.
- Caller exclusions are honored.
- Transactions Quick Filter and full filters remain compact and do not navigate.
- Arabic/English ordering and 200% text behavior remain correct.

## Visual Validation

Render and compare the actual screen against the approved reference at:

- Arabic RTL, 390px phone width
- English LTR, 390px phone width
- Arabic RTL, 320px small-phone width
- Arabic and English at 200% text scale in focused component tests

Correct header centering, search dimensions, section spacing, grouped-card radius, dividers, icon size, selected checkmark, page background, and overall density before completion.

## Completion Criteria

- One canonical dedicated Category picker exists for normal single-category selection.
- All identified normal consumers use it.
- Transactions filtering remains compact and separate.
- Originating forms preserve their state on Back and after selection.
- Real category data, business rules, APIs, and persistence remain unchanged.
- Focused, static, and visual verification pass.
