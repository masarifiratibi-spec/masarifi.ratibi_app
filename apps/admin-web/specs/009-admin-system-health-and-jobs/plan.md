# Implementation Plan: System Health, External Providers, Jobs, and Queues

**Phase / Spec**: Phase 8 / Spec 009  
**Date**: 2026-08-01  
**Spec**: [spec.md](./spec.md)  
**Input**: Clarified Admin Web feature specification

## Summary

Extend the existing approved System Health page into nine Arabic-first
operational routes covering core-service health, external providers, queues,
job runs, safe retry/cancellation simulations, and read-only schedules. Expand
the existing `system-health` typed boundary and MSW adapter instead of creating
a second operations subsystem. Keep telemetry and history as immutable
fictional fixtures, and use one small deterministic in-memory state only for
job retry/cancel transitions and queue counts derived from those runs.

Reuse the current shell, permissions, query client, charts, tables/cards,
dialogs, safe text, platform filter, and mock error patterns. Add no real
monitoring, provider, Redis, BullMQ, worker, scheduler, backend, browser
persistence, or dependency.

## Technical Context

**Language**: TypeScript, strict mode  
**Framework**: Next.js App Router with React  
**UI and data stack**: Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts, Lucide Icons  
**Mock boundary**: Mock Service Worker behind typed services or repositories  
**Testing**: Vitest and Playwright  
**Storage**: Deterministic in-memory mock job state only; no browser or backend persistence  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend implementation  
**Performance and scale**: 25 rows by default; 25/50/100 page sizes; standard
pages usable at p95 ≤2 seconds and filter/sort/pagination/range changes at p95
≤1 second; labeled slow scenarios excluded  
**Operational ranges**: `1h | 24h | 7d | 30d`, default `24h`  
**Refresh**: 60 seconds while visible and online; manual refetch available;
pause while hidden, offline, or a job-action dialog is pending  
**Freshness**: Contract-supplied `observedAt` and `staleAt`; missing or invalid
timestamps produce Unknown; no client freshness policy  
**Text limits**: Search 120 Unicode characters; retry/cancel reason 10–500
trimmed Unicode characters; control characters rejected  
**Mock clock**: Inject fixed `2026-08-01T12:00:00+03:00` into Phase 8 state,
fixtures, handlers, and tests; no `Date.now()` or `Math.random()` in new Phase 8 mock logic  
**Dependencies**: Existing packages only; no install or upgrade

## Constitution Check

*GATE: Every item passed before Phase 0 and was re-evaluated after Phase 1.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 8 / Spec 009 and planned health, job, file, import, AI, notification, report, data-request, subscription, payment, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, Redis, BullMQ, worker, scheduler, Sentry, or real authentication is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, stale, error, success, warning, conflict, and permission states are covered.
- [x] Operational and customer data is aggregated or structurally excluded; retry and cancellation require explicit confirmation.
- [x] All external, mocked, user-entered, URL, metadata, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, links, client storage, environment exposure, errors, and logs are safe; Phase 8 has no uploads or downloads.
- [x] Mock permissions remain development-only UX controls; future backend authorization and queue-scoped projection are documented.
- [x] Dependencies are unchanged.
- [x] Security-sensitive behavior has accessible Vitest and Playwright coverage planned.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

## Project Structure

### Feature documentation

```text
specs/009-admin-system-health-and-jobs/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-system-health-jobs.openapi.yaml
└── tasks.md
```

### Existing Admin Web paths to modify

```text
src/
├── app/admin/
│   ├── system-health/
│   │   ├── page.tsx
│   │   ├── api/page.tsx
│   │   ├── database/page.tsx
│   │   ├── storage/page.tsx
│   │   └── providers/page.tsx
│   └── jobs/
│       ├── queues/page.tsx
│       ├── runs/page.tsx
│       ├── runs/[jobRunId]/page.tsx
│       └── scheduled/page.tsx
├── components/admin/
│   ├── AdminShell.tsx
│   ├── Breadcrumbs.tsx
│   ├── shell-state.ts
│   ├── Charts.tsx
│   ├── PlatformFilter.tsx
│   └── ui.tsx
├── core/
│   ├── permissions/permissions.ts
│   ├── permissions/role-map.ts
│   └── validation/common.ts
├── features/system-health/
│   ├── contracts.ts
│   ├── contracts.test.ts
│   ├── repository.ts
│   ├── repository.test.ts
│   ├── hooks.ts
│   ├── hooks.test.ts
│   ├── OperationsViews.tsx
│   ├── OperationsViews.test.tsx
│   └── JobRunDetailView.tsx
├── mocks/
│   ├── fixtures/system-health.ts
│   ├── handlers/system-health.ts
│   ├── handlers/index.ts
│   ├── phase8-system-health-state.ts
│   ├── phase8-system-health-state.test.ts
│   └── server.ts
└── tests/no-direct-fixtures.test.ts

tests/e2e/
└── system-health-jobs.spec.ts
```

**Structure decision**: Extend the existing `system-health` contracts,
repository, hooks, fixtures, handler, route, and tests. Add two focused view
files rather than one file per route: `OperationsViews.tsx` for read-only
health/provider/queue/list/schedule views and `JobRunDetailView.tsx` for the
only action-bearing route. Keep all nine route files thin. Add one resettable
job-state module; derive queue snapshots from it. Do not add a separate `jobs`
feature, generic monitoring framework, workflow engine, data-table wrapper,
refresh service, or arbitrary JSON viewer.

## Existing Patterns to Reuse

### Approved System Health seed

- Preserve `/admin/system-health` and its approved visual identity.
- Replace the legacy string-based `SystemHealthResponse` with the strict Phase
  8 read models while keeping the feature location and route stable.
- Replace the legacy POST refresh simulation with TanStack Query refetch.
  Manual refresh is a read, not a fictional background job.
- Reuse existing `ChartCard`, charts, status/severity badges, drawers, region
  states, `.data-table` plus `.mobile-data-card`, `.ltr`, and semantic tokens.

### Route, navigation, and permission pattern

- Keep `system-health.read` for the existing overview route and add specific
  read/action permissions for API, database, storage, provider, queue, run, and
  schedule capabilities.
- Register dynamic job-run and specific subroute rules before broad
  `/admin/system-health` and `/admin/jobs` rules in `shell-state.ts`.
- Activate the existing planned Jobs navigation record and add bounded
  subnavigation through the foundation fixture; role filtering remains in the
  navigation handler.
- Reuse the shared role-change query-cache clearing established by Spec 008.
  Role-scoped Phase 8 query keys remain a second boundary.

### Contract, repository, and hook pattern

- Define strict Zod request/response schemas in the existing
  `src/features/system-health/contracts.ts` and import shared schemas only when
  their exact semantics match.
- Realize the logical specification paths under the established
  `/api/v1/admin` mock prefix.
- Use one repository and URL-safe serialization for validated range, platform,
  provider, queue, state, app version, search, sort, and pagination values.
- Query keys begin with `['phase8-system-health']` and include resource, role,
  validated filters, range, platform, and identifier.
- Read hooks use 60-second refetch intervals with background refetch disabled;
  action-bearing views pass the pending-dialog pause state.
- Retry/cancel mutations reuse `useLockedMutation()` with
  `job-run:id:retry|cancel` keys and invalidate only job detail, run list, and
  queue summary queries.

### Mock data and state pattern

- Keep service, API, database, storage, provider, schedule, and initial job
  observations in sanitized immutable fixtures.
- Put only job-run retry/cancel state, deterministic revision increments,
  generated linked attempts, and audit references in
  `phase8-system-health-state.ts`.
- Compute queue counters and oldest-waiting values from current job state so a
  mutation cannot leave list and summary fixtures contradictory.
- Validate role, query, path, payload, expected version, state, and projection
  in the handler before serialization.
- Return structural full, domain, linked-status, or denied projections; never
  send full records and hide fields in components.

### Safe operational presentation

- Use flat allowlisted metadata rows. Do not render recursive JSON, raw logs,
  SQL, request bodies, provider responses, headers, paths, filenames, object
  keys, tokens, credentials, AI content, payment payloads, or customer content.
- Use a small Phase 8 operational range control in `OperationsViews.tsx` with
  existing segmented-control styling. Do not change the shell-wide
  `DateRangeControl`, whose `7d|30d|90d|custom` semantics serve other phases.
- Treat status, impact, fallback, freshness, queue counts, eligibility, allowed
  actions, and deduplicated affected-customer values as authoritative contracts.

## Design and Data Flow

```text
Thin App Router page
  → OperationsViews or JobRunDetailView
  → Phase 8 query/action hook
  → existing SystemHealthRepository
  → existing versioned Admin API client
  → MSW system-health handler
  → role/queue structural projection
  → immutable observation fixture or revisioned Phase 8 job state
```

- Pages do not derive health status, provider fallback, queue thresholds,
  customer impact, freshness deadlines, action eligibility, or schedule state.
- `observedAt` and `staleAt` are parsed before rendering; stale state follows
  the contract and invalid timestamps become Unknown.
- Global service and provider availability never changes with the mobile
  platform filter. Only attributable impact, job, failure, import, and
  notification metrics respond to All/iOS/Android.
- Event/job counts may be additive when each record has one origin. Unique
  affected-customer totals remain authoritative and deduplicated.
- A retry preserves the Failed source run and creates one linked Waiting run
  with attempt +1. `Retried` is a selected-range relationship count, not a state.
- Cancellation changes only an eligible Waiting or Delayed mock run to
  Cancelled. Schedules and providers have no mutation contract.

## Implementation Sequence

### Phase A — Contracts, permissions, and route foundation

1. Add Phase 8 permission keys, role mappings, route rules, navigation records,
   breadcrumb labels, and focused route/permission tests.
2. Replace legacy System Health schemas with strict range, freshness, metric,
   service, provider, queue, job, schedule, action, pagination, and safe-error schemas.
3. Add repository methods and role-scoped query keys for all 11 OpenAPI
   operations; normalize logical spec paths to `/api/v1/admin`.
4. Add refetch-aware hooks and locked retry/cancel mutations with targeted invalidation.

### Phase B — Immutable observations and deterministic job state

1. Expand fictional fixtures for all 12 services, five provider categories,
   seven queues, four ranges, platform/app-version cases, safe endpoint/query
   groups, job histories, schedules, incidents, and partial/stale states.
2. Add explicit retry and cancellation functions with eligibility, expected
   version, 10–500-character reason, control rejection, deterministic clock,
   linked-attempt counter, and planned audit reference.
3. Derive queue snapshots from current job runs and add state reset for tests.
4. Expand the existing handler with all GET and POST operations, structural
   role projections, filters, pagination, scenarios, and safe errors.

### Phase C — Health and provider journeys

1. Make the approved System Health page thin while preserving its approved
   layout language and visual identity.
2. Add API, database, storage, and provider views with operational ranges,
   freshness, partial/unavailable values, explicit units, safe chart summaries,
   and authorized incident links.
3. Add 60-second visible/online refetch and manual refetch without the legacy
   refresh mutation.
4. Verify global-versus-platform attribution, non-color state, safe metadata,
   keyboard/focus, Arabic RTL/English LTR, and all five viewports.

### Phase D — Queue and job journeys

1. Add queue overview, job-run explorer, job detail, and read-only schedule
   views with thin routes and role-scoped projections.
2. Add retry and cancellation dialogs with scope, consequence, plain-text
   reason, expected version, confirmation, pending lock, safe outcome, focus
   restoration, and planned audit reference.
3. Prove original-run immutability, one linked retry attempt, queue-summary
   consistency, eligible cancellation, stale/duplicate conflict, and terminal states.
4. Verify there is no schedule/provider/queue administration surface and no
   real operation, file, payload, or secret path.

### Phase E — Cross-cutting verification

1. Add focused contract, repository/hook, state, handler/projection, component,
   route, and Playwright coverage.
2. Extend no-direct-fixture, route, permission, role-change cache, safe-text,
   accessibility, direction, responsive, performance, and visual-preservation checks.
3. Run the full command and manual matrix in `quickstart.md`.
4. Record exact implementation evidence later; planning does not claim commands pass.

## Test Strategy

- **Contracts**: Fixed ranges, platform and global attribution, page sizes,
  bounded IDs/search/reasons, control rejection, timestamp ordering,
  `observedAt < staleAt`, numeric units, unavailable values, strict enums,
  unknown-field rejection, metadata allowlists, response projections, and errors.
- **State**: Failed → linked Waiting retry, immutable original, incremented
  attempt, Retried count, Waiting/Delayed → Cancelled, terminal/ineligible
  rejection, expected version, duplicate lock, deterministic audit ID and time,
  queue derivation, and reset.
- **Repository/handlers**: Every operation, URL encoding, query serialization,
  specific-before-parameterized endpoint ordering, role matrix, queue/provider
  projection, stale/partial scenarios, response validation, and safe errors.
- **Components**: Loading/empty/partial/stale/error/success/warning/permission/
  conflict/offline states, operational range, 60-second refetch pause/resume,
  tables/cards, chart summaries, flat metadata, confirmation, pending lock,
  live announcement, focus restore, and non-color status.
- **Playwright**: All nine routes, six primary stories, denied direct routes and
  mutations, role change, platform semantics, safe exclusions, keyboard,
  Arabic RTL/English LTR, reduced motion, and 1440/1280/1024/768/390.

## Backend Alignment

**Planned modules**: `health`, `jobs`, `files`, `transaction-imports`, `ai`,
`notifications`, `reports`, `data-requests`, `subscriptions`, `payments`,
`audit-logs`; Redis, BullMQ, storage, providers, and Sentry are infrastructure
or adapter capabilities rather than frontend implementations  
**Planned entities**: `job_runs`, `transaction_imports`,
`ai_processing_jobs`, `notifications`, `uploaded_files`, `payment_events`,
`subscriptions`, `data_export_requests`, `account_deletion_requests`,
`exchange_rates`, `audit_logs`  
**Proposed read models**: Service, API, database, storage, provider, queue, and
schedule observations are DTOs derived from telemetry/adapters; no persistent
entity is invented  
**Proposed contracts**: Typed frontend schemas and MSW endpoints documented in
`contracts/admin-system-health-jobs.openapi.yaml`  
**Deferred production security**: Independent NestJS authentication and
authorization, queue-scoped projections, telemetry integrity, Redis/BullMQ
control, worker and schedule execution, provider authentication/failover,
idempotency, cancellation semantics, rate limits, audit persistence, alerting,
incident response, network controls, and secret management

## Governance Alignment Note

The constitution's narrative delivery list uses a legacy label that groups
system health and audit in Phase 8. The approved ten-spec master document,
active feature pointer, completed Spec 008, and explicit user request assign
security/audit/privacy to Spec 008 and system health/providers/jobs/queues to
Phase 8 / Spec 009. This plan follows that exact approved folder and scope; a
constitution wording amendment is separate governance work.

## Post-Design Constitution Re-evaluation

- The design extends the existing System Health implementation and uses only installed dependencies.
- All nine routes are thin and cross one typed repository/MSW boundary.
- Read-only observations remain immutable; only eligible job actions mutate deterministic mock state.
- Queue snapshots derive from job state, preventing summary/list inconsistency.
- Provider health, schedules, queue administration, and infrastructure remain read-only or absent.
- Operational metadata is flat, bounded, allowlisted, structurally projected, and rendered as text.
- Retry/cancel use exact eligibility, expected version, confirmation, pending lock, safe conflict, deterministic outcome, and audit expectation.
- Global versus attributable platform semantics and unique-customer deduplication remain explicit.
- Mobile preserves urgent health, backlog, failed-job, and permitted action flows; complex diagnostics may use the approved desktop notice.
- All constitution gates remain passed. No exception or amendment is required.

## Complexity Tracking

No constitution deviation is planned.

| Violation | Why Required | Approved By | Follow-up |
|---|---|---|---|
| None | Not applicable | Not applicable | Not applicable |
