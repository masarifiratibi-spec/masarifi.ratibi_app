# Implementation Plan: Security, Audit, and Data Privacy Requests

**Phase / Spec**: Phase 7 / Spec 008  
**Date**: 2026-07-30  
**Spec**: [spec.md](./spec.md)  
**Input**: Clarified Admin Web feature specification

## Summary

Extend the approved Admin Web with 14 Arabic-first security, immutable-audit,
data-export, account-deletion, and retention-policy routes. Use one typed
`security` feature boundary, one versioned mock HTTP adapter, immutable
read-only fixtures for evidence, and a small deterministic runtime state for
the workflows that may change. Reuse the existing shell, role simulation,
repository/hooks, locked mutation, table/card/dialog/state components, and test
patterns. Add no backend, real authentication, threat detection, archive,
download, deletion, cleanup, storage, queue, browser persistence, or dependency.

## Technical Context

**Language**: TypeScript, strict mode  
**Framework**: Next.js App Router with React  
**UI and data stack**: Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts, Lucide Icons  
**Mock boundary**: Mock Service Worker behind typed services or repositories  
**Testing**: Vitest and Playwright  
**Storage**: Deterministic in-memory mock state only; no browser or backend persistence  
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project only; no backend implementation  
**Performance and scale**: 25 rows by default; 25/50/100 page sizes; standard
overview/detail usable at p95 ≤2 seconds and filter/sort/pagination completion
at p95 ≤1 second; labeled slow scenarios excluded  
**Text limits**: Search 120 Unicode characters; reasons and internal notes
2 KiB UTF-8  
**Text semantics**: Unicode NFC, code-point character counts for search,
UTF-8 byte counts for KiB limits, and bidi/control rejection  
**Mock clock**: Injected fixed `2026-07-30T12:00:00+03:00`; no `Date.now()` or
`Math.random()` in Phase 7 state, fixtures, or handlers  
**File boundary**: Fictional metadata only; no URL, token, bytes, Blob, archive,
filesystem write, network download, or browser-stored customer data  
**Dependencies**: Existing packages only; no install or upgrade

## Constitution Check

*GATE: Every item passed before Phase 0 and was re-evaluated after Phase 1.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 7 / Spec 008 and planned auth, users, devices, roles, permissions, support, audit, data-request, file, and subscription capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication, security engine, export, deletion, cleanup, queue, or provider operation is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, error, success, warning, conflict, expiry, and permission states are covered.
- [x] Customer, actor, device, session, location, audit, archive, and privacy-request data is minimized or excluded; sensitive actions require confirmation.
- [x] All external, mocked, user-entered, URL, metadata, file-metadata, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, links, simulated downloads, client storage, environment exposure, errors, and logs are safe.
- [x] Mock permissions remain development-only UX controls; future backend authorization and field projection are documented.
- [x] Dependencies are unchanged.
- [x] Security-sensitive behavior has accessible Vitest and Playwright coverage planned.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

## Project Structure

### Feature documentation

```text
specs/008-admin-security-audit-and-privacy/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-security-audit-privacy.openapi.yaml
└── tasks.md
```

### Existing Admin Web paths to modify

```text
src/
├── app/admin/
│   ├── security/...
│   ├── audit/...
│   └── data-requests/...
├── components/admin/
│   ├── AdminShell.tsx
│   ├── shell-state.ts
│   ├── MaskedField.tsx
│   └── ui.tsx
├── core/
│   ├── auth/use-simulated-role.ts
│   ├── permissions/
│   │   ├── permissions.ts
│   │   └── role-map.ts
│   └── validation/common.ts
├── features/
│   ├── foundation/useLockedMutation.ts
│   └── security/
│       ├── contracts.ts
│       ├── contracts.test.ts
│       ├── repository.ts
│       ├── repository.test.ts
│       ├── hooks.ts
│       ├── hooks.test.ts
│       ├── SecurityViews.tsx
│       ├── SecurityViews.test.tsx
│       ├── AuditViews.tsx
│       ├── AuditViews.test.tsx
│       ├── PrivacyViews.tsx
│       └── PrivacyViews.test.tsx
├── mocks/
│   ├── fixtures/security.ts
│   ├── handlers/security.ts
│   ├── handlers/index.ts
│   ├── phase7-security-state.ts
│   ├── phase7-security-state.test.ts
│   └── server.ts
└── tests/
    ├── no-direct-fixtures.test.ts
    └── setup.ts

tests/e2e/
└── security-audit-privacy.spec.ts
```

**Structure decision**: Use one feature boundary with three focused view files.
Keep route files thin. Keep authentication, permission-change, and audit
evidence immutable. Keep only suspicious activity, incidents, support access,
export requests, deletion requests, and retention policies in one resettable
runtime state. Reuse the existing locked-mutation helper rather than adding a
second lock manager. Do not build a schema-driven page framework, generic JSON
viewer, workflow engine, or separate repository per navigation group.

### Shared role-change cache boundary

- The current simulated role changes independently of the TanStack Query
  client. Add one shared role-change subscription that removes in-memory query
  data immediately when the development role changes.
- Keep only the selected development role and scenario in session storage.
  Phase 7 records, metadata, filters, and mutation payloads never enter browser
  storage.
- Role-scoped query keys remain useful for correct fetching, but are not a
  substitute for clearing previously authorized protected data.

## Existing Patterns to Reuse

### Route and permission pattern

- Add Phase 7 keys to `src/core/permissions/permissions.ts` and role mappings to
  `role-map.ts`.
- Register specific dynamic routes before broad prefixes in
  `src/components/admin/shell-state.ts`.
- Add grouped navigation records through the existing foundation fixture and
  preserve direct-route denial via `resolveRoutePermission()`.
- Super Admin and Security Administrator receive the Phase 7 permissions.
  Support Agent limited projections stay inside prior authorized routes and do
  not create a Phase 7 route grant.

### Contract, repository, and hook pattern

- Define strict Zod request/response schemas in
  `src/features/security/contracts.ts`, importing existing shared schemas where
  their semantics match.
- Use one repository with the existing `/api/v1/admin` client convention and
  URL-safe query serialization.
- Use the already exported `requestJson()` with `method: "PATCH"` for the
  single retention update; do not expand the shared client for one call.
- Parse repository responses before returning them to hooks or views.
- Query keys begin with `["phase7-security"]` and include resource, validated
  filters, platform, period, and identifier.
- Mutations use `useLockedMutation()` with `resource:id:action` keys and
  invalidate only affected list/detail/overview queries.

### Mock HTTP and state pattern

- Register specific endpoints before parameterized endpoints in one
  `src/mocks/handlers/security.ts` module.
- Validate query, path, role, and payload at the handler boundary.
- Apply structural field projections before serialization.
- Use immutable fictional fixtures for authentication events, Admin posture,
  permission changes, and audit events.
- Use simple module-level mutable records plus `resetPhase7SecurityState()` for
  the six mutable resource groups; avoid a custom workflow framework.
- Use one injected clock and deterministic counters for timestamps and planned
  audit references.

### Safe presentation pattern

- Reuse `MaskedField`, status/severity badges, tables, cards, dialogs, region
  states, and live feedback from the approved Admin component set.
- Render notes, reasons, signal labels, filenames, before/after values, and
  metadata as bounded plain text.
- Represent audit metadata as allowlisted key/value rows. Do not add HTML,
  Markdown, recursive arbitrary JSON, syntax highlighting, or executable copy.
- Build role-specific response schemas so prohibited fields never reach the
  page.

## Design and Data Flow

```text
Thin App Router page
  → Security, Audit, or Privacy view
  → Phase 7 query/action hook
  → SecurityRepository
  → existing versioned Admin API client
  → MSW security handler
  → structural role projection
  → immutable evidence fixture or revisioned Phase 7 runtime state
```

- Pages never derive risk, signals, legal holds, export eligibility, deletion
  eligibility, retention bounds, or allowed transitions.
- All platform totals declare their entity semantic. Event/session counts may
  be additive; unique affected customers use authoritative deduplicated totals.
- Unknown platform attribution stays explicit and is not assigned to iOS or
  Android.
- Audit evidence has GET contracts only. No mutation type, handler, hook, or UI
  control exists for audit records.
- Simulated export download returns only an allowed boolean, expiry, and
  mock-only message.
- Deletion completion checks required checklist state in the runtime state
  before the transition succeeds.
- Active legal hold forces cleanup status to suspended independently of the
  displayed retention days.

## Implementation Sequence

### Phase A — Shared contracts, permissions, and routes

1. Add Phase 7 permission keys, role mappings, route permission rules,
   navigation records, dynamic-route patterns, and focused tests.
2. Clear in-memory query data on simulated-role change and test that protected
   Phase 7 data is removed before the new role renders.
3. Define strict IDs, queries, pagination, timestamps, masked projections,
   platform metrics, safe metadata, action results, and error contracts.
4. Define security, audit, export, deletion, and retention schemas plus
   lifecycle and invariant tests.
5. Add repository methods, role-scoped query keys, hooks, locked mutations,
   and targeted invalidation tests.

### Phase B — Immutable fixtures and deterministic mock workflows

1. Add fictional Arabic/English, iOS/Android/Unknown/global fixtures with no
   real PII, IP, device ID, token, credential, archive content, or private
   payload.
2. Add deterministic transition functions for suspicious activity, incidents,
   support-access revocation, export requests, deletion requests, and retention
   updates.
3. Add MSW GET/POST/PATCH handlers for every OpenAPI operation with strict
   validation, permission projection, filters, pagination, scenarios, and safe
   errors.
4. Register handlers and reset Phase 7 state and its clock/counters in shared
   test setup.

### Phase C — Security and audit journeys

1. Add Security Overview, Authentication Events, Suspicious Activity, Admin
   Security, Permission Changes, Active Support Access, and Incident Detail
   views with thin routes.
2. Add reviewer/state actions, incident actions, and support-access revocation
   with expected state/version, confirmation, pending lock, safe conflict, and
   audit reference.
3. Add immutable Audit Explorer and Audit Event Detail using safe key/value
   metadata and no mutation surface.
4. Verify platform semantics, non-color status, structural projections,
   immutable evidence, keyboard/focus, and 390px urgent monitoring.

### Phase D — Privacy-request and retention journeys

1. Add Export Request list/detail with metadata-only scope labels, exact
   lifecycle, expiry, and no-file download simulation.
2. Add Deletion Request list/detail with checklist blockers, legal holds, exact
   lifecycle, and mock-only completion.
3. Add Retention Policy list/edit with integer-day bounds, protected audit
   minimum, legal-hold suspension, reason, confirmation, and stale-version
   conflict.
4. Verify no archive content, URLs, tokens, Blob, file transfer, customer-data
   deletion, cleanup execution, job scheduling, or browser persistence.

### Phase E — Cross-cutting verification

1. Add focused contract, repository, hook, state, projection, component, route,
   and Playwright coverage.
2. Extend global route, permission, no-direct-fixture, accessibility, direction,
   responsive, performance, and visual-preservation checks where applicable.
3. Run the complete command and manual matrix in `quickstart.md`.
4. Record exact results in a verification report during implementation; do not
   mark completion from planning evidence.

## Test Strategy

- **Contracts**: Strict unknown-field rejection, prefixed IDs, date ranges,
  pagination, enums, Unicode limits, bidi/control rejection, metadata keys and
  bounds, scope allowlist, timestamps, platform semantics, action-specific
  fields, and response projection.
- **State**: Every clarified transition table, terminal states, incident
  reference requirement, legal hold, deletion checklist completion, retention
  bounds, expected revision, deterministic audit reference, injected clock,
  and reset.
- **Repository/handlers**: Every operation, URL encoding, query serialization,
  specific-before-parameterized ordering, permission matrix, structural
  projections, role-change cache removal, response validation, scenarios, and
  safe errors.
- **Components**: Loading/empty/partial/error/success/warning/permission/
  conflict/expiry states, tables/cards, plain metadata, timelines, checklist,
  forms, confirmations, hook-level pending locks, live announcements, and focus
  restore.
- **Playwright**: All 14 routes, five primary journeys, direct denied mutation,
  audit immutability, privacy exclusions, no-file download, keyboard, Arabic
  RTL/English LTR, reduced motion, and 1440/1280/1024/768/390.

## Backend Alignment

**Planned modules**: `auth`, `users`, `profiles`, `devices`, `roles`,
`permissions`, `support`, `audit`, `data-requests`, `files`, `subscriptions`  
**Planned entities**: `authentication_events`, `security_events`,
`security_incidents`, `admin_sessions`, `permission_change_events`,
`support_access_grants`, `audit_logs`, `data_export_requests`,
`account_deletion_requests`, `retention_policies`, `users`, `profiles`,
`devices`, `roles`, `permissions`, `support_tickets`, `subscriptions`  
**Proposed contracts**: Typed frontend schemas and MSW endpoints documented in
`contracts/admin-security-audit-privacy.openapi.yaml`  
**Deferred production security**: Independent NestJS authentication and
authorization, risk policy, session revocation, tamper-evident audit storage,
signed short-lived archive access, encryption, deletion/anonymization, legal
holds, retention enforcement, queues, jobs, rate limits, monitoring, alerting,
incident response, and secret management

## Governance Alignment Note

The constitution’s narrative delivery list uses legacy phase labels, while the
user-approved ten-spec master document, current feature pointer, and completed
Specs 001–007 explicitly map Phase 7 to Spec 008
`admin-security-audit-and-privacy`. This plan follows that exact approved Spec
008 folder and scope. It does not amend the constitution or move work between
Specs; the wording drift should be corrected only through a separately approved
constitution amendment.

## Post-Design Constitution Re-evaluation

- The design extends the current app and uses only installed dependencies.
- All 14 routes remain thin and cross typed repository/MSW boundaries.
- Sensitive fields are structurally excluded before presentation.
- Audit evidence is immutable and has no mutation contract.
- Export, deletion, and retention behavior changes deterministic mock state only.
- Raw HTML, Markdown, recursive arbitrary JSON, real files, redirects, and
  provider operations are unnecessary and prohibited.
- Mobile preserves urgent monitoring and safe revocation/approval actions;
  complex metadata and retention editing receive the specified desktop notice.
- Every sensitive mutation has strict validation, allowed transition, expected
  state/version, confirmation, pending lock, safe outcome, and planned audit
  alignment.
- All constitution gates remain passed. No exception or amendment is required.

## Complexity Tracking

No constitution deviation is planned.

| Violation | Why Required | Approved By | Follow-up |
|---|---|---|---|
| None | Not applicable | Not applicable | Not applicable |
