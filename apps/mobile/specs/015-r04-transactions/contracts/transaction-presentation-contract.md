# UI Contract: R04 Confirmed Transactions

This contract defines presentation/query boundaries. Existing ledger rules and service commands remain authoritative.

## 1. Transaction Row Contract

Input is one typed display projection with localized identity, formatted amount/date, explicit financial meaning, Source Mark, concise status/review, hidden state, and open callback.

- All current types/sources/statuses remain distinguishable without color alone.
- Amount sign/tone is supplied by the R04 projector using existing domain meaning; the shared component does not infer it.
- Row grows for 200% text and keeps amount/status readable.
- Swipe may supplement but never replace visible action paths.

## 2. Ledger Contract

- Consumes existing cursor pages for applied filters and virtualizes the accumulated list.
- Groups chronologically without reversing chronology in RTL.
- Distinguishes first-use empty, filtered empty, initial loading, next-page loading/error, mapped query error, partial cached/refetch state where provable, and hidden values.
- Preserves mounted filters/sort/scroll/origin through detail navigation.

## 3. Filter Contract

- Exposes every existing `TransactionFilterSet` field.
- Draft starts from applied state; cancel restores applied; Apply commits; Clear resets current semantics.
- Active filters are localized removable descriptors; inactive filters do not occupy chips.
- Amount-range validation preserves valid draft values and never changes filter semantics.
- Account/category choices consume R02/R03 controlled pickers.

## 4. Detail Contract

Order: amount/type/status → identity/date/account/category → source/explanation → supplied relationships → current eligible actions.

The screen never infers a relationship or recalculates a ledger effect. Automatic source exposes only approved content and current wrong-detection/report path. Hard-coded visible labels are prohibited.

## 5. Edit Contract

- R05 form anatomy is reused.
- R04 supplies current transaction values, loading/missing/error, update callback, save result, conflict recovery, and destination.
- Validation and commands remain existing core finance.
- Meaningful edits retain current guard/recovery; duplicate Save is blocked.

## 6. Delete and Undo Contract

- Delete requires named consequence confirmation.
- Working state blocks duplicates.
- Success exposes a textual countdown to current `undoExpiresAt` and persists across detail reopen.
- Undo restores through current command; failure/expiry removes unavailable action and shows current recovery.

## 7. Conflict Contract

- One comparison body is reused by full-screen and modal containers.
- Local/later labels, changed fields, and existing financial effects remain clear even when values are hidden.
- User selects one supported choice, then confirms one resolving action.
- Supported choices are `keep_local` and `keep_later`; no silent merge or `keep_both`.
- Cancel changes nothing and preserves origin.

## 8. Direction, Accessibility, Privacy, and State

- Arabic/English expose identical fields, filters, actions, explanations, and recovery.
- Financial runs/dates/masked identities use shared formatters and bidi isolation.
- Screen-reader order follows list context/row, record hierarchy, and conflict comparison/choice.
- Values remain hidden in UI, accessibility, errors, evidence, notifications, and app switcher.
- Status/filter/conflict/undo meaning is not color/icon/gesture/motion-only.
- 44×44 targets, 200% reflow, keyboard/safe areas, and reduced motion are mandatory.

## 9. Ownership Matrix

| Concern | Owner |
|---|---|
| Shared amount/row/source/state/form/overlay/privacy | R01 |
| Account/category identity and picker | R02/R03 |
| Ledger projection/list/filter/detail/edit orchestration/delete/undo/conflict | R04 |
| Reusable Add/edit form anatomy | R05 |
| Transaction rules, pages, mutations, undo, conflict persistence | Existing core finance |
| Unconfirmed automatic review | R06 |

