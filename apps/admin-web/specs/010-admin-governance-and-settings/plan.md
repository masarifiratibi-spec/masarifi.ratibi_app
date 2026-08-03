# Implementation Plan: Admin Team, Roles, Permissions, Settings, and Final Integration

**Phase / Spec**: Phase 9 / Spec 010  
**Date**: 2026-08-01  
**Spec**: [spec.md](./spec.md)  
**Input**: Clarified Admin Web feature specification

## Summary

Complete the final Admin Web phase with one focused `governance` feature
boundary for fictional Admin users, custom roles, the consolidated permission
matrix, versioned settings, feature flags, and simulated maintenance. Extend
the existing foundation search and attention contracts instead of creating
parallel shell services. Keep all sixteen routes thin and reuse the approved
shell, forms, tables/cards, dialogs, permission boundary, query client,
semantic tokens, and responsive patterns.

Use immutable sanitized fixtures for read-only reference data and one
resettable deterministic in-memory mock state for Pending invitations, eligible
Admin mutations, custom-role mutations, settings groups, feature flags, and
maintenance transitions. Derive permission-matrix completeness from the
existing permission inventory, keep the seven system roles immutable, and add
no real account, email, session, setting, rollout, maintenance, backend,
database, provider, or deployment effect.

## Technical Context

**Language**: TypeScript, strict mode  
**Framework**: Next.js App Router with React  
**UI and data stack**: Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts, Lucide Icons  
**Mock boundary**: Mock Service Worker behind typed services or repositories  
**Testing**: Vitest and Playwright  
**Storage**: Resettable deterministic in-memory Phase 9 mock state only; no browser or backend persistence  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend implementation  
**Performance and scale**: 25 rows by default; 25/50/100 page sizes; search
2–120 Unicode characters; standard pages usable at p95 ≤2 seconds and
search/filter/sort/pagination/local updates at p95 ≤1 second; explicitly
labeled slow scenarios excluded  
**Mutation limits**: Reasons 10–500 trimmed Unicode characters; invitation
messages ≤1,000 characters; invitation expiry 1–30 whole days, default 7;
flag rollout integer 0–100  
**Concurrency**: Resource or settings-group version plus client-generated
submission key; duplicate or stale mutations return safe current state/conflict  
**Mock clock**: Inject one fixed Phase 9 timestamp through fixtures, state, and
tests; do not use current-time or random generation in deterministic state logic  
**Dependencies**: Existing packages only; no install or upgrade

## Constitution Check

*GATE: Every item passed before Phase 0 and was re-evaluated after Phase 1.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 9 / Spec 010 and planned admin, auth, roles, permissions, system-settings, notifications, audit, search, and domain-projection capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication, email delivery, session revocation, flag service, mobile release, maintenance infrastructure, or deployment is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, light/dark themes, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, stale, error, success, warning, conflict, and permission states are covered.
- [x] Admin and customer identities are masked or structurally omitted; every privileged mutation requires explicit confirmation.
- [x] All mocked, user-entered, URL, settings, search, attention, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, internal destinations, external store links, client storage, environment exposure, errors, and logs are safe; Phase 9 uploads and downloads no files.
- [x] Mock permissions remain development-only UX controls; future backend authentication, authorization, projection, audit, and concurrency controls are documented.
- [x] Dependencies are unchanged.
- [x] Security-sensitive behavior has accessible Vitest and Playwright coverage planned.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

## Project Structure

### Feature documentation

```text
specs/010-admin-governance-and-settings/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-governance-settings.openapi.yaml
└── tasks.md
```

### Existing Admin Web paths to modify

```text
src/
├── app/admin/
│   ├── admin-team/
│   │   ├── page.tsx
│   │   ├── invite/page.tsx
│   │   └── [adminId]/page.tsx
│   ├── roles/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   ├── permissions/page.tsx
│   │   └── [roleId]/
│   │       ├── page.tsx
│   │       └── edit/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── mobile/page.tsx
│       ├── feature-flags/page.tsx
│       ├── imports/page.tsx
│       ├── ai/page.tsx
│       ├── subscriptions/page.tsx
│       ├── security/page.tsx
│       └── maintenance/page.tsx
├── components/admin/
│   ├── AdminShell.tsx
│   ├── AdminShell.test.tsx
│   ├── Breadcrumbs.tsx
│   ├── GlobalSearch.tsx
│   ├── AttentionPanel.tsx
│   ├── shell-state.ts
│   └── shell-state.test.ts
├── core/permissions/
│   ├── permissions.ts
│   ├── role-map.ts
│   └── role-map.phase9.test.ts
├── features/
│   ├── foundation/
│   │   ├── schemas.ts
│   │   ├── contracts.ts
│   │   ├── repository.ts
│   │   ├── hooks.ts
│   │   └── associated tests
│   └── governance/
│       ├── contracts.ts
│       ├── contracts.test.ts
│       ├── repository.ts
│       ├── repository.test.ts
│       ├── hooks.ts
│       ├── hooks.test.ts
│       ├── GovernanceViews.tsx
│       ├── GovernanceViews.test.tsx
│       ├── SettingsViews.tsx
│       └── SettingsViews.test.tsx
├── mocks/
│   ├── fixtures/governance.ts
│   ├── handlers/governance.ts
│   ├── handlers/search.ts
│   ├── handlers/attention.ts
│   ├── handlers/index.ts
│   ├── phase9-governance-state.ts
│   └── phase9-governance-state.test.ts
└── tests/no-direct-fixtures.test.ts

tests/e2e/
├── governance-settings.spec.ts
├── permissions.spec.ts
├── accessibility.spec.ts
├── performance.spec.ts
└── visual-preservation.spec.ts
```

**Structure decision**: Add one `governance` feature for all Phase 9 routes
because Admin identity, roles, permissions, settings, flags, and maintenance
share one privilege boundary and mutation model. Split presentation into two
files—team/roles and settings—rather than one component per route. Keep search and attention
inside the existing foundation boundary. Add one deterministic Phase 9 state
module and one handler. Do not add an approval workflow, generic settings
framework, form-builder, state library, feature-flag engine, search index,
notification store, or new component system.

## Existing Patterns to Reuse

### Permissions, routes, and navigation

- Append the exact Spec 010 permission keys to `PERMISSION_KEYS` and preserve
  every prior key unchanged.
- Add a dedicated Phase 9 role-map test before changing assignments. Super
  Admin receives all Phase 9 keys; Security Administrator receives the exact
  read and security-settings subset; the other five roles receive no Phase 9
  governance key.
- Register static routes such as `/admin/roles/permissions`,
  `/admin/roles/new`, and settings subroutes before dynamic and broad route
  rules. Register `[adminId]` and `[roleId]` patterns explicitly.
- Activate Admin Team, Roles and Permissions, and System Settings navigation
  under the existing Governance group. Navigation continues to be projected by
  the existing role-aware handler.
- Preserve the seven-role development switcher. Custom roles belong to mock
  governance data and never become selectable session roles.

### Contracts, repository, and hooks

- Define strict request/response schemas in one
  `src/features/governance/contracts.ts`; reuse shared pagination, safe error,
  identifier, search, and localized-text primitives only where semantics match.
- Use one repository with validated query serialization and the existing
  versioned Admin API client. Repository methods correspond one-to-one with the
  twenty documented OpenAPI operations, including the permission-restricted
  invitation list required to inspect seeded invitation states.
- Query keys begin with `['phase9-governance']` and include the resource,
  simulated role, validated filters, and stable identifier or settings group.
- Mutations reuse `useLockedMutation()` with target-specific keys and invalidate
  only affected Admin, role, permission, settings, flag, maintenance, search,
  attention, and navigation queries.
- Keep search and attention public component signatures stable. Extend their
  schemas, fixtures, handlers, and result labels to cover completed modules.

### Mock data and state

- Keep permission definitions, seven system-role descriptors, departments,
  read-only invitation scenarios, reference settings metadata, search records,
  and attention records in sanitized immutable fixtures.
- Put only Pending invitation creation, eligible Admin changes, custom-role
  state, settings-group versions, feature-flag changes, and maintenance
  transitions in `phase9-governance-state.ts`.
- Seed every mutable collection from immutable fixtures and export one reset
  function for test isolation.
- Use stable fictional IDs, fixed timestamps, deterministic revision
  increments, and deterministic audit references. Do not use `Date.now()`,
  `Math.random()`, UUID generation, or browser storage.
- Build the permission matrix from `PERMISSION_KEYS`, permission metadata, the
  existing seven system-role assignments, and current custom-role state. A
  missing or duplicated permission definition fails validation.
- Validate role, permission, path, query, body, expected status/version,
  submission key, eligibility, and structural projection before serialization.

### UI and responsive behavior

- Reuse current Admin page headers, tables/cards, form controls, status and
  severity badges, confirmation dialogs, live feedback, `.ltr` direction
  isolation, semantic tokens, and desktop-required notice pattern.
- Admin Team and Roles use responsive table/card pairs. Admin and role details
  use bounded sections rather than unrestricted JSON or nested data browsers.
- Permission Matrix uses the existing table style at wide viewports and grouped
  permission cards at tablet/mobile; edit actions show the documented desktop
  requirement at 390px.
- Settings pages share existing section navigation and form styling but retain
  group-specific schemas and forms. Save one group atomically; do not introduce
  a generic schema-driven form engine.
- Preserve the current top-header placement and interaction of search and
  attention. Add entity/event groups without redesigning either shell surface.

## Design and Data Flow

```text
Thin App Router page
  → GovernanceViews / SettingsViews
  → Phase 9 query or locked-mutation hook
  → GovernanceRepository
  → existing Admin API client
  → MSW governance handler
  → role-aware structural projection
  → immutable fixture or deterministic Phase 9 state

Existing GlobalSearch / AttentionPanel
  → existing foundation hook and repository
  → extended search / attention handler
  → owning-domain safe projection + route permission
```

- UI code does not determine whether an Admin is the last Active Super Admin,
  whether a custom role may be disabled, whether a permission is assignable,
  whether a settings value is authoritative, whether a flag scope is compatible,
  or whether maintenance may transition. Contracts carry eligibility and the
  mock mutation boundary rechecks it.
- System roles and their permission assignments remain immutable and derive
  from the existing permission map. Custom roles are separate governance
  records and do not alter the current session's role union.
- Pending invitation creation is the only invitation mutation. Accepted,
  Expired, and Revoked invitation scenarios remain read-only fixtures.
- Settings updates send changed allowlisted fields only and apply atomically to
  one group version. No partial field success is possible.
- Feature flags use the fixed five-audience enum and one compatible platform
  scope. No customer identifiers or audience expressions enter the boundary.
- Maintenance transitions change only fictional frontend state; every result
  retains a visible mock-only marker.
- Search and attention perform defense-in-depth filtering at handler and
  repository boundaries, then direct users only to normalized internal routes
  whose owning permission is currently allowed.

## Implementation Sequence

### Phase A — Permission, route, and contract foundation

1. Add failing Phase 9 tests for permission keys, role assignments, route
   precedence, navigation visibility, direct denial, and permission-inventory completeness.
2. Add the exact permission constants and least-privilege system-role mappings.
3. Add route rules, breadcrumb labels, and active Governance navigation records.
4. Add strict governance schemas for lists, details, mutations, settings,
   flags, maintenance, search/attention extensions, pagination, and safe errors.
5. Add repository methods, role-scoped query keys, and locked mutation hooks
   for all documented operations.

### Phase B — Deterministic governance state and handlers

1. Add sanitized immutable fixtures for Admins, sessions, invitations, system
   roles, permission metadata, custom roles, settings, flags, maintenance,
   search, attention, and error/partial scenarios.
2. Add the resettable state module with invitation, Admin, custom-role,
   settings-group, flag, and maintenance transitions.
3. Enforce self-disable, current-session, last-Active-Super-Admin, immutable
   system-role, active-assignment, assignable-scope, platform compatibility,
   schedule, atomic-version, and duplicate-submission invariants.
4. Add all governance handlers with validation, permission checks, structural
   projections, deterministic pagination, safe conflict/current-state results,
   and mock-only outcomes.
5. Extend search and attention handlers only after the new route permissions
   and safe projections exist.

### Phase C — Admin team and role governance journeys

1. Add Admin list, invitation, and profile routes and views with masked fields,
   partial sections, role/security projections, and responsive tables/cards.
2. Add invitation, role assignment, session revocation, and Admin disablement
   confirmations with reasons, consequences, pending locks, conflicts, live
   outcomes, focus restoration, and expected audit references.
3. Add roles list, role detail, custom-role create/edit, and complete permission
   matrix routes and views.
4. Prove system-role immutability, Active/Disabled custom-role lifecycle,
   no-delete surface, active-assignment block, out-of-scope permission rejection,
   and absence of an approval queue.

### Phase D — Settings, flags, and maintenance journeys

1. Add General, Mobile, Import, AI, Subscription, and Security settings routes
   with group-specific validation and atomic changed-field saves.
2. Add strict iOS, Android, and Shared mobile sections with version ordering,
   approved HTTPS store links, and capability compatibility.
3. Add feature-flag list/edit behavior with fixed audiences, 0–100 rollout,
   platform compatibility, optional schedule, version conflict, and confirmation.
4. Add maintenance Off/Scheduled/Active transitions with localized messages,
   affected platforms, time window, required Super Admin recovery path, second
   mock-only acknowledgement, and safe end action.

### Phase E — Search, attention, and final integration

1. Extend global search through Navigation plus all ten required entity groups;
   preserve masking, grouping, deterministic order, keyboard use, and safe destinations.
2. Extend attention through all ten event types and five severities; preserve
   permission filtering, non-color cues, deterministic ordering, and global vs
   mobile attribution.
3. Reconcile every permission key and route from Specs 001–010 against
   navigation, route resolution, fields, search, attention, and mutations.
4. Run representative and full cross-module responsive, Arabic RTL/English LTR,
   light/dark, keyboard, accessibility, privacy, security, design, contract,
   performance, console, and route reviews.
5. Record exact verification evidence during implementation; this plan does not
   claim commands or routes pass.

## Test Strategy

- **Contracts**: Strict enums and objects, bounded names/email/search/messages/
  reasons, safe IDs, page sizes, timestamps, invitation expiry, versions,
  unique role keys and permissions, dotted mobile versions, approved HTTPS
  store URLs, setting field types/ranges, fixed flag audiences, 0–100 rollout,
  schedule ordering, maintenance languages/scopes, safe internal destinations,
  and error shapes.
- **State invariants**: One Pending invitation, duplicate conflicts, self and
  last-Super-Admin blocks, current-session block, role assignment, immutable
  system roles, Active/Disabled custom roles, no active-assignment disable,
  atomic settings groups, stale versions, compatible flags, maintenance
  transitions, idempotent submission keys, deterministic audit IDs, and reset.
- **Repository/handlers**: All twenty operations, URL encoding, query
  serialization, route precedence, role matrix, field-level projections,
  pagination, partial scenarios, validation, safe forbidden/not-found/conflict/
  rate-limited/internal errors, and response-schema parsing.
- **Components**: Loading/empty/partial/stale/error/success/warning/permission/
  conflict states, tables/cards, forms, matrix alternative, changed-field
  review, confirmations, pending lock, live announcement, focus restore,
  direction isolation, unsaved changes, desktop notice, and non-color state.
- **Search/attention**: Every group/type, masked values, denied omission,
  duplicate deduplication, partial group/region failure, safe route targets,
  severity order, platform scope, keyboard opening, and focus destination.
- **Playwright**: All sixteen routes, seven primary stories, seven simulated
  roles, direct denied reads/mutations, session expiry, Arabic RTL/English LTR,
  light/dark, reduced motion, keyboard, and 1440/1280/1024/768/390.
- **Cross-module**: Existing tests plus permission-inventory reconciliation,
  no-direct-fixture scan, no-`any`/unsafe-rendering/storage/environment/log scan,
  route inventory, console capture, visual preservation, performance, complete
  typecheck, lint, Vitest, Playwright, and production build.

## Backend Alignment

**Planned modules**: `admin`, `auth`, `users`, `roles`, `permissions`,
`system-settings`, `notifications`, `audit-logs`, plus owning modules from
Specs 002–009 for safe search and attention projections  
**Planned entities**: `auth.users`, `profiles`, `roles`, `permissions`,
`role_permissions`, `user_roles`, `audit_logs`, `system_settings`, and
`notifications`; AdminInvitation, AdminSession, FeatureFlag,
MaintenanceWindow, and AttentionItem remain proposed capability models  
**Proposed contracts**: Typed frontend schemas and MSW endpoints documented in
`contracts/admin-governance-settings.openapi.yaml`  
**Deferred production security**: Independent authentication and authorization,
field-level projections, invitation delivery and acceptance, MFA enforcement,
session revocation, role-assignment and separation-of-duties policy,
concurrency and idempotency, tamper-evident audit persistence, secret management,
rate limits, rollout evaluation, mobile release safety, maintenance recovery,
monitoring, alerting, incident response, database policies, and infrastructure controls

## Governance Alignment Note

The constitution's narrative delivery list uses legacy phase labels that do
not exactly match the approved ten-spec master document. The active feature,
completed Specs 001–009, master specification, and user request explicitly
assign Admin team, roles, permissions, settings, global integration, and final
hardening to Phase 9 / Spec 010. This plan follows that approved scope. A
constitution wording amendment is separate governance work.

## Post-Design Constitution Re-evaluation

- The design extends the existing application and shell without redesigning prior pages.
- One feature boundary, one repository, one handler, and one deterministic state module cover Phase 9 without speculative infrastructure.
- Search and attention extend their existing foundation contracts rather than creating duplicate systems.
- All sixteen routes are thin and cross typed repository/MSW boundaries.
- System roles remain immutable; custom roles cannot change the development-session role model.
- Sensitive Admin, role, settings, flag, and maintenance changes use validation, confirmation, pending lock, expected version, duplicate protection, safe result, and audit expectation.
- Settings changes are atomic by group; flag audiences and platform scopes are fixed and bounded.
- No file, secret, credential, customer list, private configuration, raw payload, or unrestricted record enters the Phase 9 contract.
- Responsive, accessibility, RTL/LTR, light/dark, permission, privacy, contract, console, route, and full quality gates are planned.
- All constitution gates remain passed. No exception or amendment is required.

## Complexity Tracking

No constitution deviation is planned.

| Violation | Why Required | Approved By | Follow-up |
|-----------|--------------|-------------|-----------|
| None | Not applicable | Not applicable | Not applicable |
