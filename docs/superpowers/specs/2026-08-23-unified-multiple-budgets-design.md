# Masarifi Unified Multiple-Budgets Design

## 1. Objective

Replace the current empty budget overview followed by a separate creation form with one unified budget experience in `apps/mobile`.

The approved result must:

- Open the creation form immediately when no budget exists.
- Show all budgets for the selected month when records exist.
- Allow more than one budget in the same month.
- Prevent a category from belonging to more than one non-deleted budget in that month.
- Aggregate active monthly budgets in Reports without counting a transaction twice.
- Redesign only the budget experience. All unrelated screens, navigation, and visual identity remain unchanged.

This is an explicitly approved exception to the earlier UI freeze for the budget screens only.

## 2. Approved Visual Direction

- Use the Reports page background token resolving to `#F6F7F5` across the whole budget screen.
- Reuse the existing white report-card surface, approved radii, typography, spacing, shadows, and dark-green primary action token.
- Do not introduce new colors, gradients, component styles, icon styles, or navigation chrome.
- Preserve Arabic RTL and English LTR behavior, safe areas, keyboard avoidance, text wrapping, and 200% text scaling.
- Keep all interactive targets at the existing accessibility minimum without visually enlarging icon-only controls when `hitSlop` is sufficient.

## 3. Unified Route Flow

### `/budgets`

The route is the single entry point from Reports, More, onboarding completion, notifications, and planning shortcuts.

- While loading, render the existing planning loading state.
- If the selected month has no budgets, render the creation form directly. Do not render the current intermediate empty-state screen or an extra “Create budget” confirmation.
- If budgets exist, render the monthly budget collection.
- Keep a visible “Add budget” action on the collection.

### `/budgets/new`

Keep the public route for deep-link compatibility. It renders the same unified screen with the creation composer open immediately.

### Existing edit/detail routes

Keep existing route names and back behavior. Editing returns to `/budgets` with the same selected month. After a successful create, replace the creation route with `/budgets` so Back does not reopen a submitted form.

## 4. Monthly Budget Collection

The collection header contains the existing back action, localized `Budgets` title, selected month, and budget count.

Each budget card displays:

- Budget name.
- Lifecycle state when it is not active.
- Configured expense limit.
- Eligible spend.
- Remaining amount.
- Usage percentage and progress track.
- Count of assigned categories.

Tapping a card opens its existing detail/edit journey. Existing pause, resume, allocation, transactions, and delete capabilities remain reachable.

The collection ends with one full-width “Add budget” action using the existing primary button style.

## 5. Creation and Editing Form

The redesigned form contains only budget-owned concepts:

1. Required budget name.
2. Budget month.
3. Required expense limit.
4. Category selection.
5. Optional per-category limits.
6. Existing unused-budget rollover switch.
7. “Copy previous budget” action.

Income and savings targets are not shown in the new form because they are global monthly concepts and would produce misleading totals when repeated across several budgets. Existing stored values remain intact for backward compatibility.

“Copy previous budget” opens a choice of existing prior budgets instead of assuming that the previous month contains only one budget. Copying fills the new form but never saves automatically.

Categories already assigned to another non-deleted budget in the same month are disabled and identify the owning budget. The app never silently transfers a category between budgets.

The save action remains disabled until the required fields are valid. Validation and persistence errors use the existing localized planning feedback components.

## 6. Domain and Service Contract

### Budget identity

Add a nullable `name` field to persisted `Budget` records. New budgets require a non-empty trimmed name. A nullable persisted field keeps legacy payloads readable without destructive rewriting.

Legacy records with no name render a localized “Monthly budget” fallback until edited. Saving an edited legacy budget stores the chosen name.

### Collection query

Add a period-scoped service read returning all non-deleted budgets with their categories and progress, sorted deterministically by creation time and ID. The unified screen must consume this collection query.

Keep the current singular period read only for existing v1 compatibility during this change; no new production caller may use it. It returns the most recently updated non-deleted budget deterministically when legacy code calls it.

### Save rules

Within one period:

- Several non-deleted budgets are allowed.
- Normalized names must be unique among non-deleted budgets.
- A category may belong to only one non-deleted budget, including paused budgets.
- Deleted budgets reserve neither names nor categories.
- An edit excludes its own budget ID from duplicate checks.

Validation belongs in the shared repository/service path so every caller receives the same behavior.

## 7. Financial Projection and Reports

Budget progress must filter eligible expense transactions by the budget’s assigned category IDs. Existing transaction-effect rules continue to exclude transfers, failed/deleted items, reversed originals, and pending amounts from confirmed expense totals.

The monthly Reports budget metric aggregates active budgets only:

- Configured limit = sum of active effective expense limits.
- Eligible spend = sum of category-filtered eligible spend.
- Remaining = configured limit minus eligible spend.
- Usage percentage = eligible spend divided by configured limit when the limit is greater than zero.

Category exclusivity guarantees that one transaction cannot contribute to two budgets in the same month. Paused and deleted budgets do not contribute to the aggregate. The Reports card keeps its approved appearance; only its values and destination behavior change.

## 8. Persistence and Compatibility

Budget payloads already persist in the current SQLite planning tables, so this feature adds no database, state-management library, or schema framework.

Hydration normalizes a missing legacy `name` to `null`. The change is idempotent and preserves IDs, versions, limits, categories, lifecycle, rollover, and the retired income/savings values.

Removing the repository’s period-level uniqueness check must not weaken operation idempotency or optimistic-version checks.

## 9. Query Invalidation and State

- Add a period-scoped budget-list query key.
- Budget create, edit, pause/resume, delete, allocation, and category changes invalidate the list, affected budget detail, planning overview, Reports, and Home scopes already represented by the service result.
- Keep form state during category selection and keyboard transitions.
- Do not add a new store or dependency-injection layer.

## 10. Error Handling

- Duplicate name: localized inline error identifying the same-month conflict.
- Category conflict: localized error naming the budget that owns the category.
- Stale edit: reuse the existing planning conflict/version handling.
- Storage failure: keep user input and expose the existing retry feedback.
- Legacy malformed optional name: treat it as unnamed; do not discard the budget.
- Missing category metadata: keep the budget readable and show the existing category fallback label.

## 11. Verification

### Repository and service checks

- Save and retrieve two budgets in the same month.
- Reject duplicate normalized names in the same month.
- Allow the same name in different months.
- Reject a category assigned to another non-deleted budget in the same month.
- Permit reuse after the owning budget is deleted.
- Keep paused budgets’ categories reserved.
- Hydrate an unnamed legacy budget without data loss.
- Preserve operation idempotency and optimistic versions.

### Financial checks

- Filter each budget’s spend by assigned categories.
- Aggregate two active budgets without double counting.
- Exclude paused/deleted budgets and pending/failed/reversed/transfer effects.
- Preserve currency minor-unit precision.

### UI journey checks

- `/budgets` with no records displays the form directly.
- `/budgets` with records displays every selected-month budget.
- `/budgets/new` opens the composer directly.
- Create a second budget in the same month and return to the collection.
- Edit, pause/resume, allocate, inspect transactions, and delete remain reachable.
- Category conflicts remain visible and accessible in Arabic and English.
- Back behavior does not reopen a submitted form.

### Visual checks

- Capture the empty/direct-create and populated/multiple-budget states before release.
- Verify the exact `#F6F7F5` page background, approved report-card surface, existing green action token, Arabic RTL, English LTR, narrow phone, tablet, keyboard, and 200% text scaling.
- Review every visual delta outside the budget routes as a regression.

## 12. Out of Scope

- No changes to global navigation, Reports layout, Home layout, theme modes, or unrelated planning screens.
- No automatic category reassignment.
- No cross-budget transfers or shared categories.
- No new charting, caching, routing, state-management, component, or persistence framework.
- No removal of legacy income/savings data in this change.

## 13. Acceptance Criteria

The feature is complete when users can enter Budgets without the intermediate empty page, create multiple named budgets in one month, assign each category to at most one budget, see accurate per-budget and aggregate values, and return to a unified collection that matches the approved application background and components. Existing budget data, deep links, financial precision, and unrelated UI remain intact.
