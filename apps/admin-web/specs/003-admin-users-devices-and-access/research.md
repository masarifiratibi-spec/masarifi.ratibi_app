# Research: Users, Devices, Sessions, and Controlled Access

**Phase / Spec**: Phase 2 / Spec 003  
**Date**: 2026-07-28  
**Status**: Complete — no unresolved clarification remains

## Decision 1: Extend the existing Users implementation in place

**Decision**: Preserve `/admin/users`, its current visual hierarchy, and its
`src/features/users` contracts/repository/hooks. Add only the full detail route
and approved access routes.

**Rationale**: The approved list already has masked records, filters,
pagination, responsive cards, a summary drawer, and a typed repository/MSW
boundary. Extending it is safer than replacing it or creating a parallel users
module.

**Alternatives considered**:

- Replace the Users page: rejected because it risks the approved design.
- Create `customer-operations` beside `users`: rejected because it duplicates
  the existing feature and contracts.

## Decision 2: Separate controlled access from ordinary user operations

**Decision**: Add `src/features/access` for access-request and workspace
contracts, hooks, repository, and feature views.

**Rationale**: Access has a distinct lifecycle, separation-of-duty rule,
assignee binding, scope allowlist, expiry boundary, and cache purge behavior.
Keeping it inside a focused feature avoids bloating the already broad users
contract while retaining a direct dependency on privacy-safe user summaries.

**Alternatives considered**:

- Put everything in `features/users`: rejected because access lifecycle and
  expiry rules would become hard to isolate and test.
- Create separate features for requests and workspace: rejected as unnecessary
  fragmentation; they share one lifecycle and repository.

## Decision 3: Keep the existing quick drawer and add a detail route

**Decision**: Retain the current summary drawer on `/admin/users` and link it to
`/admin/users/[userId]` for Overview, Devices, and Sessions.

**Rationale**: The drawer preserves the approved quick-triage interaction. A
route is required for deep linking, independent region states, permissions,
actions, and responsive operation.

**Alternatives considered**:

- Put all Phase 2 content in the drawer: rejected because it creates an
  inaccessible, overloaded surface.
- Remove the drawer: rejected because it changes approved behavior.

## Decision 4: Use independent profile, device, and session queries

**Decision**: Give each region a stable TanStack Query key and repository
method.

**Rationale**: Partial failure must not blank unrelated customer context.
Independent queries also permit granular permissions and targeted invalidation
after device/session actions.

**Alternatives considered**:

- One large customer response: rejected because it couples permissions,
  loading, errors, and mutations.
- Request each table row separately: rejected because the detail page already
  provides the correct boundary.

## Decision 5: Make customer membership authoritative and device totals additive

**Decision**: Store explicit registered platforms and platform device counts on
each user contract. Filter membership from those values; validate but do not
invent authoritative customer totals.

**Rationale**: A multi-platform customer belongs to both platform filters but
must appear only once in All Platforms. Device totals may be summed because
devices are distinct records.

**Alternatives considered**:

- Use only `primaryPlatform`: rejected because it hides multi-platform users.
- Add iOS and Android customer counts: rejected because it double-counts
  shared customers.

## Decision 6: Infer user and access types from Zod schemas

**Decision**: Treat `features/users/contracts.ts` and
`features/access/contracts.ts` as the Phase 2 type source of truth.

**Rationale**: The constitution requires validation at trust boundaries and no
`any`. Inferred types prevent drift between forms, repositories, handlers, and
components.

**Alternatives considered**:

- Maintain parallel handwritten interfaces: rejected because they can diverge.
- Generate code from OpenAPI now: rejected because no generator is installed
  and it adds tooling without current value.

## Decision 7: Reuse existing form, confirmation, and lock foundations

**Decision**: Use installed React Hook Form with Zod, existing
`ConfirmDialog`, and existing `useLockedMutation`.

**Rationale**: These cover accessible form errors, scoped confirmation,
planned audit context, pending state, and duplicate-submission prevention
without new dependencies or patterns.

**Alternatives considered**:

- Hand-roll form state for every action: rejected because validation and
  accessibility would be duplicated.
- Add a workflow/form library: rejected because the installed stack is
  sufficient.

## Decision 8: Use one resettable in-memory mock state

**Decision**: Add `src/mocks/phase2-state.ts` with cloned fictional user,
device, session, and access-request records plus `resetPhase2MockState()`.

**Rationale**: Multi-step actions and access decisions must affect subsequent
mock reads. A small module-local state object is enough, stays behind MSW, and
can be reset between unit tests.

**Alternatives considered**:

- Browser storage: rejected because temporary/sensitive data must not persist.
- Add a mock database/server: rejected as backend implementation and needless
  complexity.
- Return success without state change: rejected because subsequent reads would
  contradict the action.

## Decision 9: Enforce access transitions in schemas and handlers

**Decision**: Use the explicit transition table from the specification and
validate decisions against current state, requester, approver, requested scope,
and requested duration.

**Rationale**: Hidden buttons alone cannot demonstrate a controlled workflow.
The mock boundary must also reject invalid transitions, self-approval, scope
expansion, duration expansion, and duplicate overlap.

**Alternatives considered**:

- UI-only transition checks: rejected as a broken access-control assumption.
- Generic free-form status updates: rejected because they allow invalid states.

## Decision 10: Use an allowlisted workspace projection

**Decision**: Workspace responses contain only sections derived from approved
scope values: profile contact, account status, device diagnostics, session
diagnostics, subscription summary, and import summary.

**Rationale**: An allowlist prevents omitted UI controls from becoming the only
privacy boundary. Values remain masked or aggregated even when a section is
approved.

**Alternatives considered**:

- Return the full customer record and hide fields: rejected because protected
  values would still reach the browser.
- Accept arbitrary scope strings: rejected because they cannot be validated or
  safely projected.

## Decision 11: Use authoritative expiry with one scheduled timeout

**Decision**: The response supplies an absolute `expiresAt`; the workspace
schedules one timeout, rechecks on focus/visibility, and relies on protected
handler checks for every read/mutation. Expiry removes the workspace query
cache and clears local input.

**Rationale**: This meets the five-second removal outcome without a polling
framework or noisy per-second assistive announcements.

**Alternatives considered**:

- Client-only countdown: rejected because client state alone is not a trust
  boundary.
- One-second refetch polling: rejected because it is unnecessary load and can
  produce accessibility noise.

## Decision 12: Expand the existing permission simulation granularly

**Decision**: Add the exact Phase 2 permission keys to the current
`PERMISSION_KEYS` and seven-role map. Apply route gates and action gates. Map
each role to one stable fictional Admin actor ID for deterministic mock
requester/approver/assignee checks.

**Rationale**: `users.read` alone cannot express device revocation,
verification, access approval, self-service end access, or separation of
duties.

**Alternatives considered**:

- Treat role names as permissions in components: rejected because it scatters
  policy and makes future adapter replacement harder.
- Add production authentication: rejected as outside the frontend-only phase.

## Decision 13: Keep selection page-scoped and bounded

**Decision**: Bulk payloads contain deduplicated explicit user IDs from the
current page and enforce a maximum of 100.

**Rationale**: This matches the existing page-size ceiling and prevents an
ambiguous “all filtered results” action. Partial results remain safe and
understandable.

**Alternatives considered**:

- Select all filtered results across pages: rejected because scope can change
  invisibly and requires backend snapshot semantics.
- Unlimited payloads: rejected because they are not needed for the prototype.

## Decision 14: Add no dependencies

**Decision**: Use the installed framework, forms, validation, query, table,
icons, mocks, and test stack.

**Rationale**: The existing stack covers every Phase 2 requirement. A new
package would increase risk without reducing the implementation.

**Alternatives considered**:

- Add a date/countdown library: rejected; ISO timestamps and platform time
  functions are sufficient.
- Add a state machine library: rejected; the access transition table is small
  and explicit.

## Decision 15: Split verification by risk

**Decision**: Use Vitest for contracts, repository behavior, permissions,
transition rules, scope projections, mutation locks, and expiry cleanup. Use
Playwright for complete role, platform, action, temporary-access, keyboard,
direction, theme, and viewport journeys.

**Rationale**: Fast tests cover invariants and unsafe inputs; browser tests
cover visible operator behavior and accessibility. Existing full-project
checks remain the final gate.

**Alternatives considered**:

- Browser-only coverage: rejected because contract/state failures would be
  slower and harder to diagnose.
- Unit-only coverage: rejected because dialogs, focus, routing, expiry, and
  responsive behavior require browser evidence.

## Resolved Environment

- Next.js 16.2.11 with App Router
- React 19.2.8
- TypeScript 5.9.3 strict mode
- Tailwind CSS 4.3.3
- TanStack Query 5.101.4
- TanStack Table 8.21.3
- React Hook Form 7.83.0
- Zod 4.4.3
- Lucide React 1.26.0
- Mock Service Worker 2.15.0
- Vitest 4.1.10
- Playwright 1.62.0
- No dependency addition or upgrade
- No unresolved clarification
