# Implementation Plan: Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002  
**Date**: 2026-07-27  
**Spec**: [spec.md](./spec.md)  
**Input**: Clarified Admin Web feature specification

## Summary

Extend the approved `/admin` Overview in place so authorized operators can
review authoritative combined metrics and compare iOS and Android customer,
device, adoption, import, support, and operational trends. Reuse the Phase 0
flow:

```text
Page → overview hooks → typed repository → shared HTTP client → MSW handlers
     → sanitized fictional fixtures
```

Strengthen the existing Overview contracts rather than adding a route or a
parallel dashboard. Split the current single mock response into independently
queryable overview, platform-analytics, activity, and attention regions so one
failure cannot blank unrelated content. Preserve the approved component
hierarchy, tokens, charts, shell, Arabic RTL default, and English LTR readiness.
No backend, real authentication, provider, persistence, or new dependency is
included.

## Technical Context

**Language**: TypeScript 5.9.3 in strict mode  
**Framework**: Existing Next.js 16.2.11 App Router with React 19.2.8  
**UI and data stack**: Existing Tailwind CSS 4.3.3, TanStack Query 5.101.4,
TanStack Table 8.21.3, React Hook Form 7.83.0, Zod 4.4.3, Recharts 3.10.0,
and Lucide React 1.26.0  
**Mock boundary**: Existing Mock Service Worker 2.15.0 behind typed feature
repositories; no Next.js API routes  
**Testing**: Existing Vitest 4.1.10 and Playwright 1.62.0  
**Storage**: None; sanitized fictional mock data only, with no overview result
persisted in browser storage  
**Direction**: Arabic RTL default; English LTR ready  
**Themes**: Preserve existing light and dark semantic-token themes  
**Target viewports**: 1440px, 1280px, 1024px, 768px, and 390px  
**Performance**: Primary Overview content visible within 2.5 seconds; each
local platform, period, refresh, retry, pagination, or expansion action
acknowledges input within 200 milliseconds under the documented reference
conditions; deliberate slow scenarios are excluded from completion timing  
**Scale**: Activity and attention use bounded pagination; charts and metric
responses use bounded series; the browser does not derive authoritative
customer or financial totals from unbounded raw records  
**Scope**: Existing `apps/admin-web` project and `/admin` route only; no
backend implementation, new route, dependency change, or redesign  
**Existing migration target**: The current Overview contract combines all
regions and the page has one top-level loading/error boundary; Spec 002
introduces independently loaded typed regions without changing the approved
visual hierarchy

No technical-context item remains unresolved.

## Constitution Check

*GATE: Passed before research and rechecked after Phase 1 design.*

- [x] Existing approved `/admin`, shell, components, tokens, assets, and
  configuration remain the baseline; only Overview data and state behavior are
  extended.
- [x] Masarifi Gulf Premium Design System Version 2.1 remains the visual source
  of truth; deep teal stays primary and bronze remains limited.
- [x] The work is Phase 1 / Spec 002 and maps to planned Admin aggregation,
  users, profiles, devices, subscriptions, payments, imports, AI, support,
  notifications, jobs, audit, and health capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication,
  queue, or infrastructure implementation is planned.
- [x] The page consumes Overview hooks and repositories; fixtures remain behind
  MSW handlers and are never imported by presentation code.
- [x] The four HTTP-shaped contracts in
  `contracts/admin-overview.openapi.yaml` are replaceable by a future NestJS
  API.
- [x] The fixed installed stack is reused with strict TypeScript, semantic
  tokens, and no `any`; no dependency addition or upgrade is planned.
- [x] Arabic RTL, English LTR, keyboard operation, focus, accessible chart
  summaries, reduced motion, touch targets, and all five viewports are covered.
- [x] Loading, success, empty, partial, stale, invalid, error, warning,
  rate-limited, unavailable, session-expired, and permission states are
  independently covered.
- [x] Customer and financial values stay aggregated; Spec 002 is read-only and
  introduces no destructive action.
- [x] Platform, period, locale, pagination, scenario, response, version,
  destination, metric, timestamp, and rate values cross Zod validation
  boundaries.
- [x] Response text is safely rendered; raw HTML, uploads, external links,
  redirects, private client storage, public secrets, raw errors, and unsafe
  logs are excluded.
- [x] Mock permissions remain development-only UX controls; every future
  endpoint must independently authorize and filter its response.
- [x] Existing dependencies are sufficient; dependency files remain unchanged.
- [x] Vitest and Playwright coverage includes count invariants, invalid and
  unsafe data, permissions, masking, independent region states, accessibility,
  viewport behavior, and deterministic ordering.
- [x] `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run test:e2e`, and `npm run build`, plus focused static and manual
  reviews, are defined in `quickstart.md`.

**Pre-design gate result**: PASS. No constitutional exception is required.

## Project Structure

### Feature documentation

```text
specs/002-admin-overview-and-platform-analytics/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-overview.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Existing Admin Web source

```text
src/
├── app/
│   └── admin/
│       └── page.tsx
├── components/
│   └── admin/
│       ├── AttentionPanel.tsx
│       ├── Charts.tsx
│       ├── DateRangeControl.tsx
│       ├── PlatformFilter.tsx
│       └── ui.tsx
├── core/
│   ├── api/
│   ├── permissions/
│   └── validation/
├── features/
│   ├── foundation/
│   └── overview/
│       ├── contracts.ts
│       ├── repository.ts
│       ├── repository.test.ts
│       └── hooks.ts
├── mocks/
│   ├── fixtures/
│   │   └── overview.ts
│   ├── handlers/
│   │   ├── attention.ts
│   │   └── overview.ts
│   └── scenarios/
└── tests/

tests/
└── e2e/
```

**Structure decision**: Reuse and extend the paths above. Keep
`src/app/admin/page.tsx` as the only Overview route and preserve its visible
sections. Extend the existing Overview feature contract, repository, hooks,
handler, and fixture rather than creating another analytics feature. Reuse
shared Phase 0 platform, date, permission, API-error, pagination, chart, and UI
state foundations. Add only focused contract/component tests and one
`tests/e2e/overview-analytics.spec.ts` journey if the existing test files
cannot hold the new scenarios cleanly. Component extraction is permitted only
when needed to give independently loaded existing regions a test boundary; it
must preserve the rendered hierarchy and styles.

## Design Decisions

### 1. Preserve the route and visual hierarchy

`/admin` remains the sole Overview route. Existing page header, KPI grids,
chart sections, attention region, health list, and activity region remain in
their approved order and styling. New data appears within those structures;
there is no dashboard builder, new navigation entry, or alternate layout.

### 2. Use four independently loaded contracts

The existing Overview repository owns:

- `/api/v1/admin/overview` for combined KPI, revenue, subscription, operational
  summary, service health, and region freshness;
- `/api/v1/admin/overview/platform-analytics` for customer breakdown, device,
  version, capability, import, support, and comparison analytics;
- `/api/v1/admin/overview/activity` for bounded recent operational activity;
- `/api/v1/admin/attention` for permission-filtered attention items.

Each query has its own TanStack Query key and state. A failed activity,
attention, analytics, or summary request does not clear successful sibling
regions.

### 3. Validate contracts and counting invariants at the repository boundary

Zod parses all requests and responses. Cross-field refinements enforce:

- authoritative combined unique and active totals;
- iOS-only + Android-only + multi-platform = unique total;
- platform active audiences may overlap;
- new customers are counted once on registration completion and belong to
  exactly one registration-origin platform;
- rates stay between 0 and 1;
- device counts are non-negative and exclusively platform-attributed;
- comparison series share period, unit, and aggregation semantics;
- destinations use the approved route allowlist.

The browser may validate authoritative totals but does not reconstruct
production customer, subscription, revenue, or deduplication truth.

### 4. Keep platform and reporting period in every attributable query

Use stable `all`, `ios`, and `android` values and existing 7-, 30-, and 90-day
presets. The query key includes both selections. Global service-health values
remain labeled Global and are unchanged by mobile platform selection. An
out-of-order response cannot replace data for the latest selection.

### 5. Make metric semantics explicit

Every visible metric carries its kind, platform scope, reporting period,
freshness, numeric source, formatted display, and optional change. Currency
responses carry an authoritative normalized currency code and amount.
Customer, device, event, import, request, payment, ticket, and currency values
are not treated as interchangeable or automatically additive.

### 6. Model adoption without customer-level data

Platform analytics contains aggregated version distribution, device
distribution, and capability adoption. iOS supports Shortcut and Share
Extension measures only; Android supports SMS tracking and Notification
Listener measures. Unknown or unsupported versions remain explicit
data-quality categories. No unrestricted iOS SMS or notification capability is
represented.

### 7. Sort attention deterministically after validation

Attention items are permission-filtered and then ordered by severity
`critical → high → medium → low → info`, followed by descending ISO timestamp.
Stable identifiers provide the final deterministic tie-break. A later-phase or
unauthorized destination is omitted while its sanitized summary may remain.

### 8. Keep activity bounded and non-audit

Activity uses the shared pagination envelope and sanitized fictional summaries.
It is explicitly labeled operational activity, not immutable audit history.
Only approved, permitted destinations are interactive.

### 9. Reuse independent state and accessibility patterns

Each existing region owns the relevant skeleton, empty, partial, stale,
unavailable, forbidden, or retry presentation. Charts retain a textual
summary. Filter changes and refresh acknowledge immediately, keyboard focus
remains visible, touch controls meet the approved target, and reduced motion
removes nonessential transitions.

### 10. Keep privacy and security at the boundary

Fixtures contain only aggregated or sanitized fictional values. Response text
renders as text, not HTML. No Overview data enters `localStorage` or
`sessionStorage`. Errors use stable safe codes. No secret, provider payload,
customer identifier, imported message, transaction detail, or device
identifier crosses the presentation boundary.

## Implementation Sequence

1. Record the current `/admin` visual and behavior baseline at the required
   themes, directions, and viewports.
2. Extend Overview Zod contracts and focused invariant tests without changing
   page presentation.
3. Extend the repository and query keys for the four independently loaded
   endpoints.
4. Replace the existing Overview fixtures with complete deterministic
   combined, iOS, Android, overlap, invalid, empty, partial, stale, and
   security scenarios.
5. Extend MSW handlers and reuse the shared safe error/scenario machinery.
6. Bind the existing page regions to their corresponding queries and existing
   shared controls, preserving the approved hierarchy and semantic tokens.
7. Complete platform adoption, global-health labeling, attention sorting,
   bounded activity, and accessible summaries.
8. Add focused Vitest and Playwright coverage, then execute the quickstart
   verification matrix and record evidence.

Each contract and region is independently verifiable. No route, backend,
dependency, or unrelated component is added.

## Backend Alignment

**Planned modules**: admin, users, profiles, devices, subscriptions, payments,
transaction-imports, AI, support, notifications, jobs, audit-logs, and system
health  
**Planned entities**: `auth.users`, `profiles`, `devices`,
`subscription_plans`, `subscriptions`, `payment_events`,
`transaction_imports`, `import_items`, `ai_usage`, `ai_processing_jobs`,
`support_tickets`, `notifications`, `audit_logs`, and `job_runs`  
**Proposed contracts**: Four read-only typed frontend contracts documented in
`contracts/admin-overview.openapi.yaml`; MSW implements them now and future
NestJS controllers may replace the adapter without redesigning the page  
**Deferred production security**: NestJS authentication and endpoint
authorization, role and permission enforcement, server-side aggregation and
deduplication, Supabase persistence and policies, financial normalization,
rate limiting, encryption, immutable audit records, provider-secret handling,
monitoring, and penetration testing

## Post-Design Constitution Recheck

The completed research, data model, OpenAPI contract, and validation guide keep
all pre-design gates satisfied. They reuse the existing route, fixed stack,
typed repository/MSW boundary, semantic tokens, permission simulation, safe
errors, and test infrastructure. No new dependency, route, backend runtime,
storage, credential, raw fixture import, unsafe renderer, or design deviation
is introduced.

**Post-design gate result**: PASS.

## Complexity Tracking

No constitution violation or approved deviation is present.
