# Implementation Plan: Reports and Automatic Email Delivery

**Branch**: `008-reports` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-reports/spec.md`

## Summary

Replace the permanent Reports tab placeholder with four calendar-period reports derived from the
existing Core Finance and Financial Planning records. Add pure period, eligibility, aggregation,
comparison, currency, recurrence, and snapshot rules; expose them through one typed reports
service and TanStack Query; and persist only one report schedule plus idempotent output attempts
containing immutable snapshots. Reuse the existing transaction and obligation routes for
drill-down, the planning draft store for interrupted schedule edits, and the installed chart,
localization, privacy, storage, and test foundations. Email, background scheduling, export,
sharing, file generation, and assistant prose remain deterministic frontend simulations. Add no
dependency.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, Expo SQLite 14, TanStack Query 5,
Zustand 4, Zod 3, i18next 23, React Native SVG, and the existing Masarifi design system; native
`Date` and `Intl` for calendar, timezone, and formatting behavior; no new dependency

**Storage**: Existing SQLite schema advances from version 5 to 6 with `report_schedules` and
`report_output_attempts`. Live reports remain derived from canonical finance/planning records;
immutable output snapshots are embedded in attempts. The existing `planning_drafts` table gains a
`report_schedule` draft kind. No report aggregate, file, provider, or second financial ledger is
persisted.

**Testing**: Jest and React Native Testing Library for period/timezone boundaries, eligibility,
money and comparison rules, currency completeness, aggregation and Other membership, recurrence,
verification, schedule lifecycle, output idempotency, immutable snapshots, migrations, query
invalidation, drill-down context, masking, localization, charts, accessibility, and a 10,000-row
performance fixture; Android development build for layout, lifecycle, offline, TalkBack, and
simulated output flows; iOS native checks require macOS/Xcode

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels and adaptive tablets

**Project Type**: Shared Expo and React Native mobile application with typed local adapters

**Performance Goals**: One O(n) report aggregation pass; summary and first useful content within
2 seconds for 95% of selections with up to 10,000 confirmed contributing records; no calculation
per rendered row; responsive virtualized drill-down lists

**Constraints**: Frontend-only deterministic services; safe integer minor-unit money; explicit
IANA timezone and local-date ranges; confirmed records count once; missing rates and unresolved
records remain visible as incomplete; live reports may refresh but output snapshots are immutable;
one verified recipient and one schedule; stable operation IDs; no production secret, provider,
background scheduler, email, file, sharing, notification, or assistant integration; no false
external-success claim; Arabic RTL and English LTR parity; English numerals; global masking;
200% text; 44 by 44 targets; reduced motion; no camera, receipts, investments, or iOS SMS claim

**Scale/Scope**: Six user journeys; four required report periods; one primary report screen and
three secondary report routes; one report domain/service/repository; up to 10,000 contributing
records per period; one schedule; output-attempt history; complete, empty, insufficient, partial,
estimated, stale, offline, verification, scheduled, sending, sent, failed, retry, paused, and
simulated fixtures

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Reports derive from canonical confirmed records, preserve original
  amounts and missing-data reasons, count obligation/refund/transfer/savings effects once, and
  retain drill-down identities. Live recalculation cannot rewrite an external-output snapshot.
  Recipient verification, detail allowlisting, stable operation IDs, masking, and actionable
  error categories prevent false success, duplicate send, and sensitive-data leakage.
- **Platform honesty - PASS**: Android and iOS receive the same report, schedule, preview, and
  deterministic output states without platform permission. The plan does not claim device-closed
  background delivery, real email, files, sharing, or notifications on either platform. Offline
  users can derive or inspect clearly dated local data and snapshots.
- **Language and access - PASS**: Arabic and English catalogs, logical direction, English
  numerals, mixed-direction money/email content, screen-reader summaries, 200% text, reduced
  motion, grayscale meaning, focus order, and 44 by 44 targets cover reports, charts, forms,
  previews, statuses, and recovery.
- **Design system - PASS**: Existing report metric, comparison, accessible chart, state, form,
  overlay, theme, semantic-token, and privacy primitives are reused and hardened for real data,
  contextual meaning, localization, masking, incomplete values, and retained drill-down IDs. No
  parallel UI or chart package is introduced.
- **Architecture and proof - PASS**: Core Finance and Financial Planning remain canonical owners.
  One narrow reporting projection exposes their read data; reports never write financial records.
  TanStack Query owns report-shaped data, Zustand owns only session view context, SQLite owns
  schedule/attempt history, and typed mock boundaries own simulated output. Focused automated and
  native checks cover every financial, privacy, platform, and access risk.

## Project Structure

### Documentation (this feature)

```text
specs/008-reports/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- reports-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- (tabs)/
|   `-- reports.tsx
`-- reports/
    |-- _layout.tsx
    |-- drill-down.tsx
    |-- preview.tsx
    `-- schedule.tsx

src/
|-- domain/
|   |-- reports.ts
|   `-- financial-planning.ts
|-- features/
|   |-- reports/
|   |   |-- ReportsScreen.tsx
|   |   |-- ReportDrillDownScreen.tsx
|   |   |-- ReportPreviewScreen.tsx
|   |   |-- ReportScheduleScreen.tsx
|   |   |-- report-queries.ts
|   |   `-- useReportDraft.ts
|   |-- core-finance/
|   |   `-- core-finance-queries.ts
|   `-- financial-planning/
|       `-- financial-planning-queries.ts
|-- services/
|   |-- contracts/
|   |   |-- reports-service.ts
|   |   `-- financial-planning-service.ts
|   `-- mocks/
|       |-- reports-service.ts
|       `-- report-delivery-adapter.ts
|-- state/
|   `-- reports-view-state.ts
|-- storage/
|   |-- database.ts
|   `-- reports-repository.ts
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- design-system/
|   |-- charts/
|   |   |-- chart-data.ts
|   |   |-- DonutChart.tsx
|   |   `-- LineChart.tsx
|   `-- components/financial/
|       |-- ComparisonIndicator.tsx
|       `-- ReportMetricCard.tsx
`-- test-utils/
    `-- report-fixtures.ts

scripts/
`-- check-reports-boundaries.mjs
```

Focused tests remain beside domain, repository, service, feature, route, design-system, and
boundary behavior. Existing transaction and obligation routes are reused for final drill-down
destinations rather than duplicated under Reports.

**Structure Decision**: Keep the five-tab shell and replace only the Reports placeholder. Use one
reports domain/service/repository, one transient report view store, and three secondary routes for
drill-down, preview/history, and schedule settings. Extend Financial Planning with one narrow
read-only reporting snapshot and a schedule-draft kind; do not let Reports query its storage
directly. Persist a self-contained snapshot inside each output attempt instead of adding a report
cache or snapshot table. Add a cache only if measured local derivation later misses the two-second
gate.

## Implementation Strategy

### Slice 1: Reporting domain and canonical read boundary

- Define report periods, values, metrics, comparisons, breakdowns, drill-down descriptors,
  snapshots, schedules, attempts, validation, recurrence, and safe errors in one reports domain.
- Derive completed and elapsed date ranges in the captured IANA timezone. Compare incomplete
  periods only with the matching elapsed portion of the immediately preceding period.
- Add one Financial Planning reporting snapshot and use existing Core Finance paged reads so the
  reports service receives canonical transactions, account/category labels, salary, budgets,
  obligation payments, savings movements, and completeness evidence without a second ledger.
- Aggregate eligible records once in integer minor units. Include confirmed local pending-sync
  records once; exclude review-required and unresolved conflict candidates and mark affected
  sections incomplete.
- Add schema v6 schedule and output-attempt tables. Reuse planning drafts for interrupted schedule
  edits and keep immutable snapshots inside attempts.

### Slice 2: Period reports, charts, and drill-down

- Replace the tab placeholder with period selection, exact ranges, summary metrics, income and
  expense comparison, cash flow, category/account/merchant breakdowns, budget, obligation,
  savings, salary, previous-period comparison, contextual assistant entry points, and state
  recovery.
- Implement monthly, three-month, half-year, and annual questions from the same report model,
  including denominator-safe savings rate and comparison percentage.
- Preserve original currencies and rate timestamps; label converted values as estimates and
  mark totals incomplete when any otherwise eligible amount lacks a rate.
- Harden existing ReportMetricCard, ComparisonIndicator, AccessibleChartFrame, LineChart,
  DonutChart, and chart-data helpers for semantic metric meaning, actual values, localized Other,
  retained member IDs, masking, non-color cues, RTL, and equivalent text summaries.
- Map category/account/merchant/month/Other drill-down to the existing TransactionFilterSet and
  obligation results to existing obligation detail. Preserve report period and return context in
  transient view state.

### Slice 3: Schedule, preview, and deterministic output

- Add one schedule with validated/normalized recipient email, exact-address verification state,
  frequency, language, currency, day 1-28, captured timezone, assistant-summary option, detail
  level, version, last result, and projected next delivery.
- Default to summary-only and day 1. A missed schedule projects the next recurrence and never
  silently backfills; a timezone change requires schedule review.
- Autosave meaningful schedule edits through the existing durable planning draft boundary and
  preserve them across validation, navigation, restart, offline state, and recoverable failure.
- Build side-effect-free previews. Allow send test, send now, scheduled mock, retry, simulated
  download, and simulated share through stable operation IDs and one deterministic adapter.
- Persist each attempt with its immutable snapshot. Retry creates one linked attempt; repeating an
  operation returns the original result. Late results never reactivate a paused schedule.
- Enforce the detailed-row allowlist: date, type, category, optional merchant, amount/currency,
  and masked account label only.

### Slice 4: Query invalidation, privacy, and recovery

- Add report query keys for live report, breakdown, schedule, draft, preview, attempts, and
  attempt detail. Schedule/output mutations invalidate only mutable report-owned keys.
- Extend Core Finance and Financial Planning mutation invalidation to refresh live report keys;
  immutable attempt snapshots are never invalidated or recomputed.
- Map complete, empty, insufficient, partial, estimated, stale, offline, verification-required,
  active, paused, disabled, sending, sent, failed, retrying, late-result, and simulated states to
  localized actions without raw errors.
- Exclude financial amounts, recipient email, merchants, accounts, report rows, and snapshots from
  analytics/logs/errors; ensure hidden values are neither rendered nor announced.
- Keep assistant buttons contextual but mock-only and prevent them from inventing totals or
  changing records.

### Slice 5: Focused proof and native evidence

- Add pure checks for period/leap/timezone math, elapsed comparisons, eligibility, formulas,
  currency completeness, Other membership, contextual directions, recurrence, and sanitized
  snapshots.
- Add migration/repository/service checks for one schedule, drafts, verification, versions,
  operation idempotency, retry linkage, late result, immutable snapshot persistence, and query
  scopes.
- Add screen/route/design-system checks for all report types, drill-down/back context, charts,
  schedule retention, privacy, Arabic/English, themes, small screens, 200% text, screen readers,
  grayscale, and reduced motion.
- Add one report boundary script and one deterministic 10,000-record performance test. Retain
  Android device evidence and record iOS/VoiceOver as blocked unless macOS/Xcode is available.

## Phase 0: Research Outcome

[research.md](research.md) resolves dependency reuse, period/timezone semantics, record
eligibility, money and comparison formulas, currency estimates, chart grouping, canonical data
ownership, schedule recurrence and verification, output idempotency, snapshot immutability,
privacy, query ownership, and the 10,000-record proof. No planning clarification remains open.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines report values, periods, summaries, breakdowns,
  drill-down, schedules, drafts, attempts, immutable snapshots, relationships, validations,
  state transitions, schema v6 shape, privacy, and derived calculations.
- [contracts/reports-contract.md](contracts/reports-contract.md) defines route, service, report,
  schedule, preview, output, retry, query, error, invalidation, privacy, localization,
  accessibility, and simulation boundaries.
- [quickstart.md](quickstart.md) provides runnable automated and native validation for all six
  stories, five clarifications, report periods, exact-once calculations, schedule/output states,
  accessibility matrix, and the two-second/10,000-record target.

## Post-Design Constitution Re-check

The design keeps Core Finance and Financial Planning as the only financial owners, derives live
reports from canonical confirmed records, persists only report preferences and immutable output
evidence, and refreshes live queries after source changes. It never fabricates a conversion,
comparison, external send, file, share, notification, assistant fact, or background scheduler.
Explicit ranges, original amounts, completeness reasons, traceable drill-down, recipient
verification, summary-only default, allowlisted detailed rows, operation idempotency, and frozen
snapshots preserve financial trust. Arabic/English parity, semantic component reuse, masking,
offline recovery, accessible chart summaries, focused automated proof, and native evidence are
specified. No gate failed and no exception is required.

## Complexity Tracking

No constitution violation or new dependency requires justification. A separate report cache,
snapshot table, file adapter, provider contract, or background scheduler is intentionally omitted;
existing local canonical data and attempt-embedded snapshots cover the approved frontend scope.
