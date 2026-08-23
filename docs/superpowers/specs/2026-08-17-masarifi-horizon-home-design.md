# Masarifi Horizon Home Design

## Approved direction

Replace the current card-stack Home composition with the approved “Masarifi Horizon” surface. The header and financial overview sit in a continuous dark-teal atmospheric field; the activity area rises from it as a light rounded sheet. Preserve all existing data sources, privacy behavior, navigation routes, period selection, loading/error/empty states, RTL/LTR support, and large-text behavior.

## Default Home state

- Keep the existing Reports action, real period selector, and profile-initials avatar.
- Present the exact total balance and exchange-rate note as the primary centered financial statement; amount and currency stay atomic and never truncate.
- Show the current all-accounts count and exact balance without ellipsis.
- Add four compact quick actions backed by existing routes only: Add, Voice, Reports, and Accounts.
- In the light activity sheet, show recent expenses first and recent income second. Partition only the existing `summary.recentTransactions`: `expense` belongs to spending, `income` belongs to income, and transfers remain excluded from both sections.
- Show up to two rows per section. Preserve direct row-to-edit navigation, category visuals, privacy masking, account-name resolution, and mixed-direction safety.
- Omit a section when it has no matching recent transactions; keep the existing empty Home state when the whole summary is empty.

## Accounts bottom sheet

- The Accounts quick action uses the three-dot visual and opens a real modal `AppSheet` from the physical bottom edge.
- The modal backdrop dims and covers the entire current application surface, including the tab bar. The sheet overlays rather than reflows or sits above underlying content.
- Sheet actions reuse existing routes:
  - Add account → `/accounts/new`
  - Manage accounts → `/accounts`
  - How balances work → an in-sheet explanatory state using existing localized balance/exchange-rate truth; no new route or business logic.
  - Cancel, backdrop press, Android Back, and swipe/modal dismissal close the sheet.
- The sheet uses at least 48×48 dp touch targets, modal accessibility semantics, localized labels, RTL/LTR ordering, dark theme, and large text.

## Responsive and visual rules

- At normal text size, the four quick actions remain one row.
- At 200% text, quick actions and activity content may wrap/stack; typography is not reduced to preserve columns.
- Use existing Masarifi semantic tokens and `react-native-svg`, already installed, for the background field. Add no dependency and no raw feature-level palette.
- Preserve the global hidden-balances preference and reveal behavior.

## Validation

- TDD covers expense-before-income ordering, transfer exclusion, empty-section omission, exact/masked amounts, quick-action routes, modal overlay behavior, every sheet route, dismissal paths, RTL/LTR, and 200% text.
- Verify focused Jest red then green, full Jest, typecheck, lint, design-system/core-finance boundaries, Impeccable once, and Arabic/English web rendering.
- Android remains the release gate only when an authorized ADB device is attached; never claim physical Android or TalkBack validation without it.

## Explicit non-goals

- No domain schema, service contract, summary query, transaction logic, Add behavior, legacy detail route, or global privacy behavior changes.
- No new account-management flow; the sheet is only a Home entry point to existing account features.
