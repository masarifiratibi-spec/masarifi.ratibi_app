# Implementation Plan: Admin Foundation and Design Preservation

**Phase / Spec**: Phase 0 / Spec 001  
**Date**: 2026-07-27  
**Spec**: [spec.md](./spec.md)  
**Input**: Clarified Admin Web foundation specification

## Summary

Extend the existing Admin Web application in place. Preserve the approved shell,
four routes, components, tokens, assets, and responsive presentation while
moving each route from direct fixture imports to:

```text
Page → feature hook → typed repository → HTTP client → MSW handler → fixture
```

Phase 0 also completes the shared shell foundations, functional light/dark
themes, Arabic RTL and English LTR behavior, six Phase 0 permission keys,
permission-filtered search for existing entities, common UI states, security
boundaries, and the Vitest/Playwright verification foundation. No later-phase
business route or production backend is included.

## Technical Context

**Language**: TypeScript 5.9 in strict mode  
**Framework**: Existing Next.js 16 App Router with React 19  
**UI and data stack**: Existing Tailwind CSS 4, Recharts, and Lucide Icons;
add only the missing approved TanStack Query, TanStack Table, React Hook Form,
and Zod dependencies  
**Mock boundary**: Add Mock Service Worker behind typed feature repositories;
do not create Next.js API routes  
**Testing**: Replace the current Node test runner script with Vitest coverage
and add Playwright end-to-end projects  
**Storage**: None; mock fixtures are sanitized fictional source files and
client storage contains no sensitive data  
**Direction**: Arabic RTL default with verified English LTR behavior  
**Themes**: Functional light and dark themes on the shell and all four routes  
**Target viewports**: 1440px, 1280px, 1024px, 768px, and 390px  
**Performance**: Primary shell content visible within 2.5 seconds and local
interaction acknowledgement within 200 milliseconds under documented
reference conditions; deliberate slow mocks are excluded  
**Scale**: Server-style pagination envelopes; the UI renders one page at a
time and never loads an entire large fixture set into a table  
**Scope**: Existing `apps/admin-web` project only; no backend implementation  
**Existing migration targets**: Direct fixture imports in `/admin`,
`/admin/users`, `/admin/imports`, and `/admin/system-health`

No technical-context item remains unresolved.

## Constitution Check

*GATE: Passed before research and rechecked after design.*

- [x] Existing approved pages, routes, components, tokens, assets, and
  configuration are preserved; migration changes only data and shared
  foundation boundaries.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature is Phase 0 of the approved ten-spec plan and maps to planned
  auth, users, permissions, notifications, health, jobs, audit, files, and
  configuration capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication,
  queue, or infrastructure implementation is planned.
- [x] All four pages migrate to typed hooks and repositories with zero direct
  presentation-layer fixture imports.
- [x] MSW implements replaceable HTTP contracts documented in
  `contracts/admin-foundation.openapi.yaml`.
- [x] The fixed stack is retained; only missing approved dependencies are added,
  the existing project is not reinitialized, and application types prohibit
  `any`.
- [x] RTL/LTR, reduced motion, keyboard behavior, accessible semantics, light
  and dark themes, and all five viewports are planned.
- [x] Loading, empty, error, success, warning, conflict, partial, permission,
  session-expired, and unavailable states are assigned to shared boundaries.
- [x] Sensitive values remain masked or aggregated; sensitive mock mutations
  use accessible confirmation, audit expectation, and pending locks.
- [x] URL, filter, search, identifier, mock, and mutation inputs cross Zod
  validation boundaries.
- [x] Safe rendering, redirects, new-tab links, file-contract constraints,
  client storage, environment exposure, errors, and logging are covered.
- [x] Mock roles are visibly development-only UX controls; future NestJS
  authorization remains mandatory.
- [x] Dependency additions are restricted to the missing approved stack and
  require lockfile review; unrelated upgrades are excluded.
- [x] Vitest and Playwright cover permission, masking, validation, unsafe input,
  confirmation, accessibility, viewport, theme, and direction behavior.
- [x] Typecheck, lint, Vitest, Playwright, production build, security review,
  performance review, and visual-preservation review are defined in
  `quickstart.md`.

**Gate result**: PASS. No constitutional exception is required.

## Project Structure

### Feature documentation

```text
specs/001-admin-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-foundation.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Existing Admin Web source

```text
src/
├── app/
│   ├── layout.tsx
│   ├── providers.tsx                  # query and development-only MSW boot
│   └── admin/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── users/page.tsx
│       ├── imports/page.tsx
│       └── system-health/page.tsx
├── components/
│   └── admin/
│       ├── AdminShell.tsx             # preserved visual shell
│       ├── Charts.tsx
│       ├── ui.tsx
│       └── [missing shared foundation controls]
├── core/
│   ├── api/
│   │   ├── client.ts
│   │   ├── contracts.ts
│   │   ├── errors.ts
│   │   └── pagination.ts
│   ├── localization/
│   │   └── direction.ts
│   ├── permissions/
│   │   ├── permissions.ts
│   │   └── role-map.ts
│   └── validation/
│       └── common.ts
├── features/
│   ├── foundation/
│   │   ├── contracts.ts
│   │   ├── repository.ts
│   │   ├── hooks.ts
│   │   └── schemas.ts
│   ├── overview/
│   │   ├── contracts.ts
│   │   ├── repository.ts
│   │   └── hooks.ts
│   ├── users/
│   │   ├── contracts.ts
│   │   ├── repository.ts
│   │   ├── hooks.ts
│   │   └── schemas.ts
│   ├── imports/
│   │   ├── contracts.ts
│   │   ├── repository.ts
│   │   ├── hooks.ts
│   │   └── schemas.ts
│   └── system-health/
│       ├── contracts.ts
│       ├── repository.ts
│       └── hooks.ts
├── mocks/
│   ├── browser.ts
│   ├── server.ts
│   ├── handlers/
│   ├── fixtures/
│   └── scenarios/
├── lib/
│   └── admin-utils.ts
├── types/
│   └── admin.ts
└── tests/
    └── setup.ts

tests/
└── e2e/
    ├── foundation.spec.ts
    ├── permissions.spec.ts
    └── visual-preservation.spec.ts
```

**Structure decision**: Keep the current routes and Admin components in place.
Add only the shared `core`, feature data boundaries, MSW layer, provider, and
test files required by Spec 001. Existing fixture content moves under
`src/mocks/fixtures`; it is not duplicated. Existing component splitting is
allowed only when required for testability or shared states and cannot alter
the approved output.

## Design Decisions

### 1. Query and repository boundary

Pages call feature hooks. Hooks use TanStack Query and a feature repository.
Each repository delegates to one shared HTTP client. MSW intercepts the same
HTTP requests a future NestJS adapter will serve. Query keys are feature-owned,
serializable, and derived from validated filters.

### 2. Contract validation

Zod schemas validate all inputs at the trust boundary: URL/search parameters,
filters, identifiers, mutation bodies, and mock responses. TypeScript types are
inferred from schemas where practical to prevent schema/type drift.

### 3. Mock scenarios

Handlers select deterministic scenarios through test overrides or an explicit
development-only scenario mechanism. They provide success, empty, large, slow,
partial, unauthorized, forbidden, not-found, validation, conflict,
rate-limited, provider-unavailable, and internal-error responses. Production
builds do not start the browser worker.

### 4. Four-page migration

Each current page keeps its component tree and visual output while its direct
`src/data/admin/*` imports move behind the corresponding feature repository.
No page may retain a direct fixture import after Phase 0.

### 5. Shell foundation

`AdminShell` remains the visual base. Its navigation, theme, direction,
environment, role, attention, and search behavior consume the foundation
repository and six Phase 0 permission keys. Search returns only Navigation,
Users, Imports, and System Health results. Future groups remain unavailable.

### 6. Theme and direction

Existing CSS custom properties remain authoritative. Dark-theme gaps and
component variants are filled with semantic tokens. Direction state updates
document language and direction and uses logical CSS; it does not duplicate
layouts.

### 7. Shared tables, charts, and states

TanStack Table supplies table state while the current table markup and CSS
remain visually authoritative. Recharts remains the chart library; accessible
summaries remain required. Shared async states map typed query/error state to
existing or derived Admin UI components.

### 8. Permissions and security

The role map implements only the clarified Phase 0 routes and shell
capabilities. Client controls never claim production authorization. Sensitive
values are masked before presentation; safe errors and logs exclude raw
payloads. Pending sensitive actions lock duplicate submission and identify the
future audit event.

### 9. Verification

Vitest covers schemas, repositories, permission mapping, utilities, and shared
component behavior. Playwright covers routes, role states, search scope,
themes, direction, keyboard behavior, five viewports, error scenarios,
performance acknowledgement, and visual-preservation evidence.

## Implementation Sequence

1. Record the approved baseline and exact dependency delta.
2. Add the missing approved dependencies and test configuration without
   upgrading unrelated packages.
3. Add shared API, validation, permission, provider, and MSW foundations.
4. Move existing fixtures without duplication and expose deterministic handlers.
5. Migrate Overview, Users, Imports, and System Health data flows one route at
   a time, verifying visual parity after each.
6. Complete shell search, attention, role, environment, direction, and theme
   behavior.
7. Complete shared state, table, chart, dialog, drawer, confirmation, privacy,
   and security behavior.
8. Run the quickstart verification matrix and record results.

Each route migration is independently reversible until its direct fixture
import is removed and its parity checks pass. No later-phase route is created.

## Backend Alignment

**Planned modules**: auth, users, profiles, devices, roles, permissions,
notifications, health, jobs, audit, files, and platform configuration  
**Planned entities**: AdminUser, AdminSession, Role, Permission, AuditEvent,
Notification, Incident, Device, FeatureFlag, and SystemSetting  
**Proposed contracts**: Nine read-only frontend contracts: session, navigation,
attention, scoped search, platform options, and one data contract for each of
the four approved pages  
**Deferred production security**: NestJS authentication and authorization,
Supabase persistence and policies, rate limiting, encryption infrastructure,
provider-secret handling, audit immutability, infrastructure protection, and
penetration testing

## Post-Design Constitution Recheck

The research decisions, data model, OpenAPI contract, and quickstart preserve
all pre-design gates. No new dependency family, backend runtime, route, raw
fixture import, unsafe storage, real credential, or visual redesign is
introduced by the design.

**Post-design gate result**: PASS.

## Complexity Tracking

No constitution violations or approved deviations are present.
