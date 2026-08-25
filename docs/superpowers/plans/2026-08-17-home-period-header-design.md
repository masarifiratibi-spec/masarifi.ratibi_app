# Home Period Header Design

## Scope

Update the shared primary header so More is represented by the authenticated profile initials, and update Home's center control to a filled month/year pill that opens a date-range sheet. Reports, More, account navigation, privacy behavior, and all non-Home routes remain unchanged.

## Header identity

`PrimaryShellHeader` continues to own the Reports and More navigation actions. It reads the existing settings profile query and renders a circular avatar inside the existing 48×48 More touch target. Initials are derived from the first and last words of `name`; a single word uses its first two characters; email local-part and authenticated user id are safe fallbacks. The More accessibility label and route stay unchanged.

## Home period state

Home owns one in-memory applied period. It defaults to the current UTC calendar month and remains separate from the Transactions filter store. A period contains a mode (`month` or `custom`) plus inclusive `periodStart` and `periodEnd` timestamps. This avoids coupling Home selections to Transactions while reusing `TransactionFilterSet` at the query/service boundary.

## Selection flow

The filled Home pill displays the applied period using `Intl.DateTimeFormat` and opens the existing `AppSheet` overlay. The sheet has three internal views:

1. Choose date range: Custom range and By month cards.
2. By month: dynamically generated months around the current selection, with teal selected styling and a check icon. Selecting one applies immediately and closes the sheet.
3. Custom range: two existing native/web date fields, inclusive duration, validation for start after end, and an Apply range action.

The sheet mirrors row order, text alignment, icons, and chevrons from the stored RTL/LTR preference. No new dependency or custom calendar is introduced.

## Financial data

`getHomeSummary` and `useHomeSummary` gain an optional `TransactionFilterSet`, defaulting to the existing empty filters for backward compatibility. Account balances remain current; period income, period expense, recent transactions, review count, and pending sync count derive from transactions matching the selected period/account filters. The query key includes the filters so changing the Home period fetches the correct summary without duplicating calculations in the UI.

## Verification

Focused tests cover initials and fallbacks, unchanged More routing, month/custom range calculations, sheet RTL/LTR flow, native/web date labels, filtered Home summaries, and query keys. Then run focused Jest, full Jest, typecheck, lint, app-shell/design-system/core-finance boundaries, Impeccable detection, and Arabic/English mobile-width web checks. Android validation is attempted only if an authorized device and installed dev client are available; the known CMake blocker is reported honestly if encountered.
