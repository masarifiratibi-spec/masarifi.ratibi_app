# Tasks: Subscriptions, Plans, Payments, and Revenue

**Input**: `specs/004-admin-revenue-and-billing/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Vitest and Playwright are required for changed behavior  
**Execution rule**: Complete tasks in ID order unless a task is marked `[P]`.
Do not mark a verification task complete unless its stated command or manual
procedure actually succeeds.

Every implementation task must preserve the approved Admin Dashboard, Arabic
RTL default, English LTR readiness, semantic tokens, privacy masking, typed
boundaries, and frontend-only scope.

## Phase 1: Existing Project and Contract Review

**Purpose**: Confirm the existing baseline and prevent duplicate infrastructure
or accidental work outside Phase 3.

- [X] T001 Inspect `src/app/admin`, `src/components/admin`, `src/features`, `src/core`, `src/mocks`, and `tests/e2e`, then update only inaccurate reuse paths in `specs/004-admin-revenue-and-billing/plan.md`; verify every planned reused file exists with `rg --files src tests`
- [X] T002 Compare all 16 operations in `specs/004-admin-revenue-and-billing/contracts/admin-revenue-billing.openapi.yaml` with the routes, request types, response types, permissions, and clarified action allowlists in `specs/004-admin-revenue-and-billing/spec.md`; correct contract mismatches only and verify all 15 documented path groups remain present with `rg -n "^  /" specs/004-admin-revenue-and-billing/contracts/admin-revenue-billing.openapi.yaml`
- [X] T003 Confirm `package.json` already contains Next.js, React, TypeScript, Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts, Lucide, MSW, Vitest, and Playwright; record any actual mismatch in `specs/004-admin-revenue-and-billing/plan.md` and verify no dependency or initialization command was added with `git diff -- package.json`
- [X] T004 Confirm the exact verification commands and five Playwright viewport projects in `package.json`, `playwright.config.ts`, and `specs/004-admin-revenue-and-billing/quickstart.md`; correct documentation only and verify the quickstart names `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build`

---

## Phase 2: Frontend Foundations

**Purpose**: Add the shared Phase 3 contract, permission, navigation, and mock
boundaries that block all user stories.

- [X] T005 [P] Add failing Vitest cases for safe billing IDs, `AED`/`SAR` money, platform filters, masked customers, safe errors, bounded pagination, date ranges, sort keys, and rejection of unknown fields in `src/features/billing/contracts.test.ts`; verify the new cases are discovered with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T006 Implement the shared strict Zod schemas and inferred TypeScript types required by T005 in `src/features/billing/contracts.ts`; reuse applicable schemas from `src/features/shared/admin-schemas.ts` and verify T005 passes with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T007 Add fictional masked base records, overlapping multi-platform attribution, separate AED/SAR money values, and no prohibited payment/customer/provider fields in `src/mocks/fixtures/billing.ts`; after T006, verify fixture values satisfy `src/features/billing/contracts.ts` in a focused test in `src/features/billing/contracts.test.ts`
- [X] T008 [P] Add failing tests for runtime-only reset semantics, immutable source fixtures, expected-state conflicts, and duplicate operation rejection in `src/mocks/phase3-billing-state.test.ts`; verify the test file is discovered with `npm run test -- src/mocks/phase3-billing-state.test.ts`
- [X] T009 Implement the smallest module-memory billing state and reset helper required by T008 in `src/mocks/phase3-billing-state.ts`; do not use `window`, `localStorage`, `sessionStorage`, IndexedDB, files, or databases, and verify with `npm run test -- src/mocks/phase3-billing-state.test.ts`
- [X] T010 [P] Extend permission-map tests for all 12 Spec 004 permission keys and the Super Admin, Billing Operator, Support Agent, Security Administrator, Import Operator, AI Operator, and Content Manager matrices in `src/core/permissions/role-map.test.ts`; verify the new assertions fail before T011 with `npm run test -- src/core/permissions/role-map.test.ts`
- [X] T011 Add the 12 billing permission keys to `src/core/permissions/permissions.ts` and assign the exact Spec 004 role capabilities in `src/core/permissions/role-map.ts`; verify T010 passes with `npm run test -- src/core/permissions/role-map.test.ts`
- [X] T012 [P] Add failing route-permission tests for all eight billing routes, including detail-route precedence, in `src/components/admin/AdminShell.test.tsx`; verify the new assertions are discovered with `npm run test -- src/components/admin/AdminShell.test.tsx`
- [X] T013 Map `/admin/subscriptions`, its detail/plans/promotional-code routes, `/admin/payments`, and its event/failed/reconciliation routes to their least-privileged read permissions in `src/components/admin/shell-state.ts`; verify T012 passes with `npm run test -- src/components/admin/AdminShell.test.tsx`
- [X] T014 Add failing navigation tests proving subscriptions and payments are active only for roles with their read permissions while later-phase entries remain planned in `src/components/admin/AdminShell.test.tsx`; after T013, verify with `npm run test -- src/components/admin/AdminShell.test.tsx`
- [X] T015 Activate only the subscriptions and payments navigation fixtures with `/admin/subscriptions`, `/admin/payments`, `subscriptions.read`, and `payments.read` in `src/mocks/fixtures/foundation.ts`; leave every later-phase entry unchanged and verify T014 passes with `npm run test -- src/components/admin/AdminShell.test.tsx`
- [X] T016 Run `npm run test -- src/features/billing/contracts.test.ts src/mocks/phase3-billing-state.test.ts src/core/permissions/role-map.test.ts src/components/admin/AdminShell.test.tsx` and fix only Phase 3 foundation failures in the files changed by T005-T015

**Codex review note (2026-07-28)**: The first delegated GLM/OpenCode pass was
stopped after invalid TypeScript and unsafe placeholder contracts. The later
GLM 5.2 pass contributed the billing routes, repository/hook coverage, and E2E
journeys but stalled before final verification. Codex repaired the remaining
E2E race/unsafe-copy issues, removed the temporary delegation brief, and verified
the final state locally.

**Implementation structure adjustment (2026-07-28)**: T033, T040, T041, T047,
T054, T055, T061, T069-T071, T078, and T085 originally named separate component
and test files. The completed implementation uses named exports in
`src/features/billing/BillingViews.tsx` plus coverage in
`src/features/billing/BillingViews.test.tsx` to avoid empty wrapper files and
duplicated test scaffolding. Thin route files still import only feature-level
views and do not import fixtures.

**Final verification actually executed**: `npm run typecheck` passed,
`npm run lint` passed, `npm run test` passed (34 files / 269 tests),
`npm run test:e2e` passed (83 passed / 122 skipped across configured projects),
and `npm run build` passed.

**Gate**: Do not start a user story until T016 passes. No page or presentation
component may import `src/mocks/fixtures/billing.ts`; mock permissions remain
development-only UX controls.

---

## Phase 3: User Story 1 — Monitor Revenue and Subscription Health (P1)

**Goal**: Show authoritative subscription health and currency-safe,
platform-aware revenue on `/admin/subscriptions`.

**Independent test**: A Billing Operator opens `/admin/subscriptions`, identifies
subscription health and the largest failed-renewal segment, switches among All,
iOS, Android, and Multi-platform, and observes that unique/revenue totals are
contract values rather than iOS-plus-Android arithmetic.

### Tests

- [X] T017 [P] [US1] Add failing contract tests for the 30-day default, 7/90-day options, overview KPIs, freshness, plan distribution, trends, cancellation reasons, partial regions, authoritative platform totals, and separate AED/SAR groups in `src/features/billing/contracts.test.ts`; verify with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T018 [P] [US1] Add failing repository and hook tests for validated overview queries/responses, role/scenario parameters, safe provider errors, and stable query keys in `src/features/billing/repository.test.ts` and `src/features/billing/hooks.test.ts`; verify with `npm run test -- src/features/billing/repository.test.ts src/features/billing/hooks.test.ts`
- [X] T019 [P] [US1] Add failing component tests for KPI/freshness rendering, accessible chart summaries, platform changes, mixed-currency warning, partial data, loading, empty, error, and forbidden states in `src/features/billing/BillingOverview.test.tsx`; verify with `npm run test -- src/features/billing/BillingOverview.test.tsx`
- [X] T020 [US1] Add a failing Playwright journey for Billing Operator access, overview comprehension, All/iOS/Android/Multi-platform filters, non-additive totals, separate currencies, keyboard operation, and safe partial-provider recovery in `tests/e2e/billing.spec.ts`; verify the scenario is discovered with `npm run test:e2e -- --project=desktop-1440 --grep "subscription health"`

### Implementation

- [X] T021 [US1] Add `SubscriptionOverviewQuery`, `SubscriptionOverview`, KPI, chart-series, region, currency-group, and authoritative platform-breakdown schemas/types in `src/features/billing/contracts.ts`; verify T017 with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T022 [US1] Add default, empty, partial, provider-unavailable, multi-platform-overlap, and mixed-AED/SAR overview fixtures in `src/mocks/fixtures/billing.ts`; verify every response parses in `src/features/billing/contracts.test.ts`
- [X] T023 [US1] Implement `GET /api/v1/admin/billing/subscriptions/overview` with validated query parameters, `subscriptions.read`, 30-day default, scenario handling, and safe errors in `src/mocks/handlers/billing.ts`; verify through `src/features/billing/repository.test.ts`
- [X] T024 [US1] Register `billingHandlers` once in `src/mocks/handlers/index.ts`; verify the overview request is intercepted in `src/features/billing/repository.test.ts`
- [X] T025 [US1] Add the validated `getSubscriptionOverview` method and query-string allowlist in `src/features/billing/repository.ts`; verify no fixture import exists and T018 repository cases pass with `npm run test -- src/features/billing/repository.test.ts`
- [X] T026 [US1] Add overview query keys and `useSubscriptionOverview` using the existing TanStack Query patterns in `src/features/billing/hooks.ts`; keep safe previous data during filter changes and verify with `npm run test -- src/features/billing/hooks.test.ts`
- [X] T027 [US1] Implement `BillingOverview` with existing `MetricCard`, chart, filter, warning, and `RegionState` patterns in `src/features/billing/BillingOverview.tsx`; show Arabic labels, explicit currencies, freshness, text alternatives, and no client-derived cross-platform totals, then verify with `npm run test -- src/features/billing/BillingOverview.test.tsx`
- [X] T028 [US1] Create the thin client route that composes `BillingOverview` without importing fixtures in `src/app/admin/subscriptions/page.tsx`; verify route rendering through T019 and `src/tests/no-direct-fixtures.test.ts`
- [X] T029 [US1] Run `npm run test -- src/features/billing/contracts.test.ts src/features/billing/repository.test.ts src/features/billing/hooks.test.ts src/features/billing/BillingOverview.test.tsx src/tests/no-direct-fixtures.test.ts` and fix only User Story 1 failures
- [X] T030 [US1] Run `npm run test:e2e -- --project=desktop-1440 --grep "subscription health"` and fix only the User Story 1 journey until it passes

**Checkpoint**: User Story 1 is a usable MVP and must remain independently
testable before subscription operations are added.

---

## Phase 4: User Story 2 — Review and Manage Subscriptions (P1)

**Goal**: Search and inspect masked subscriptions and perform only the five
clarified simulated actions through validated confirmations.

**Independent test**: An authorized operator filters a paginated subscription
list, opens a masked detail, completes an eligible mock action, and receives a
safe conflict for stale or incompatible state.

### Tests

- [X] T031 [P] [US2] Add failing contract tests for subscription search/filters/sort/pagination, list/detail response invariants, safe provider references, action eligibility, the five allowed actions, conditional target-plan/note/timing fields, expected state, and confirmation token in `src/features/billing/contracts.test.ts`; verify with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T032 [P] [US2] Add failing repository and hook tests for list/detail queries, invalid route IDs, permission forwarding, action validation, cache invalidation, stale conflicts, and duplicate mutation locking in `src/features/billing/repository.test.ts` and `src/features/billing/hooks.test.ts`; verify with `npm run test -- src/features/billing/repository.test.ts src/features/billing/hooks.test.ts`
- [X] T033 [P] [US2] Add failing UI tests for filter reset, sorting, pagination, masked rows, mobile cards, detail sections, action visibility, field errors, confirmation scope/consequence/mock-only/audit text, pending lock, focus restoration, success, forbidden, and conflict states in `src/features/billing/SubscriptionsList.test.tsx` and `src/features/billing/SubscriptionDetailView.test.tsx`; verify both with `npm run test -- src/features/billing/SubscriptionsList.test.tsx src/features/billing/SubscriptionDetailView.test.tsx`
- [X] T034 [US2] Add failing Playwright journeys for list search/filter/sort/pagination, masked detail, plan change, cancel-at-period-end, cancellation clearing, eligible resume, internal note, forbidden role, duplicate submit, and stale conflict in `tests/e2e/billing.spec.ts`; verify discovery with `npm run test:e2e -- --project=desktop-1440 --grep "subscription operations"`

### Implementation

- [X] T035 [US2] Add strict `SubscriptionsQuery`, `SubscriptionsPage`, `SubscriptionListItem`, `SubscriptionDetail`, `SubscriptionActionRequest`, and `BillingActionResult` schemas/types in `src/features/billing/contracts.ts`; include bounded inputs and reject prohibited/generic action names, then verify T031
- [X] T036 [US2] Add masked list/detail/history fixtures and eligible, incompatible, stale, forbidden, empty, large-page, slow, not-found, invalid, conflict, rate-limited, and provider-unavailable scenarios in `src/mocks/fixtures/billing.ts` and `src/mocks/phase3-billing-state.ts`; verify state transitions with `npm run test -- src/mocks/phase3-billing-state.test.ts`
- [X] T037 [US2] Implement subscription list/detail GET handlers and the validated action POST handler in `src/mocks/handlers/billing.ts`; require `subscriptions.read`, `subscriptions.detail.read`, or `subscriptions.manage` as appropriate, return safe errors, update runtime state only after expected-state validation, and verify through T032
- [X] T038 [US2] Add list, detail, and action methods to `src/features/billing/repository.ts`; parse every request/response with T035 schemas and verify `npm run test -- src/features/billing/repository.test.ts`
- [X] T039 [US2] Add list/detail query keys, `useSubscriptions`, `useSubscription`, and a `useLockedMutation`-based subscription action with precise invalidation in `src/features/billing/hooks.ts`; verify `npm run test -- src/features/billing/hooks.test.ts`
- [X] T040 [US2] Implement `SubscriptionsList` in `src/features/billing/SubscriptionsList.tsx` using existing table/mobile-card/filter/pagination/state patterns; reset page selection on filter changes, label masked values, and verify `npm run test -- src/features/billing/SubscriptionsList.test.tsx`
- [X] T041 [US2] Implement `SubscriptionDetailView` and its five allowlisted confirmed operations in `src/features/billing/SubscriptionDetailView.tsx`; render identifiers/reasons as text, show planned audit reference, lock pending actions, and restore focus, then verify `npm run test -- src/features/billing/SubscriptionDetailView.test.tsx`
- [X] T042 [US2] Add `SubscriptionsList` below the existing overview without changing its approved styling in `src/app/admin/subscriptions/page.tsx`; verify no fixture import with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T043 [US2] Create the thin validated detail route using `SubscriptionDetailView` in `src/app/admin/subscriptions/[subscriptionId]/page.tsx`; invalid or unknown IDs must resolve to a safe state and verify through T033
- [X] T044 [US2] Run `npm run test -- src/features/billing/contracts.test.ts src/features/billing/repository.test.ts src/features/billing/hooks.test.ts src/features/billing/SubscriptionsList.test.tsx src/features/billing/SubscriptionDetailView.test.tsx src/mocks/phase3-billing-state.test.ts src/tests/no-direct-fixtures.test.ts` and `npm run test:e2e -- --project=desktop-1440 --grep "subscription operations"`; fix only User Story 2 failures

**Checkpoint**: User Story 2 works with masked data and mock-only actions; no
charge, refund, invoice, email, notification, or provider mutation exists.

---

## Phase 5: User Story 3 — Maintain Plans and Promotional Codes (P1)

**Goal**: Review and safely simulate plan and promotional-code changes with
validated before/after confirmation.

**Independent test**: A Billing Operator views Free, Basic, and Premium,
receives field-level errors for invalid changes, and completes valid mock
plan/promotion operations with a planned audit reference and no provider call.

### Tests

- [X] T045 [P] [US3] Add failing contract tests for plan prices/currencies/intervals/limits/active state/provider labels and promotion code/discount/duration/redemption/expiration/status/eligible-plan invariants in `src/features/billing/contracts.test.ts`; verify with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T046 [P] [US3] Add failing repository and hook tests for plan/promotion reads, creates/updates, schema rejection, permission forwarding, expected-state conflicts, pending locks, and cache invalidation in `src/features/billing/repository.test.ts` and `src/features/billing/hooks.test.ts`; verify both test files
- [X] T047 [P] [US3] Add failing form/component tests for Free/Basic/Premium display, React Hook Form plus Zod field errors, before/after review, mock-only warning, confirmation, forbidden/conflict/error/success states, pending lock, and focus restoration in `src/features/billing/PlanManagementView.test.tsx` and `src/features/billing/PromotionalCodesView.test.tsx`; verify both with `npm run test -- src/features/billing/PlanManagementView.test.tsx src/features/billing/PromotionalCodesView.test.tsx`
- [X] T048 [US3] Add failing Playwright journeys for invalid/valid plan edits and promotional-code create/edit/deactivate/expire flows in `tests/e2e/billing.spec.ts`; verify discovery with `npm run test:e2e -- --project=desktop-1440 --grep "plans and promotions"`

### Implementation

- [X] T049 [US3] Add strict `PlanDetail`, plan mutation, `PromotionalCodeDetail`, promotion query/page, and promotion mutation schemas/types in `src/features/billing/contracts.ts`; encode conditional percentage/fixed-discount, duration, expiration, active-plan, and confirmation rules, then verify T045
- [X] T050 [US3] Add Free/Basic/Premium and promotional-code fixtures plus empty, invalid, duplicate, expired, exhausted, inactive-plan, stale, forbidden, conflict, rate-limit, and safe-error runtime scenarios in `src/mocks/fixtures/billing.ts` and `src/mocks/phase3-billing-state.ts`; verify with `npm run test -- src/mocks/phase3-billing-state.test.ts`
- [X] T051 [US3] Implement plan GET/update and promotional-code GET/create/update handlers in `src/mocks/handlers/billing.ts`; enforce `plans.read/manage` and `promotions.read/manage`, validated expected state, runtime-only changes, and safe errors, then verify through T046
- [X] T052 [US3] Add typed plan and promotional-code methods to `src/features/billing/repository.ts`; validate all inputs and outputs and verify `npm run test -- src/features/billing/repository.test.ts`
- [X] T053 [US3] Add plan/promotion query keys, query hooks, and `useLockedMutation` mutations with exact cache invalidation in `src/features/billing/hooks.ts`; verify `npm run test -- src/features/billing/hooks.test.ts`
- [X] T054 [US3] Implement `PlanManagementView` with existing form, table/card, dialog, warning, permission, and state components in `src/features/billing/PlanManagementView.tsx`; show explicit currency and safe non-navigating provider labels, then verify T047
- [X] T055 [US3] Implement `PromotionalCodesView` with validated create/edit/deactivate/expire forms and accessible confirmation/outcome behavior in `src/features/billing/PromotionalCodesView.tsx`; verify T047
- [X] T056 [US3] Create the thin plan route in `src/app/admin/subscriptions/plans/page.tsx`; verify it imports only the feature component and no fixture with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T057 [US3] Create the thin promotional-code route in `src/app/admin/subscriptions/promotional-codes/page.tsx`; verify it imports only the feature component and no fixture with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T058 [US3] Run `npm run test -- src/features/billing/contracts.test.ts src/features/billing/repository.test.ts src/features/billing/hooks.test.ts src/features/billing/PlanManagementView.test.tsx src/features/billing/PromotionalCodesView.test.tsx src/mocks/phase3-billing-state.test.ts src/tests/no-direct-fixtures.test.ts` and `npm run test:e2e -- --project=desktop-1440 --grep "plans and promotions"`; fix only User Story 3 failures

**Checkpoint**: User Story 3 changes only mock runtime state and never calls
Stripe, billing providers, databases, email, or notification services.

---

## Phase 6: User Story 4 — Triage Payment Events and Failures (P1)

**Goal**: Review payment health and allowlisted event details, then record only
the four clarified failed-payment outcomes.

**Independent test**: A Billing Operator filters payment events, opens a detail
containing only the sanitized allowlist, and completes a confirmed failed-payment
mock action without exposing or invoking real payment capabilities.

### Tests

- [X] T059 [P] [US4] Add failing contract tests for payments overview, event list/query/detail, the exact sanitized payload allowlist with unknown-field rejection, failed-payment records, the four allowed actions, and safe outcome/error envelopes in `src/features/billing/contracts.test.ts`; verify with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T060 [P] [US4] Add failing repository and hook tests for payment overview/event list/detail/failed-list reads, invalid identifiers/filters, action permission, duplicate lock, stale conflict, and precise cache invalidation in `src/features/billing/repository.test.ts` and `src/features/billing/hooks.test.ts`; verify both files
- [X] T061 [P] [US4] Add failing UI tests for currency-separated payment KPIs, event filters/table/mobile cards, sanitized detail/timeline/retries, forbidden fields, failed-payment states, confirmation content, pending lock, focus restoration, and accessible announcements in `src/features/billing/PaymentsOverview.test.tsx`, `src/features/billing/PaymentEventDetailView.test.tsx`, and `src/features/billing/FailedPaymentsView.test.tsx`; verify all three files
- [X] T062 [US4] Add failing Playwright journeys for payments overview, event filters, sanitized unsafe-text detail, failed-payment actions, duplicate submit, forbidden role, stale conflict, and absence of card/token/signature/raw-payload data in `tests/e2e/billing.spec.ts`; verify discovery with `npm run test:e2e -- --project=desktop-1440 --grep "payment triage"`

### Implementation

- [X] T063 [US4] Add strict `PaymentsOverview`, payment-event query/page/list/detail, `SanitizedPaymentPayloadPreview`, failed-payment query/page/item/action, and related timeline/retry schemas/types in `src/features/billing/contracts.ts`; reject every preview field outside the clarified allowlist and verify T059
- [X] T064 [US4] Add currency-separated payment metrics, masked events, unsafe-text-as-plain-text preview, failures, retry histories, and empty/large/slow/partial/forbidden/not-found/invalid/conflict/rate-limit/provider-unavailable fixtures in `src/mocks/fixtures/billing.ts` and runtime transitions in `src/mocks/phase3-billing-state.ts`; verify all fixtures parse and state tests pass
- [X] T065 [US4] Implement payment overview, payment-event list, and payment-event detail GET handlers with validated filters, `payments.read`/`payments.detail.read`, sanitized responses, and safe errors in `src/mocks/handlers/billing.ts`; verify through T060
- [X] T066 [US4] Implement failed-payment list GET and action POST handlers with `payment_failures.manage`, the four-action allowlist, expected-state conflict, runtime-only update, and no retry/charge/refund/email/push/provider behavior in `src/mocks/handlers/billing.ts`; verify through T060 and state tests
- [X] T067 [US4] Add typed payments overview, event list/detail, failed-payment list, and failed-payment action methods to `src/features/billing/repository.ts`; parse every boundary and verify `npm run test -- src/features/billing/repository.test.ts`
- [X] T068 [US4] Add payment/failure query keys and hooks plus a locked failed-payment mutation with exact invalidation in `src/features/billing/hooks.ts`; verify `npm run test -- src/features/billing/hooks.test.ts`
- [X] T069 [US4] Implement `PaymentsOverview` with currency-safe metrics, platform/date filters, event list, reconciliation/failure summaries, accessible chart summaries, and all relevant region states in `src/features/billing/PaymentsOverview.tsx`; verify T061
- [X] T070 [US4] Implement `PaymentEventDetailView` with timeline, safe subscription link/reference, retry history, and plain-text allowlisted payload preview in `src/features/billing/PaymentEventDetailView.tsx`; do not render raw JSON/HTML/Markdown or provider links and verify T061
- [X] T071 [US4] Implement `FailedPaymentsView` with masked records and the four confirmed mock actions in `src/features/billing/FailedPaymentsView.tsx`; include reason/scope, mock-only consequence, permission, audit expectation, pending lock, and safe outcomes, then verify T061
- [X] T072 [US4] Create the thin payments overview/event-list route in `src/app/admin/payments/page.tsx`; verify no fixture import with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T073 [US4] Create the thin validated payment-event detail route in `src/app/admin/payments/events/[eventId]/page.tsx`; invalid or unknown IDs must show a safe state and verify through T061
- [X] T074 [US4] Create the thin failed-payment route in `src/app/admin/payments/failed/page.tsx`; verify no fixture import with `npm run test -- src/tests/no-direct-fixtures.test.ts`
- [X] T075 [US4] Run `npm run test -- src/features/billing/contracts.test.ts src/features/billing/repository.test.ts src/features/billing/hooks.test.ts src/features/billing/PaymentsOverview.test.tsx src/features/billing/PaymentEventDetailView.test.tsx src/features/billing/FailedPaymentsView.test.tsx src/mocks/phase3-billing-state.test.ts src/tests/no-direct-fixtures.test.ts` and `npm run test:e2e -- --project=desktop-1440 --grep "payment triage"`; fix only User Story 4 failures

**Checkpoint**: User Story 4 displays only fictional, masked, allowlisted
operations data and performs no real financial or provider operation.

---

## Phase 7: User Story 5 — Resolve Reconciliation Issues (P2)

**Goal**: Compare safe internal/provider states and record a validated simulated
reconciliation decision without claiming provider or database change.

**Independent test**: A Billing Operator reviews an issue, confirms a permitted
mock decision, sees its planned audit reference, and cannot report success when
provider data is stale or unavailable.

### Tests

- [X] T076 [P] [US5] Add failing contract tests for reconciliation query/page/item, severity, age, safe currency impact, provider freshness, decision allowlist, reason, expected issue state, confirmation token, and stale-state rejection in `src/features/billing/contracts.test.ts`; verify with `npm run test -- src/features/billing/contracts.test.ts`
- [X] T077 [P] [US5] Add failing repository/hook tests for reconciliation reads/actions, permission forwarding, response parsing, pending lock, stale/unavailable provider conflict, and cache invalidation in `src/features/billing/repository.test.ts` and `src/features/billing/hooks.test.ts`; verify both files
- [X] T078 [P] [US5] Add failing component tests for list fields, severity text alternatives, safe difference rendering, mock-only notice, all relevant states, confirmation content, pending lock, conflict recovery, and focus restoration in `src/features/billing/ReconciliationView.test.tsx`; verify with `npm run test -- src/features/billing/ReconciliationView.test.tsx`
- [X] T079 [US5] Add failing Playwright journeys for successful reconciliation review, forbidden action, stale provider block, conflict recovery, keyboard dialog flow, and absence of provider/database success claims in `tests/e2e/billing.spec.ts`; verify discovery with `npm run test:e2e -- --project=desktop-1440 --grep "reconciliation"`

### Implementation

- [X] T080 [US5] Add strict reconciliation query/page/item/action schemas and types in `src/features/billing/contracts.ts`; require provider freshness and expected issue state and verify T076
- [X] T081 [US5] Add default, empty, stale, unavailable, missing-internal, missing-provider, no-op, already-resolved, forbidden, conflict, and safe-error reconciliation fixtures/state transitions in `src/mocks/fixtures/billing.ts` and `src/mocks/phase3-billing-state.ts`; verify all fixtures parse and state tests pass
- [X] T082 [US5] Implement reconciliation list GET and action POST handlers with `billing_reconciliation.read/manage`, validated decisions, stale-provider blocking, runtime-only changes, planned audit references, and safe errors in `src/mocks/handlers/billing.ts`; verify through T077
- [X] T083 [US5] Add typed reconciliation list/action methods to `src/features/billing/repository.ts`; parse all inputs/outputs and verify `npm run test -- src/features/billing/repository.test.ts`
- [X] T084 [US5] Add reconciliation query keys, query hook, and locked action mutation with exact invalidation in `src/features/billing/hooks.ts`; verify `npm run test -- src/features/billing/hooks.test.ts`
- [X] T085 [US5] Implement `ReconciliationView` with existing table/mobile-card, warning, dialog, permission, status, and region-state patterns in `src/features/billing/ReconciliationView.tsx`; clearly label outcomes as simulated and verify T078
- [X] T086 [US5] Create the thin reconciliation route in `src/app/admin/payments/reconciliation/page.tsx`; run `npm run test -- src/features/billing/contracts.test.ts src/features/billing/repository.test.ts src/features/billing/hooks.test.ts src/features/billing/ReconciliationView.test.tsx src/mocks/phase3-billing-state.test.ts src/tests/no-direct-fixtures.test.ts` and `npm run test:e2e -- --project=desktop-1440 --grep "reconciliation"` until only User Story 5 checks pass

**Checkpoint**: All five user stories are independently usable. Phase 3 remains
frontend-only and backend-aligned.

---

## Final Phase: Hardening and Verification

- [X] T087 Review every changed TypeScript/TSX file for `any`, direct fixture imports, duplicated helpers, unsafe casts, raw colors, raw HTML/Markdown/JSON rendering, unvalidated URL/form/API data, browser storage, public secrets, unsafe links, and unsafe errors/logs; record and fix findings only in the affected files under `src` and verify with `rg -n "\\bany\\b|dangerouslySetInnerHTML|localStorage|sessionStorage|NEXT_PUBLIC_.*(KEY|SECRET|TOKEN)|src/mocks/fixtures/billing" src`
- [X] T088 Review `src/features/billing/contracts.ts`, `src/mocks/fixtures/billing.ts`, `src/mocks/handlers/billing.ts`, and `tests/e2e/billing.spec.ts` for prohibited financial/customer/provider data; remove any card, CVV, bank, billing-address, raw-email, token, signature, fingerprint, invoice-content, raw-payload, or real-customer value and document the completed privacy review in `specs/004-admin-revenue-and-billing/tasks.md`
- [X] T089 Verify all eight Phase 3 routes in default, loading, empty, error, forbidden, not-found, partial, conflict, rate-limited, provider-unavailable, and relevant success/warning scenarios; record actual results and unresolved defects in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T090 Verify Arabic RTL and English LTR readiness at 1440px, 1280px, 1024px, 768px, and 390px for subscription search/detail/actions, plan/promotion forms, payment-event review, failed-payment triage, and reconciliation; record actual results in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T091 Verify keyboard navigation, visible focus, semantic headings/tables/forms/dialogs, accessible names, sort state, chart summaries, live status, focus trap/restoration, touch targets, text alternatives, and reduced motion across all Phase 3 routes; record actual results in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T092 Confirm the implementation matches `.specify/memory/constitution.md`, `specs/004-admin-revenue-and-billing/spec.md`, `plan.md`, `data-model.md`, and `contracts/admin-revenue-billing.openapi.yaml`; document only real deviations or deferred backend protections in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T093 Run `npm run typecheck`, fix all failures without weakening strictness, and record the actual command and successful result in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T094 Run `npm run lint`, fix all failures without disabling rules for convenience, and record the actual command and successful result in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T095 Run `npm run test`, fix all failures, and record the actual Vitest result in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T096 Run `npm run test:e2e`, fix all failures across all five configured viewport projects, and record the actual Playwright result in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T097 Run `npm run build`, fix all production-build failures, and record the actual result in `specs/004-admin-revenue-and-billing/quickstart.md`
- [X] T098 Recheck every checkbox against the current Git diff, mark only genuinely completed tasks in `specs/004-admin-revenue-and-billing/tasks.md`, and leave any failed, skipped, or unexecuted verification task unchecked with a concise reason

## Dependencies

### Phase order

```text
Phase 1 review
  -> Phase 2 foundations
    -> US1 subscription health (MVP)
      -> US2 subscription operations
        -> US3 plans and promotions
          -> US4 payment events and failures
            -> US5 reconciliation
              -> final hardening and verification
```

### User-story dependencies

- **US1** depends only on Phase 2 and delivers the recommended MVP.
- **US2** depends on Phase 2 and reuses the `/admin/subscriptions` route created
  by US1.
- **US3** depends on Phase 2 and the subscription/plan contract vocabulary from
  US2; it does not depend on US2 UI completion.
- **US4** depends on Phase 2 and reuses subscription safe IDs from US2.
- **US5** depends on the payment and subscription states established by US2 and
  US4.
- The final phase starts only after every in-scope story is complete.

## Parallel Execution Examples

Parallel work is allowed only for tasks marked `[P]`, and agents must not edit
the same file concurrently.

### Foundation

- T005 contract tests, T008 mock-state tests, T010 permission tests, and T012
  route-permission tests can start in parallel because they use separate files.
- T011 waits for T010; T013 waits for T012; T015 waits for T014.

### User Story 1

- T017, T018, and T019 can start in parallel in their separate test files.
- T021 must finish before T022-T027 can prove schema-valid behavior.

### User Story 2

- T031, T032, and T033 can start in parallel.
- T035 precedes fixtures, handlers, repository, hooks, and components; T042 and
  T043 wait for their components.

### User Story 3

- T045, T046, and T047 can start in parallel.
- T054 and T055 can run in parallel after T049-T053 because they use separate
  components; T056 waits for T054 and T057 waits for T055.

### User Story 4

- T059, T060, and T061 can start in parallel.
- T069, T070, and T071 can run in parallel after T063-T068; their route tasks
  wait for the corresponding component.

### User Story 5

- T076, T077, and T078 can start in parallel.
- T085 waits for T080-T084, then T086 wires and verifies the route.

## Implementation Strategy

1. Complete Phase 1 and the Phase 2 gate without changing approved visual
   design or adding dependencies.
2. Deliver US1 as the MVP and keep it green.
3. Add US2-US4 one at a time in P1 order; rerun each story's focused checks
   before proceeding.
4. Add the P2 reconciliation story only after subscription and payment states
   exist.
5. Finish with the complete automated suite and recorded manual evidence.

## Completion Rule

Do not claim completion unless T093-T097 actually run successfully. Do not mark
manual reviews complete from inference. Do not implement later Admin specs,
backend code, real authentication, provider integration, persistence, or
redesign during these tasks.
