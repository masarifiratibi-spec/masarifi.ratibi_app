# Implementation Plan: Users, Devices, Sessions, and Controlled Access

**Phase / Spec**: Phase 2 / Spec 003  
**Date**: 2026-07-28  
**Spec**: [spec.md](./spec.md)  
**Input**: Admin Web feature specification

## Summary

Extend the approved `/admin/users` experience in place and add focused customer
detail and controlled-access routes. Reuse the established Phase 0/1 flow:

```text
Route/page → feature component → typed hook → repository → shared API client
           → MSW handler → sanitized fictional fixture/state
```

Keep user list, profile, devices, sessions, account actions, and bulk actions
inside the existing `users` feature. Add one `access` feature because access
requests have a separate permission model, lifecycle, expiry boundary, and
cache-removal requirement. Reuse the Admin shell, semantic tokens, dialogs,
region states, masked fields, permission simulation, and locked-mutation
foundation. No backend, real authentication, persistence, redesign, or new
dependency is included.

## Technical Context

**Language**: TypeScript 5.9.3 in strict mode  
**Framework**: Existing Next.js 16.2.11 App Router with React 19.2.8  
**UI and data stack**: Existing Tailwind CSS 4.3.3, TanStack Query 5.101.4,
TanStack Table 8.21.3, React Hook Form 7.83.0, Zod 4.4.3, and Lucide React
1.26.0; Recharts remains installed but is not needed for this phase  
**Mock boundary**: Existing Mock Service Worker 2.15.0 behind typed feature
repositories; no Next.js API routes  
**Testing**: Existing Vitest 4.1.10 and Playwright 1.62.0  
**Storage**: Sanitized in-memory mock state only; no customer, selection,
session, or temporary-access data in browser storage  
**Direction**: Arabic RTL default; English LTR ready  
**Themes**: Preserve existing light and dark semantic-token themes  
**Target viewports**: 1440px, 1280px, 1024px, 768px, and 390px  
**User outcomes**: A specified fictional customer is identifiable within 90
seconds; protected workspace content is removed within five seconds of expiry  
**Scale**: Users and access requests use bounded pagination; devices and
sessions are bounded per customer; bulk actions accept only the current
explicit selection  
**Scope**: Existing `apps/admin-web` project only; extend `/admin/users` and add
the four approved Spec 003 routes without later-phase modules  
**Dependencies**: No package installation, upgrade, or configuration
replacement

No technical-context item remains unresolved.

## Constitution Check

*GATE: Passed before research and rechecked after Phase 1 design.*

- [x] Existing approved pages, routes, components, tokens, assets, and
  configuration remain the baseline; `/admin/users` is extended in place.
- [x] Masarifi Gulf Premium Design System Version 2.1 remains the visual source
  of truth; deep teal stays primary and bronze remains limited.
- [x] The work is Phase 2 / Spec 003 and maps to planned users, profiles,
  devices, auth, roles, permissions, support, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication,
  queue, or infrastructure implementation is planned.
- [x] Pages consume typed users/access hooks and repositories; fixtures remain
  behind MSW and are never imported by presentation code.
- [x] The proposed contracts in
  `contracts/admin-users-access.openapi.yaml` are replaceable by future NestJS
  controllers.
- [x] The fixed installed stack is reused with strict TypeScript, semantic
  tokens, and no `any`; no dependency change is planned.
- [x] Arabic RTL, English LTR, keyboard operation, visible focus, reduced
  motion, touch targets, and all five viewports are covered.
- [x] Relevant loading, empty, error, success, warning, conflict, expired, and
  permission states are defined per independently loaded region and mutation.
- [x] Customer data remains masked or aggregated; destructive and
  privacy-sensitive actions require scoped confirmation.
- [x] Route/query identifiers, forms, filters, sorting, pagination, selections,
  scopes, durations, mutation payloads, and responses cross Zod boundaries.
- [x] Response text renders safely; uploads, raw HTML/Markdown/JSON, open
  redirects, private storage, public secrets, raw errors, and unsafe logs are
  excluded.
- [x] Mock permissions remain development-only UX controls; every future
  endpoint must independently authorize and filter its response.
- [x] Existing dependencies are sufficient and lock/package files remain
  unchanged.
- [x] Vitest and Playwright coverage includes masking, platform membership,
  permission visibility, state transitions, confirmation, pending locks,
  self-approval denial, scope reduction, expiry, cache removal, keyboard use,
  and viewport behavior.
- [x] `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run test:e2e`, and `npm run build`, plus focused static/manual reviews,
  are defined in `quickstart.md`.

**Pre-design gate result**: PASS. No constitutional exception is required.

## Project Structure

### Feature documentation

```text
specs/003-admin-users-devices-and-access/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-users-access.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md                         # generated by /speckit-tasks
```

### Existing and planned Admin Web source

```text
src/
├── app/
│   ├── admin/
│   │   ├── users/
│   │   │   ├── page.tsx                         # extend list in place
│   │   │   └── [userId]/page.tsx                # add customer detail
│   │   └── access-requests/
│   │       ├── page.tsx                         # add request list
│   │       └── [requestId]/
│   │           ├── page.tsx                     # add request detail
│   │           └── workspace/page.tsx           # add active workspace
│   └── globals.css                              # minimum semantic additions
├── components/admin/
│   ├── AdminShell.tsx                           # register route permissions
│   ├── MaskedField.tsx                          # reuse
│   ├── PermissionBoundary.tsx                   # reuse
│   └── ui.tsx                                   # reuse existing states/dialogs
├── core/permissions/
│   ├── permissions.ts                           # add granular Phase 2 keys
│   ├── role-map.ts                              # extend seven-role mapping
│   └── role-map.test.ts                         # verify exact matrix
├── features/
│   ├── foundation/useLockedMutation.ts          # reuse
│   ├── users/
│   │   ├── contracts.ts                         # extend schemas/types
│   │   ├── contracts.test.ts                    # add invariants/security tests
│   │   ├── repository.ts                        # add reads/mutations
│   │   ├── repository.test.ts                   # extend contract tests
│   │   ├── hooks.ts                             # add query/mutation hooks
│   │   ├── UserDetailView.tsx                   # profile/devices/sessions
│   │   ├── UserActions.tsx                      # single/bulk form dialogs
│   │   └── user-actions.test.tsx                # action accessibility/safety
│   └── access/
│       ├── contracts.ts                         # access schemas/state machine
│       ├── contracts.test.ts                    # transition/scope tests
│       ├── repository.ts                        # request/workspace operations
│       ├── repository.test.ts                   # parsed HTTP behavior
│       ├── hooks.ts                             # queries/mutations/cache purge
│       ├── AccessRequestView.tsx                # list/detail decisions
│       ├── TemporaryAccessWorkspace.tsx         # scope/expiry boundary
│       └── access-workspace.test.tsx             # expiry/privacy/access tests
├── mocks/
│   ├── fixtures/
│   │   ├── users.ts                             # sanitized Phase 2 customers
│   │   └── access.ts                            # sanitized request/workspace data
│   ├── handlers/
│   │   ├── users.ts                             # extend user endpoints
│   │   ├── access.ts                            # add access endpoints
│   │   └── index.ts                             # register access handlers
│   ├── phase2-state.ts                          # resettable in-memory mock state
│   └── scenarios/foundation.ts                  # reuse scenario vocabulary
└── tests/no-direct-fixtures.test.ts             # preserve architecture guard

tests/e2e/
└── users-access.spec.ts                         # Phase 2 journeys
```

**Structure decision**: Keep the affected user flow in the existing
`src/features/users` folder. Add only one sibling `src/features/access` folder
because temporary access has distinct contracts and lifecycle rules. Keep
route files thin; they parse route values, render permission boundaries, and
delegate to feature views. Reuse `ui.tsx`, `MaskedField`,
`PermissionBoundary`, and `useLockedMutation` instead of creating another
component library. Keep style additions in the existing `globals.css` because
that is the approved project pattern.

## Design Decisions

### 1. Extend the approved Users page, retain its quick summary

`/admin/users` keeps its approved header, metrics, filters, table/mobile cards,
selection bar, and privacy notice. The existing drawer remains a quick summary
and gains an explicit link to `/admin/users/[userId]`; it is not expanded into
the complete Phase 2 experience.

### 2. Use a dedicated detail route with independently loaded regions

`/admin/users/[userId]` owns the full privacy-safe summary. Overview, Devices,
and Sessions use separate query keys and state boundaries. A failed device or
session request does not erase the successful profile summary. Later-phase
tabs are not implemented.

### 3. Keep one users repository and one access repository

The users repository owns list, profile, device, session, account, verification,
device/session revocation, export, and bulk operations. The access repository
owns request list/detail/create/decision/revoke/workspace/end operations. No
endpoint-specific repository classes or one-use interfaces are introduced.

### 4. Make platform membership and totals explicit

List items carry `primaryPlatform`, `registeredPlatforms`,
`iosDeviceCount`, `androidDeviceCount`, and `totalDeviceCount`. All Platforms
contains each customer once. iOS and Android membership may overlap;
Multi-platform requires both. Zod validates that total devices equal iOS plus
Android devices; it never derives unique customer totals by adding platform
audiences.

### 5. Infer application types from Zod contracts

Extend `src/features/users/contracts.ts` as the user-flow source of truth and
define access schemas in `src/features/access/contracts.ts`. Existing user
fixtures, filters, pages, handlers, and repositories migrate to these inferred
types. Do not create a second handwritten Phase 2 type tree.

### 6. Reuse existing confirmation and mutation locking

React Hook Form and Zod handle action inputs. Existing `ConfirmDialog` presents
scope, consequence, permission, and planned audit event. Existing
`useLockedMutation` rejects duplicate pending actions. TanStack Query updates
or invalidates only affected queries after success.

### 7. Keep MSW state small, explicit, and resettable

`src/mocks/phase2-state.ts` owns cloned fictional users, devices, sessions, and
access requests plus one reset function for Vitest. Handlers apply validated
state transitions and return safe conflicts. No local storage, database, mock
server, or general-purpose state framework is added.

### 8. Enforce the access lifecycle at contract and handler boundaries

Allowed transitions are:

```text
pending  → approved | rejected
approved → active | expired | revoked
active   → expired | revoked
rejected | expired | revoked → terminal
```

The requester cannot approve their own request. Approval can only reduce the
requested scope/duration. Duplicate overlapping requests return conflict.
Workspace reads require matching assignee, valid ticket, permitted scope,
permission, and unexpired approved/active status.

### 9. Remove workspace data at expiry without a polling framework

The workspace uses the authoritative `expiresAt` value. One timeout schedules
expiry, visibility/focus events recheck it, and each protected request is
validated by the mock handler. Expiry cancels workspace queries, removes their
cache, clears local component input, and renders the shared expired state. The
accessible banner includes an absolute timestamp and does not announce a
per-second countdown.

### 10. Keep temporary scope allowlisted and masked

Approved scope values are limited to profile contact, account status, device
diagnostics, session diagnostics, subscription summary, and import summary.
Workspace response sections are built from this allowlist and contain masked or
aggregated values only. Raw financial records, messages, files, tokens,
fingerprints, full IPs, and credentials never enter a contract or fixture.

### 11. Add granular permissions without claiming production security

Extend the existing seven-role simulation with the Spec 003 keys from the
specification. Route-level permission gates hide protected navigation and
replace direct denied routes with the shared denied state. Each action also
checks its granular permission in the UI and handler. Each simulated role maps
to one stable fictional Admin actor ID so requester, approver, and assignee
checks are deterministic. Documentation and the role switcher continue to state
that future backend authorization is required.

### 12. Keep bulk actions page-scoped and bounded

Selection never means all filtered records. Payloads contain the explicit
current selection only, are deduplicated and bounded, and return safe
succeeded/failed counts. Notification remains a mock handoff result; campaign
and delivery behavior remain out of scope.

### 13. Test contracts below the browser and journeys in Playwright

Vitest covers schemas, state transitions, repository parsing, permission
mapping, mutation locks, scope enforcement, masking, and expiry cache removal.
Playwright covers operator journeys, all platform filters, action
confirmations, role visibility, requester/approver separation, active workspace
expiry, keyboard/focus behavior, and all approved viewports. Existing
architecture and visual-preservation tests remain active.

## Requirement Coverage

| Specification coverage | Design/artifact coverage |
|------------------------|--------------------------|
| FR-001–FR-008: Users list/profile | Decisions 1, 4, and 5; user entities and invariants in `data-model.md`; list/profile paths in the OpenAPI contract |
| FR-009–FR-014: Devices/sessions | Decisions 2 and 4; device/session entities and endpoints; independent-region checks in `quickstart.md` |
| FR-015–FR-020: Customer actions | Decision 6; validated action inputs/results; confirmation, lock, success/error/conflict checks |
| FR-021–FR-025: Bulk actions | Decision 12; bounded explicit selection model and bulk endpoint; partial/export privacy checks |
| FR-026–FR-038: Controlled access | Decisions 7–11; access state model, request/workspace endpoints, lifecycle/expiry verification |
| FR-039–FR-042: Architecture/fixtures | Decisions 3, 5, 7, and 13; typed repositories, resettable MSW state, fixture matrix, static scans |
| UX, RTL/LTR, responsive, accessibility | Existing approved primitives plus the accessibility and five-viewport matrices in `quickstart.md` |
| Privacy, security, and audit expectations | Allowlisted projections, safe errors, mock audit references, no storage/secrets, and focused security scans |
| AC-001–AC-020 and SC-001–SC-010 | Automated and manual evidence matrix in `quickstart.md`; no result is pre-claimed |

## Implementation Sequence

1. Record the current `/admin/users` visual and behavior baseline at both
   directions/themes and all approved viewports.
2. Extend granular Phase 2 permissions and the shell/navigation route map with
   focused permission-matrix tests.
3. Extend users schemas and tests for unique customers, platform membership,
   devices, sessions, action forms, bulk bounds, masking, and safe errors.
4. Add access schemas and tests for request validation, state transitions,
   separation of duties, scope reduction, duplicate overlap, and expiry.
5. Extend the users repository/hooks and add the access repository/hooks using
   the shared API client, query keys, and locked mutation.
6. Replace the small user fixture set with complete deterministic Phase 2
   fixtures and add resettable in-memory state.
7. Extend/register MSW handlers for all proposed endpoints and safe mock
   scenarios.
8. Extend `/admin/users`, add the detail route, and bind profile/device/session
   regions and account actions without changing the approved list identity.
9. Add access list/detail/workspace routes and enforce requester, assignee,
   scope, permission, and expiry behavior.
10. Add the minimum semantic CSS required for the new detail, access banner,
    timelines, responsive cards, and dialogs using existing tokens.
11. Add focused Vitest and Playwright coverage and execute the complete
    quickstart verification matrix.

Each step leaves a typed, independently testable boundary. Detailed file-level
tasks are generated later by `/speckit-tasks`.

## Backend Alignment

**Planned modules**: users, profiles, devices, auth, roles, permissions,
support, and audit-logs  
**Planned entities**: `auth.users`, `profiles`, `devices`, `roles`,
`permissions`, `role_permissions`, `user_roles`, `support_tickets`,
`admin_access_requests`, `audit_logs`, and read-only plan context from
`subscriptions`  
**Proposed contracts**: Seventeen frontend/MSW operations documented in
`contracts/admin-users-access.openapi.yaml`; future NestJS controllers may
replace the mock adapter without redesigning the routes  
**Deferred production security**: Real identity and session control, NestJS
authorization, separation-of-duty enforcement, Supabase policies and
persistence, encrypted secrets/tokens, immutable audit storage, consent,
rate limiting, monitoring, incident response, retention, and penetration
testing

## Post-Design Constitution Recheck

The completed research, data model, OpenAPI contract, and quickstart preserve
all pre-design gates. They reuse the existing application, fixed dependencies,
semantic tokens, typed repositories, shared API/error/state foundations,
permission simulation, and test infrastructure. They add only approved Phase 2
routes and one bounded access feature. No backend runtime, real authentication,
database, dependency, browser persistence, secret, unsafe renderer, raw fixture
import, later-phase module, or visual redesign is introduced.

**Post-design gate result**: PASS.

## Complexity Tracking

No constitution violation or approved deviation is present.
