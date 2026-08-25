# Implementation Plan: R04 — Transactions, Details, Editing, and Sync Conflicts

**Branch**: `015-r04-transactions` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: R04 specification, approved redesign analysis, implemented transaction routes/screens/domain/services, mobile constitution, and R01/R02/R03/R05 contracts.

## Summary

Redesign the six transaction surfaces in place: a cursor-paginated virtualized date-grouped ledger, complete filter surface, record-first detail, R05-aligned edit flow, confirmed delete with persisted 30-second undo, and one explicit conflict comparison body shared by full-screen/modal routes. Preserve every route, filter meaning, financial rule, mutation, undo deadline, supported conflict choice, deep link, and downstream effect. Add one typed transaction display projector and minimal query/filter-session operations; add no schema, provider, permission, route, business state, or dependency.

## Technical Context

**Language/Version**: TypeScript 5.3.3 strict mode; React 18.2; React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, React Query 5.51, Zustand 4.5, Zod 3.23, Expo SQLite 14 through existing repository, i18next 23.12, R01 design system

**Storage**: Existing core-finance repository and persisted transaction/delete/conflict data; no schema change

**Testing**: Jest 29/jest-expo, React Native Testing Library 12.5, design-system/core-finance checks, TypeScript, ESLint, Android/iOS development-build validation

**Target Platform**: Existing supported Android and iOS Expo mobile application

**Project Type**: React Native/Expo feature-oriented mobile application with file routing and typed query/service/repository ownership

**Performance Goals**: Smooth native virtualization with 1,000+ records; stable existing cursor page size/performance; immediate filter/row feedback; no full-ledger render/announcement; 100–240 ms standard motion

**Constraints**: Six routes unchanged; all current filter/type/source/status semantics; 30-second persisted undo; only repository-supported conflict choices; no fabricated freshness/offline certainty; 320×568, 200% text, 44×44, Arabic/English, hidden-value privacy

**Scale/Scope**: Six routes, ledger/filter/detail/edit/delete-undo/conflict screen groups, 1,000+ dense data, and ten downstream transaction consumers

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

- **Financial trust — PASS**: One projector uses existing effect rules; status/source/relationships remain explicit. Delete requires consequence and retains current undo; conflicts compare both snapshots and expose only supported deliberate choices.
- **Platform honesty — PASS**: Ledger/correction capability remains equal on Android/iOS with current offline/manual recovery and no new permission or SMS claim.
- **Language and access — PASS**: Arabic/English parity, bidi-safe financial/date/reference runs, 200% text, virtualized screen-reader behavior, non-color status, visible alternatives to swipe, reduced motion, and 44×44 targets are planned.
- **Design system — PASS**: R04 consumes R01 row/source/amount/group/form/state/overlay/privacy contracts; shared defects are corrected at R01 ownership, not locally.
- **Architecture and proof — PASS**: Existing domain/service/repository owns rules/pages/mutations. React Query/Zustand remain the single query/filter owners; one presentation projector prevents duplicated mapping without creating a business model.

### Post-Design Re-check

- Research resolves pagination, projector ownership, complete filters, context, form sharing, undo, conflict choices, shared defects, and truthful state mapping.
- Data model adds only ephemeral display/query/decision projections.
- Transaction UI contract separates R01/R02/R03/R04/R05/R06 and core-finance ownership.
- Quickstart covers dense pages, all filters, correction, privacy, accessibility, devices, and downstream flows.
- No constitution exception remains.

## Project Structure

### Documentation (this feature)

```text
specs/015-r04-transactions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/transaction-presentation-contract.md
├── checklists/requirements.md
└── tasks.md                              # Created later by /speckit-tasks
```

### Existing Source Code in Scope

```text
app/
├── (tabs)/transactions.tsx
├── transactions/[id].tsx
├── transactions/[id]/edit.tsx
├── transactions/conflicts/[id].tsx
└── modals/{transaction-filters,sync-conflict}.tsx

src/
├── features/transactions/
│   ├── TransactionListScreen.tsx
│   ├── TransactionFilters.tsx
│   ├── TransactionDetailScreen.tsx
│   ├── TransactionForm.tsx               # Shared anatomy gate with R05
│   ├── SyncConflictScreen.tsx
│   └── useTransactionDraftGuard.ts
├── features/core-finance/core-finance-queries.ts
├── state/core-finance-view-state.ts
├── domain/core-finance.ts
├── services/contracts/core-finance-service.ts
├── services/mocks/core-finance-service.ts
├── storage/core-finance-repository.ts
├── features/shell/navigation-context.ts
├── design-system/                         # R01 contracts consumed/corrected at owner
├── localization/messages/{ar,en}.ts
└── test-utils/core-finance-fixtures.ts
```

**Structure Decision**: Keep thin routes and current domain/service/repository ownership. Extend the existing list/filter/detail/form/conflict components; add one small typed transaction presentation projector and bounded shared conflict body. Use current React Query/Zustand owners and native virtualization; do not add a transaction UI framework or second store.

## Implementation Design

### 1. Shared Prerequisites and Projection

- Inventory R04/downstream consumers and R01 row/source/amount contracts.
- Correct shared raw English/source labels at R01 ownership with localization/accessibility regression.
- Add one R04 projector mapping each existing type/source/record/review/sync state and supplied relationship through current domain meaning and R02/R03 identity.
- Add projector fixtures for all types, negative/zero/large/hidden/multi-currency values and mixed text.

### 2. Transaction List

- Adapt current query to existing cursor pages, reset on applied-filter change, deduplicate stable records, and request next page near list end.
- Render one native virtualized chronological list/section with compact R01 transaction rows.
- Preserve search, return context, detail navigation, and mounted scroll/filter state.
- Add initial/next-page loading, first-use/filtered empty, next-page/query error, partial cached state where provable, hidden, dense, and live-update behavior.

### 3. Filters

- Extend current view store with minimal begin/cancel/reset operations so draft never leaks on cancel.
- Present every existing filter field using R01 form/chip/picker/overlay patterns and R02/R03 selection.
- Derive localized active descriptors/count/removal without new semantics; validate amount range and keep applied context.

### 4. Transaction Detail

- Recompose record hierarchy and consume the projector.
- Render only supplied transfer/original/refund/reversal/obligation/source/review/sync relationships.
- Localize the current hard-coded support label and preserve support/wrong-detection contexts.
- Keep missing/error/back/retry, hidden, edit/delete/report, and origin behavior.

### 5. Edit

- Consume R05 form anatomy after its shared contract is approved.
- Keep R04 current-record adapter, loading/missing/error distinction, update command, validation, draft guard, conflict/result, and ledger return.
- Preserve current values and type-dependent account/category/destination relationships.

### 6. Delete and Undo

- Add named R01 confirmation before current delete command.
- Use pending guards and mapped failure; after success render textual countdown based on persisted `undoExpiresAt`.
- Restore deadline on reopen, block duplicate undo, and move to current correction after expiry/failure.

### 7. Sync Conflict

- Extract one conflict comparison body consumed by full-screen and R01 modal container routes.
- Compare only changed supplied fields and existing-domain financial effects; preserve hidden values.
- Require selected `keep_local` or `keep_later`, then one resolve action; support cancel/concurrent change/error/retry/current destination.

### 8. Localization, Accessibility, Privacy, and Consumers

- Localize every new type/source/status/filter/relationship/action/error label.
- Validate logical RTL/LTR, chronological order, bidi amounts/dates/references, 200% reflow, virtual-list accessibility, 44×44, keyboard/safe areas, reduced motion, visible non-swipe actions.
- Verify no hidden amount/source leaks in UI, accessibility, evidence, notifications, or app switcher.
- Regress R02/R05/R06/R07/R09/R10/R11/R12/R13/R14/support consumers.

## Planned Verification

### Automated

- Projector coverage for every type/source/status/relation/sign/hidden state.
- Cursor pagination, deduplication, date grouping, 1,000+, next-page error, filter reset, scroll/context regression.
- Full filter draft/apply/cancel/clear/chips/range/picker tests.
- Detail hierarchy, localization, missing/error, support/wrong-detection, relationship/action tests.
- Edit loading/missing/error, R05 anatomy adapter, validation/draft/result/conflict tests.
- Delete confirmation/pending/failure, persisted deadline/countdown/undo/expiry tests.
- Full-screen/modal conflict parity, changed fields, effects, supported choices, cancel/failure/concurrency tests.
- Typecheck, lint, design-system/core-finance boundaries and downstream targeted tests.

### Visual and Device

- Independently validate List, Filters, Detail, Edit, Delete/Undo, full-screen Conflict, and modal Conflict.
- Cover Arabic/English, light/dark, normal/200%, smallest/larger phone, TalkBack/VoiceOver, keyboard, reduced motion, hidden values, all types/sources/statuses, mixed/large/multi-currency data, 1,000+, loading/error/partial/offline-mapped/conflict.
- Validate supported Android/iOS environments and keep only privacy-safe evidence.

## `/tasks` Handoff

Future `tasks.md` MUST be ordered:

1. Shared R01/projector/query/filter prerequisites.
2. Screen: Transaction List, then tests/device validation/fixes.
3. Screen: Transaction Filters, then tests/device validation/fixes.
4. Screen: Transaction Detail, then tests/device validation/fixes.
5. Screen: Transaction Edit, then tests/device validation/fixes.
6. Screen State: Delete and Undo, then tests/device validation/fixes.
7. Screen: Full-Screen Sync Conflict, then tests/device validation/fixes.
8. Screen: Modal Sync Conflict, then tests/device validation/fixes.
9. Cross-consumer/financial/privacy and final R04 consistency.

Each group names exact files and covers hierarchy, components, styling, interactions/navigation, states, RTL/LTR, accessibility, motion, tests, device evidence, and bounded validation fixes.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.
