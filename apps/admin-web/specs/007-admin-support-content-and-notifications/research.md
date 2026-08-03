# Research: Spec 007 Support, Feedback, Content, and Notifications

## Decision 1: Use one communications feature boundary

**Decision**: Add one `src/features/communications` boundary for support,
feedback, content, templates, campaigns, and delivery logs.

**Rationale**: These domains share sanitized text, attachments, platform and
locale scope, permission projections, lifecycle actions, audit references, and
campaign/template relationships. One boundary avoids five parallel copies of
the same repository, hooks, query parsing, and action handling.

**Alternatives considered**: Separate packages for each navigation group; one
giant page component; extending unrelated existing features. Those choices add
boilerplate, coupling, or unclear ownership.

## Decision 2: Reuse the implemented Admin patterns

**Decision**: Reuse the current API client, safe error model, role simulation,
route permission resolver, TanStack Query patterns, locked mutation helper,
shared table/card/chart/dialog/state components, and MSW registry.

**Rationale**: Specs 001–006 already exercise these boundaries. Reuse preserves
the approved visual language and avoids a second state, permission, or dialog
system.

**Alternatives considered**: New libraries, a second API client, custom global
state, a new form/wizard framework, or a new modal system.

## Decision 3: Use the existing versioned Admin prefix

**Decision**: Realize all logical contracts under
`/api/v1/admin/{support|feedback|content|communications|notifications}`.

**Rationale**: Existing feature repositories use `/api/v1/admin`. Keeping the
same prefix makes the mock adapter replaceable without a route convention
migration.

**Alternatives considered**: Unversioned routes, browser-only service calls, or
a communications-specific base host.

## Decision 4: Return structural permission projections

**Decision**: MSW handlers return full, aggregate, linked-context, restricted,
or denied schemas according to the simulated role.

**Rationale**: Support conversations, abuse evidence, recipient information,
and delivery diagnostics must not reach unauthorized components. Structural
omission is safer and directly testable.

**Alternatives considered**: Returning full records and hiding fields in CSS,
component-only permission checks, or one nullable schema for every role.

## Decision 5: Keep customer and message content plain and bounded

**Decision**: Ticket messages, feedback, evidence summaries, content, and
template previews are sanitized fictional plain text or allowlisted structured
fields. Attachments are metadata-only.

**Rationale**: No approved journey requires HTML, Markdown, arbitrary JSON, or
real files. Structural exclusion removes XSS, payload, token, and file-preview
risk with less code.

**Alternatives considered**: Rich-text editors, HTML email previews, Markdown,
generic JSON payload editors, data URLs, and real browser file objects.

## Decision 6: Treat operational classifications as authoritative

**Decision**: SLA risk, severity, audience eligibility, opt-out exclusion,
delivery state, failure class, and every rate numerator/denominator arrive as
validated future-backend values.

**Rationale**: The browser lacks policy, consent, provider, delivery, and
customer-history authority. Local derivation could misclassify urgent work or
communication outcomes.

**Alternatives considered**: Client-side SLA thresholds, audience calculation,
provider-status inference, and recomputing rates from incomplete rows.

## Decision 7: Model ticket ownership and transitions explicitly

**Decision**: Each ticket has one owning team and at most one assigned agent.
Reassignment replaces ownership atomically. A reply to Resolved reopens it to
Open; Closed rejects replies until an explicit reopen.

**Rationale**: These clarified rules prevent duplicate ownership and ambiguous
conversation state while remaining simple to test with expected revisions.

**Alternatives considered**: Multiple active agents, implicit closed-ticket
replies, or independent state and message mutations.

## Decision 8: Use revisioned bilingual content lifecycles

**Decision**: Content and templates use Draft, Published/Active, and Retired
states with required Arabic/English variants by default, explicit scope
exceptions, expected revisions, and usage-aware retirement.

**Rationale**: The UI needs deterministic preview and conflict behavior without
editing active customer-facing content in place.

**Alternatives considered**: Autosaving active records, unversioned overwrite,
or allowing incomplete translations without explicit audience scope.

## Decision 9: Keep campaigns single-channel and one-time

**Decision**: One campaign has exactly one channel and either Send Now or one
future scheduled time. Multi-channel communication uses separate campaigns;
recurrence is excluded.

**Rationale**: This preserves clear audience, denominator, delivery, and
failure semantics and avoids adding orchestration not required by Spec 007.

**Alternatives considered**: Multi-channel campaigns, recurring schedules,
event streams, and automated sequences.

## Decision 10: Keep drafts and mutations in deterministic runtime memory

**Decision**: Use one `phase6-communications-state.ts` module for revisioned
mock mutations, inject one fixed Phase 6 application clock into time-sensitive
transitions, and reset both state and clock from the shared test setup.

**Rationale**: Cross-route changes and conflicts remain realistic while no
support content, campaign draft, or recipient context enters browser storage.

**Alternatives considered**: Local/session storage, IndexedDB, filesystem
persistence, Supabase, a backend, or `Date.now()` in handlers/state.

## Decision 11: Use focused views with shared primitives

**Decision**: Split views into support, feedback, content, and notification
files while sharing a small filter toolbar, safe-text presentation, action
dialog, and responsive operational list within the feature boundary.

**Rationale**: Twenty-two routes are too broad for one component file, but do
not justify an abstract page-builder framework.

**Alternatives considered**: One monolithic `CommunicationsViews.tsx`, one file
per route, or a generic schema-driven UI engine.

## Decision 12: Test invariants at the smallest useful layer

**Decision**: Use Vitest for contracts, repository/hooks, transitions,
projections, fixtures, and components; use Playwright for primary journeys,
permissions, privacy, keyboard/focus, direction, performance, and five
viewports.

**Rationale**: This matches the installed stack and keeps schema/lifecycle
permutations out of slower browser tests while preserving end-to-end evidence.

**Alternatives considered**: Snapshot-only coverage, a new test framework, or
duplicating every contract case in Playwright.

## Decision 13: Reuse Spec 003 controlled access

**Decision**: The ticket “request access” control calls the existing
`useCreateAccessRequest` / `accessRepository.createRequest` boundary and stores
only the returned safe access-request reference in the ticket projection.

**Rationale**: Spec 003 already owns access-request permissions, validation,
state, and audit semantics. A second communications action would create
conflicting access state.

**Alternatives considered**: A `request_access` ticket action or a Phase 6
access-request endpoint/state.

## Decision 14: Define text normalization and measurement once

**Decision**: Human-readable input is normalized to Unicode NFC, checked for
disallowed bidi/control characters, counted by Unicode code point for character
limits, and measured with UTF-8 bytes for KiB limits.

**Rationale**: JavaScript UTF-16 length and OpenAPI `maxLength` alone do not
correctly implement the specified Unicode/KiB boundaries.

**Alternatives considered**: UTF-16 `.length`, byte limits for every field,
grapheme counting, or schema annotations without runtime validation.

## Decision 15: Keep limited access linked-only

**Decision**: Content Manager and Security Administrator limited support,
feedback, and delivery projections appear only inside an already authorized
feedback or abuse/domain context. Flat route guards continue to deny direct
support, general-feedback, and delivery-log routes.

**Rationale**: This matches existing boolean route guards and prevents an
aggregate/linked projection from accidentally becoming broad route access.

**Alternatives considered**: New projection-aware route authorization, direct
limited routes, or returning full records and hiding fields.

## Decision 16: Make conditional payload rules contractual

**Decision**: Mutation payloads use strict action-discriminated Zod schemas,
mirrored by OpenAPI conditional requirements. A single-language content or
template payload requires a non-empty reason and an audience locale matching
its sole variant.

**Rationale**: A generic optional-field action object accepts incomplete
mutations that cannot be executed safely. Refinements keep one endpoint per
resource while rejecting invalid field combinations at the boundary.

**Alternatives considered**: One endpoint per action, UI-only validation, or
permissive payloads rejected later by mock state.

## Resolved Unknowns

The clarified specification, constitution, existing Specs 001–006, and
decisions above resolve all planning questions. No unresolved planning marker
remains.
