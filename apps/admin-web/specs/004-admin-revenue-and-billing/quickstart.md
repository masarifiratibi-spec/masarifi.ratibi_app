# Quickstart: Spec 004 Planning and Verification

## Scope

Implement only Phase 3 inside `apps/admin-web`. Reuse the existing Admin shell,
design tokens, route/state patterns, typed API client, repositories, query
provider, permission boundary, MSW setup, and test utilities. Do not initialize
a project, install dependencies, connect Stripe/Supabase/NestJS, or persist
billing data.

## Prerequisites

- Existing Admin Web dependencies are installed.
- Specs 001-003 and the shared Admin shell remain intact.
- Phase 3 implementation tasks have been generated and completed before using
  this guide as a completion check.

## Planning artifacts

- `spec.md`: requirements and acceptance criteria
- `plan.md`: implementation design and constitution gate
- `research.md`: resolved technical decisions
- `data-model.md`: contract entities, validation, and state transitions
- `contracts/admin-revenue-billing.openapi.yaml`: proposed replaceable API
- `tasks.md`: generated later by `/speckit.tasks`

## Implementation sequence

1. Add and test Zod billing contracts.
2. Add fictional masked fixtures, runtime mock state, and MSW handlers.
3. Add the typed repository and TanStack Query hooks.
4. Activate planned billing navigation and permissions.
5. Deliver overview/list routes, then detail routes, then confirmed operations.
6. Add unit/component and Playwright coverage.
7. Run every automated and manual verification below and update `tasks.md`
   only with results actually observed.

## Automated verification

Run from `apps/admin-web`:

```powershell
npm run dev
```

Use the local URL printed by Next.js for manual route checks. In a separate
terminal, run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected outcomes: each command exits successfully; Vitest covers contract and
component behavior; Playwright completes the Phase 3 journeys; and the
production build completes without type, route, or bundling errors.

## Required manual verification

- Open all eight Phase 3 routes in default, loading, empty, error, forbidden,
  not-found, conflict, and relevant mutation scenarios.
- Verify All, iOS, Android, and Multi-platform views. Confirm authoritative
  unique totals are not calculated by adding iOS and Android values.
- Confirm AED and SAR remain separately labeled.
- Inspect payment-event detail and verify only the sanitized allowlist appears.
- Verify masked customer data and absence of billing/provider data in browser
  storage, URLs, logs, screenshots, errors, and environment values.
- Verify confirmations identify scope, consequence, mock-only behavior, and
  planned audit event; pending actions reject duplicates.
- Verify 1440px, 1280px, 1024px, 768px, and 390px in Arabic RTL, plus English
  LTR readiness.
- Verify keyboard operation, visible focus, focus restoration, semantic
  tables/forms/dialogs, accessible status announcements, chart summaries, touch
  targets, and reduced motion.

Expected outcome: every acceptance criterion in `spec.md` has observable
evidence, with zero blocking design-preservation, privacy, security,
accessibility, platform-counting, contract-validation, or responsive defects.

Do not report a command or manual check as passing unless it was actually run
and completed successfully.

## Final verification record - 2026-07-28

All eight Phase 3 routes are now implemented:
- `/admin/subscriptions` - Subscription overview with platform filters and currency-separated metrics
- `/admin/subscriptions/[subscriptionId]` - Subscription detail with safe customer data and mock actions
- `/admin/subscriptions/plans` - Plan management with simulated edits
- `/admin/subscriptions/promotional-codes` - Promotional code management with simulated CRUD
- `/admin/payments` - Payments overview with currency-separated payment metrics
- `/admin/payments/events/[eventId]` - Payment event detail with sanitized payload preview
- `/admin/payments/failed` - Failed payment triage with mock resolution actions
- `/admin/payments/reconciliation` - Reconciliation issue management with simulated decisions

Implementation structure adjustment:
- The original task list named separate view files such as `SubscriptionsList.tsx`,
  `PlanManagementView.tsx`, and `FailedPaymentsView.tsx`.
- The selected implementation keeps the Phase 3 UI in
  `src/features/billing/BillingViews.tsx` with named exports, plus the existing
  `BillingOverview.tsx`.
- This avoids empty wrapper modules and keeps the current app easier to review.
  Future work can split the file when the billing views grow or need independent
  ownership.

Commands actually run from `apps/admin-web`:

- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run test` - passed, 34 test files / 269 tests
- `npm run test:e2e` - passed, 83 passed / 122 skipped across configured projects
- `npm run build` - passed; Next.js built all current Admin routes, including the
  eight Phase 3 routes

Additional focused checks actually run:
- `npx playwright test --grep "all eight billing routes"` - passed, 5 viewport
  projects
- `npx playwright test --project=desktop-1440 --grep "subscription health stays free"` -
  passed
- Billing-scope hardening scan for `any`, direct fixture imports in app routes,
  raw colors, unsafe HTML, debug logging, and forbidden generated UI symbols -
  no matches
- Full `src` browser-storage/public-secret scan found only pre-existing,
  reviewed development/test utilities: test setup storage clearing, simulated
  role/scenario session storage, and the billing mock-state warning comment.

Review notes:
- Phase 3 remains frontend-only: no NestJS, Supabase, Stripe, database,
  provider, email, notification, or real-auth integration was added.
- Payment event detail renders the sanitized allowlist only; forbidden raw
  provider fields are tested at contract, repository, component, and E2E levels.
- The all-route billing smoke now runs at 1440px, 1280px, 1024px, 768px, and
  390px. Detailed billing journeys remain scoped to the reference desktop by
  existing Playwright project filters.

## Completion Re-audit — 2026-07-29

- Reviewed `spec.md`, `plan.md`, `tasks.md`, this quickstart, relevant
  constitution rules, all eight routes, contracts, repository/hook boundaries,
  deterministic fixtures, handlers, and tests.
- All 98 tasks remain supported by implementation and verification evidence;
  there are no unchecked tasks.
- No runtime, route-permission, raw-provider-payload, privacy, accessibility,
  RTL/LTR, responsive, or approved-design regression was found.
- Fresh shared-suite evidence: typecheck and lint passed; Vitest passed
  34 files / 278 tests; Playwright passed 111 tests with 149 intentional
  project skips and no failures across all five approved viewports; production
  build passed with 14 static pages.

## Risk-review correction — 2026-07-29

The later all-spec risk review found two trust-boundary defects that the
completion re-audit missed: billing MSW endpoints did not enforce their route
permissions for direct requests, and malformed direct queries/actions could
surface an internal validation failure. All billing endpoints now enforce the
existing least-privilege permission map and return safe 400/403 responses.
Regression tests cover both cases. Fresh post-fix verification passed:
typecheck, lint, Vitest (45 files / 497 tests), Playwright (171 passed /
199 intentional skips across all five configured viewports), and production
build (34 static pages). See `risk-review-report.md`.
