# Research: Spec 008 Security, Audit, and Data Privacy Requests

## Decision 1: Use one security feature boundary

**Decision**: Add one `src/features/security` boundary with focused Security,
Audit, and Privacy view files.

**Rationale**: The three areas share identifiers, risk/status presentation,
masked projections, immutable evidence, expected revisions, audit references,
permissions, and safe errors. One boundary avoids three copies of the same
repository, hooks, query parsing, and mutation plumbing.

**Alternatives considered**: Separate feature packages for every navigation
group; extending unrelated access or communications features; one monolithic
view file.

## Decision 2: Reuse implemented Admin foundations

**Decision**: Reuse the current API client, safe error model, role simulation,
route permission resolver, TanStack Query patterns, locked-mutation helper,
approved Admin components, and MSW registry.

**Rationale**: Specs 001–007 already exercise these boundaries. Reuse preserves
the approved interface and avoids a second permission, lock, dialog, or state
system.

**Alternatives considered**: New libraries, a second API client, custom global
state, a workflow package, or a new modal/table framework.

## Decision 3: Separate immutable evidence from mutable workflow state

**Decision**: Keep authentication events, Admin posture, permission changes,
and audit events as immutable fixtures. Store only suspicious activity,
incidents, support-access grants, export requests, deletion requests, and
retention policies in resettable runtime memory.

**Rationale**: Only those six groups have Phase 7 actions. Avoiding copies of
read-only evidence makes audit immutability structural and reduces mutation
code.

**Alternatives considered**: One mutable store for every record; a generic
entity store; browser persistence.

## Decision 4: Use explicit transition functions, not a workflow engine

**Decision**: Implement one small transition function per mutable resource
using the clarified state tables, expected state/revision, and the existing
pending lock.

**Rationale**: Six short state machines are easier to review and test than a
configurable workflow abstraction. Exact domain rules remain visible.

**Alternatives considered**: A generic state-machine dependency, a schema-driven
workflow engine, or accepting any target state from the client.

## Decision 5: Use one injected deterministic clock

**Decision**: Inject a Phase 7 clock fixed to
`2026-07-30T12:00:00+03:00` in fixtures, handlers, and transition tests; use a
deterministic counter for planned audit references.

**Rationale**: Expiry, remaining time, scheduling, timestamps, and test reset
must not drift. The feature needs no production time source.

**Alternatives considered**: `Date.now()`, `Math.random()`, wall-clock timers,
or per-handler timestamps.

## Decision 6: Make permission projection structural

**Decision**: Validate role and action permission in each handler and return
full, own-access, linked-status, or denied schemas before serialization.

**Rationale**: Actor, signal, audit metadata, privacy request, and policy fields
must not reach unauthorized components. Structural omission is safer and
directly testable.

**Alternatives considered**: CSS hiding, component-only guards, or one
full-record schema with nullable sensitive fields.

## Decision 7: Keep audit metadata allowlisted and flat

**Decision**: Represent audit metadata and before/after summaries as bounded
allowlisted key/value rows of plain text.

**Rationale**: The approved journeys require readable evidence, not a general
JSON explorer. Flat rows remove recursive depth, syntax, HTML, and executable
payload risks.

**Alternatives considered**: Recursive JSON tree, syntax highlighter, raw
payload view, HTML/Markdown rendering, or `dangerouslySetInnerHTML`.

## Decision 8: Keep export scope metadata-only

**Decision**: Use the eight clarified `ExportScopeCategory` labels and never
include category contents in Phase 7 responses.

**Rationale**: Operators need scope, eligibility, lifecycle, and expiry—not the
archive itself. Omitting contents prevents accidental financial and personal
data exposure.

**Alternatives considered**: Sample archive previews, field selectors, real
download URLs, Blob generation, or local file export.

## Decision 9: Make simulated download incapable of transferring data

**Decision**: Return only `allowed`, `expiresAt`, and a mock-only message for an
unexpired Ready request.

**Rationale**: The result proves eligibility behavior without creating a URL,
token, bytes, Blob, network request, filesystem write, or browser-stored data.

**Alternatives considered**: Data URLs, object URLs, generated ZIP files,
signed-link placeholders, or downloadable JSON.

## Decision 10: Treat policy and security values as authoritative

**Decision**: Risk scores/signals, legal holds, allowed transitions, export and
deletion eligibility, retention bounds, and protected audit minimums arrive as
validated contract values.

**Rationale**: The browser has neither security nor legal authority. Local
derivation could misclassify risk or permit a destructive action.

**Alternatives considered**: Client-side risk formulas, hard-coded legal
policy, inferred holds, or locally computed eligibility.

## Decision 11: Preserve platform semantics explicitly

**Decision**: Filter attributable events and sessions by All/iOS/Android/
Unknown. Keep global Admin/audit/policy records unsplit. Use authoritative
deduplicated unique-customer totals.

**Rationale**: This prevents invented attribution and double-counting customers
who use both mobile platforms.

**Alternatives considered**: Force every record into a platform, add iOS and
Android customer counts, or infer platform from device ownership.

## Decision 12: Test at the smallest useful layer

**Decision**: Use Vitest for contracts, transitions, projections, repository/
handler behavior, and components; use Playwright for primary journeys, route
permissions, audit immutability, privacy exclusions, keyboard/focus, direction,
performance, and five viewports.

**Rationale**: State and schema permutations are faster and clearer below the
browser, while Playwright still proves user-visible integration.

**Alternatives considered**: Snapshot-only tests, duplicating every schema case
in Playwright, or adding another test framework.

## Decision 13: Keep route permissions flat and specific

**Decision**: Register dynamic and specific Phase 7 route matches before broad
`/admin/security`, `/admin/audit`, and `/admin/data-requests` prefixes.

**Rationale**: This matches the existing boolean route guard and prevents a
broad read permission from granting a more sensitive detail or mutation view.

**Alternatives considered**: Replacing the route guard, projection-aware route
authorization, or route-level role conditionals.

## Decision 14: Add no new dependency

**Decision**: Use only installed Next.js, React, Zod, TanStack, MSW, Vitest,
Playwright, Recharts, Lucide, React Hook Form, and Tailwind capabilities.

**Rationale**: The feature needs no JSON viewer, state machine, date library,
archive utility, sanitizer, or security SDK.

**Alternatives considered**: New packages for workflows, JSON display, dates,
downloads, state, or mock generation.

## Decision 15: Remove protected query data on role change

**Decision**: Extend the existing simulated-role event boundary so the shared
TanStack Query client removes in-memory query data immediately when the
development role changes. Keep Phase 7 query keys role-scoped as a second
guard.

**Rationale**: The current role switch updates session storage but does not
clear cached responses. A newly selected lower-privilege role must not inherit
previously authorized security, audit, or privacy-request data in memory or on
screen.

**Alternatives considered**: Role-scoped keys alone, waiting for cache expiry,
component-local cleanup, or persisting a separate cache per role.

## Decision 16: Use the existing request boundary for one PATCH

**Decision**: Call the already exported `requestJson()` with
`method: "PATCH"` for retention-policy update.

**Rationale**: The shared API module already supports arbitrary request methods.
Adding a new client convenience method for one Phase 7 call provides no safety
or reuse benefit.

**Alternatives considered**: Add `apiClient.patch`, change the contract to
POST, or create a feature-specific fetch wrapper.

## Governance note

The constitution’s narrative delivery list contains legacy phase labels. The
approved master ten-spec map, active feature pointer, existing Specs 001–007,
and explicit user instruction all identify this work as Phase 7 / Spec 008.
Planning follows the exact approved `008-admin-security-audit-and-privacy`
scope; changing constitution wording requires a separate amendment and is not
part of this feature.

## Resolved Unknowns

The clarified specification, constitution, current source patterns, and
decisions above resolve all planning questions. No unresolved planning marker
remains.
