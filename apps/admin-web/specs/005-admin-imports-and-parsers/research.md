# Research: Spec 005 Imports and Parser Management

## Decision 1: Preserve and extend the approved import page

**Decision**: Keep `/admin/imports` and extend its current contracts,
repository, hooks, fixtures, handlers, and view in place.

**Rationale**: The route is already approved, tested, linked from navigation,
and visually consistent. A replacement page would duplicate behavior and risk
design regression.

**Alternatives considered**: A second import overview route or a complete page
rewrite. Both were rejected because they provide no user value and would violate
the preservation constraint.

## Decision 2: Keep one existing import feature boundary

**Decision**: Keep import operations and parser management in
`src/features/imports`, using a few cohesive grouped view files.

**Rationale**: Both areas share contracts, permissions, safe identifiers, mock
state, and operational handoffs. Reusing the current boundary avoids a second
feature package while grouped views prevent one oversized component.

**Alternatives considered**: A new `features/parsers` package, one giant view,
and a feature folder per route. Each adds either cross-feature coordination,
review cost, or duplicated contracts/hooks without current ownership needs.

## Decision 3: Trust authoritative event and review metadata

**Decision**: Render combined totals, deduplication state, confidence, review
eligibility, match scores, and parser test outcomes supplied by the contract.

**Rationale**: The browser cannot reliably distinguish original events from
retries/replays or reproduce backend confidence/deduplication logic.

**Alternatives considered**: Adding iOS/Android event cards in components,
client-side deduplication, and client-computed confidence. All risk false
operational conclusions.

## Decision 4: Use positive allowlists for previews

**Decision**: Session and unsupported-format previews allow only source, masked
bank/sender, transaction direction/type, ISO currency, coarse date, masked
merchant/category, confidence, warnings, and omission labels. Customer-derived
amounts remain masked. Full normalized values appear only in explicitly
fictional parser-test samples.

**Rationale**: A positive allowlist makes accidental raw-content and financial
exposure testable and prevents new backend fields from appearing automatically.

**Alternatives considered**: Raw structured-data viewers and field denylists.
Both can leak unknown sensitive fields.

## Decision 5: Keep parser rules declarative and bounded

**Decision**: Model rule definitions as allowlisted match, capture,
normalization, and output-mapping operations with the clarified size limits.

**Rationale**: The Admin frontend needs to represent future parser
configuration, not execute code. Bounded declarative data supports validation,
preview fixtures, and safe rendering.

**Alternatives considered**: JavaScript editors, dynamic expressions, arbitrary
JSON, shell-backed tests, and client-side parser execution. They create an
unnecessary execution boundary and are outside frontend scope.

## Decision 6: Preserve parser-version history

**Decision**: Use `draft -> testing -> active -> retired`, allow one active
version per declared scope, require all enabled mandatory tests to pass, and
model rollback as a new draft cloned from prior configuration.

**Rationale**: Immutable history keeps the simulated operational timeline
auditable and avoids rewriting a released version.

**Alternatives considered**: Reopening a retired version, editing an active
version in place, and activating with partial mandatory-test success.

## Decision 7: Keep mock mutations in runtime memory

**Decision**: Store simulated Phase 4 changes in one deterministic MSW
runtime-state module where cross-flow state is required.

**Rationale**: Runtime-only state matches the clarified reset behavior and
prevents imported content, drafts, identifiers, or operational decisions from
entering browser storage.

**Alternatives considered**: Local storage, session storage, IndexedDB, files,
Supabase, and a backend database. All add prohibited persistence.

## Decision 8: Reuse existing state, permission, and error patterns

**Decision**: Extend the current permission key/role map, API client,
`useLockedMutation`, shared scenario handler, access-denied state, region
states, confirmations, and safe error normalization.

**Rationale**: These patterns already work across completed specs and provide
the required UX-only permission, pending-lock, and safe-error behavior.

**Alternatives considered**: A second API client, state library, permission
system, error format, or confirmation component.

## Decision 9: Carry the simulated role to mock handlers

**Decision**: Add an allowlisted development-only simulated-role request header
beside the existing mock-scenario header and validate it in Phase 4 handlers.

**Rationale**: Direct mock mutation requests must return forbidden when the
simulated role lacks permission. Passing role through every public hook and
repository call would leak development concerns across feature contracts.

**Alternatives considered**: UI gating only, which cannot protect direct mock
requests, and adding role to every mutation payload, which is noisier and could
be mistaken for production authorization.

## Decision 10: Use one replaceable OpenAPI contract

**Decision**: Document import and parser mock endpoints in
`contracts/admin-imports-parsers.openapi.yaml`, with reusable safe identifiers,
pagination, errors, action results, and strict read-model schemas.

**Rationale**: One contract records the intentional cross-flow relationship
while preserving separate frontend repositories. It is directly replaceable by
future NestJS routes.

**Alternatives considered**: Undocumented fixture shapes and separate
per-screen contract files. Both increase drift.

## Decision 11: Verify behavior at the smallest useful layer

**Decision**: Use Vitest for contracts, repositories, hooks, state transitions,
and component behavior; use Playwright for cross-route journeys, permissions,
accessibility, direction, and responsive/runtime checks.

**Rationale**: This matches the installed mandated stack and avoids duplicating
browser journeys in component tests or schema cases in Playwright.

**Alternatives considered**: Adding another test framework, snapshot-only
coverage, or testing mock fixtures without exercising production schemas.

## Resolved Unknowns

All planning questions are resolved by the clarified specification,
constitution, full product plan, existing Admin Web implementation, and the
decisions above. No planning question remains open.
