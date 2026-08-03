# Research: Spec 004 Admin Revenue and Billing

## Decision 1: Use one billing feature boundary

**Decision**: Place subscriptions, plans, promotions, payments, failures, and
reconciliation in `src/features/billing`.

**Rationale**: These screens share financial types, permissions, provider-state
semantics, mutation safeguards, and one mock data boundary. Separate packages
would duplicate configuration and add no current isolation benefit.

**Alternatives rejected**: A feature folder per route and a new shared billing
package. Both are premature for one Admin Web application.

## Decision 2: Keep simulated changes in MSW runtime memory

**Decision**: Store mutable mock records only in an in-memory Phase 3 mock-state
module.

**Rationale**: This matches the clarified reset behavior and prevents sensitive
billing drafts or customer-linked values from entering browser storage.

**Alternatives rejected**: `localStorage`, `sessionStorage`, IndexedDB, files,
and databases because persistence is explicitly out of scope.

## Decision 3: Trust contract aggregates, not browser arithmetic

**Decision**: Render platform totals, unique subscription counts, and revenue
aggregates supplied by the typed mock API.

**Rationale**: A multi-platform customer may appear in iOS and Android segments.
Adding those segment values would double-count unique subscriptions and revenue.
The future backend owns deduplication and financial calculation.

**Alternatives rejected**: Summing platform cards or deduplicating customer
records in components.

## Decision 4: Keep currencies explicit

**Decision**: Model monetary values as amount plus ISO currency and present AED
and SAR separately unless a normalized aggregate arrives with an explicit
normalization label.

**Rationale**: A numeric sum across currencies is misleading and violates the
specification.

**Alternatives rejected**: Client-side conversion and unlabeled mixed totals.

## Decision 5: Allowlist the provider preview

**Decision**: Validate a flattened preview containing only safe event ID, event
type, status, timestamps, amount, currency, safe subscription reference, retry
count, and safe provider error code/message.

**Rationale**: A positive allowlist prevents accidental exposure of provider
payloads, signatures, tokens, card data, and personal data.

**Alternatives rejected**: Rendering raw JSON and removing known secret keys.
A denylist cannot anticipate every sensitive provider field.

## Decision 6: Model sensitive operations as confirmed mock actions

**Decision**: Use explicit action unions, Zod validation, expected-current-state
checks, confirmation tokens, a pending lock, and safe conflict responses.

**Rationale**: The action set stays bounded, double submissions are prevented,
and stale views cannot report false success.

**Alternatives rejected**: Generic patch endpoints, optimistic financial
mutations, and real provider operations.

## Decision 7: Reuse the installed verification stack

**Decision**: Use Vitest for schemas/repositories/components and Playwright for
route journeys, permissions, keyboard behavior, RTL, and responsive checks.

**Rationale**: The tools already exist and are mandated by the constitution.

**Alternatives rejected**: Adding another test, state, form, chart, or UI
library. No dependency is needed.

## Resolved Unknowns

All planning questions are resolved by the specification, constitution, full
product plan, and existing Admin Web patterns. No planning question remains
open.
