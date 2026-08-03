# Implementation Plan: AI Management and Automation Intelligence

**Phase / Spec**: Phase 5 / Spec 006 of 010  
**Date**: 2026-07-29  
**Spec**: [`spec.md`](./spec.md)  
**Input**: Clarified Admin Web feature specification

## Summary

Add the ten approved AI operations routes through one new `features/ai`
boundary. Reuse the existing Admin shell, components, typed API client,
TanStack Query patterns, locked mutations, permission simulation, Mock Service
Worker setup, and test stack. Provider health, severity, impact, eligibility,
cost normalization, request counts, and safety outcomes remain authoritative
contract values. The frontend receives only sanitized fictional data and never
calls an AI provider or receives raw prompts, conversations, responses, keys,
credentials, or provider payloads.

## Technical Context

**Language**: TypeScript 5.x in strict mode; no `any`  
**Framework**: Existing Next.js App Router and React application  
**UI and data stack**: Existing Tailwind CSS, TanStack Query, TanStack Table,
React Hook Form, Zod, Recharts, and Lucide Icons  
**Mock boundary**: Existing typed API client and repository pattern backed by
Mock Service Worker; all queries, identifiers, commands, and responses are
validated at the boundary  
**Testing**: Existing Vitest and Playwright setup  
**Storage**: Mock runtime memory only; no browser storage or persistent data  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend, provider,
database, queue, credential, or dependency change  
**Performance and scale**: Lists default to 25 rows, allow 25/50/100, and cap
at 100. Search and names cap at 120 Unicode characters, reasons/notes at 500,
sanitized prompt previews at 4 KiB, sanitized report excerpts at 280 Unicode
characters, and declarative safety definitions at 8 KiB. In standard mock
scenarios, at least 95% of overview/detail loads show usable content within two
seconds and at least 95% of filter/sort/pagination updates complete within one
second. Explicit slow scenarios are measured separately.  
**Existing implementation**: The shell, navigation placeholder, API client,
locked mutation helper, platform/date filters, charts, tables, dialogs,
permission boundary, safe errors, mock scenarios, and role simulation already
exist and are extended in place.

## Constitution Check

*GATE: Evaluated before Phase 0 and re-evaluated after Phase 1 design.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 5 / Spec 006 and planned AI gateway, provider, model, prompt, usage, safety, permission, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, queue, credential, or real authentication is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, bidirectional identifiers, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, error, success, warning, and permission states are covered.
- [x] Customer and financial data is masked or aggregated; sensitive actions require confirmation and pending locks.
- [x] External, mocked, URL, form, provider, prompt, report, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, previews, links, storage, environment exposure, errors, and logs are constrained safely.
- [x] Mock permissions remain development-only UX controls; future backend authorization is documented.
- [x] Dependencies remain unchanged.
- [x] Security-sensitive behavior has planned accessible Vitest and Playwright coverage.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

**Initial gate result**: PASS. No constitution deviation requires approval.

## Project Structure

### Feature documentation

```text
specs/006-admin-ai-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── admin-ai-management.openapi.yaml
└── tasks.md                         # created by /speckit-tasks
```

### Planned Admin Web source footprint

```text
src/
├── app/admin/ai/
│   ├── page.tsx
│   ├── providers/page.tsx
│   ├── providers/[providerId]/page.tsx
│   ├── models/page.tsx
│   ├── prompts/page.tsx
│   ├── prompts/[promptId]/page.tsx
│   ├── usage/page.tsx
│   ├── failures/page.tsx
│   ├── reports/page.tsx
│   └── safety-rules/page.tsx
├── features/ai/
│   ├── contracts.ts
│   ├── repository.ts
│   ├── hooks.ts
│   ├── AiOverview.tsx
│   └── AiViews.tsx
├── mocks/
│   ├── fixtures/ai.ts
│   ├── handlers/ai.ts
│   └── phase5-ai-state.ts
├── core/permissions/
│   ├── permissions.ts
│   └── role-map.ts
├── components/admin/shell-state.ts
└── mocks/fixtures/foundation.ts

tests/e2e/
└── ai-management.spec.ts
```

Exact view/test filenames may be consolidated during tasks if the smallest
cohesive unit differs. Route files remain thin, and focused tests remain beside
the production unit they verify.

**Structure decision**: Create one `features/ai` boundary because all ten
routes share AI-specific contracts, query keys, permissions, authoritative
classification rules, sanitized projections, and runtime mutations. Use two
cohesive view files initially; split only if implementation evidence shows a
review or ownership problem. Add one runtime-state module because provider,
model, prompt, failure, report, and safety actions share revision/conflict
behavior. Reuse all shared Admin primitives.

## Implementation Design

### 1. Activate the existing AI entry point

1. Change the existing planned AI navigation item to active with
   `/admin/ai` and `ai.overview.read`.
2. Add AI permission keys to the current permission union and role map.
3. Add most-specific AI route rules before the `/admin` fallback rule.
4. Add AI entries to global search only where the existing grouped search
   contract supports them; do not expand global search architecture.
5. Keep page files limited to parameter validation, permission composition, and
   a feature view.

### 2. Contract and repository boundary

1. Define strict Zod schemas for safe identifiers, query strings, pagination,
   platform, period, feature, locale, provider, model, prompt lifecycle, status,
   severity, currency, projections, commands, and safe errors.
2. Reject unknown response fields and invalid cross-field combinations before
   presentation.
3. Use the existing `/api/v1/admin` prefix and document the versioned paths as
   the current-project realization of the logical Spec 006 contracts.
4. Keep all AI calls in `features/ai/repository.ts`; views never call `fetch`,
   MSW, or fixture modules.
5. Expose TanStack Query hooks with stable query keys, previous-data behavior
   for lists, focused invalidation, and `useLockedMutation` for actions.
6. Treat request totals, attempt counts, health, severity, impact, eligibility,
   normalized cost, test results, and safety coverage as authoritative values.

### 3. Privacy-safe projections and rendering

1. Usage responses contain masked user references and metadata only—never
   prompt or response content.
2. User-report responses may contain only a future-backend-sanitized,
   allowlisted excerpt capped at 280 Unicode characters plus omission labels.
3. Full raw prompts, conversations, responses, financial values, provider
   payloads, headers, keys, credentials, and secret configuration never enter
   frontend contracts or fixtures.
4. Prompt detail uses only fictional sanitized preview text, allowlisted
   variables, bounded schema summaries, validation summaries, immutable
   history, and fictional tests.
5. All preview-like values render as text or allowlisted structured fields.
   No raw HTML, Markdown renderer, generic provider JSON viewer, or
   `dangerouslySetInnerHTML` is introduced.
6. Limited roles receive structurally limited aggregate/context projections;
   protected fields are not sent and hidden client-side.

### 4. Provider and model configuration

1. Model provider status, feature coverage, latency, failure rate, cost, rate
   limit state, and freshness as contract values.
2. Scope fallback chains by AI feature and locale, independent of mobile
   platform.
3. Validate unique priorities, no cycles, compatible provider/model/feature/
   locale combinations, and at least one eligible terminal route.
4. Block changes on stale revision, denied permission, invalid state, missing
   coverage, or pending duplicate submission.
5. Present all changes as mock decisions with previous/proposed state,
   consequence, confirmation, pending state, safe result, and audit reference.

### 5. Prompt lifecycle

1. Model `draft -> testing -> active -> retired`.
2. Allow one active prompt version per feature/locale scope.
3. Require valid variables/schema and all enabled required tests to pass before
   activation.
4. Keep version history immutable.
5. Simulated rollback creates a new Draft from an eligible historical version;
   it never reactivates or edits the historical record.

### 6. Usage, failures, reports, and safety

1. Usage lists filter by feature, provider, model, plan, platform, date, and
   status while preserving active filter context and pagination.
2. Count each original request once; model retries and fallback attempts
   separately.
3. Keep currencies separate unless the response includes an authoritative
   normalized total, currency, and conversion timestamp.
4. Support the specified failure and report dispositions with revision checks,
   bounded reasons, confirmations, pending locks, and safe conflict recovery.
5. Model safety rules as bounded declarative conditions and outcomes. No code,
   dynamic evaluation, recursion, network action, or client-side enforcement.
6. Reject safety changes that create required-coverage gaps, invalid scope,
   unsupported operations, or stale state.

### 7. Mock HTTP and runtime state

1. Add one AI fixture family and register one AI handler family in the existing
   handler registry.
2. Seed deterministic Arabic/English, UAE/Saudi, iOS/Android/unknown,
   multi-platform, provider outage, successful/failed fallback, mixed-currency,
   prompt lifecycle, failure, report, and safety cases.
3. Keep mutable state in module memory and reset it on reload, development
   restart, or scenario reset.
4. Support success, empty, large, slow, partial, unauthorized, forbidden, not
   found, expired, validation, conflict, rate limited, unavailable, unsafe
   response, masking violation, and safe internal-error scenarios.
5. Reuse the existing development-only simulated-role forwarding and validate
   permissions in handlers so direct mock mutations can return safe forbidden
   responses.

### 8. UI delivery order

1. Activate navigation/permissions and add the AI Overview.
2. Add provider list/detail and model inventory/assignment.
3. Add prompt versions/detail and lifecycle actions.
4. Add usage and failure explorer.
5. Add response reports and safety rules.
6. Apply complete states, safe confirmations, announcements, conflict recovery,
   privacy projections, accessibility, and responsive behavior across routes.
7. At 390px, retain overview, outage/fallback, severe failure/report, and
   approval-result monitoring; show the specified desktop-required state for
   complex provider/model/prompt/safety configuration.

### 9. Verification strategy

- **Vitest contracts**: bounds, strict unknown-field rejection, IDs,
  authoritative totals/classifications, platform attribution, mixed currency,
  sanitized excerpt cap, projection omission, fallback graph, prompt
  lifecycle, safety coverage, and unsafe-response rejection.
- **Vitest repository/hooks/state**: query serialization, response validation,
  scenario matrix, cache invalidation, expected revision, reset behavior,
  pending locks, conflict, and role-based mock rejection.
- **Vitest components**: metrics, charts, lists, details, empty/partial/error
  regions, safe previews, permission labels, desktop-required notices,
  confirmations, accessible announcements, and focus restoration.
- **Playwright**: all ten routes; primary overview/provider/prompt/usage/
  failure/report/safety journeys; denied routes/actions; masking; unsafe text;
  lifecycle and safety gates; keyboard/focus; RTL/LTR; reduced motion; five
  viewports; 20 representative standard samples per load/interaction class for
  the response targets; and console/runtime errors.
- **Static review**: no `any`, direct fixture imports, raw AI/customer content,
  unsafe rendering, debug logs, secrets, browser persistence, real provider/
  backend calls, new dependencies, or scattered raw colors.

## Backend Alignment

**Planned modules**: `ai-gateway`, `ai-providers`, `ai-models`, `ai-prompts`,
`ai-usage`, `ai-processing-jobs`, `ai-safety`, `users`, `profiles`, `devices`,
`subscriptions`, `roles`, `permissions`, and `audit-logs`  
**Planned entities**: `ai_providers`, `ai_models`, `ai_prompt_versions`,
`ai_feature_assignments`, `ai_usage_records`, `ai_processing_jobs`,
`ai_failures`, `ai_response_reports`, `ai_safety_rules`, `ai_safety_events`,
`users`, `profiles`, `devices`, `subscriptions`, `roles`, `permissions`, and
`audit_logs`  
**Proposed contracts**:
[`contracts/admin-ai-management.openapi.yaml`](./contracts/admin-ai-management.openapi.yaml)  
**Deferred production security**: NestJS authorization and validation,
provider secret management, network egress, provider allowlists, prompt
encryption/retention, production routing/fallback, rate and spend controls,
idempotency, queue isolation, safety enforcement, immutable audit storage,
monitoring, and incident response

## Post-Design Constitution Check

**Result**: PASS. Research, data model, API contract, and quickstart preserve
the approved Admin implementation, add one feature boundary and no dependency,
keep all data behind typed replaceable contracts, and cover authoritative
metrics, privacy projections, safe rendering, permissions, confirmations,
runtime-only state, accessibility, RTL/LTR, responsive behavior, complete UI
states, and evidence-based verification. No deviation or unresolved
clarification remains.

## Complexity Tracking

No constitution deviation. One AI feature boundary, one mock handler family,
one runtime-state module, and two initial cohesive view files are the smallest
structure that covers ten related routes without duplicating shared patterns or
creating one component per route.
