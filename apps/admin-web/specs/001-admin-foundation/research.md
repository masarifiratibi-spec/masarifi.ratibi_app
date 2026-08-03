# Research: Admin Foundation and Design Preservation

**Phase / Spec**: Phase 0 / Spec 001  
**Date**: 2026-07-27

All technical-context decisions are resolved. This research records choices
for the existing Admin Web application; it does not authorize implementation
outside Spec 001.

## Decision 1: Extend the existing application in place

**Decision**: Preserve the current Next.js App Router project, routes,
components, CSS tokens, assets, and configuration.

**Rationale**: The existing four pages are the approved visual baseline and the
constitution forbids reinitialization or redesign.

**Alternatives considered**:

- New Next.js application: rejected because it duplicates configuration and
  risks visual regression.
- Separate foundation package now: rejected because the foundation has one
  consumer and would add premature workspace complexity.

## Decision 2: Add only missing approved dependencies

**Decision**: Keep installed Next.js, React, Tailwind CSS, Recharts, Lucide, and
TypeScript packages. Add TanStack Query, TanStack Table, React Hook Form, Zod,
MSW, Vitest, and Playwright using versions compatible with the locked project.

**Rationale**: These are constitution-mandated and currently absent. The
lockfile will record exact resolved versions.

**Alternatives considered**:

- Replace existing libraries: rejected by the fixed stack.
- Upgrade all dependencies together: rejected as unrelated scope and avoidable
  risk.

## Decision 3: Use HTTP-shaped MSW contracts without Next.js API routes

**Decision**: Feature repositories call a shared browser HTTP client; MSW
intercepts `/api/v1/admin/*` during development and tests.

**Rationale**: This exercises real request/response behavior and makes a future
NestJS adapter replaceable without building a temporary backend.

**Alternatives considered**:

- Direct in-memory repository only: rejected because it does not validate the
  approved mock HTTP boundary.
- Next.js route handlers: rejected because they create an unnecessary
  server-side implementation in a frontend-only phase.

## Decision 4: Keep repositories feature-local

**Decision**: Overview, Users, Imports, System Health, and Foundation each own a
small typed repository contract and query hooks; shared transport remains in
`src/core/api`.

**Rationale**: Feature ownership prevents a large generic data service while
keeping transport and errors consistent.

**Alternatives considered**:

- One universal Admin repository: rejected because it couples unrelated data
  and grows with every later spec.
- Page-to-client calls: rejected because the constitution requires a typed
  service or repository boundary.

## Decision 5: Infer TypeScript types from Zod at trust boundaries

**Decision**: Use Zod for request, query, identifier, and response validation;
infer the corresponding TypeScript types when the schema is authoritative.

**Rationale**: One definition reduces contract drift and treats mocked/API data
as untrusted.

**Alternatives considered**:

- Handwritten types plus separate validators: rejected because duplication can
  diverge.
- Type assertions: rejected because they do not validate runtime input.

## Decision 6: Use TanStack Query for server-state simulation

**Decision**: A single client provider owns cache defaults. Each feature owns
stable query keys, repository calls, and local invalidation rules.

**Rationale**: It matches the approved stack and models the future backend
integration without introducing a global client-state library.

**Alternatives considered**:

- Context for fetched data: rejected because it duplicates query lifecycle,
  caching, retries, and error state.
- New state library: rejected by the fixed stack and YAGNI.

## Decision 7: Use TanStack Table without replacing approved markup

**Decision**: TanStack Table manages table state and row models while existing
Admin table/card markup and CSS remain the visual layer.

**Rationale**: It supplies typed sorting, filtering, pagination, selection, and
column visibility without imposing a UI framework.

**Alternatives considered**:

- Third-party table UI: rejected because it changes the design language.
- Keep ad hoc table state: rejected because Phase 0 must establish the shared
  table foundation.

## Decision 8: Preserve semantic CSS tokens for both themes

**Decision**: Continue using `src/app/globals.css` semantic custom properties.
Replace affected chart literals with token-backed values only where the
rendered colors remain visually equivalent.

**Rationale**: The existing file already contains approved light and dark token
sets. Reuse is safer than a second theme system.

**Alternatives considered**:

- JavaScript theme object: rejected because it duplicates CSS tokens.
- New component library theme: rejected because it changes the approved stack
  and appearance.

## Decision 9: Limit permissions and search to Phase 0

**Decision**: Implement six permission keys and the clarified role-to-route map.
Global search returns only Navigation, Users, Imports, and System Health.

**Rationale**: This is independently testable and avoids prebuilding the Spec
010 matrix or later-module search features.

**Alternatives considered**:

- Complete future permission matrix now: rejected as Spec 010 scope.
- Visual-only search: rejected because Spec 001 requires a functional shell
  foundation.

## Decision 10: Make mocks deterministic and production-inactive

**Decision**: Tests override handlers directly; development uses an explicit
scenario selection mechanism. The browser worker starts only in development
and test contexts.

**Rationale**: Deterministic scenarios keep tests stable and prevent mock
security behavior from appearing production-ready.

**Alternatives considered**:

- Random failures: rejected because tests and demonstrations become flaky.
- Start MSW in production: rejected because the future real adapter must own
  production traffic.

## Decision 11: Migrate the existing Node test to Vitest

**Decision**: Preserve current utility assertions while moving them to Vitest,
then add focused schema, repository, permission, and component tests. Use
Playwright only for browser-level journeys and viewport evidence.

**Rationale**: This meets the fixed test stack with minimal duplicated coverage.

**Alternatives considered**:

- Run Node test and Vitest permanently: rejected because two unit runners add
  maintenance without value.
- Put all tests in Playwright: rejected because unit boundaries would become
  slower and harder to diagnose.

## Decision 12: Measure acknowledgement, not mock completion

**Decision**: The 200-millisecond interaction gate measures visible local
acknowledgement such as active, open, selected, or pending state. The
2.5-second shell gate uses the production build and default mock latency under
documented reference conditions.

**Rationale**: Network completion depends on the selected mock scenario, while
immediate acknowledgement is controlled by the frontend.

**Alternatives considered**:

- Require every request to finish in 200 milliseconds: rejected because it
  conflicts with deliberate slow/error scenarios.
- No performance gate: rejected by the clarified specification.

## Implementation dependency baseline (2026-07-27)

The inspected project resolved Next.js 16.2.11, React 19.2.8, TypeScript
5.9.3, Tailwind CSS 4.3.3, Recharts 3.10.0, and Lucide React 1.26.0 before
implementation.

The approved-stack delta was:

- Runtime: `@tanstack/react-query`, `@tanstack/react-table`,
  `react-hook-form`, and `zod`.
- Development: `msw`, `vitest`, `@vitest/coverage-v8`, `jsdom`, and
  `@playwright/test`.

No framework, router, styling, charting, or unrelated package upgrade is part
of Spec 001. Resolved versions are recorded in `quickstart.md` after the
lockfile update.
