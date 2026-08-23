# Feature Specification: R04 — Transactions, Details, Editing, and Sync Conflicts

**Feature Branch**: `codex/r01-shared-ui-foundation` (existing worktree reused as requested)

**Created**: 2026-08-15

**Status**: Draft for product review

**Input**: Redesign the existing Masarifi transaction ledger, filters, record detail, editing, delete/undo, and synchronization-conflict experience without changing ledger rules, routes, financial effects, or recovery commands.

**Primary source of truth**: `D:\MY Work\0Part_Time\MASREFY _Final\apps\mobile\new_Desinge\REDESIGN_ANALYSIS.md`

**Roadmap area**: R04 — Transactions, Details, Editing, and Sync Conflicts

## Ownership and Boundaries

R04 owns presentation for these existing route surfaces:

- `app/(tabs)/transactions.tsx` — primary transaction ledger and optional preserved return destination.
- `app/modals/transaction-filters.tsx` — transaction-filter decision surface.
- `app/transactions/[id].tsx` — transaction record detail and correction actions.
- `app/transactions/[id]/edit.tsx` — transaction edit loading, missing, error, and form states.
- `app/transactions/conflicts/[id].tsx` — full-screen synchronization-conflict resolution.
- `app/modals/sync-conflict.tsx` — modal synchronization-conflict entry using the same decision content.

R04 also owns the confirmed transaction-row, transaction-record, filter-summary, delete/undo, and transaction-conflict presentation used by downstream features. It does not own manual or voice creation in R05, pre-confirmation automatic candidates in R06, account/category selection rules in R02/R03, Home composition, report calculations, planning calculations, notifications, Assistant reasoning, or shared R01 components.

Entry points remain the Transactions tab, Home/account/planning/report drill-downs, tracking feedback, notifications, Assistant evidence, support/reporting paths, protected deep links, and synchronization recovery. No route, deep-link meaning, financial command, or primary ownership changes.

## Current Capability Baseline

Masarifi currently provides:

- a transaction ledger with current search, sort, period, account, category, type, source, record-status, sync-status, review-required, and amount-range filtering semantics;
- confirmed transaction types including expense, income, transfer, refund, reversal, adjustment, obligation payment, and recurring payment;
- sources including manual, automatic, voice, platform-assisted, and adjustment;
- record states including pending, posted, failed, refunded, reversed, deleted, review-required/resolved, and pending/syncing/synced/failed/conflict synchronization;
- account, category, date, currency, title/merchant, original-record, obligation, transfer-destination, fee, notes, source, and status relationships where present;
- stable transaction detail entry from lists, tracking feedback, notifications, reports, accounts, planning, Assistant evidence, and protected deep links;
- editing through the existing transaction form and current validation, draft, account/category, type, and financial-effect rules;
- deletion that removes eligible records from active financial views immediately, exposes the existing 30-second undo window, and retains a deletion marker after expiry;
- support reporting and wrong-detection reporting for eligible automatic records;
- explicit conflict retrieval and user selection among currently supported resolution choices without silent overwrite;
- loading, empty, filtered-empty, error, offline, partial/stale, pending-sync, conflict, hidden-value, and recovery states supplied by the existing data flow.

All ledger calculations, signs, record types, filters, sort order, relationships, edit/delete eligibility, 30-second undo, synchronization, conflict snapshots/resolutions, deep links, support context, and downstream updates remain unchanged. R04 changes presentation and usability only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan a Dense Financial History (Priority: P1)

As a user, I can scan a long transaction history and immediately understand what changed, when, by how much, on which account, from which source, and whether attention is required.

**Why this priority**: The ledger is the primary record of truth for daily money activity and every other financial area links back to it.

**Independent Test**: Render first-use, typical, dense 1,000-plus-record, multi-currency, hidden, mixed-source, all-type, all-status, partial/stale, offline, loading, and error ledgers in both languages; verify date grouping, stable amount alignment, correct detail navigation, and bounded responsive behavior.

**Acceptance Scenarios**:

1. **Given** a dense ledger, **When** the list opens, **Then** records are grouped chronologically and each compact row exposes title/merchant, category, account, date, amount/currency, financial meaning, source, and applicable review/sync/status without badge accumulation.
2. **Given** expense, income, transfer, refund, reversal, adjustment, obligation-payment, recurring, failed, or deleted data, **When** rows render, **Then** type and status remain distinguishable through sign, wording, structure, and source/status text rather than color alone.
3. **Given** confirmed automatic or voice data, **When** it appears, **Then** Source Mark is quiet but available; a review-required, duplicate-related, or conflicted record gives the reason greater prominence and a valid next action.
4. **Given** hidden balances, **When** the ledger renders, **Then** protected amounts are masked visually and accessibly while non-sensitive identity, date, source, status, and permitted actions remain usable.
5. **Given** an origin-specific return destination, **When** the user finishes the ledger task, **Then** the existing sanitized return behavior preserves the originating feature context.

---

### User Story 2 - Search and Filter Without Losing Context (Priority: P1)

As a user, I can search and combine existing filters, see exactly what is active, and return to the same results after inspecting a record.

**Why this priority**: Large ledgers are only useful when users can retrieve and verify a specific financial event quickly.

**Independent Test**: Combine every supported search, period, account, category, type, source, record status, sync status, review, amount, and sort constraint; apply, cancel, reopen, remove individual constraints, clear all, enter detail, and return with list position and results intact.

**Acceptance Scenarios**:

1. **Given** no active constraints, **When** the ledger opens, **Then** search and one Filter entry are visible without a permanent chip wall.
2. **Given** filters are active, **When** results render, **Then** each active constraint is visible and individually removable, the Filter entry communicates the count, and Clear all appears only when useful.
3. **Given** no record matches, **When** results finish loading, **Then** a filtered-empty state explains the current query and offers clear/revise actions rather than first-use guidance.
4. **Given** the user cancels or applies the filter surface, **When** it closes, **Then** cancellation preserves the prior applied set and Apply uses the existing semantics without resetting unrelated list state.
5. **Given** the user opens and returns from a detail, **When** the ledger reappears, **Then** search, filters, sort, scroll position, and origin context remain intact.

---

### User Story 3 - Understand a Transaction Record (Priority: P1)

As a user, I can inspect one transaction as a financial record, understand its source and relationships, and choose only actions currently valid for that record.

**Why this priority**: Correction is safe only when the user can see exactly which record and financial effects are involved.

**Independent Test**: Open each supported type, source, status, review, sync, transfer, original/refund/reversal, obligation-linked, deleted-with-undo, hidden, missing, partial, and error transaction from every supported entry point.

**Acceptance Scenarios**:

1. **Given** a transaction exists, **When** detail opens, **Then** amount/type/status lead, record identity and date/account/category follow, source and explanation follow, relationships follow, and correction/report/delete actions appear last.
2. **Given** a transfer, refund, reversal, adjustment, obligation payment, recurring record, or linked original, **When** detail renders, **Then** applicable relationships and financial meaning are explicit without inferring new rules in presentation.
3. **Given** an automatic or voice source, **When** detail renders, **Then** source, available evidence/reason, and current correction/report path are visible without exposing protected raw source content.
4. **Given** a record is pending, failed, reversed, refunded, deleted, review-required, or conflicted, **When** detail renders, **Then** the state states what changed, what did not change, and the valid next action.
5. **Given** the record is missing or unavailable, **When** detail is requested, **Then** stale financial content is not shown and the user receives the existing safe back or retry route.

---

### User Story 4 - Edit Without Changing the Rules (Priority: P1)

As a user, I can correct an eligible transaction using the same focused anatomy as manual Add while preserving the record's current values, relationships, draft, and financial semantics.

**Why this priority**: Editing directly affects balances and downstream reports and must not silently reinterpret the record.

**Independent Test**: Edit every eligible type with valid/invalid values, transfer destinations, archived account/category changes, keyboard open, meaningful unsaved changes, offline/local save, pending sync, save failure, and concurrent conflict.

**Acceptance Scenarios**:

1. **Given** an eligible record, **When** edit opens, **Then** current values and relationships are populated and the hierarchy follows type, amount, identity, account/category or destination, date, and contextual fields.
2. **Given** the type changes, **When** dependent fields change, **Then** only currently valid account/category/destination relationships remain visible and no hidden stale relationship is applied.
3. **Given** validation fails, **When** Save is attempted, **Then** the exact issue and correction are shown, all valid edits remain, and no financial record changes.
4. **Given** meaningful edits, **When** navigation or dismissal is attempted, **Then** approved draft protection prevents accidental loss.
5. **Given** save is local, pending, synchronized, failed, or conflicted, **When** the operation resolves, **Then** the result is stated truthfully and the existing correction/recovery path remains available.

---

### User Story 5 - Delete and Recover Safely (Priority: P1)

As a user, I can delete an eligible transaction only after understanding the consequence, undo it during the existing window, and still reach correction after undo expires.

**Why this priority**: Deleting a financial record changes visible balances and history and requires reversible, exact feedback.

**Independent Test**: Delete eligible records from typical, automatic, linked, offline, pending-sync, and failure states; exercise confirmation, repeated activation, 30-second undo, restored undo after reopening, expiry, undo failure, and post-expiry correction.

**Acceptance Scenarios**:

1. **Given** an eligible record, **When** Delete is requested, **Then** confirmation names the record and existing financial consequence before the command runs.
2. **Given** deletion succeeds, **When** the result appears, **Then** the record is removed from active financial views according to current rules and an accessible textual 30-second Undo is available.
3. **Given** Undo is used before expiry, **When** restoration resolves, **Then** the same record and downstream effects are restored once and completion is not reported early.
4. **Given** Undo expires or fails, **When** the state updates, **Then** no unavailable action remains and the current edit/correction/support route is explained.
5. **Given** deletion or undo is repeated, **When** the command is already working, **Then** duplicate submission is prevented.

---

### User Story 6 - Resolve a Sync Conflict Deliberately (Priority: P1)

As a user, I can compare local and later versions of one transaction, understand each version's financial effect, and deliberately choose one of the existing valid resolutions.

**Why this priority**: Silent overwrite would destroy user trust and may alter financial history incorrectly.

**Independent Test**: Open conflict recovery as a full screen and modal with differing amounts, dates, accounts, categories, types, relationships, hidden values, one missing snapshot, loading, failure, concurrent resolution, and every currently supported resolution.

**Acceptance Scenarios**:

1. **Given** an unresolved conflict, **When** the decision surface opens, **Then** local and later snapshots are clearly named, comparable by changed field, and accompanied by their supplied financial effects.
2. **Given** values are hidden, **When** snapshots render, **Then** protected amounts remain masked while changed fields and decision meaning remain accessible.
3. **Given** a resolution is selected, **When** confirmation occurs, **Then** the exact retained outcome is stated, duplicate submission is prevented, and no silent merge or overwrite occurs.
4. **Given** conflict data changes, disappears, or resolution fails, **When** the operation returns, **Then** no false success appears and the user can retry, refresh, or safely return using current behavior.
5. **Given** the user cancels, **When** the surface closes, **Then** neither version changes and the origin context is preserved.

### Edge Cases

- The ledger is empty, contains over 1,000 records, or receives updates while scrolling.
- Search and filters conflict, produce no results, or reference archived/missing accounts or categories.
- Amounts are zero, negative by financial meaning, extremely large, multi-currency, hidden, unknown, or too long for one line.
- Merchant/title/account/category content mixes Arabic, English, digits, punctuation, and long unbroken references.
- Transactions are pending, failed, refunded, reversed, deleted, review-required, syncing, sync-failed, or conflicted.
- Transfers have missing destination data; refunds/reversals have missing originals; obligation relationships are missing or stale.
- An automatic record lacks permissible source detail or changes during review.
- Edit dependencies become archived while the form is open.
- Delete succeeds but notification/feedback is interrupted; Undo is restored after reopening, expires while visible, or fails.
- Local and later conflict snapshots differ on multiple fields, have equal visible amounts, or one snapshot becomes unavailable.
- Hidden-value, theme, locale, text-size, or connectivity state changes while list, detail, edit, filter, or conflict is open.

## Redesign Scope

- Evolve the confirmed transaction row into a compact date-grouped record with stable amount alignment, Source Mark, one concise status/review line, and transfer/refund/reversal variants.
- Recompose the ledger header into title/context, search, one Filter entry, active-filter chips only, result context, and grouped activity.
- Rebuild filter presentation around the current complete filter set with clear applied/draft distinction, current selection, Apply, cancel, individual removal, and Clear all.
- Recompose detail as a financial record rather than a read-only form: amount/status, identity, core fields, source, relationships, then actions.
- Align edit presentation with R05's manual form anatomy while retaining R04 edit ownership and current values/commands.
- Make delete/undo feedback persistent enough to recover, with textual expiry and exact consequence.
- Replace generic conflict cards with a changed-field comparison and explicit financial-effect decision using the same content in full-screen and modal entries.
- Apply R01 semantic tokens, amount/source/status patterns, grouped rows, overlays, state feedback, privacy, motion, direction, and accessibility.

## Non-Goals

- No transaction type, ledger sign, balance effect, filter meaning, sort behavior, relationship, edit/delete eligibility, undo duration, or conflict rule change.
- No new bank connection, import, receipt scan, payment, investment, or production provider.
- No route, deep-link, notification target, support target, or navigation-meaning change.
- No ownership of automatic candidates/review, manual/voice creation, accounts, categories, planning, reports, notifications, or Assistant behavior.
- No new gesture-only action or presentation-layer financial calculation.
- No feature-local raw colors, token system, duplicate shared component, or visual-only dependency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: R04 MUST preserve every owned route, entry point, deep-link result, sanitized return behavior, and financial command listed in Ownership and Boundaries.
- **FR-002**: The ledger MUST preserve current search, sort, period, account, category, type, source, record-status, sync-status, review, and amount-range semantics.
- **FR-003**: Transactions MUST be grouped chronologically without reversing chronological meaning in RTL.
- **FR-004**: Each row MUST present title/merchant, category, account, date, amount/currency, financial type, source, and applicable record/review/sync state.
- **FR-005**: Repeated transactions MUST use compact rows; cards MUST be reserved for summary, attention, conflict, or exceptional state.
- **FR-006**: Row geometry MUST maintain a stable amount area while allowing long identity/status text and 200% text to reflow without clipping.
- **FR-007**: Expense, income, transfer, refund, reversal, adjustment, obligation-payment, and recurring-payment meaning MUST use wording/sign/structure in addition to financial color.
- **FR-008**: Manual, automatic, voice, platform-assisted, and adjustment sources MUST use the shared Source Mark without exposing protected source content.
- **FR-009**: Review-required, duplicate-related where supplied, failed, deleted, reversed/refunded, pending-sync, sync-failed, and conflict states MUST be explicit and actionable where current behavior provides an action.
- **FR-010**: Initial loading MUST preserve list geometry and MUST NOT show unknown money as zero.
- **FR-011**: First-use empty, filtered-empty, error, offline, partial/stale, hidden, and dense states MUST remain distinct and provide only current valid recovery.
- **FR-012**: The ledger MUST remain usable with at least 1,000 records without requiring all records to render or announce at once.
- **FR-013**: Search and one Filter entry MUST remain visible; inactive filters MUST not occupy permanent chip space.
- **FR-014**: Active filters MUST be visible, individually removable, reopen with current selection, and be clearable together when useful.
- **FR-015**: Filter Apply and cancel MUST preserve current applied/draft semantics and return to the same ledger context.
- **FR-016**: Opening and returning from detail MUST preserve ledger search, filters, sort, scroll, and caller origin.
- **FR-017**: Transaction detail MUST order content as amount/type/status, identity/core fields, source/explanation, relationships, then current actions.
- **FR-018**: Detail MUST represent only feature-supplied account, category, transfer, original, refund/reversal, obligation, source, review, and sync relationships and MUST not infer missing rules.
- **FR-019**: Automatic records MUST retain current wrong-detection/report paths and source privacy; all eligible records retain current support-report context.
- **FR-020**: Edit MUST reuse the approved focused transaction-form anatomy while preserving current record values, type-dependent fields, validation, commands, and R04 ownership.
- **FR-021**: Edit validation MUST identify the affected field, preserve valid values, and leave financial data unchanged on failure.
- **FR-022**: Meaningful edits MUST be protected from accidental loss according to current draft/navigation behavior.
- **FR-023**: Local save, pending sync, synchronized success, failure, and conflict MUST remain visibly and accessibly distinct.
- **FR-024**: Deletion MUST require the current consequence confirmation, remove the eligible record according to existing rules, and expose the existing 30-second Undo.
- **FR-025**: Undo MUST state its remaining availability textually, prevent duplicate activation, restore the same record when successful, and disappear or change recovery when expired.
- **FR-026**: A deleted record's audit marker and post-expiry correction routes MUST remain unchanged.
- **FR-027**: Conflict presentation MUST compare local and later versions by meaningful changed field and financial effect, not by two unlabeled summary cards.
- **FR-028**: Conflict resolution MUST expose only currently valid choices, require a deliberate choice, prevent duplicate submission, and never silently overwrite or merge.
- **FR-029**: The full-screen and modal conflict entries MUST present equivalent decision content and preserve their respective origin/dismissal behavior.
- **FR-030**: Hidden transaction values MUST remain protected in visual content, accessibility, errors, notifications, analytics/evidence, screenshots, and app-switcher presentation.
- **FR-031**: Financial sign, amount, decimal, and currency MUST form one locale-aware, intentionally isolated numeric run using English numerals in both languages.
- **FR-032**: Arabic RTL and English LTR MUST expose identical content, filters, actions, explanations, and recovery.
- **FR-033**: Direction-dependent navigation/disclosure icons MUST mirror; transaction chronology, universal source/status icons, and internal numeric order MUST not be incorrectly reversed.
- **FR-034**: Every row and action MUST meet the 44-by-44-point minimum target; swipe actions MAY supplement but MUST never replace visible edit/delete/review access.
- **FR-035**: Screen-reader order MUST follow the visual task sequence and include financial meaning, source, status, hidden state, selection, and available action without announcing protected values.
- **FR-036**: Status, selection, financial meaning, filter state, conflict difference, and undo availability MUST NOT rely on color, icon, gesture, motion, sound, or haptics alone.
- **FR-037**: Motion MUST be brief, preserve spatial/origin context, and avoid animated amount counting, input shaking, or repeated chart-like decoration; reduced motion retains full meaning.
- **FR-038**: R04 MUST reuse R01 transaction row, Source Mark, amount/date formatting, grouped list, search/filter, feedback, confirmation, conflict/overlay, sensitive-value, and accessibility contracts.
- **FR-039**: R04 MUST consume R02 account and R03 category identity/selection contracts without duplicating their rules.
- **FR-040**: R04 MUST introduce no new business calculation, record state, route, permission, provider, or production data source.
- **FR-041**: Downstream regression MUST cover R02 Accounts, R05 Add results, R06 Tracking, R07 Home, R09 Budgets, R10 Obligations, R11 Savings, R12 Reports, R13 Assistant, and R14 Notifications wherever confirmed transactions appear.

### Constitution Requirements *(mandatory)*

- **Platform behavior**: Ledger, detail, editing, delete/undo, and conflict recovery retain equal Android/iOS capability, existing offline/manual recovery, protected navigation, and no new permission claim.
- **Financial trust**: Source, status, financial effect, delete/undo, and conflict choices remain explicit; no uncertain, destructive, or conflicting change is applied silently.
- **Localization and accessibility**: Arabic RTL and English LTR have complete parity, English numerals, mixed-direction isolation, screen-reader semantics, 200% text, visible non-gesture actions, reduced motion, and minimum targets.
- **UI states and tokens**: R01 semantic roles govern repeated rows, amount/source/status, filters, record detail, state feedback, confirmation, hidden values, and conflict decisions.
- **Verification**: Focused regression and independent real-device evidence are required for ledger, filters, detail, edit, delete/undo, and both conflict entries before R04 closes.

### Shared Dependencies

- **R01**: transaction row, Source Mark, amounts/dates, grouped lists, headers, search/filter grammar, forms, feedback, confirmations, overlays, conflict comparison, semantic tokens, privacy, direction, motion, and accessibility.
- **R02**: account identity and account picker; **R03**: category identity and category picker.
- **R05**: approved manual form anatomy may be shared with edit, while R04 retains edit route and record command ownership.
- **Feature-owned data**: existing ledger queries, filters, record relationships, mutation commands, undo expiry, conflict snapshots/resolutions, and financial projections remain authoritative.
- **Downstream consumers**: Accounts, Add, Tracking, Home, Budgets, Obligations, Savings, Reports, Assistant, and Notifications require regression validation when the confirmed transaction contract changes.

### Key Entities

- **Confirmed Transaction**: An existing ledger record with financial type, amount/currency, account/category and optional relationships, source, record/review/sync state, and correction eligibility.
- **Transaction Filter Set**: The currently supported search, period, account, category, type, source, record status, sync status, review, amount, and sort constraints with applied/draft state.
- **Correction Outcome**: An edit, delete, undo, wrong-detection report, support report, or existing related correction with exact consequence and recovery.
- **Sync Conflict**: Local and later snapshots of one transaction with supplied differences, financial effects, current resolution choices, and working/failure/resolved state.
- **Ledger Context**: Search, filters, sort, scroll, origin, hidden-value state, and selected record that must survive navigation.

## State Matrix

| Screen | Required states |
|---|---|
| Transaction list | initial/loading, first-use empty, typical, dense 1,000+, filtered no results, error/retry, offline, partial/stale, hidden, all types/sources/statuses, review required, pending/syncing/failed/conflict |
| Transaction filters | no active filters, current draft, multiple active filters, invalid amount range, archived/missing selections, apply, cancel, clear, keyboard open, long labels, error where applicable |
| Transaction detail | loading, missing, error/back/retry, typical, each type/source/status, linked relationships, hidden, partial/stale, offline, pending sync, review, conflict, action working/failure/success |
| Transaction edit | loading, missing/error, ready, keyboard open, type-dependent fields, validation, unsaved edits, local/pending save, success, failure, concurrent conflict |
| Delete and Undo | confirmation, deleting, deleted, 30-second undo, restored undo after reopen, undoing, undo success/failure, expiry, post-expiry correction |
| Sync conflict | loading, missing/error, two snapshots, multiple changed fields, hidden values, resolution selection, resolving, concurrent change, failure/retry, success, cancel; both full-screen and modal entries |

## Trust, Privacy, Localization, and Accessibility

- Amounts, account identifiers, merchant/source evidence, notes, references, and relationship details retain existing sensitivity and hidden-value rules.
- Automatic source presentation exposes only approved source labels/fragments and keeps wrong-detection correction available.
- Every mutation states what changed, what did not change, and the next valid action; offline/local outcomes are not described as synchronized.
- Arabic and English expose identical record fields, filters, statuses, conflict differences, actions, and recovery.
- Amount/currency/sign, dates, masked accounts, merchants, sender/source labels, and references use approved formatters and bidi isolation.
- Screen-reader focus follows list context → row; detail amount/status → identity → relationships → actions; conflict local/later comparison → resolution.
- Hidden values are neither visible nor announced; non-sensitive state and correction remain available.
- At 200% text, rows grow, filter controls and actions stack, and conflict comparison becomes sequential without losing labels.

## Navigation and Connections

- The Transactions tab remains the primary ledger and accepts existing origin/return context from reports and other feature drill-downs.
- Detail retains entry from Home, Accounts, Tracking feedback, Notifications, Reports, Assistant evidence, planning, and deep links.
- Edit returns to the existing ledger result; delete/undo and conflict resolution update the same feature-owned scopes and destinations as today.
- Filter apply/cancel and detail back preserve ledger query, sort, scroll, and origin.
- Conflict modal dismissal changes nothing; full-screen and modal resolution preserve their current return destinations.
- Authentication, unlock, notification-response sanitization, and privacy gates remain owned by the shell and their feature owners.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users identify a requested transaction's amount, type, account, source, and status within 10 seconds in a dense ledger.
- **SC-002**: At least 90% of users locate a specified record in a 500-transaction ledger within 30 seconds using current search and filters.
- **SC-003**: 100% of supported transaction types, sources, record states, review states, and sync states are distinguishable without relying on color alone.
- **SC-004**: At least 90% of users explain what changed and select a valid next action from transaction detail within 20 seconds.
- **SC-005**: 100% of delete tests expose the exact 30-second Undo, prevent duplicate mutation, and either restore the same record or explain expiry/failure without false success.
- **SC-006**: At least 90% of users correctly compare local and later versions and select the intended conflict resolution within 45 seconds; zero tests silently overwrite a version.
- **SC-007**: All owned screens complete critical journeys in Arabic RTL and English LTR, light/dark, 200% text, smallest supported phone, hidden values, screen reader, and reduced motion with zero clipped required content or inaccessible actions.
- **SC-008**: A 1,000-plus-record validation remains responsive and navigable, preserves search/filter/scroll context, and does not require all rows to render or announce at once.
- **SC-009**: Privacy review finds zero protected transaction values or raw source evidence in hidden visual output, accessibility, errors, notifications/evidence captures, or app-switcher presentation.
- **SC-010**: Regression validation finds zero changes to ledger calculations, signs, filter/sort semantics, routes/deep links, edit/delete/undo rules, conflict resolutions, or downstream financial effects.

## Assumptions

- The approved compatible-redesign direction and R04 roadmap ownership remain unchanged.
- R01 is approved before R04 implementation; R02/R03 account and category contracts are available before their picker/identity presentations are adopted.
- Existing ledger data, filters, calculations, record relationships, commands, undo duration, synchronization, conflict resolution, support context, and protected navigation remain authoritative.
- Duplicate and automatic-candidate decisions remain owned by R06 until they become confirmed transaction state supplied to R04.
- Edit may share R05 form anatomy after R05 approval without transferring edit route or confirmed-record command ownership.
- Real-device validation and validation-fix tasks will be detailed during `/tasks`; this `/specify` phase changes no production code.

