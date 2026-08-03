# Implementation Plan: Subscriptions, Plans, Payments, and Revenue

**Phase / Spec**: Phase 3 / Spec 004 of 010  
**Date**: 2026-07-28  
**Spec**: [`spec.md`](./spec.md)  
**Input**: Admin Web feature specification

## Summary

Extend the existing Admin Web shell with eight billing routes for subscription
health, subscription operations, plan and promotion maintenance, payment-event
review, failed-payment triage, and reconciliation. Use one feature boundary,
typed Zod-validated repository contracts, TanStack Query hooks, and MSW runtime
state. Preserve the approved RTL design and expose only fictional, masked, and
allowlisted billing data. No provider, backend, database, authentication, or
browser-storage integration is included.

## Technical Context

**Language**: TypeScript 5.x in strict mode; no `any`  
**Framework**: Existing Next.js App Router and React application  
**UI and data stack**: Existing Tailwind CSS, TanStack Query, TanStack Table,
React Hook Form, Zod, Recharts, and Lucide Icons  
**Mock boundary**: Existing API client and repository pattern backed by Mock
Service Worker; responses and mutations validated at the boundary  
**Testing**: Existing Vitest and Playwright setup  
**Storage**: MSW runtime memory only; state resets on reload, server restart, or
scenario reset and never enters local/session storage  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend implementation or
new dependency  
**Performance and scale**: Paginated and bounded subscription/payment lists;
the primary overview must let a Billing Operator identify subscription health
and the largest failed-renewal segment within 90 seconds; all five approved
viewports must complete the primary journeys without blocking overflow  
**Constraints**: AED and SAR remain separate unless a backend-supplied normalized
aggregate is explicitly labeled; platform totals are authoritative contract
values and are never derived by adding iOS and Android values

## Constitution Check

*GATE: Re-evaluate before implementation and after implementation.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 3 and the planned subscriptions, payments, reconciliation, roles, permissions, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, or real authentication is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, and all approved viewports are covered.
- [x] Relevant loading, empty, error, success, warning, and permission states are covered.
- [x] Sensitive financial data is masked or aggregated; sensitive actions require confirmation.
- [x] External, mocked, user-entered, URL, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, links, client storage, environment exposure, errors, and logs are constrained to safe allowlisted values.
- [x] Mock permissions remain development-only UX controls; future backend authorization is documented.
- [x] Dependencies remain unchanged.
- [x] Security-sensitive behavior has planned Vitest and Playwright coverage.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

**Initial gate result**: PASS. No constitution deviation requires approval.

## Project Structure

### Feature documentation

```text
specs/004-admin-revenue-and-billing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-revenue-billing.openapi.yaml
└── tasks.md                       # created by /speckit.tasks
```

### Existing Admin Web source

```text
src/
├── app/admin/
│   ├── subscriptions/
│   │   ├── page.tsx
│   │   ├── [subscriptionId]/page.tsx
│   │   ├── plans/page.tsx
│   │   └── promotional-codes/page.tsx
│   └── payments/
│       ├── page.tsx
│       ├── events/[eventId]/page.tsx
│       ├── failed/page.tsx
│       └── reconciliation/page.tsx
├── features/billing/
│   ├── contracts.ts
│   ├── repository.ts
│   ├── hooks.ts
│   ├── BillingOverview.tsx
│   ├── SubscriptionsList.tsx
│   ├── SubscriptionDetailView.tsx
│   ├── PlanManagementView.tsx
│   ├── PromotionalCodesView.tsx
│   ├── PaymentsOverview.tsx
│   ├── PaymentEventDetailView.tsx
│   ├── FailedPaymentsView.tsx
│   └── ReconciliationView.tsx
├── mocks/
│   ├── fixtures/billing.ts
│   ├── handlers/billing.ts
│   └── phase3-billing-state.ts
└── core/permissions/
    ├── permissions.ts
    └── role-map.ts

tests/e2e/
└── billing.spec.ts
```

Tests should live beside the smallest unit they verify; the list above omits
test filenames except the Phase 3 browser journey to keep the structure focused.

**Structure decision**: Use one `features/billing` boundary because subscriptions,
plans, promotions, payments, failures, and reconciliation share the same
financial contracts, permission surface, and mock state. Route files remain
thin. Reuse the existing Admin shell, state components, permission boundary,
API client, query provider, tables, cards, charts, dialogs, tokens, and test
utilities. Extend existing navigation fixtures and permission maps instead of
creating parallel configuration. Add no package and no speculative shared
abstraction.

## Implementation Design

### Contract and repository boundary

1. Define explicit query, entity, page, mutation, result, and safe-error schemas
   in `features/billing/contracts.ts`.
2. Parse route IDs, search parameters, filters, sorting, pagination, dates,
   currencies, amounts, codes, limits, action reasons, and all mock responses.
3. Keep endpoint calls in `features/billing/repository.ts`; presentation code
   uses typed query/mutation hooks only.
4. Treat aggregate, platform, currency, and uniqueness values returned by the
   repository as authoritative. Never recompute cross-platform unique counts or
   combine currencies in components.

### Mock HTTP behavior

1. Add the Phase 3 handlers to the existing MSW handler registry.
2. Seed fictional masked fixtures, including multi-platform overlap and separate
   AED/SAR aggregates.
3. Keep mutable mock records in module memory only.
4. Allow only the clarified subscription, failed-payment, plan, promotion, and
   reconciliation actions. Reject invalid, duplicate, forbidden, stale, and
   rate-limited submissions with safe errors.
5. Return only the documented sanitized payment-payload allowlist.

### UI delivery order

1. Activate the already planned subscriptions and payments navigation entries.
2. Build the subscription overview/list and payment overview/event list using
   existing page, filter, table, chart, and state patterns.
3. Add subscription and payment-event details.
4. Add plan and promotional-code forms.
5. Add failed-payment and reconciliation operation views.
6. Add permission, confirmation, pending lock, conflict recovery, accessible
   announcements, RTL/LTR, responsive, and reduced-motion behavior across all
   routes.

### Verification strategy

- Vitest: schema acceptance/rejection, repository parsing, currency separation,
  unique platform totals, allowlisted payload preview, masking, permission
  behavior, stale-state conflicts, and duplicate-mutation lock.
- Playwright: subscription overview/filter/detail/action, plan/promotion
  validation, payment-event safe detail, failed-payment triage, reconciliation,
  forbidden routes, keyboard dialogs/focus recovery, RTL, and representative
  responsive checks.
- Manual: all eight routes across the required state scenarios, all platform
  filters, five approved widths, Arabic RTL, English LTR readiness, screen-reader
  naming, visible focus, chart summaries, touch targets, and reduced motion.

## Backend Alignment

**Planned modules**: `subscriptions`, `payments`, `reconciliation`, `users`,
`profiles`, `devices` (attribution only), `roles`, `permissions`, `audit-logs`  
**Planned entities**: `subscription_plans`, `subscriptions`,
`subscription_plan_changes`, `promotional_codes`, `promotion_redemptions`,
`payment_events`, `payment_failures`, `billing_reconciliation_items`,
`profiles`, `devices`, `audit_logs`, and role/permission mappings  
**Proposed contracts**: Typed frontend models and the mock HTTP operations in
[`contracts/admin-revenue-billing.openapi.yaml`](./contracts/admin-revenue-billing.openapi.yaml)  
**Deferred production security**: NestJS authorization and validation,
Supabase Auth/RLS and persistence, Stripe/webhook truth and idempotency, PCI
controls, immutable audit storage, encryption, provider rate limiting,
monitoring, reconciliation jobs, and incident response

## Post-Design Constitution Check

**Result**: PASS. The research, data model, contract, and validation guide keep
all data behind typed replaceable boundaries, preserve the approved stack and
design, add no dependency or persistence, and explicitly cover privacy,
permissions, confirmation, accessibility, RTL/LTR, responsive behavior, and
required verification. No deviation or unresolved clarification remains.

## Complexity Tracking

No constitution deviation. One cohesive feature folder and the existing
framework patterns are sufficient.
