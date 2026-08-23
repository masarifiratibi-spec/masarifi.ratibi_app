# Tasks: R04 — Transactions, Details, Editing, and Sync Conflicts

**Input**: Design documents in `specs/015-r04-transactions/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/transaction-presentation-contract.md`, `quickstart.md`

**Organization**: Work is screen-first. Shared projection/query/filter prerequisites appear once, then Transaction List, Filters, Detail, Edit, Delete/Undo, Full-Screen Conflict, and Modal Conflict are implemented and validated independently.

**Tests**: Mandatory under the specification and constitution. Tests precede implementation and prove ledger meaning, cursor pagination, filters, correction, persisted undo, conflict decisions, route context, privacy, localization, and accessibility.

## Format: `[ID] [P?] [Story?] Description with exact file path`

- **[P]**: May run in parallel only after prerequisites and only across different files.
- **[US1]–[US6]**: Maps work to the six R04 user stories.
- Baseline, Shared Foundation, and Final Gate tasks have no story label.

---

## Phase 1: Baseline and Scope Lock

**Purpose**: Record existing ledger/filter/detail/edit/delete/conflict contracts and downstream consumers before presentation changes.

- [ ] T001 Inventory all six owned routes, current `TransactionFilterSet`, transaction row callers, edit form boundary, delete/undo paths, conflict entries, and downstream consumers named in `specs/015-r04-transactions/plan.md`; record exact files and behavior in `specs/015-r04-transactions/validation/baseline.md`.
- [ ] T002 Run the automated baseline from `specs/015-r04-transactions/quickstart.md` and record command, date, suite/test counts, data-page size, and pre-existing failures in `specs/015-r04-transactions/validation/baseline.md` without modifying production code.
- [ ] T003 Create the evidence index with Shared Foundation, List, Filters, Detail, Edit, Delete/Undo, Full-Screen Conflict, Modal Conflict, Android, iOS, and final regression sections in `specs/015-r04-transactions/validation/README.md`.

**Checkpoint**: Current routes, filter meanings, financial effects, undo deadline, conflict choices, and consumers are locked.

---

## Phase 2: Shared Transaction Foundation

**Purpose**: Establish one typed transaction display projector and truthful page/filter state boundaries before any screen redesign.

- [ ] T004 [P] Add failing projector tests for every current type, source, record/review/sync state, financial sign/effect, transfer/refund/reversal/original/obligation relationship, hidden/unknown value, mixed text, and multi-currency amount in the approved new file `src/features/transactions/transaction-presentation.test.ts`.
- [X] T005 Implement the non-persisted transaction display projector in the approved new file `src/features/transactions/transaction-presentation.ts`, reusing current domain effect meaning from `src/domain/core-finance.ts` and inferring no unsupported relationship or freshness state.
- [ ] T006 [P] Add failing query coverage for existing cursor pages, stable deduplication, applied-filter page reset, next-page availability/error, cached partial state only where provable, and 1,000+ records in `src/features/core-finance/core-finance-queries.test.ts` and `src/storage/core-finance-performance.test.ts`.
- [ ] T007 Expose the existing transaction cursor pages as the single React Query infinite-read owner in `src/features/core-finance/core-finance-queries.ts`, preserving service page size/cursor semantics and adding no second ledger store.
- [ ] T008 [P] Add failing filter-session tests proving begin-from-applied, draft edit, cancel restore, apply commit, individual removal, and reset/clear behavior in `src/state/core-finance-view-state.test.ts`.
- [X] T009 Add only the minimal begin/cancel/reset filter-session operations to `src/state/core-finance-view-state.ts`, retaining existing `TransactionFilterSet`, sort, and server-state ownership.
- [ ] T010 [P] Add failing shared Source Mark/transaction-row localization tests for current sources, hidden values, non-color status, amount projection, mixed direction, and no raw English in `src/design-system/components/financial/TransactionRow.test.tsx` and `src/design-system/components/financial/SharedDecisionSurfaces.test.tsx`.
- [X] T011 Correct only confirmed shared localization/accessibility defects in `src/design-system/components/financial/TransactionRow.tsx`, `src/design-system/components/financial/SourceMark.tsx`, and `src/localization/messages/en.ts`/`ar.ts`; keep sign, status, source, and relationship meaning caller-supplied.
- [ ] T012 Add complete English and Arabic transaction type/source/status/review/sync/filter/relationship/delete/undo/conflict/state/action keys required by R04 to `src/localization/messages/en.ts` and `src/localization/messages/ar.ts`, preserving identical parameters and English numerals.
- [ ] T013 Run T004–T012 plus `npm run typecheck`, `npm run check:design-system`, and `npm run check:core-finance`; record results and public-prop migrations in `specs/015-r04-transactions/validation/shared-foundation.md`.
- [ ] T014 Fix only Shared Transaction Foundation defects recorded by T013 in the named projector/query/filter/shared/localization owner, rerun focused checks, and update `specs/015-r04-transactions/validation/shared-foundation.md`.

**Checkpoint**: R04 has one tested display projector, one cursor query owner, and one applied/draft filter owner.

---

## Phase 3: Screen — Transaction List (User Story 1, Priority P1) 🎯 MVP

**Goal**: Deliver a virtualized, chronological, trustworthy ledger that scales beyond the first page.

**Independent Test**: Render first-use, typical, 500/1,000+, every type/source/status, multi-currency, hidden, loading/next-page/error, review/conflict, and live-update ledgers; verify stable chronology and detail navigation.

- [ ] T015 [P] [US1] Add failing list tests for projector-backed row identity, date grouping, all types/sources/statuses, Source Mark prominence rules, hidden values, first-use empty, initial loading/error, next-page loading/error/retry, deduplication, 1,000+, live updates, detail route, and sanitized origin return in `src/features/transactions/TransactionListScreen.test.tsx` and `src/features/transactions/TransactionsRoute.test.tsx`.
- [ ] T016 [US1] Replace the first-page/scroll-map rendering with one native virtualized chronological list consuming accumulated cursor pages in `src/features/transactions/TransactionListScreen.tsx`, preserving existing search, sort, filter, row press, and route context.
- [X] T017 [US1] Render each ledger item through the R04 projector and R01 `TransactionRow` in `src/features/transactions/TransactionListScreen.tsx`, keeping title/category/account/date/amount/source/status/review concise and avoiding badge accumulation.
- [ ] T018 [US1] Implement stable date section headers, end-of-list fetch, cursor deduplication, and mounted scroll restoration in `src/features/transactions/TransactionListScreen.tsx`; chronology must not reverse in RTL.
- [ ] T019 [US1] Implement geometry-preserving initial loading, first-use empty, mapped query error/retry, next-page loading/error/retry, cached partial/refetch state where provable, hidden/unknown values, and dense-list states in `src/features/transactions/TransactionListScreen.tsx`.
- [ ] T020 [US1] Preserve the tab route, supported query/origin parameters, sanitized return, and detail destination in `app/(tabs)/transactions.tsx`; prove unchanged route outcomes in `src/features/transactions/TransactionsRoute.test.tsx`.
- [ ] T021 [US1] Add Arabic RTL/English LTR, English-numeral bidi amounts/dates/references, mixed labels, light/dark, 200% row growth, virtual-list screen-reader behavior, 44×44, visible non-swipe action paths, and reduced-motion assertions to `src/features/transactions/TransactionListScreen.test.tsx` and localization files.
- [ ] T022 [US1] Run Transaction List tests, performance fixtures, and boundary checks and record exact results in `specs/015-r04-transactions/validation/transaction-list.md`.
- [ ] T023 [P] [US1] Validate Transaction List on Android across 1,000+ records, every type/source/status, initial/next-page/error states, hidden/mixed/multi-currency values, Arabic/English, themes, 200% text, TalkBack, and reduced motion; record `specs/015-r04-transactions/validation/transaction-list-android.md`.
- [ ] T024 [P] [US1] Validate the equivalent Transaction List matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/transaction-list-ios.md`; unavailable infrastructure remains blocked.
- [ ] T025 [US1] Fix only Transaction List defects from T022–T024 in `src/features/transactions/TransactionListScreen.tsx`, `app/(tabs)/transactions.tsx`, the projector/query, or named shared owner, rerun tests, and update `specs/015-r04-transactions/validation/transaction-list.md` before Filters.

**Checkpoint**: Transaction List is independently implemented, tested, device-reviewed, and corrected beyond the first page.

---

## Phase 4: Screen — Transaction Filters (User Story 2, Priority P1)

**Goal**: Expose every existing filter with applied/draft separation, concise active descriptors, and preserved ledger context.

**Independent Test**: Combine every search, period, account, category, type, source, record/sync/review status, amount, and sort filter; apply/cancel/reopen/remove/clear and return from detail without state loss.

- [ ] T026 [P] [US2] Add failing filter tests for every `TransactionFilterSet` field, begin/cancel/apply/reset, account/category pickers, amount-range validation, active descriptor/count/removal, clear all, archived/missing selection, filtered empty, keyboard, and context preservation in `src/features/transactions/TransactionFilters.test.tsx` and `src/state/core-finance-view-state.test.ts`.
- [ ] T027 [US2] Recompose `src/features/transactions/TransactionFilters.tsx` with R01 fields, chips, selection controls, and R02/R03 picker triggers while retaining every existing filter value and sort meaning.
- [ ] T028 [US2] Bind the surface to applied/draft filter-session operations from `src/state/core-finance-view-state.ts` so Cancel restores the prior applied set and Apply resets cursor pages without resetting unrelated search/scroll/origin state.
- [ ] T029 [US2] Derive localized active filter descriptors/count, individual removal, and Clear all from the applied set in `src/features/transactions/TransactionFilters.tsx`; show no inactive chip wall and introduce no fuzzy/new semantics.
- [ ] T030 [US2] Implement exact amount-range field errors, valid-value retention, loading/error for picker dependencies, archived/missing selected identities, no-result recovery, and disabled/applying states in `src/features/transactions/TransactionFilters.tsx`.
- [ ] T031 [US2] Wrap the route surface with the R01 modal/container contract in `app/modals/transaction-filters.tsx`, preserving current dismissal, return destination, and caller-owned ledger context.
- [ ] T032 [US2] Preserve search, filters, sort, scroll, and origin when entering/returning from detail in `src/features/transactions/TransactionListScreen.tsx` and `src/features/shell/navigation-context.ts`; prove behavior in `src/features/transactions/TransactionsRoute.test.tsx` and `src/features/shell/navigation-context.test.ts`.
- [ ] T033 [US2] Add Arabic RTL/English LTR, mixed/long descriptors, bidi amount/date inputs, light/dark, 200% wrapping, logical focus, keyboard/safe-area, screen-reader selected/error/count semantics, 44×44, and reduced-motion coverage to `src/features/transactions/TransactionFilters.test.tsx` and localization files.
- [ ] T034 [US2] Run Transaction Filters/state/context tests and record exact results in `specs/015-r04-transactions/validation/transaction-filters.md`.
- [ ] T035 [P] [US2] Validate Transaction Filters on Android across all fields, apply/cancel/reopen/remove/clear, picker return, invalid ranges, filtered empty, Arabic/English, themes, 200% text, keyboard, TalkBack, and reduced motion; record `specs/015-r04-transactions/validation/transaction-filters-android.md`.
- [ ] T036 [P] [US2] Validate the equivalent Transaction Filters matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/transaction-filters-ios.md`; unavailable infrastructure remains blocked.
- [ ] T037 [US2] Fix only Transaction Filters defects from T034–T036 in `src/features/transactions/TransactionFilters.tsx`, `app/modals/transaction-filters.tsx`, the filter store, or named picker/shared owner, rerun tests, and update `specs/015-r04-transactions/validation/transaction-filters.md` before Detail.

**Checkpoint**: Transaction Filters is independently implemented, tested, device-reviewed, and corrected with cancel-safe drafts.

---

## Phase 5: Screen — Transaction Detail (User Story 3, Priority P1)

**Goal**: Present one transaction as a financial record with explicit source, status, relationships, and only valid current actions.

**Independent Test**: Open every type/source/status/review/sync and supplied relationship from all entry points, including hidden, missing, loading/error, deleted-with-undo, and support/wrong-detection paths.

- [ ] T038 [P] [US3] Add failing detail tests for record-first hierarchy, all projected types/sources/statuses, account/category/date identity, transfer/original/refund/reversal/obligation relationships, approved source explanation, report-wrong/support paths, eligible actions, hidden values, missing/loading/error/retry, and origin return in `src/features/transactions/TransactionDetailScreen.test.tsx` and `src/features/transactions/TransactionDetailRoute.test.tsx`.
- [ ] T039 [US3] Recompose `src/features/transactions/TransactionDetailScreen.tsx` into amount/type/status, record identity/date/account/category, source/explanation, supplied relationships, then eligible correction/report/delete actions using the R04 projector and R01 surfaces.
- [ ] T040 [US3] Render only current supplied relationship/effect data in `src/features/transactions/TransactionDetailScreen.tsx`; do not infer transfer pairs, obligation progress, recurring meaning, refund/reversal origin, sync freshness, or ledger calculations.
- [ ] T041 [US3] Present automatic/voice source and approved reason/evidence plus current report-wrong/support actions in `src/features/transactions/TransactionDetailScreen.tsx`, excluding protected raw source content and replacing hard-coded support copy through localization.
- [ ] T042 [US3] Implement loading, missing, mapped error/retry, pending, failed, reversed, refunded, deleted, review-required, conflict, hidden/unknown, and partial relationship states in `src/features/transactions/TransactionDetailScreen.tsx`, stating valid next actions without false certainty.
- [ ] T043 [US3] Preserve route params, deep-link/origin context, edit/delete/report destinations, and safe back behavior in `app/transactions/[id].tsx`; prove unchanged outcomes in `src/features/transactions/TransactionDetailRoute.test.tsx`.
- [ ] T044 [US3] Add Arabic RTL/English LTR, bidi amount/date/reference, mixed labels, non-color status/source/relationship meaning, light/dark, 200%, screen-reader hierarchy, 44×44, keyboard/safe-area, and reduced-motion coverage to `src/features/transactions/TransactionDetailScreen.test.tsx` and localization files.
- [ ] T045 [US3] Run Transaction Detail tests and record exact results in `specs/015-r04-transactions/validation/transaction-detail.md`.
- [ ] T046 [P] [US3] Validate Transaction Detail on Android across every type/source/status/relationship, hidden/missing/error, support/wrong-detection, actions, Arabic/English, themes, 200% text, TalkBack, and reduced motion; record `specs/015-r04-transactions/validation/transaction-detail-android.md`.
- [ ] T047 [P] [US3] Validate the equivalent Transaction Detail matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/transaction-detail-ios.md`; unavailable infrastructure remains blocked.
- [ ] T048 [US3] Fix only Transaction Detail defects from T045–T047 in `src/features/transactions/TransactionDetailScreen.tsx`, `app/transactions/[id].tsx`, projector/localization, or named shared owner, rerun tests, and update `specs/015-r04-transactions/validation/transaction-detail.md` before Edit.

**Checkpoint**: Transaction Detail is independently implemented, tested, device-reviewed, and corrected.

---

## Phase 6: Screen — Transaction Edit (User Story 4, Priority P1)

**Goal**: Correct eligible records using the R05-aligned form anatomy without changing validation, relationships, or financial commands.

**Independent Test**: Edit every eligible type with populated values, type-dependent relationships, archived/missing selections, invalid input, dirty dismissal, local/pending/sync/failure/conflict outcomes, and keyboard open.

- [ ] T049 [P] [US4] Add failing edit tests for loading/missing/error, populated values, every eligible type, source/destination accounts, category, type-dependent field clearing, validation retention, dirty dismissal, duplicate Save, local/pending/success/failure/conflict result, and ledger return in `src/features/transactions/TransactionForm.test.tsx`, `src/features/transactions/useTransactionDraftGuard.test.tsx`, and `src/features/transactions/TransactionDetailRoute.test.tsx`.
- [ ] T050 [US4] Apply the approved R05 amount-first form anatomy to edit mode in `src/features/transactions/TransactionForm.tsx`, retaining the current record adapter, schema, operation ID, update command, and affected-scope invalidation.
- [ ] T051 [US4] Replace inline account/category choices with R02/R03 controlled picker fields in `src/features/transactions/TransactionForm.tsx`, preserving the entire edit draft and keyboard-safe position on select/cancel.
- [ ] T052 [US4] Keep only currently valid account/category/destination/relationship fields when type changes in `src/features/transactions/TransactionForm.tsx` and `src/features/transactions/transaction-form-schema.ts`, proving no hidden stale relationship reaches the update command.
- [ ] T053 [US4] Preserve meaningful-draft dismissal through `src/features/transactions/useTransactionDraftGuard.ts` and implement duplicate-submit, field error, loading/missing/error, local/pending/success/failure/conflict presentation in `app/transactions/[id]/edit.tsx` and `src/features/transactions/TransactionForm.tsx`.
- [ ] T054 [US4] Add Arabic RTL/English LTR, bidi financial/date input, mixed text, light/dark, 200% reflow, focus/error announcement, keyboard/safe-area, 44×44, screen-reader, and reduced-motion coverage to `src/features/transactions/TransactionForm.test.tsx` and localization files.
- [ ] T055 [US4] Run Transaction Edit/form/schema/draft tests and record exact results in `specs/015-r04-transactions/validation/transaction-edit.md`.
- [ ] T056 [P] [US4] Validate Transaction Edit on Android across all types, picker return, archived/missing selections, validation, dirty dismissal, duplicate Save, result/failure/conflict, Arabic/English, themes, 200% text, keyboard, and TalkBack; record `specs/015-r04-transactions/validation/transaction-edit-android.md`.
- [ ] T057 [P] [US4] Validate the equivalent Transaction Edit matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/transaction-edit-ios.md`; unavailable infrastructure remains blocked.
- [ ] T058 [US4] Fix only Transaction Edit defects from T055–T057 in `src/features/transactions/TransactionForm.tsx`, `app/transactions/[id]/edit.tsx`, schema/draft guard, or named picker/shared owner, rerun tests, and update `specs/015-r04-transactions/validation/transaction-edit.md` before Delete/Undo.

**Checkpoint**: Transaction Edit is independently implemented, tested, device-reviewed, and corrected with unchanged financial semantics.

---

## Phase 7: Screen State — Delete and Undo (User Story 5, Priority P1)

**Goal**: Require exact delete confirmation and expose the persisted 30-second undo deadline with truthful recovery.

**Independent Test**: Delete eligible typical/automatic/linked/offline/pending records, exercise repeated activation, failure, detail reopen, undo success/failure/expiry, and post-expiry correction.

- [ ] T059 [P] [US5] Add failing detail-state tests for named delete consequence confirmation, cancel, duplicate-submit guard, command failure, textual countdown from persisted `undoExpiresAt`, detail reopen, undo working/success/failure, expiry, and post-expiry recovery in `src/features/transactions/TransactionDetailScreen.test.tsx`.
- [ ] T060 [P] [US5] Add service/repository regression coverage for the current 30-second persisted undo deadline, single delete/undo effect, reopen restoration, expiry, and affected scopes in `src/services/mocks/core-finance-delete.test.ts`, `src/storage/core-finance-repository.test.ts`, and `src/storage/core-finance-persistence.test.ts`.
- [ ] T061 [US5] Add R01 named consequence confirmation before the existing delete command in `src/features/transactions/TransactionDetailScreen.tsx`, block duplicate activation, and report no success before command resolution.
- [ ] T062 [US5] Render an accessible textual countdown from repository-supplied `undoExpiresAt` in `src/features/transactions/TransactionDetailScreen.tsx`, restoring it on reopen without creating a second durable timer owner.
- [ ] T063 [US5] Implement undo working/success/failure/expired states and current edit/correction/support recovery in `src/features/transactions/TransactionDetailScreen.tsx`, removing unavailable Undo after expiry and preventing duplicate restore.
- [ ] T064 [US5] Add Arabic RTL/English LTR confirmation/countdown/recovery copy, English numerals, non-color/non-motion meaning, light/dark, 200%, screen-reader live updates without per-second spam, 44×44, and reduced-motion coverage to `src/features/transactions/TransactionDetailScreen.test.tsx` and localization files.
- [ ] T065 [US5] Run Delete/Undo UI, service, repository, and persistence tests and record exact results in `specs/015-r04-transactions/validation/delete-undo.md`.
- [ ] T066 [P] [US5] Validate Delete/Undo on Android across confirm/cancel, working/failure/success, 30-second countdown, reopen, undo success/failure/expiry, Arabic/English, themes, 200% text, TalkBack, and reduced motion; record `specs/015-r04-transactions/validation/delete-undo-android.md`.
- [ ] T067 [P] [US5] Validate the equivalent Delete/Undo matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/delete-undo-ios.md`; unavailable infrastructure remains blocked.
- [ ] T068 [US5] Fix only Delete/Undo defects from T065–T067 in `src/features/transactions/TransactionDetailScreen.tsx` or current delete/repository/shared owner, rerun tests, and update `specs/015-r04-transactions/validation/delete-undo.md` before Conflict.

**Checkpoint**: Delete/Undo is independently implemented, tested, device-reviewed, corrected, and still uses the persisted current deadline.

---

## Phase 8: Screen — Full-Screen Sync Conflict (User Story 6, Priority P1)

**Goal**: Compare local and later snapshots by changed field and deliberately keep one supported version.

**Independent Test**: Open full-screen conflicts with changed/equal/hidden/missing snapshots, select keep-local/keep-later, confirm/cancel, and handle concurrent resolution/failure/retry with unchanged origin context.

- [ ] T069 [P] [US6] Add failing conflict-body tests for local/later labels, changed-field comparison, supplied financial effects, hidden values, missing/equal snapshots, only `keep_local`/`keep_later`, selected/confirm separation, cancel, duplicate guard, failure/retry, and concurrent disappearance in `src/features/transactions/SyncConflictScreen.test.tsx`.
- [ ] T070 [P] [US6] Add repository/service tests proving supported choices remain `keep_local` and `keep_later`, `keep_both` remains rejected, resolution is single/atomic, and effects/affected scopes are unchanged in `src/services/mocks/core-finance-conflict.test.ts` and `src/storage/core-finance-repository.test.ts`.
- [ ] T071 [US6] Extract one reusable conflict comparison body in the approved new file `src/features/transactions/TransactionConflictComparison.tsx`, comparing only supplied changed fields/effects and performing no merge or financial calculation.
- [ ] T072 [US6] Recompose `src/features/transactions/SyncConflictScreen.tsx` around the shared comparison body with explicit local/later identities, selected choice, one resolve action, cancel, working, failure/retry, and concurrent-change states.
- [ ] T073 [US6] Preserve full-screen route params, lookup, cancel/origin behavior, completion destination, and existing resolve command in `app/transactions/conflicts/[id].tsx`; prove no silent resolution in `src/features/transactions/TransactionDetailRoute.test.tsx`.
- [ ] T074 [US6] Keep protected amounts hidden while changed fields and retained-outcome meaning remain accessible in `src/features/transactions/TransactionConflictComparison.tsx` and `src/features/transactions/SyncConflictScreen.tsx`.
- [ ] T075 [US6] Add Arabic RTL/English LTR local/later/change/effect semantics, bidi values, non-color selection, light/dark, 200% comparison reflow, focus order, screen-reader choice/consequence, 44×44, keyboard/safe-area, and reduced-motion coverage to `src/features/transactions/SyncConflictScreen.test.tsx` and localization files.
- [ ] T076 [US6] Run Full-Screen Conflict UI/service/repository tests and record exact results in `specs/015-r04-transactions/validation/conflict-full-screen.md`.
- [ ] T077 [P] [US6] Validate Full-Screen Conflict on Android across changed/equal/hidden/missing snapshots, both choices, cancel, working/failure/concurrency, Arabic/English, themes, 200% text, TalkBack, and reduced motion; record `specs/015-r04-transactions/validation/conflict-full-screen-android.md`.
- [ ] T078 [P] [US6] Validate the equivalent Full-Screen Conflict matrix on iOS/VoiceOver and record `specs/015-r04-transactions/validation/conflict-full-screen-ios.md`; unavailable infrastructure remains blocked.
- [ ] T079 [US6] Fix only Full-Screen Conflict defects from T076–T078 in `src/features/transactions/TransactionConflictComparison.tsx`, `SyncConflictScreen.tsx`, `app/transactions/conflicts/[id].tsx`, or current conflict/shared owner, rerun tests, and update `specs/015-r04-transactions/validation/conflict-full-screen.md` before Modal Conflict.

**Checkpoint**: Full-Screen Conflict is independently implemented, tested, device-reviewed, and corrected with supported choices only.

---

## Phase 9: Screen — Modal Sync Conflict (User Story 6, Priority P1)

**Goal**: Present the identical conflict body in the existing modal entry without duplicating comparison or command behavior.

**Independent Test**: Open/dismiss/resolve the modal for the same fixture set as full-screen; field comparison, choices, privacy, effects, and outcomes remain identical while modal focus/context are correct.

- [ ] T080 [P] [US6] Add failing modal-parity tests for identical comparison content/choices/results, route parameter pass-through, native modal semantics, focus entry/return, safe dismissal, keyboard/safe areas, long content, and no command on cancel in `src/features/transactions/SyncConflictScreen.test.tsx` and `src/design-system/components/overlays/RouteModalContainer.test.tsx`.
- [ ] T081 [US6] Wrap the shared `SyncConflictScreen`/`TransactionConflictComparison` body with R01 `RouteModalContainer` in `app/modals/sync-conflict.tsx`, passing current conflict/origin parameters unchanged and adding no second lookup or resolution path.
- [ ] T082 [US6] Preserve loading, missing/error, unresolved, selected, resolving, failure, concurrent-change, canceled, and success parity between `app/modals/sync-conflict.tsx` and `app/transactions/conflicts/[id].tsx`; prove parity in `src/features/transactions/SyncConflictScreen.test.tsx`.
- [ ] T083 [US6] Add Arabic RTL/English LTR modal title/close semantics, hidden-value privacy, 200% long comparison, VoiceOver/TalkBack modal order, 44×44 close/action, keyboard/safe areas, and reduced-motion assertions to `src/features/transactions/SyncConflictScreen.test.tsx` and localization files.
- [ ] T084 [US6] Run Modal Conflict/parity/container tests and record exact results in `specs/015-r04-transactions/validation/conflict-modal.md`.
- [ ] T085 [P] [US6] Validate Modal Conflict on Android across the full fixture/state/language/theme/text/TalkBack/focus/dismissal matrix and record `specs/015-r04-transactions/validation/conflict-modal-android.md`.
- [ ] T086 [P] [US6] Validate the equivalent Modal Conflict matrix on iOS/VoiceOver, including home-indicator and focus return, and record `specs/015-r04-transactions/validation/conflict-modal-ios.md`; unavailable infrastructure remains blocked.
- [ ] T087 [US6] Fix only Modal Conflict/container parity defects from T084–T086 in `app/modals/sync-conflict.tsx`, the shared conflict body/screen, or R01 container owner, rerun tests, and update `specs/015-r04-transactions/validation/conflict-modal.md`.

**Checkpoint**: Modal Conflict independently matches the full-screen decision behavior and preserves caller context.

---

## Phase 10: Final Cross-Consumer Consistency and R04 Gate

**Purpose**: Prove all transaction screens and downstream financial consumers remain correct, private, accessible, and route-compatible.

- [ ] T088 Run `npm run typecheck`, `npm run lint`, `npm run check:design-system`, and `npm run check:core-finance`, recording exact output and zero new failures in `specs/015-r04-transactions/validation/final-r04.md`.
- [ ] T089 Run the complete focused Jest command from `specs/015-r04-transactions/quickstart.md` and append suite/test totals and failures to `specs/015-r04-transactions/validation/final-r04.md`.
- [ ] T090 Run targeted Accounts activity, Add results, Tracking feedback/review, Home activity, Budgets, Obligations, Savings, Reports drill-down, Assistant evidence, Notifications/deep links, and Support context regressions identified by T001; record unchanged financial meaning in `specs/015-r04-transactions/validation/consumer-regression.md`.
- [ ] T091 Verify Arabic/English key parity, chronology, bidi values, light/dark, 320×568/large phone, 200% text, screen readers, keyboard, reduced motion, visible/hidden/background masking, 1,000+ data, and all required states across seven screen groups in `specs/015-r04-transactions/validation/final-matrix.md`.
- [ ] T092 [P] Re-run the complete R04 journey on Android: list/pagination → filters → detail → edit → delete/undo → full conflict → modal conflict → origin return; record `specs/015-r04-transactions/validation/final-android.md`.
- [ ] T093 [P] Re-run the equivalent R04 journey on iOS/VoiceOver and record `specs/015-r04-transactions/validation/final-ios.md`; unavailable iOS infrastructure remains explicitly blocked.
- [ ] T094 Verify hidden amounts/source content never appears in screen-reader output, errors, notifications, app-switcher snapshots, logs, or retained evidence; record sanitized checks in `specs/015-r04-transactions/validation/privacy.md`.
- [ ] T095 Fix only defects recorded by T088–T094 in the named R04/R01/R02/R03/R05/core-finance owner, rerun affected checks, and update `specs/015-r04-transactions/validation/final-r04.md`; do not add routes, filters, choices, rules, providers, permissions, schema, or local token workarounds.
- [ ] T096 Complete the R04 handoff in `specs/015-r04-transactions/validation/README.md` by linking final evidence, listing approved projector/filter/conflict contracts, and confirming unchanged routes, filter semantics, mutations, undo deadline, conflict choices, and downstream effects.

**Final Checkpoint**: R04 is complete only when T088–T096 pass or unavailable platform infrastructure is explicitly blocked rather than checked.

---

## Dependencies and Execution Order

```text
Baseline
  → Shared Transaction Foundation
    → Transaction List → validate/fix
      → Filters → validate/fix
        → Detail → validate/fix
          → Edit → validate/fix
            → Delete/Undo → validate/fix
              → Full-Screen Conflict → validate/fix
                → Modal Conflict → validate/fix
                  → Final R04 Gate
```

- Shared Transaction Foundation blocks all screens because it owns projection, pagination, and applied/draft filter boundaries.
- Each screen's fix task blocks the next screen under the screen-first contract.
- Android/iOS validation for the same screen may run in parallel and both feed that screen's fix task.
- R05 owns reusable form anatomy; R04 owns existing-record edit orchestration. R02/R03 own picker identity/eligibility.

### User Story Traceability

- **US1**: T015–T025 — Transaction List.
- **US2**: T026–T037 — Transaction Filters.
- **US3**: T038–T048 — Transaction Detail.
- **US4**: T049–T058 — Transaction Edit.
- **US5**: T059–T068 — Delete and Undo.
- **US6**: T069–T087 — Full-Screen and Modal Sync Conflict.

## Parallel Opportunities

- Projector, pagination, filter-session, and shared-row tests may be authored in parallel where marked `[P]`.
- Android and iOS validation may run in parallel after each focused automated gate.
- Full-screen conflict must pass before modal parity work; screen implementations otherwise remain sequential.

### Parallel Examples by User Story

- **US1**: Run Android T023 and iOS T024 after T022 passes.
- **US2**: Run Android T035 and iOS T036 after T034 passes.
- **US3**: Run Android T046 and iOS T047 after T045 passes.
- **US4**: Run Android T056 and iOS T057 after T055 passes.
- **US5**: Run Android T066 and iOS T067 after T065 passes.
- **US6**: Run Full-Screen validations T077/T078 together, then Modal validations T085/T086 together after their respective automated gates.

## Implementation Strategy

### Reviewable MVP

Complete T001–T025: baseline, Shared Transaction Foundation, and Transaction List. This proves the trustworthy paginated ledger but does not close R04.

### Sequential Delivery

1. Lock existing behavior and complete shared projection/query/filter prerequisites.
2. Implement, test, device-review, and fix one screen/state at a time in the listed order.
3. Run full financial/privacy and downstream regressions only after both conflict entries pass.

### Stop Conditions

- Stop before device validation if focused tests or boundary checks fail.
- Stop before the next screen while the current screen has an unresolved required defect.
- Return shared/picker/form defects to R01/R02/R03/R05 owners; do not patch locally.
- Require a separate approved specification for any route, filter meaning, transaction rule, undo duration, conflict choice, provider, permission, or schema change.

## Notes

- Every task names an existing or plan-approved new file path.
- Tests precede changes to money meaning, pagination, filter state, delete/undo, and conflict resolution.
- `[P]` indicates safe file-level parallelism, not permission to bypass dependencies.
- Preserve unrelated user changes in the shared worktree.
