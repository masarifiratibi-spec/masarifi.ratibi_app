# Research: Spec 006 AI Management and Automation Intelligence

## Decision 1: Use one AI feature boundary

**Decision**: Add one `src/features/ai` boundary with contracts, repository,
hooks, and a few cohesive views for all ten Phase 5 routes.

**Rationale**: The routes share provider/model/prompt identifiers,
authoritative classifications, platform/cost semantics, permissions, safe
projections, query keys, and mutation state. One boundary matches the existing
feature architecture without route-per-folder duplication.

**Alternatives considered**: Separate provider, prompt, usage, and safety
feature packages; one component per route; or one giant view. Each adds
coordination, boilerplate, or review cost without current ownership needs.

## Decision 2: Reuse current Admin and data patterns

**Decision**: Reuse the Admin shell, navigation fixtures, route permission
resolver, typed API client, TanStack Query hooks, locked mutation helper,
shared tables/charts/dialogs/states, MSW registry, safe errors, and role
simulation.

**Rationale**: These patterns already support completed Specs 001-005 and
provide the required visual continuity, permission UX, validation, conflict
handling, and accessibility.

**Alternatives considered**: A new API client, state library, permission
system, table/chart wrapper, modal system, or mock server. None adds needed
capability.

## Decision 3: Use the existing versioned endpoint prefix

**Decision**: Realize the logical Spec 006 contracts under
`/api/v1/admin/ai/...`.

**Rationale**: Existing repositories and prior contracts use the versioned
Admin prefix. Keeping it avoids a second routing convention while preserving
the same request and response behavior defined by the spec.

**Alternatives considered**: Unversioned `/api/admin/ai/...` paths or a
parallel AI-only base URL. Both create avoidable inconsistency.

## Decision 4: Treat operational classifications as authoritative

**Decision**: Provider health, report severity, failure impact, action
eligibility, normalized cost, request counts, prompt test outcomes, and safety
coverage arrive as validated contract values.

**Rationale**: The browser lacks provider telemetry, policy context, complete
request history, and exchange-rate authority. Client-derived thresholds could
create false operational conclusions.

**Alternatives considered**: Local thresholds, cost conversion, client-side
health scoring, and recomputing eligibility from displayed fields.

## Decision 5: Separate original requests from attempts

**Decision**: Count one original AI request once and expose retries and
fallback attempts as separate values/records.

**Rationale**: Request volume, failure rate, fallback usage, and cost use
different denominators. Combining them inflates usage and obscures reliability.

**Alternatives considered**: Counting every provider attempt as a request or
deduplicating by client-side heuristics.

## Decision 6: Scope fallback by feature and locale

**Decision**: Configure fallback chains per AI feature and locale, independent
of mobile platform, with unique priorities and at least one eligible terminal
provider/model route.

**Rationale**: Provider/model compatibility and prompt language determine
routing. Mobile platform is reporting context and does not justify duplicate
chains.

**Alternatives considered**: One global chain, separate iOS/Android chains, and
unstructured provider priority lists.

## Decision 7: Keep raw AI content outside the frontend

**Decision**: Usage and failure models contain metadata only. Response reports
may receive one future-backend-sanitized allowlisted excerpt capped at 280
Unicode characters. Raw prompts, conversations, responses, and provider
payloads never enter frontend contracts.

**Rationale**: Structural exclusion is safer and more testable than receiving
sensitive data and hiding it in components.

**Alternatives considered**: Client-side redaction, expandable raw
conversations, denylists, and generic JSON viewers.

The 280-character bound is measured as Unicode code points, not UTF-16 code
units, so surrogate pairs cannot bypass or incorrectly consume the limit.

## Decision 8: Keep prompt and safety definitions declarative

**Decision**: Represent prompt variables/schema summaries/tests and safety
conditions/outcomes as bounded allowlisted data.

**Rationale**: The frontend manages mock configuration; it does not need an
execution environment. Declarative data supports validation and safe display.

**Alternatives considered**: Code editors, dynamic expressions, arbitrary JSON,
client-side prompt execution, and client-side safety enforcement.

## Decision 9: Preserve immutable prompt history

**Decision**: Use `draft -> testing -> active -> retired`, one Active version
per feature/locale, required-test gating, and rollback by creating a new Draft.

**Rationale**: Immutable history makes simulated decisions auditable and avoids
changing released versions in place.

**Alternatives considered**: Editing Active versions, reopening Retired
versions, or activating with failed required tests.

## Decision 10: Keep mock mutations in runtime memory

**Decision**: Store cross-route mock changes in one deterministic Phase 5
runtime-state module with expected revisions and pending locks.

**Rationale**: Runtime-only state supports realistic conflicts while preventing
AI data, configuration drafts, and review notes from entering browser storage.

**Alternatives considered**: Local storage, session storage, IndexedDB,
filesystem persistence, Supabase, or a backend database.

## Decision 11: Use structural permission projections

**Decision**: Handlers return full, aggregate, context, or denied projections
according to the simulated role; components do not receive protected fields
and merely hide them.

**Rationale**: This makes privacy and permission behavior testable even when a
mock endpoint is called directly.

**Alternatives considered**: UI gating only or one full response shape for all
roles.

## Decision 12: Verify at the smallest useful layer

**Decision**: Use Vitest for contracts, repository/hooks, graph/lifecycle
invariants, runtime state, and components; use Playwright for cross-route
journeys, permissions, accessibility, direction, performance outcomes, and
responsive/runtime checks.

**Rationale**: This matches the installed stack and keeps schema logic out of
slow browser tests while preserving end-to-end confidence.

**Alternatives considered**: A new test framework, snapshot-only tests, or
duplicating all contract cases in Playwright.

## Resolved Unknowns

All planning questions are resolved by the clarified specification,
constitution, prior implemented phases, and decisions above. No
planning clarification remains.
