# Data Model: Spec 004 Admin Revenue and Billing

All records are fictional frontend contract models. IDs are safe opaque mock
identifiers. Dates use ISO 8601 strings, amounts are non-negative minor-unit or
decimal values according to one documented contract convention, and every
money value carries `AED` or `SAR`.

## Shared value objects

### BillingPlatformFilter

- `all | ios | android | multi_platform | unattributed`
- `all` is an authoritative aggregate, not the sum of platform segments.

### Money

- `amount`: finite, non-negative number
- `currency`: `AED | SAR`
- Mixed currencies must remain separate unless a normalized aggregate includes
  its target currency and normalization label.

### MaskedCustomer

- `customerId`: safe opaque ID
- `displayName`: fictional plain text
- `maskedEmail`: validated masked value; never raw email
- `platform`: `ios | android | multi_platform | unattributed`

### ApiError

- `status`: HTTP status
- `code`: allowlisted safe code
- `message`: localized safe plain text
- `fieldErrors`: optional field-to-message map
- `correlationId`: optional safe identifier
- Never includes stack traces, raw exceptions, provider payloads, or PII.

## Read models

### SubscriptionOverview

- Reporting period and freshness timestamp
- Currency-separated KPI groups
- Authoritative active, trial, free, Basic, Premium, upgrade, downgrade,
  cancellation, churn, MRR, and failed-renewal values
- Plan distribution, growth trend, upgrade funnel, cancellation reasons,
  revenue by plan, and platform breakdown
- Partial-data and provider-health indicators

### SubscriptionListItem

- Safe subscription ID and `MaskedCustomer`
- Plan, status, provider label, billing interval
- Renewal date when applicable
- `Money`, cancellation-at-period-end flag, payment status, platform attribution
- Allowlisted permitted actions

### SubscriptionDetail

- All safe list fields
- Current plan and limits
- Safe provider references
- Billing-cycle and renewal/cancellation state
- Sanitized billing-event summaries and plan-change history
- Action eligibility and expected-current-state token

### PlanDetail

- Safe plan ID; name `Free | Basic | Premium`
- Price, currency, interval, feature/AI/import limits
- Active state and safe provider price-mapping label
- Last-updated timestamp and optional pending-change summary

### PromotionalCodeDetail

- Safe code ID and display code
- Discount kind/value, duration, redemption count/limit
- Expiration, eligible plan IDs, status, and safe audit summary

### PaymentsOverview

- Reporting period and freshness
- Currency-separated successful, failed, refunded, disputed, and pending values
- Provider-status, failed-payment, trend, and reconciliation summaries
- Authoritative platform attribution

### PaymentEventListItem

- Safe event ID, `MaskedCustomer`, safe subscription ID
- Event type, `Money`, provider label, status
- Received/processed timestamps, retry count, platform attribution

### PaymentEventDetail

- Event list fields
- Processing timeline
- `SanitizedPaymentPayloadPreview`
- Related safe subscription reference
- Safe error and retry history
- Planned audit references

### SanitizedPaymentPayloadPreview

Only:

- Safe event ID, event type, status
- Received and processed timestamps
- Amount and currency
- Safe subscription reference
- Retry count
- Safe provider error code and message

Unknown fields are rejected or stripped at the mock boundary and never rendered.

### FailedPaymentItem

- Safe failure ID and `MaskedCustomer`
- Plan, failed `Money`, safe reason
- Attempt count, next retry, notification state
- Platform attribution, status, resolution eligibility, expected-state token

### BillingReconciliationItem

- Safe issue ID
- Internal and provider subscription statuses
- Plain-text difference and recommended action
- Severity, age, optional safe currency impact
- Platform attribution, provider freshness, status, resolution eligibility, and
  expected-state token

## Mutation models

### SubscriptionActionRequest

- `action`: `change_plan | set_cancel_at_period_end |
  clear_cancel_at_period_end | resume | record_internal_note`
- Required reason and confirmation token
- Expected current state
- Target plan only for `change_plan`
- Effective timing when relevant
- Sanitized note only for `record_internal_note`

### FailedPaymentActionRequest

- `action`: `mark_reviewed | prepare_retry_handoff |
  record_customer_contact_handoff | mark_provider_recovered`
- Required reason, scope, expected current state, and confirmation token

### ReconciliationActionRequest

- Allowlisted mock decision
- Required reason, expected issue state, provider freshness, and confirmation
  token

### BillingActionResult

- Affected safe ID
- Previous and current state
- `simulated_success | conflict | forbidden | rejected`
- Timestamp, safe message, optional conflict metadata, planned audit reference

## State transitions

### Subscription

`trialing -> active`  
`active -> cancel_at_period_end -> cancelled`  
`cancel_at_period_end -> active` when cancellation is cleared  
`past_due -> active` only through the simulated eligible resume/recovery state  
`cancelled | expired | suspended` reject incompatible actions

Plan changes preserve the subscription identity and record a mock history entry.
All transitions require permission, confirmation, a pending lock, and matching
expected state.

### Promotional code

`draft -> active -> expired | exhausted | disabled`

Expired, exhausted, or disabled codes cannot be silently reactivated; invalid
date, discount, limit, duplicate code, or inactive-plan combinations fail
validation.

### Payment event

`received -> pending -> processed | failed | ignored`  
`failed -> retrying -> processed | failed`

These are provider-derived display states in this frontend phase, not editable
payment processing.

### Failed payment

`open -> reviewed | retry_handoff_prepared |
customer_contact_handoff | provider_recovered -> resolved`

Already resolved or stale records return conflict and remain unchanged.

### Reconciliation issue

`open -> reviewing -> resolved | blocked`  
Any state may become `stale` when provider freshness expires.

Stale provider data prevents a success result until refreshed.

## Validation invariants

- Presentation code never imports fixture arrays.
- Every response is parsed before use.
- Search length, page size, sort keys, identifiers, reasons, codes, amounts,
  discounts, limits, and date ranges are bounded.
- Unique totals are never derived from overlapping platform segments.
- AED and SAR are never silently combined.
- Masked-customer and sanitized-preview schemas reject privacy violations.
- Mutation state changes occur only after validated permission, confirmation,
  expected-state, and duplicate-submission checks.
