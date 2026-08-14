# UI Contract: Mobile Design System and Interaction Language

This contract defines behavior observable by users and later mobile specifications. It does
not define backend endpoints or feature-specific financial calculations.

## 1. Public Design-System Boundary

Later features import reusable tokens, themes, typography, icons, motion, privacy helpers, and
components from `src/design-system`. They do not import internal gallery fixtures or raw token
values. Missing semantic values are added to the central adapter before feature use.

## 2. Token and Theme Contract

- Deep teal is the default interaction family in light and dark themes.
- Bronze is limited to premium, milestone, celebration, or justified quick-add emphasis.
- Clean neutral surfaces define the mobile light theme; dark mode uses warm charcoal and teal.
- Standard cards use borders before shadows.
- Financial semantics and system status semantics use separate names and treatments.
- Feature components contain no raw brand colors, local token aliases, or theme mode checks.
- Every foreground/background pair used by text, icons, controls, and statuses meets contrast.

## 3. Typography and Formatting Contract

- IBM Plex Sans Arabic and IBM Plex Sans are packaged locally and available before product text
  is shown.
- Arabic and English have equivalent hierarchy for headings, body, helper, labels, and values.
- Financial numbers use stable-width English numerals and locale-aware formatting.
- Amounts, currency codes, and mixed-direction identifiers preserve readable order in RTL.
- Critical content and actions remain usable at 200% text scaling; larger settings may reflow
  or scroll but cannot hide or discard content.

## 4. Component Contract

Every reusable component declares:

1. Anatomy and optional parts.
2. Meaningful variants and supported sizes.
3. Default, pressed, focused, selected, disabled, and loading behavior where applicable.
4. Arabic RTL and English LTR layout behavior.
5. Behavior at 320 by 568 logical pixels, keyboard-open layouts, and adaptive tablets.
6. Accessible name, role, value/state, reading order, announcement, and 44 by 44 target behavior.
7. Content wrapping, empty content, action-label, and sensitive-data rules.
8. Semantic token mapping for both themes.

## 5. Component Families

| Family | Required coverage |
|---|---|
| Navigation | App bar, bottom tabs, back, context/overflow, steps, segments, sticky header |
| Financial | Balance, account, transaction, category, amount, currency, type badge, progress, budget, obligation, installment, savings, report, comparison |
| Forms | Text, phone, OTP, search, amount, date/time triggers, account/category/payment selectors, switch, checkbox, radio, chips, keyword editor, validation, helper text |
| Feedback | Toast, snackbar, undo, success, error, empty, skeleton, offline, sync, permission, review-required, notification badge |
| Overlays | Bottom/full-screen sheet, confirmation, destructive confirmation, account/category picker, filters, date range, voice overlay |
| Charts | Accessible donut and line presentation, labels, summaries, empty/insufficient states, optional drill-down |

Components may share primitives; the contract does not require a separate implementation file
for every row when one typed component with variants preserves the observable behavior.

## 6. Interaction Contract

- A pending mutation disables repeated submission without clearing entered data.
- A completed save shows immediate feedback and an actionable result.
- Reversible automatic actions expose undo; destructive actions explain consequences and require
  confirmation away from the primary action.
- Short low-risk choices use a sheet; multi-step or high-risk actions use a full screen or
  explicit confirmation.
- Motion uses 100-140 ms for micro-interactions, 140-180 ms for control state, 180-220 ms for
  dialogs, and 200-240 ms for sheets or page transitions.
- Reduced motion applies the final state without non-essential animation.
- Haptics may reinforce an outcome but never carry meaning alone.

## 7. Financial and Status Contract

| Financial meaning | Required non-color cue |
|---|---|
| Income | Label and inflow sign or icon |
| Expense | Label and outflow sign or icon; never an error symbol by default |
| Transfer | Label and directional/account cue |
| Refund | Label and relation to the original movement where available |
| Savings | Label and progress context |
| Debt | Label and payment context; never a warning symbol by default |

Operational success, warning, danger, information, neutral, pending, offline, and sync states
use their own label/icon treatment and may coexist with any financial meaning.

## 8. Chart Contract

- Each chart states the financial question it answers and supplies a text summary with values.
- Donut data is limited to five visible categories after grouping the remainder under Other.
- A standard line chart is limited to four series and distinguishes series by line style or
  marker in addition to color.
- Tooltips are supplementary; labels and summaries carry essential meaning.
- Empty and insufficient-data states explain the next useful action.
- Drill-down announces the destination and applied filter.

## 9. Sensitive Display Contract

- Sensitive financial values are masked on first use.
- An authorized foreground reveal expires when the app locks or enters the background.
- Lock-screen notifications and app-switcher previews remain masked regardless of foreground
  reveal state.
- Masked accessible labels describe the field without announcing its value.
- Errors, analytics, titles, and previews never include sensitive values or identifiers.

## 10. Content Contract

- Labels are calm, specific, action-oriented, and complete in Arabic and English.
- Commands name their outcome when known; generic Continue, Confirm, and Submit labels are not
  used for a named financial action.
- Validation identifies the field, problem, and correction without blaming the user.
- Amounts, statuses, and actions wrap or reflow before truncation; they are never hidden by
  decorative content.

## 11. Scope Contract

SPEC-002 may implement reusable design-system behavior and one validation gallery only. It does
not implement authentication, dashboard, transaction, tracking, voice, planning, reports,
assistant, subscriptions, support, production integrations, or Admin Dashboard layouts.
