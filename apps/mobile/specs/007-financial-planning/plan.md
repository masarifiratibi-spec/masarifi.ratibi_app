# Implementation Plan: Salary, Budgets, Obligations, Debts, Installments, and Savings

**Branch**: `007-financial-planning` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-financial-planning/spec.md`

## Summary

Add secondary Salary, Budgets, Obligations, and Savings experiences around the existing Core
Finance ledger. Extend the current SQLite owner from schema version 4 to 5 with canonical
planning records, durable drafts, operation IDs, and conflicts; derive cycles, totals, forecasts,
schedule state, and progress instead of persisting duplicate summaries. Use one typed planning
service and deterministic adapter coordinated by TanStack Query, with a narrow Core Finance seam
for atomic ledger-plus-planning writes. Reuse the current routes, localization, privacy,
financial components, and tests after hardening them for zero/incomplete states. Add no dependency
and no production provider behavior.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo SQLite 14, TanStack Query 5,
Zustand 4, Zod 3, i18next 23, React Native SVG, and the existing Masarifi design system; native
`Date`/`Intl` for calendar and formatting behavior; no new dependency

**Storage**: Existing SQLite schema advances from version 4 to 5 for salary profiles/receipt
links, budgets/category allocations, obligations/schedules/payments, savings goals/movements,
planning drafts, operation IDs, and conflicts. Core Finance remains the ledger owner. Cycles,
progress, totals, forecasts, due state, and Home previews are derived.

**Testing**: Jest and React Native Testing Library for pure calendar/money rules, salary cycles,
budget eligibility/currency/rollover, schedule and payment allocation, atomicity, idempotency,
undo/recalculation, goal movements, migrations, query scopes, routes, RTL/LTR, masking, and
accessibility; Android development build for lifecycle, offline, TalkBack, and real layout; iOS
native checks require macOS/Xcode

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels and adaptive tablets

**Project Type**: Shared Expo and React Native mobile application with typed local adapters

**Performance Goals**: First useful local planning overview within 1 second after hydration;
month/filter/detail result within 300 ms for the acceptance fixture; responsive virtualized
100-row histories and ordinary interaction at 60 frames per second; mutation feedback within
1 second for local deterministic data

**Constraints**: Frontend-only deterministic services; integer minor-unit money; local calendar
dates; one durable financial owner; no production secrets, backend, bank, rate, notification,
reminder, or payment-provider calls; no silent financial mutation or conflict overwrite; exact-
once multi-record effects; manual/offline fallback; Arabic RTL and English LTR parity; English
numerals; 200% text; 44 by 44 targets; reduced motion; no camera, receipts, investments, or iOS
SMS claim

**Scale/Scope**: Six user journeys; four secondary route groups; one planning domain/service/
repository; 24 months and 500 ledger transactions; 24 monthly budgets with 100 category limits;
50 obligations with schedules/payment histories; 50 goals with movements; normal, empty,
partial, stale, offline, conflict, review, and correction fixtures

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Confirmed primary receipts define salary cycles. Budget effects
  reuse the ledger once. Payment and detected-match changes preview when required and commit
  transaction, payment, allocation, schedule, and summaries atomically. Clear automatic changes
  expose source/edit/undo. Goal movements cannot change account balances. Undo and correction
  preserve history and recompute from canonical records. Global masking and actionable recovery
  apply throughout.
- **Platform honesty - PASS**: Manual salary, budget, obligation, payment, and savings flows work
  on Android and iOS and offline where eligible. Android tracking may provide clear salary or
  payment records through the established boundary. iOS receives manual, voice, and approved
  assisted input only; no SMS permission or inbox behavior is introduced.
- **Language and access - PASS**: Arabic and English catalogs, logical direction, English
  numerals, mixed-direction financial values, coherent screen-reader announcements, 200% text,
  reduced motion, contrast-safe states, keyboard access, and 44 by 44 targets cover every route
  and state.
- **Design system - PASS**: Existing financial cards, progress, timeline, form, state, overlay,
  navigation, chart, theme, and semantic-token primitives are reused and hardened for integer
  values, zero denominators, masking, localization, incomplete data, and over-limit/progress
  states. No parallel UI system is introduced.
- **Architecture and proof - PASS**: SQLite remains the single durable financial owner behind
  repositories and typed services. Core Finance remains the only ledger writer. TanStack Query
  owns service-shaped reads; Zustand holds only transient UI state. Stable operation IDs,
  versions, boundary checks, focused tests, and native evidence prove critical behavior. No
  provider call or secret enters the client.

## Project Structure

### Documentation (this feature)

```text
specs/007-financial-planning/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- financial-planning-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- salary/
|   |-- index.tsx
|   |-- setup.tsx
|   `-- review/[id].tsx
|-- budgets/
|   |-- index.tsx
|   |-- new.tsx
|   |-- [id].tsx
|   `-- [id]/edit.tsx
|-- obligations/
|   |-- _layout.tsx
|   |-- index.tsx
|   |-- new.tsx
|   |-- [id].tsx
|   |-- [id]/edit.tsx
|   |-- [id]/payment.tsx
|   `-- review/[id].tsx
|-- savings/
|   |-- index.tsx
|   |-- new.tsx
|   |-- [id].tsx
|   `-- [id]/movement.tsx
|-- modals/
|   `-- planning-conflict.tsx
`-- (tabs)/
    |-- home.tsx
    `-- more.tsx

src/
|-- domain/
|   `-- financial-planning.ts
|-- features/
|   |-- financial-planning/
|   |   `-- financial-planning-queries.ts
|   |-- salary/
|   |-- budgets/
|   |-- obligations/
|   `-- savings/
|-- services/
|   |-- contracts/
|   |   `-- financial-planning-service.ts
|   `-- mocks/
|       |-- financial-planning-fixtures.ts
|       `-- financial-planning-service.ts
|-- storage/
|   |-- database.ts
|   |-- core-finance-repository.ts
|   `-- financial-planning-repository.ts
|-- state/
|   `-- financial-planning-view-state.ts
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- design-system/
|   `-- components/financial/
`-- test-utils/
    `-- financial-planning-fixtures.ts

scripts/
`-- check-financial-planning-boundaries.mjs
```

Focused tests remain beside domain, repository, service, feature, route, and boundary behavior.

**Structure Decision**: Keep route files thin and the five-tab shell unchanged. Use one planning
domain/service/repository for shared money, date, draft, sync, conflict, and atomicity rules, while
Salary, Budgets, Obligations, and Savings keep separate user-facing feature folders. Extend the
existing Core Finance repository only with the narrow transaction-aware write seam needed for a
single SQLite commit; do not create a second ledger or generic framework.

## Implementation Strategy

### Slice 1: Canonical planning foundation

- Define local-date, calculation, record metadata, salary, budget, obligation, payment, goal,
  draft, conflict, validation, and error contracts in one planning domain.
- Add forward-only schema v5 tables, constraints, indexes, operation IDs, versions, and synthetic
  fixtures through the existing database owner.
- Add one planning repository/service and TanStack Query keys with exact affected-scope mapping.
  Keep persisted planning records out of Zustand.
- Add a durable planning draft record for meaningful interrupted forms.
- Add the narrow Core Finance repository seam that permits a validated ledger write inside the
  existing exclusive transaction without exposing SQLite to routes or features.
- Add the planning boundary script and package command; reuse all current dependencies.

### Slice 2: Salary cycles and budgets

- Add salary overview/setup/review routes, confirmed receipt links, last-day schedule fallback,
  early/late/overdue states, projected occurrences, comparisons, correction, and undo.
- Derive cycle income, eligible expenses, reserved obligations, remaining money, and guarded
  daily suggestion from canonical records.
- Add monthly budget creation/copy/edit, frozen positive rollover, unique category limits,
  allocation moves, thresholds, related transactions, and calendar-month navigation.
- Derive budget progress and run-rate forecast from Core Finance semantics, preserve original
  currencies, and make missing-rate results incomplete.
- Replace profile-completion placeholders and add Home/More links without changing the primary
  tabs.

### Slice 3: Obligations and atomic payments

- Add the approved Obligations information architecture and type-aware fixed, open-ended, and
  irregular forms.
- Persist schedules and confirmed open-ended occurrences; derive payable/receivable totals,
  progress, next due, and overdue separately from lifecycle.
- Add detail, lifecycle, reminder-preview, matching-status, source, schedule, history, and related-
  transaction experiences.
- Add payment preview and confirmation for full, partial, later-installment, principal,
  correction, early, excessive, and settlement cases.
- Coordinate exactly one ledger transaction/link and one obligation payment/allocation in one
  SQLite commit. Apply operation-ID idempotency and version checks.
- Replace the bounded SPEC-005/006 obligation preview with the planning contract. Keep ambiguous
  and duplicate matches in review; propagate clear match view/edit/undo across both owners.

### Slice 4: Savings and integrated planning summaries

- Add goal list/create/detail/movement routes and active, paused, target-reached, completed,
  emergency-fund, and archived presentations.
- Derive progress, remaining amount, contribution history, and calendar-based required monthly
  saving from canonical movements.
- Keep movements tracking-only by default; allow explicit existing transaction/transfer links
  with estimates and no duplicate ledger effect.
- Add withdrawal validation, below-target reopening preview, reversal, target-date recovery, and
  calm optional-motion completion.
- Feed compact salary, budget, obligation, and goal previews into existing Home and profile-
  completion owners; expose linked destinations to Reports/Assistant without implementing their
  SPEC-008/009 screens.

### Slice 5: Recovery, localization, access, and proof

- Map initial, loading, empty, partial, stale, error, offline, pending, failed, conflict,
  review, read-only, paused, completed, and archived states to localized actions.
- Preserve drafts and both conflict snapshots; allow only keep-local or keep-later for planning
  records and never count both.
- Harden existing BudgetCard, ObligationProgressCard, SavingsGoalCard, FinancialProgress,
  InstallmentTimeline, and sensitive-value presentation for localized labels, minor units, zero,
  incomplete/estimated state, masking, RTL, and scaling.
- Verify exact calculations, atomic writes, retry idempotency, correction/undo, affected query
  scopes, privacy, both languages/themes, 320x568 and large layouts, keyboard, 200% text,
  screen readers, reduced motion, offline operation, and Android/iOS platform honesty.

## Phase 0: Research Outcome

[research.md](research.md) resolves dependency reuse, money/date representation, salary cycle
boundaries, budget calculation/currency/forecast/rollover, obligation lifecycle/open-ended totals,
payment allocation/atomicity/undo, savings semantics, storage/query ownership, routes, and proof.
No planning clarification remains open.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines ownership, persistence, fields, relationships,
  validations, calculations, lifecycle transitions, schema v5 shape, sync, and privacy.
- [contracts/financial-planning-contract.md](contracts/financial-planning-contract.md) defines
  route, service, preview/confirm, calculation, atomicity, query, offline, error, capture,
  localization, accessibility, and boundary behavior.
- [quickstart.md](quickstart.md) provides runnable automated and native validation for all six
  user stories, five clarifications, performance targets, and financial invariants.

## Post-Design Constitution Re-check

The design keeps one durable financial owner and one ledger writer, uses exact money and explicit
date semantics, derives summaries, and coordinates all cross-record effects atomically and
idempotently. Salary projections never fabricate income; missing rates and provider rules become
unavailable states; open-ended obligations never invent debt; goal movements cannot mutate an
account. Manual/offline fallbacks, explicit conflict resolution, masking, Arabic/English parity,
semantic component reuse, typed replaceable boundaries, and focused automated/native proof are
specified. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation or new dependency requires justification. The only cross-feature
extension is the narrow Core Finance transaction-aware write seam required to keep one ledger
owner while committing obligation payments atomically.
