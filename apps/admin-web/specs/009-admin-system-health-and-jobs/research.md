# Research: Spec 009 System Health, External Providers, Jobs, and Queues

## Decision 1: Extend the existing System Health boundary

**Decision**: Expand `src/features/system-health` to own all Phase 8 contracts,
repository methods, hooks, and focused views.

**Rationale**: The repository already contains an approved System Health route,
typed repository, hook, fixture, handler, and test. Extending them avoids a
second operations client and preserves the approved page.

**Alternatives considered**: Add a separate `operations` feature; create a
standalone `jobs` feature; replace the existing route.

## Decision 2: Keep route files thin and use two view files

**Decision**: Use `OperationsViews.tsx` for read-only operational routes and
`JobRunDetailView.tsx` for the only action-bearing detail route.

**Rationale**: Nine route files are required, but their presentation shares
filters, region states, freshness, tables/cards, and chart summaries. Two
focused view files avoid both route duplication and a page-framework abstraction.

**Alternatives considered**: One component file per route; one monolithic
route file; a schema-driven dashboard renderer.

## Decision 3: Use the existing versioned endpoint prefix

**Decision**: Realize the specification's logical contracts under
`/api/v1/admin/system-health/...` and `/api/v1/admin/jobs/...`.

**Rationale**: Every implemented Admin repository and the newer Spec 007/008
OpenAPI artifacts use `/api/v1/admin`. The specification explicitly identifies
its paths as proposed frontend contracts, so normalization preserves one client convention.

**Alternatives considered**: Add parallel unversioned `/api/admin` handlers;
change the shared API client; support both prefixes.

## Decision 4: Replace the legacy refresh mutation with query refetch

**Decision**: Remove use of POST `/system-health/refresh`. Manual refresh calls
TanStack Query refetch; read-only queries use a 60-second interval while visible
and online, paused during a pending action dialog.

**Rationale**: Refreshing fictional observations is a read concern, not a job
mutation. Existing TanStack Query behavior already pauses background polling,
so a custom refresh service would add code without value.

**Alternatives considered**: Keep the POST refresh endpoint; add a global timer;
build a monitoring subscription or WebSocket simulation.

## Decision 5: Keep the operational range local to Phase 8

**Decision**: Add a small Phase 8 control for `1h | 24h | 7d | 30d` using
existing segmented-control styles.

**Rationale**: The shared date-range control uses `7d | 30d | 90d | custom`
and date-only values for other modules. Changing it would create unrelated
behavior changes and still would not model hour-based monitoring ranges.

**Alternatives considered**: Expand the global control; translate 1h/24h into
custom dates; add a date library.

## Decision 6: Treat health and operational policy as authoritative

**Decision**: Health status, impact, fallback state, queue thresholds, action
eligibility, deduplicated customer impact, `observedAt`, and `staleAt` arrive as
validated contract values.

**Rationale**: The browser cannot establish monitoring truth or operational
policy. Client inference could report healthy from partial data, misclassify a
backlog, or permit an unsafe job action.

**Alternatives considered**: Worst-card rollup in the browser; fixed local
backlog thresholds; client freshness durations; calculated retry eligibility.

## Decision 7: Separate immutable observations from minimal mutable state

**Decision**: Keep service, provider, endpoint, database, storage, schedule,
and initial job observations in immutable fixtures. Put only job retry/cancel
changes, revisions, linked attempts, and audit references in one resettable
Phase 8 state module.

**Rationale**: Only two operations mutate in Phase 8. A general telemetry store
or browser persistence would enlarge the state surface without serving a requirement.

**Alternatives considered**: Mutable state for every metric; a generic entity
store; browser storage; a state-management dependency.

## Decision 8: Derive queue summaries from job state

**Decision**: Compute queue counters, retry counts, and oldest-waiting age from
the current deterministic job-run state plus immutable range history.

**Rationale**: Retry and cancellation change both a run and its queue summary.
Derivation prevents two independently mutable fixtures from disagreeing.

**Alternatives considered**: Patch queue counters in each action; keep static
queue totals; duplicate one state record per view.

## Decision 9: Model retry as a linked new run

**Decision**: Preserve the Failed source run, create exactly one Waiting run
with `attempt + 1` and `retryOfJobRunId`, and count it as Retried for the
selected range. Retried is not a lifecycle state.

**Rationale**: This matches the clarified specification and existing AI
attempt semantics while retaining accurate operational history.

**Alternatives considered**: Change Failed to Waiting; overwrite the existing
attempt; add a Retrying state; clone the entire input payload.

## Decision 10: Use explicit job transition functions

**Decision**: Implement one retry function and one cancellation function using
allowed state, permission, expected version, bounded reason, submission lock,
and deterministic audit output.

**Rationale**: Two short transitions are clearer and safer than a generic
workflow engine or accepting a requested target state.

**Alternatives considered**: State-machine dependency; generic action reducer;
client-only optimistic state changes.

## Decision 11: Use one deterministic clock and counters

**Decision**: Inject a fixed Phase 8 clock and deterministic counters for new
run IDs, revisions, timestamps, and planned audit references.

**Rationale**: Freshness boundaries, duration, ordering, retry lineage, and
reset tests must not drift or become flaky.

**Alternatives considered**: `Date.now()`, `Math.random()`, wall-clock timers,
or per-handler timestamps.

## Decision 12: Make permission projection structural

**Decision**: Handlers return full, domain-scoped, linked-status, or denied
response shapes based on the simulated role and queue/provider assignment.

**Rationale**: Topology, error, provider, job, schedule, and metadata fields
must not reach unauthorized components. Structural omission is directly testable.

**Alternatives considered**: Component-only guards; CSS hiding; full objects
with nullable protected fields.

## Decision 13: Keep diagnostics flat and allowlisted

**Decision**: Represent endpoint groups, query groups, input summaries, errors,
timelines, and audit expectations as bounded plain-text fields or flat
allowlisted key/value entries.

**Rationale**: Operators need safe diagnostic summaries, not raw logs or a
general JSON explorer. Flat metadata eliminates recursive rendering and secret leakage paths.

**Alternatives considered**: Raw JSON, recursive viewer, syntax highlighting,
HTML/Markdown rendering, provider payload previews, or log streaming.

## Decision 14: Preserve global and mobile-attributable semantics

**Decision**: Keep infrastructure and provider availability global. Apply
All/iOS/Android only to contract-attributed impact, job, failure, import, and
notification metrics; keep Unknown explicit and use authoritative deduplicated
customer totals.

**Rationale**: Platform filtering must not invent separate databases or
providers or double-count customers who use both platforms.

**Alternatives considered**: Split every metric by platform; infer platform
from queue name; add iOS and Android customer totals.

## Decision 15: Keep schedules and provider configuration read-only

**Decision**: Expose schedule, provider health, and fallback status with GET
contracts only. Add no run-now, enable/disable, provider setup, queue pause,
drain, purge, priority, or concurrency operation.

**Rationale**: The specification requires visibility and only names retry and
cancel as actions. Configuration belongs to prior AI/provider ownership or
future backend/Spec 010 controls.

**Alternatives considered**: Schedule editor; provider failover controls;
general BullMQ administration.

## Decision 16: Test at the smallest useful layer

**Decision**: Use Vitest for schemas, transitions, queue derivation,
projections, repository/handler behavior, refresh behavior, and components;
use Playwright for the six primary journeys, permissions, accessibility,
direction, performance, and five viewports.

**Rationale**: Contract and state permutations are faster below the browser,
while Playwright still proves route integration and operator outcomes.

**Alternatives considered**: Snapshot-only testing; duplicating every schema
case in Playwright; adding a test framework.

## Decision 17: Add no dependency

**Decision**: Use only installed Next.js, React, Zod, TanStack Query, MSW,
Vitest, Playwright, Recharts, Lucide, React Hook Form, Tailwind, and platform APIs.

**Rationale**: Existing capabilities cover polling, validation, charts,
dialogs, responsive views, state transitions, and safe text. No monitoring SDK,
date library, workflow engine, JSON viewer, or state library is needed.

**Alternatives considered**: Polling package; date package; state machine;
dashboard toolkit; JSON renderer.

## Governance note

The constitution's narrative delivery labels have drifted from the approved
ten-spec master mapping. The master document, active feature pointer, completed
Spec 008, and user instruction assign this exact scope to Phase 8 / Spec 009.
Correcting constitution wording requires separate approval and is not part of
this plan.

## Resolved Unknowns

The clarified specification, constitution, source audit, prior Spec Kit
artifacts, technical plan, and decisions above resolve every planning question.
No `NEEDS CLARIFICATION` marker remains.
