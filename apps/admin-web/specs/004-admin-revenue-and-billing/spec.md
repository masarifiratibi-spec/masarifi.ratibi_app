# Admin Web Feature Specification: Subscriptions, Plans, Payments, and Revenue

**Phase / Spec**: Phase 3 / Spec 004 of 010  
**Created**: 2026-07-28  
**Status**: Draft  
**Input**: "Read the complete Admin Dashboard ten-specification plan and create Phase 3 - Spec 004: Subscriptions, Plans, Payments, and Revenue."

## Phase

- **Phase**: Phase 3 - Financial operations
- **Spec**: `004-admin-revenue-and-billing`
- **Delivery position**: Fourth of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only billing and revenue operations using proposed typed mock contracts and fictional data

## Goal

Enable authorized Admin operators to monitor subscriptions, plans, payment events,
failed renewals, promotional codes, and reconciliation issues with privacy-safe,
platform-aware revenue context.

This phase extends the approved Admin Dashboard and completed Specs 001-003. It
does not implement Stripe, payment processing, refunds, databases, webhooks,
real authentication, production authorization, or backend reconciliation logic.

## Clarifications

### Session 2026-07-28

- Q: What default reporting period should billing overview and list filters use? -> A: Last 30 calendar days ending today in the app time zone; 7-day and 90-day options remain available.
- Q: How should simulated billing mutations persist in this frontend-only phase? -> A: Mock runtime state only; no browser storage and no persistence after page reload, dev-server restart, or scenario reset.
- Q: Which subscription actions are included in Phase 3? -> A: Change plan, set cancel-at-period-end, clear cancel-at-period-end, resume eligible subscription, and record an internal billing note; no charge, refund, invoice, or provider mutation.
- Q: Which failed-payment resolution actions are included in Phase 3? -> A: Mark reviewed, prepare retry handoff, record customer-contact handoff, or mark provider-recovered; no real retry, charge, refund, email, or push notification.
- Q: Which sanitized provider payload fields may be previewed? -> A: Safe event ID, event type, status, timestamps, amount, currency, safe subscription reference, retry count, and safe provider error code/message only.

## Dependencies

- **Prior phase/specs**: Specs 001, 002, and 003 MUST remain complete and reusable.
- **Existing routes/components/tokens/assets**: Reuse the Admin shell, navigation,
  page headers, breadcrumbs, platform filters, date controls, tables, cards,
  charts, dialogs, drawers, confirmation states, permission boundary, typed API
  client, query provider, repository pattern, mock scenarios, semantic tokens,
  RTL behavior, and approved visual identity.
- **Existing overview data**: Spec 002 revenue and subscription summary semantics
  remain the cross-module summary reference.
- **Existing user context**: Spec 003 customer masking, platform attribution, and
  access-control patterns remain the privacy baseline for customer-linked billing
  records.
- **Sequence**: Spec 004 MUST NOT implement imports, AI, support ticketing,
  notifications, security center, audit explorer, data requests, admin-team
  settings, or final hardening from Specs 005-010.

## Assumptions

- Billing data is fictional mock data aligned to future Stripe-backed
  subscriptions and payment events.
- Billing overview and list filters default to the last 30 calendar days ending
  today in the app time zone, with 7-day and 90-day options available.
- Currency values are normalized aggregates supplied by the future backend and
  are never calculated from raw customer financial records in the browser.
- Supported currencies for mock data are AED and SAR unless the future product
  plan expands the supported market.
- A subscription belongs to one customer account. Platform attribution describes
  that customer's usage context and does not duplicate subscription or revenue
  totals for multi-platform customers.
- Payment events are provider events related to subscriptions, invoices,
  renewals, failures, refunds, disputes, or reconciliation. Raw provider payloads
  remain sanitized by default.
- Failed-payment resolution actions are mock operational outcomes only, such as
  marking reviewed, preparing a retry handoff, or recording a customer-contact
  handoff. Real retries, charges, refunds, emails, and push notifications are
  outside this phase.
- Plan and promotional-code edits are frontend-only draft or simulated changes
  backed by typed mock service contracts.
- Simulated plan, promotion, subscription, failed-payment, and reconciliation
  mutations persist only in mock runtime state and MUST reset after page reload,
  dev-server restart, or mock scenario reset.

## Related Backend Modules

- `subscriptions`
- `payments`
- `reconciliation`
- `users`
- `profiles`
- `devices`, for customer platform attribution only
- `roles`
- `permissions`
- `audit-logs`

The future backend remains responsible for authorization, provider webhook
truth, payment processing, reconciliation decisions, financial calculations,
persistence, idempotency, audit logging, and production compliance.

## Related Database Entities

- Supabase-managed `auth.users`
- `profiles`
- `devices`
- `subscription_plans`
- `subscriptions`
- `subscription_plan_changes`
- `promotional_codes`
- `promotion_redemptions`
- `payment_events`
- `payment_failures`
- `billing_reconciliation_items`
- `audit_logs`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

Entity names are alignment references only. No schema, migration, database
query, RLS policy, Stripe object, webhook handler, or backend job is implemented
in this phase.

## Roles

- **Super Admin**: May view all billing summaries and perform simulated billing,
  plan, promotion, and reconciliation actions.
- **Billing Operator**: Primary operator for subscriptions, payment failures,
  billing events, plan changes, promotional codes, and reconciliation issues.
- **Support Agent**: May view limited customer-linked billing status needed for
  support, without payment payloads, reconciliation controls, or plan editing.
- **Security Administrator**: May view billing events only when required for
  risk or audit context; cannot manage plans or payment outcomes by default.
- **Parser and Import Operator**, **AI Operator**, and **Content Manager**: No
  Phase 3 billing route access by default.

## Permissions

| Capability | Proposed permission | Super Admin | Billing Operator | Support Agent | Security Administrator |
|------------|---------------------|-------------|------------------|---------------|------------------------|
| Subscription overview and list | `subscriptions.read` | Allowed | Allowed | Limited status only | Context only |
| Subscription detail | `subscriptions.detail.read` | Allowed | Allowed | Limited masked detail | Context only |
| Simulated subscription action | `subscriptions.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Plan list and detail | `plans.read` | Allowed | Allowed | Not allowed | Not allowed |
| Simulated plan edit | `plans.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Promotional-code list and detail | `promotions.read` | Allowed | Allowed | Not allowed | Not allowed |
| Simulated promotional-code edit | `promotions.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Payments overview and event list | `payments.read` | Allowed | Allowed | Limited status only | Context only |
| Payment event detail | `payments.detail.read` | Allowed | Allowed | Not allowed | Context only |
| Failed-payment resolution | `payment_failures.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Billing reconciliation list | `billing_reconciliation.read` | Allowed | Allowed | Not allowed | Context only |
| Simulated reconciliation action | `billing_reconciliation.manage` | Allowed | Allowed | Not allowed | Not allowed |

- Missing route permission MUST render the shared access-denied state and no
  protected billing values.
- Missing action permission MUST hide the action or show it disabled with a
  clear reason; direct mutation attempts MUST return a safe forbidden state.
- Permission-aware UI is development-only UX simulation and MUST NOT be
  described as production authorization.

## User Stories

### User Story 1 - Monitor Revenue and Subscription Health (Priority: P1)

An authorized billing operator reviews subscription KPIs, plan distribution,
MRR, failed renewals, churn, upgrade/downgrade movement, and platform-attributed
revenue without exposing private customer financial records.

**Why this priority**: Billing operations need a reliable overview before
operators can triage individual subscriptions or failures.

**Independent test**: From `/admin/subscriptions`, the operator can identify
current subscription health, compare All/iOS/Android/Multi-platform context, and
see that multi-platform revenue is not double-counted.

**Acceptance scenarios**:

1. **Given** the All Platforms view, **When** subscription KPIs load, **Then**
   active, trial, free, Basic, Premium, upgrades, downgrades, cancellations,
   churn, MRR, and failed-renewal summaries are visible with freshness context.
2. **Given** platform attribution is available, **When** iOS, Android, or
   Multi-platform is selected, **Then** subscription totals, plan distribution,
   failed renewals, and revenue attribution update without duplicating
   multi-platform customer revenue.
3. **Given** revenue contains AED and SAR values, **When** the overview renders,
   **Then** each amount remains tied to its currency and no mixed-currency total
   is implied.
4. **Given** a provider-unavailable or partial-summary scenario, **When** the
   page resolves, **Then** the operator sees a recoverable safe error or partial
   state without raw provider payloads.

### User Story 2 - Review and Manage Subscriptions (Priority: P1)

An authorized operator searches subscriptions, filters by plan/status/provider,
opens a subscription detail, and performs simulated safe subscription actions.

**Why this priority**: Subscription status and renewal issues are the primary
customer-facing billing operations for this phase.

**Independent test**: A subscription can be found, opened, inspected with masked
customer data, and acted on only through validated confirmation flows.

**Acceptance scenarios**:

1. **Given** the Subscriptions List, **When** search, filters, sorting, and
   pagination are used, **Then** results show user, masked email, plan, status,
   provider, renewal date, amount, currency, cancel-at-period-end, payment
   status, and permitted actions.
2. **Given** a subscription detail route, **When** it loads, **Then** it shows
   user summary, current plan, billing cycle, safe provider references, renewal
   date, cancellation state, limits, billing events, and plan-change history.
3. **Given** a simulated plan change or cancellation-state action, **When** the
   operator confirms the scope and reason, **Then** the mock state updates and a
   planned audit event is identified.
4. **Given** stale or incompatible subscription state, **When** an action is
   submitted, **Then** a safe conflict message asks the operator to refresh
   rather than reporting success.

### User Story 3 - Maintain Plans and Promotional Codes (Priority: P1)

A Super Admin or Billing Operator reviews Free, Basic, and Premium plans,
feature limits, AI/import limits, active status, price mapping, and promotional
codes, then performs simulated edits with review and confirmation.

**Why this priority**: Plan and promotion configuration directly affects
customer billing and must be prepared before real backend integration.

**Independent test**: Plan and promotional-code forms validate required fields,
show before/after summaries, require confirmation, and never call real payment
providers.

**Acceptance scenarios**:

1. **Given** the Plan Management route, **When** plans load, **Then** Free,
   Basic, and Premium are visible with price, currency, billing interval,
   feature limits, AI limits, import limits, active state, and safe Stripe price
   mapping labels.
2. **Given** a plan edit, **When** invalid price, currency, interval, limit, or
   provider mapping is entered, **Then** field-level validation prevents
   submission and leaves the current plan unchanged.
3. **Given** a valid simulated plan edit, **When** confirmation is accepted,
   **Then** the operator sees a success state, before/after summary, and planned
   audit reference.
4. **Given** a promotional code, **When** it is created, edited, expired, or
   deactivated in mock mode, **Then** code, discount, duration, redemptions,
   limit, expiration, and status remain validated and visible.

### User Story 4 - Triage Payment Events and Failures (Priority: P1)

A Billing Operator reviews payment events, opens sanitized event details, and
triages failed renewals with safe mock resolution actions.

**Why this priority**: Failed payments and provider events are high-priority
operational signals, but raw payment payloads are sensitive.

**Independent test**: Payment events and failed payments can be filtered,
opened, and resolved in mock mode without exposing full provider payloads,
card data, raw customer financial data, or real provider actions.

**Acceptance scenarios**:

1. **Given** the Payments Overview, **When** it loads, **Then** successful,
   failed, refunded, disputed, pending payments, and reconciliation issues are
   visible with date, currency, and platform context.
2. **Given** the Payment Events List, **When** filters are applied, **Then**
   event ID, masked user, subscription, event type, amount, currency, provider,
   status, received time, processed time, and retry count are shown.
3. **Given** a Payment Event Detail, **When** it opens, **Then** provider event
   ID, event type, processing timeline, sanitized payload preview, related
   subscription, safe error information, and retry history are visible.
4. **Given** a failed payment, **When** a resolution action is confirmed, **Then**
   the mock result records the selected resolution outcome and does not trigger
   a real charge, refund, email, push notification, or provider call.

### User Story 5 - Resolve Reconciliation Issues (Priority: P2)

A Billing Operator compares internal subscription status with provider status,
reviews the difference, and records a simulated reconciliation decision.

**Why this priority**: Reconciliation is required for billing reliability but
depends on the subscription and payment views above.

**Independent test**: A reconciliation issue can be opened, reviewed with safe
internal/provider state, and marked with a validated mock decision.

**Acceptance scenarios**:

1. **Given** the Reconciliation route, **When** issues load, **Then** internal
   subscription status, Stripe subscription status, difference, recommended
   action, severity, age, and permitted action are visible.
2. **Given** a reconciliation action, **When** the operator confirms reason and
   expected effect, **Then** the mock issue moves to the selected resolution
   state and the planned audit event is identified.
3. **Given** provider status is unavailable or stale, **When** the issue is
   reviewed, **Then** the UI prevents false reconciliation success and shows a
   recoverable safe state.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/admin/subscriptions` | Subscription overview, list, platform breakdown, and subscription actions | Super Admin, Billing Operator, limited Support/Security context | New approved addition |
| `/admin/subscriptions/[subscriptionId]` | Subscription detail with masked customer summary, plan, limits, billing events, and plan-change history | Super Admin, Billing Operator, limited Support/Security context | New approved addition |
| `/admin/subscriptions/plans` | Plan Management for Free, Basic, Premium, limits, active state, and provider mapping | Super Admin, Billing Operator | New approved addition |
| `/admin/subscriptions/promotional-codes` | Promotional-code list and simulated create/edit/deactivate/expire flows | Super Admin, Billing Operator | New approved addition |
| `/admin/payments` | Payments overview, payment events list, failed payments summary, and reconciliation summary | Super Admin, Billing Operator, limited Support/Security context | New approved addition |
| `/admin/payments/events/[eventId]` | Sanitized payment event detail and retry-history context | Super Admin, Billing Operator, limited Security context | New approved addition |
| `/admin/payments/failed` | Failed-payment triage and mock resolution actions | Super Admin, Billing Operator | New approved addition |
| `/admin/payments/reconciliation` | Billing reconciliation issue list and mock decision actions | Super Admin, Billing Operator, limited Security context | New approved addition |

## Functional Requirements

### Revenue and Subscription Overview

- **FR-001**: The Subscription Overview MUST show active subscriptions, trial
  users, Free users, Basic users, Premium users, new upgrades, downgrades,
  cancellations, churn rate, MRR, and failed renewals.
- **FR-002**: The overview MUST show subscription growth, plan distribution,
  upgrade funnel, cancellation reasons, and revenue by plan.
- **FR-003**: Revenue and subscription summaries MUST support All Platforms,
  iOS, Android, and Multi-platform views where attribution exists.
- **FR-004**: Revenue amounts MUST be shown with explicit currency and MUST NOT
  imply conversion or mixed-currency totals unless the future backend supplies a
  normalized aggregate.
- **FR-005**: Multi-platform subscription and revenue totals MUST use
  authoritative customer-account totals and MUST NOT double-count the same
  subscription or revenue.

### Subscriptions

- **FR-006**: The Subscriptions List MUST support bounded search, plan, status,
  provider, payment status, currency, renewal date, cancel-at-period-end,
  platform attribution, sorting, and pagination.
- **FR-007**: Each subscription row MUST show masked customer, plan, status,
  provider, renewal date, amount, currency, cancel-at-period-end, payment
  status, platform attribution, and permitted actions.
- **FR-008**: Subscription Details MUST show masked user summary, current plan,
  billing cycle, safe provider identifiers, renewal date, cancellation state,
  feature limits, AI usage limit, import limit, billing events, and plan-change
  history.
- **FR-009**: Simulated subscription actions MUST be limited to change plan, set
  cancel-at-period-end, clear cancel-at-period-end, resume eligible subscription,
  and record an internal billing note; each action MUST validate current state,
  reason, effective timing, permission, confirmation, and duplicate submission
  before updating mock runtime state.
- **FR-010**: Subscription actions MUST show loading, success, error, forbidden,
  conflict, and partial-data outcomes where relevant.

### Plans and Promotional Codes

- **FR-011**: Plan Management MUST show Free, Basic, and Premium plans with
  price, currency, billing intervals, feature limits, AI limits, import limits,
  active status, and safe provider price mapping.
- **FR-012**: Plan edit forms MUST validate plan name, price, currency, billing
  interval, limits, active state, and provider mapping before simulated save.
- **FR-013**: Plan edits MUST show before/after review, confirmation, pending
  lock, success, failure, forbidden, and conflict states.
- **FR-014**: Promotional Codes MUST show code, discount, duration, redemptions,
  limit, expiration, status, and eligible plans.
- **FR-015**: Promotional-code create/edit/deactivate/expire flows MUST validate
  code format, discount, duration, redemption limits, expiration, eligible
  plans, confirmation, permission, and conflict state.

### Payments and Failures

- **FR-016**: Payments Overview MUST show successful, failed, refunded, disputed,
  and pending payments plus reconciliation issue counts.
- **FR-017**: Payment Events MUST support search, event type, status, provider,
  currency, date range, subscription, platform attribution, retry count, sorting,
  and pagination.
- **FR-018**: Each payment event row MUST show event ID, masked user,
  subscription, event type, amount, currency, provider, status, received time,
  processed time, retry count, and permitted actions.
- **FR-019**: Payment Event Details MUST show provider event ID, event type,
  processing timeline, sanitized payload preview, related subscription, safe
  error information, and retry history.
- **FR-020**: Raw provider payloads, card numbers, CVV, bank account details,
  billing email, address, invoice document content, auth tokens, webhook
  signatures, and customer transaction records MUST NOT be displayed.
- **FR-021**: Failed Payments MUST show masked user, plan, failed amount,
  currency, reason, attempt count, next retry, customer-notification state, and
  mock resolution action.
- **FR-022**: Failed-payment resolution actions MUST be limited to mark reviewed,
  prepare retry handoff, record customer-contact handoff, and mark
  provider-recovered; each action MUST require reason, scope, confirmation,
  permission, pending lock, and safe outcome.

### Billing Reconciliation

- **FR-023**: Billing Reconciliation MUST show internal subscription status,
  provider subscription status, difference, recommended action, severity, age,
  currency impact where safe, and permitted action.
- **FR-024**: Reconciliation actions MUST validate issue state, reason,
  permission, confirmation, duplicate submission, stale provider state, and
  conflict outcomes.
- **FR-025**: Reconciliation UI MUST clearly identify that the frontend records
  simulated outcomes only and does not change provider or database state.

### Shared Quality and Boundaries

- **FR-026**: Pages and presentation components MUST consume typed hooks,
  services, repositories, and mock API contracts; they MUST NOT import raw mock
  arrays directly.
- **FR-027**: Every route MUST provide relevant loading, empty, error, success,
  warning, and permission states.
- **FR-028**: All forms, filters, URL parameters, identifiers, mutation payloads,
  and mock responses MUST be parsed, normalized, and validated before use.
- **FR-029**: All financial values MUST be masked, aggregated, or explicitly
  allowlisted for billing operations; private customer financial records remain
  hidden by default.
- **FR-030**: All sensitive billing, plan, promotion, failed-payment, and
  reconciliation actions MUST identify scope, consequence, permission, and
  planned audit event before confirmation.

## Platform Data Requirements

- The default view MUST be All Platforms.
- Relevant billing views MUST support All Platforms, iOS, Android, and
  Multi-platform filters when platform attribution is available.
- A subscription belongs to a customer account, not a device.
- Customer-linked subscription totals MUST use authoritative unique customer or
  subscription totals supplied by the mock contract.
- Revenue MUST NOT be calculated by adding iOS and Android values when the same
  multi-platform customer can appear in both platform contexts.
- Multi-platform revenue MUST be shown as customer-usage attribution, not as a
  second subscription or duplicate revenue line.
- Payment event counts MAY be additive only when each provider event has one
  source event identity and no duplication is represented.
- Plan distribution by platform MUST explain whether the count represents
  subscriptions, unique customers, or payment events.
- Unattributed records MAY appear only as a visible data-quality bucket in
  reconciliation or event views when the proposed contract supports it.

## UX and Design Requirements

- Preserve the approved Admin Dashboard identity and Masarifi Gulf Premium
  Design System Version 2.1.
- Do not redesign approved pages, shell, components, routes, styles, tokens, or
  assets.
- Deep teal remains the primary interaction color and bronze remains a limited
  premium accent at approximately 2%-3% screen coverage.
- Admin billing pages MUST remain neutral, data-dense, professional, and
  operational.
- Financial semantic colors for revenue, refunds, disputes, failures, pending
  states, and reconciliation MUST remain separate from system status colors.
- Existing cards, tables, badges, dialogs, drawers, breadcrumbs, filter bars,
  skeletons, chart frames, and confirmation patterns MUST be reused when
  possible.
- Billing tables MUST prioritize scanning, comparison, and repeated operational
  action over marketing-style presentation.
- Amounts, currencies, provider IDs, and statuses MUST remain legible in Arabic
  RTL and English LTR-ready layouts.
- No meaning may rely on color alone; labels and icons/text MUST accompany
  status, risk, currency, provider, and platform meanings.

## Responsive Requirements

- **Arabic RTL default**: Tables, filters, segmented controls, dialogs, drawers,
  charts, and timelines MUST preserve logical order, right alignment, and
  readable mixed Arabic/English billing identifiers.
- **English LTR readiness**: Layouts MUST use direction-safe spacing and ordering
  so labels, amounts, provider IDs, and dates can mirror without redesign.
- **1440px**: Use full sidebar, persistent filters, KPI/charts grid, and full
  billing tables.
- **1280px**: Preserve dense overview and list scanning with compact horizontal
  spacing and overflow-safe columns.
- **1024px**: Keep core KPIs visible, allow table overflow where appropriate,
  and keep detail/reconciliation context usable.
- **768px**: Use drawer or stacked filter patterns, selective columns, two-column
  cards, and accessible row summaries.
- **390px**: Prioritize revenue health, failed-payment triage, approval/safe
  action summaries, and desktop-required notices for complex plan/reconciliation
  editing where full configuration is impractical.

## Accessibility Requirements

- Billing routes MUST support keyboard navigation, visible focus, semantic HTML,
  accessible names, clear table headers, logical tab order, and reduced motion.
- Dialogs and drawers MUST trap and restore focus, announce validation errors,
  and keep cancel/confirm actions reachable by keyboard.
- Charts MUST provide accessible summaries that include metric meaning,
  currency, reporting period, platform selection, and freshness state.
- Tables MUST expose sort state, selected filters, pagination, row actions, and
  masked-value labels to assistive technology.
- Amounts, statuses, failures, disputes, reconciliation severity, and platform
  attribution MUST use text labels in addition to color.
- Touch targets for actionable controls MUST meet the approved minimum size.
- Dynamic retry, pending, or reconciliation updates MUST not cause noisy
  repeated announcements.

## Proposed API Contracts

All paths are proposed frontend contracts; no backend is implemented.

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|--------|-----------|--------------|---------------|----------------------------|
| GET | `/api/v1/admin/billing/subscriptions/overview` | `SubscriptionOverviewQuery` | `SubscriptionOverview` | subscriptions/payments aggregate overview |
| GET | `/api/v1/admin/billing/subscriptions` | `SubscriptionsQuery` | `SubscriptionsPage` | subscriptions search |
| GET | `/api/v1/admin/billing/subscriptions/:subscriptionId` | `SubscriptionDetailRequest` | `SubscriptionDetail` | subscription detail |
| POST | `/api/v1/admin/billing/subscriptions/:subscriptionId/action` | `SubscriptionActionRequest` | `BillingActionResult` | subscription state action |
| GET | `/api/v1/admin/billing/plans` | `PlansQuery` | `PlansResponse` | plan management |
| POST | `/api/v1/admin/billing/plans/:planId` | `PlanUpdateRequest` | `PlanDetail` | simulated plan update |
| GET | `/api/v1/admin/billing/promotional-codes` | `PromotionalCodesQuery` | `PromotionalCodesPage` | promotional-code management |
| POST | `/api/v1/admin/billing/promotional-codes` | `PromotionalCodeMutationRequest` | `PromotionalCodeDetail` | simulated promotional-code create |
| POST | `/api/v1/admin/billing/promotional-codes/:codeId` | `PromotionalCodeMutationRequest` | `PromotionalCodeDetail` | simulated promotional-code update |
| GET | `/api/v1/admin/billing/payments/overview` | `PaymentsOverviewQuery` | `PaymentsOverview` | payments aggregate overview |
| GET | `/api/v1/admin/billing/payment-events` | `PaymentEventsQuery` | `PaymentEventsPage` | payment event search |
| GET | `/api/v1/admin/billing/payment-events/:eventId` | `PaymentEventDetailRequest` | `PaymentEventDetail` | payment event detail |
| GET | `/api/v1/admin/billing/failed-payments` | `FailedPaymentsQuery` | `FailedPaymentsPage` | failed payment triage |
| POST | `/api/v1/admin/billing/failed-payments/:failureId/action` | `FailedPaymentActionRequest` | `BillingActionResult` | simulated failed-payment resolution |
| GET | `/api/v1/admin/billing/reconciliation` | `BillingReconciliationQuery` | `BillingReconciliationPage` | reconciliation issue search |
| POST | `/api/v1/admin/billing/reconciliation/:issueId/action` | `ReconciliationActionRequest` | `BillingActionResult` | simulated reconciliation decision |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays.

## Frontend Types

- **BillingPlatformFilter**: All, iOS, Android, Multi-platform, and optional
  Unattributed when the contract exposes a data-quality bucket.
- **SubscriptionOverviewQuery**: reporting period, platform filter, currency,
  plan, provider, and optional mock scenario.
- **SubscriptionOverview**: KPIs, plan distribution, growth trend, upgrade
  funnel, cancellation reasons, revenue by plan, platform breakdown, currency,
  and freshness state.
- **SubscriptionsQuery**: bounded search, filters, allowlisted sort, page, page
  size, and optional mock scenario.
- **SubscriptionListItem**: safe subscription ID, masked customer, plan, status,
  provider, renewal date, amount, currency, cancel-at-period-end, payment
  status, platform attribution, and permitted actions.
- **SubscriptionDetail**: masked customer summary, current plan, billing cycle,
  safe provider references, renewal date, cancellation state, limits, billing
  events, plan-change history, and action eligibility.
- **PlanDetail**: plan ID, name, price, currency, billing interval, feature
  limits, AI limit, import limit, active state, safe provider price mapping,
  last updated, and pending-change state.
- **PromotionalCodeDetail**: code ID, display code, discount, duration,
  redemption count, limit, expiration, status, eligible plans, and audit
  summary.
- **PaymentsOverview**: payment KPIs, currency-aware trends, provider status
  summary, failed-payment summary, disputes/refunds/pending counts, and
  reconciliation count.
- **PaymentEventListItem**: safe event ID, masked user, subscription ID, event
  type, amount, currency, provider, status, received, processed, retry count,
  platform attribution, and permitted action.
- **PaymentEventDetail**: safe provider event ID, event type, timeline,
  sanitized payload preview, related subscription, safe error information, retry
  history, and planned audit references.
- **SanitizedPaymentPayloadPreview**: safe event ID, event type, status,
  timestamps, amount, currency, safe subscription reference, retry count, and
  safe provider error code/message only.
- **SubscriptionActionRequest**: allowlisted subscription action, reason,
  effective timing, target plan when applicable, note when applicable, expected
  current state, and confirmation token.
- **FailedPaymentItem**: failure ID, masked user, plan, failed amount, currency,
  reason, attempt count, next retry, customer-notification state, platform
  attribution, and resolution eligibility.
- **FailedPaymentActionRequest**: allowlisted failed-payment action, reason,
  scope, expected current state, and confirmation token.
- **BillingReconciliationItem**: issue ID, internal status, provider status,
  difference, recommended action, severity, age, safe currency impact, platform
  attribution, and resolution eligibility.
- **ReconciliationActionRequest**: allowlisted reconciliation decision, reason,
  expected issue state, provider freshness, and confirmation token.
- **BillingActionResult**: affected safe ID, previous/current state, outcome,
  timestamp, safe message, conflict metadata, and planned audit reference.
- **ApiError**: status, safe code, localized message, optional field errors, and
  correlation ID without stack traces or private payloads.
- All application types MUST be explicit and MUST NOT use `any`.

## Mock Scenarios

- Default success for subscription, payment, plan, promotion, failure, and
  reconciliation routes
- Empty subscriptions, payment events, failed payments, promotional codes, and
  reconciliation issues
- Large paginated subscription and payment event result sets
- Slow overview, list, detail, or mutation response
- Partial overview where one region such as provider health or revenue trend is
  temporarily unavailable
- Unauthorized and forbidden route/action
- Subscription, plan, promotional code, event, failed payment, or reconciliation
  issue not found
- Invalid identifier, filter, sort, date range, amount, currency, plan limit,
  provider mapping, promotion code, discount, duration, or action reason
- Conflict for stale subscription state, expired promo code, already-resolved
  failure, or already-reconciled issue
- Rate-limited sensitive mutation
- Provider unavailable and internal error with safe correlation ID
- Multi-platform customer revenue attribution that does not duplicate totals
- Mixed AED/SAR data that prevents false combined currency totals
- Sanitized payment payload preview containing unsafe text that must render as
  plain text
- Masking contract violation rejected by response validation
- Duplicate submission attempt while a billing mutation is pending
- Mock runtime mutation reset after reload, dev-server restart, or scenario reset

## Loading States

- Page-level skeletons for subscription and payment overview routes
- Table/card skeletons for subscriptions, payment events, failed payments,
  plans, promotional codes, and reconciliation issues
- Detail and drawer loading states for subscription and payment event detail
- Pending button and locked form states for every sensitive mutation
- Clearly marked updating state when safe previous aggregate data remains
  visible during filter changes

## Empty States

- No subscriptions
- No filtered subscriptions
- No payment events
- No failed payments
- No reconciliation issues
- No promotional codes
- No plan-change history
- No billing events for a subscription
- No platform-attributed data for the selected filter

Every empty state MUST explain the current filter/context and provide a safe
recovery action where one exists.

## Error States

- Failed list/detail/overview load with retry
- Invalid identifier, filter, sort, date range, amount, currency, code, limit,
  or action payload
- Unauthorized, forbidden, not found, conflict, rate limited, provider
  unavailable, partial provider state, and safe internal error
- Stale provider or reconciliation state that blocks false success

Errors MUST NOT expose stack traces, internal file paths, raw provider payloads,
webhook signatures, secrets, raw exceptions, full customer identifiers,
unmasked personal data, card data, bank details, or customer financial records.

## Success States

- Subscription action simulated successfully
- Plan edit simulated successfully
- Promotional code created, updated, deactivated, or expired in mock mode
- Failed payment marked reviewed, assigned a retry/customer-contact handoff, or
  marked provider-recovered in mock runtime state
- Reconciliation issue marked with a simulated decision
- Filter, sort, pagination, and platform changes update the displayed result

Success MUST be announced accessibly and reflected in the relevant current
state.

## Warning and Confirmation States

- Plan price, currency, limit, active-state, and provider-mapping changes
- Subscription cancellation, reactivation, plan-change, renewal-state, and
  payment-status changes
- Promotional-code discount, redemption limit, expiration, activation, and
  deactivation changes
- Failed-payment resolution, retry handoff, customer-contact handoff, and
  reconciliation action
- Mixed-currency summaries and multi-platform attribution notices
- Stale provider data and partial reconciliation information

Confirmations MUST identify scope, consequence, permission, planned audit event,
and the fact that the current phase is mock-only. Sensitive mutations MUST lock
while pending.

## Audit Expectations

The future backend is expected to append audit events for:

- Subscription list/detail access where policy requires it
- Subscription state changes, cancellation-state changes, plan changes, and
  payment-status overrides
- Plan creation/update/deactivation and provider-price mapping changes
- Promotional-code creation, update, activation, deactivation, expiration, and
  redemption-limit changes
- Failed-payment resolution and retry/contact handoff decisions
- Reconciliation issue review and resolution decisions
- Denied billing actions and stale-state conflicts where policy requires it

Frontend mock responses MAY expose a safe audit reference and timeline. Audit
rows remain immutable and the full Audit Log Explorer belongs to a later spec.

## Privacy Rules

- Mask customer email and private identifiers by default.
- Do not expose customer transaction history, account balances, bank accounts,
  salary, debts, merchant names, invoices, receipts, statement contents, SMS or
  notification contents, or AI prompts.
- Do not expose full provider payloads, webhook signatures, card numbers, CVV,
  bank account details, billing addresses, raw customer emails, payment-method
  fingerprints, tokens, secrets, or credentials.
- Show payment and subscription data only as allowlisted operational fields
  needed for billing work.
- Provider IDs, subscription IDs, event IDs, and reconciliation IDs MUST be safe
  mock identifiers and may be copied only when the UI labels them as safe.
- Search, filters, caches, errors, logs, screenshots, and tests MUST use
  fictional sanitized values.
- No billing-sensitive data, customer details, provider payloads, tokens,
  secrets, payment identifiers beyond safe mock IDs, or mutation drafts may be
  stored in local storage or session storage.

## Security Requirements

- **Untrusted inputs**: Parse and normalize route identifiers, query parameters,
  search, filters, sort keys, pagination, date ranges, currency, plan IDs,
  provider IDs, promo codes, discounts, limits, action reasons, mutation
  payloads, and mock API responses.
- **Safe rendering**: Customer names, plan names, reasons, statuses, provider
  labels, sanitized payload previews, error text, and reconciliation differences
  MUST render as plain text. Raw HTML, Markdown, JSON provider payloads, webhook
  payloads, imported messages, and customer financial records are not rendered
  except as allowlisted sanitized previews containing only safe event ID, event
  type, status, timestamps, amount, currency, safe subscription reference, retry
  count, and safe provider error code/message.
- **Client storage and environment**: Do not store billing data, customer data,
  provider data, payment payloads, tokens, secrets, credentials, mutation
  drafts, or reconciliation state in browser storage. No Stripe, Supabase, or
  service credential may appear in frontend source, fixtures, logs, screenshots,
  documentation, or browser-visible environment values.
- **Files and links**: This phase accepts no uploads. Mock exports, if any, use
  allowlisted fields and safe filenames. External provider links are disabled or
  represented as non-navigating mock references unless an approved safe
  destination exists; new-tab links MUST prevent opener access.
- **Permissions**: Frontend route guards, hidden controls, disabled controls,
  and mock permissions are UX controls only. Every future billing operation MUST
  independently enforce backend authorization.
- **Mutation safety**: Sensitive billing actions lock while pending, reject
  duplicates, confirm scope and consequences, validate stale state, and report
  conflicts safely.
- **Dependencies**: Add no dependency unless required, reviewed, scoped, tested,
  and explicitly approved; this specification requires none.
- **Security mock scenarios**: Cover denied access, invalid identifiers, invalid
  amounts/currencies/codes/limits, unsafe text, sanitized payload previews,
  masking failures, provider unavailable, stale state, duplicate submission,
  rate limiting, forbidden mutations, and reconciliation conflict.
- **Deferred production controls**: NestJS authorization, Stripe webhooks,
  provider idempotency, Supabase Auth, database policies, immutable audit
  storage, encryption, rate limiting, PCI-sensitive handling, monitoring, and
  incident response remain future backend/infrastructure responsibilities.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- A multi-platform customer changes platform attribution while a billing list is open.
- iOS and Android attribution overlap for the same customer and must not double-count revenue.
- A subscription changes plan or status while the detail page is open.
- Renewal date is missing for a free, expired, cancelled, or trial subscription.
- A plan has zero price but still has import or AI limits.
- AED and SAR amounts appear in the same reporting window.
- A promotional code is expired, exhausted, duplicated, malformed, or applies to
  an inactive plan.
- A payment event arrives before its related subscription is available.
- A provider event is duplicated, out of order, unprocessed, retried, disputed,
  refunded, or partially processed.
- A failed payment is resolved from another Admin session before confirmation.
- A reconciliation issue has stale provider data, missing internal status,
  missing provider status, or a no-op recommended action.
- Provider payload preview contains unsafe markup or oversized JSON-like text.
- A localized billing label mixes Arabic, English, currency symbols, and long
  provider identifiers.
- Permission changes while a billing form or confirmation dialog is open.

## Out of Scope

- Real NestJS, Supabase, database, migration, RLS, webhook, Stripe, payment,
  refund, dispute, invoice, email, push, queue, or reconciliation integration
- Real authentication, production authorization, real customer consent, real
  admin-team management, or backend audit storage
- Creating or sending notification campaigns
- Support ticket conversation workflows
- Import, parser, AI, content, security center, audit explorer, system health,
  jobs, data privacy requests, role matrix, settings, and final hardening
- Customer transaction lists, bank statements, receipts, SMS/notification
  contents, raw financial records, card/payment-method details, and private
  provider payloads
- Mobile, API, or Marketing specifications
- Redesign of any approved page, route shell, component, token, style, or asset

## Acceptance Criteria

- **AC-001**: `/admin/subscriptions` shows the required subscription KPIs,
  charts, freshness state, and platform-aware breakdowns.
- **AC-002**: Revenue and subscription platform breakdowns do not double-count a
  multi-platform customer's subscription or revenue.
- **AC-003**: Currency values are always displayed with a currency and mixed AED
  and SAR values are not presented as one implied total unless supplied as a
  normalized aggregate.
- **AC-004**: The Subscriptions List supports the documented search, filters,
  sorting, pagination, and permission states.
- **AC-005**: Subscription Details show the required customer, plan, billing,
  limits, event, and plan-change information while masking private data.
- **AC-006**: Plan Management shows Free, Basic, and Premium and validates all
  simulated edit fields before save.
- **AC-007**: Promotional-code flows validate code, discount, duration,
  redemption limits, expiration, status, and eligible plans.
- **AC-008**: `/admin/payments` shows successful, failed, refunded, disputed,
  pending, and reconciliation summaries.
- **AC-009**: Payment Event Details show only sanitized provider preview and
  never expose prohibited payment, customer, token, signature, or raw provider
  fields.
- **AC-010**: Failed-payment and reconciliation actions require confirmation,
  pending lock, permission, valid reason, success, forbidden, error, and conflict
  outcomes.
- **AC-011**: Every Phase 3 route demonstrates relevant loading, empty, error,
  success, warning, and permission states.
- **AC-012**: Pages consume typed service/repository contracts and no page or
  presentation component imports raw fixtures.
- **AC-013**: Arabic RTL and English LTR-ready behavior works at 1440px, 1280px,
  1024px, 768px, and 390px without hiding critical billing context.
- **AC-014**: Keyboard-only review can search, filter, paginate, open details,
  complete/cancel dialogs, and recover focus with no keyboard trap.
- **AC-015**: Verification reports zero blocking design-preservation, privacy,
  accessibility, platform-counting, contract-validation, or security defects.

## Success Criteria

- **SC-001**: In verification, a Billing Operator can identify current
  subscription health and the largest failed-renewal segment within 90 seconds.
- **SC-002**: 100% of seeded multi-platform billing fixtures preserve unique
  subscription and revenue totals without iOS plus Android double-counting.
- **SC-003**: Privacy review finds zero default-view exposures of prohibited
  customer financial records, payment-method details, raw provider payloads,
  tokens, signatures, or unmasked personal data.
- **SC-004**: 100% of sensitive plan, promotion, subscription, failed-payment,
  and reconciliation actions show scope, consequence, confirmation, pending
  lock, and outcome.
- **SC-005**: 100% of invalid billing filters, identifiers, amounts, currencies,
  promotion values, and action payloads produce field-level or safe error
  feedback without private payload exposure.
- **SC-006**: All five approved viewports complete the primary subscription
  search, detail review, payment-event review, failed-payment triage, and
  reconciliation review journeys without blocking overflow or hidden critical
  context.
- **SC-007**: Keyboard and screen-reader review finds no blocking focus,
  labeling, status, chart-summary, dialog, or reduced-motion defects.

## Verification

Implementation verification for this future phase MUST include:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Route review**: Open every Phase 3 route in default, loading, empty, error,
  forbidden, and relevant mutation scenarios.
- **Platform review**: Verify All, iOS, Android, and Multi-platform subscription,
  revenue, plan-distribution, failed-payment, and event views; confirm
  multi-platform revenue is not duplicated.
- **Viewport review**: Verify 1440px, 1280px, 1024px, 768px, and 390px in Arabic
  RTL, plus an English LTR-readiness pass.
- **Accessibility review**: Verify keyboard navigation, visible focus, semantic
  tables/forms/dialogs, chart summaries, status alternatives, touch targets, and
  reduced motion.
- **Privacy/security review**: Scan changed source, fixtures, tests, logs, URLs,
  storage, environment usage, errors, sanitized payload previews, exports,
  dependencies, permissions, validation, duplicate mutation handling, and
  masking for unsafe billing data exposure.

No verification result may be reported as successful unless the named command
or manual procedure was actually completed successfully.
