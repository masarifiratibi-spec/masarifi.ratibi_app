# Implementation Plan: Support, Feedback, Content, and Notifications

**Phase / Spec**: Phase 6 / Spec 007  
**Date**: 2026-07-29  
**Spec**: [spec.md](./spec.md)  
**Input**: Admin Web feature specification

## Summary

Extend the approved Admin Web with 22 Arabic-first support, feedback, content,
template, campaign, and delivery-monitoring routes. Use one typed
`communications` feature boundary, a versioned mock HTTP adapter, and one
deterministic revisioned runtime state. Reuse the existing shell, role
simulation, repository/hooks, locked mutation, table/card/chart, dialog, state,
and testing patterns. Do not add a backend, provider, real message delivery,
real file transfer, browser persistence, or dependency.

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
**Text limits**: search 120 Unicode characters, subject 160, customer message
8 KiB, internal note 2 KiB, content body 16 KiB  
**Text semantics**: Unicode NFC, code-point character counts, UTF-8 byte counts
for KiB limits, and bidi/control rejection  
**Mock clock**: fixed/injected `2026-07-29T12:00:00+03:00`; no `Date.now()` in
Phase 6 state or handlers  
**File boundary**: Fictional metadata only; PDF/PNG/JPEG/plain text, declared
size ≤10 MiB; no bytes, upload, download, or storage path  
**Dependencies**: Existing packages only; no install or upgrade

## Constitution Check

*GATE: Every item passed before Phase 0 and was re-evaluated after Phase 1.*

- [x] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [x] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [x] The feature maps to Phase 6 / Spec 007 and planned support, feedback, content, notification, file, permission, and audit capabilities.
- [x] No NestJS, Supabase, Stripe, AI provider, database, real authentication, message provider, or real file operation is implemented.
- [x] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [x] Mock HTTP contracts are replaceable by the future NestJS API.
- [x] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [x] RTL/LTR, accessibility, reduced motion, and all approved viewports are covered.
- [x] Relevant loading, empty, partial, error, success, warning, conflict, and permission states are covered.
- [x] Customer, financial, recipient, token, attachment, and provider data is minimized or excluded; sensitive actions require confirmation.
- [x] All external, mocked, user-entered, URL, attachment-metadata, and API values are treated as untrusted and validated with Zod.
- [x] Rendering, links, attachment metadata/previews, client storage, environment exposure, errors, and logs are safe.
- [x] Mock permissions remain development-only UX controls; future backend authorization is documented.
- [x] Dependencies are unchanged.
- [x] Security-sensitive behavior has accessible Vitest and Playwright coverage planned.
- [x] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

## Project Structure

### Feature documentation

```text
specs/007-admin-support-content-and-notifications/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-support-content-notifications.openapi.yaml
└── tasks.md
```

### Existing Admin Web paths to modify

```text
src/
├── app/admin/
│   ├── support/...
│   ├── feedback/...
│   ├── content/...
│   └── notifications/...
├── components/admin/
│   ├── AdminShell.tsx
│   ├── shell-state.ts
│   └── ui.tsx
├── core/permissions/
│   ├── permissions.ts
│   └── role-map.ts
├── features/
│   ├── communications/
│   │   ├── contracts.ts
│   │   ├── contracts.test.ts
│   │   ├── repository.ts
│   │   ├── repository.test.ts
│   │   ├── hooks.ts
│   │   ├── hooks.test.ts
│   │   ├── shared/
│   │   │   ├── OperationalFilters.tsx
│   │   │   ├── SafeText.tsx
│   │   │   └── CommunicationActionDialog.tsx
│   │   ├── support/
│   │   │   ├── SupportViews.tsx
│   │   │   └── SupportViews.test.tsx
│   │   ├── feedback/
│   │   │   ├── FeedbackViews.tsx
│   │   │   └── FeedbackViews.test.tsx
│   │   ├── content/
│   │   │   ├── ContentViews.tsx
│   │   │   └── ContentViews.test.tsx
│   │   └── notifications/
│   │       ├── NotificationViews.tsx
│   │       └── NotificationViews.test.tsx
│   └── foundation/useLockedMutation.ts
├── mocks/
│   ├── fixtures/communications.ts
│   ├── handlers/communications.ts
│   ├── handlers/index.ts
│   ├── phase6-communications-state.ts
│   ├── phase6-communications-state.test.ts
│   ├── browser.ts
│   └── server.ts
└── tests/setup.ts

tests/e2e/
├── support-content-notifications.spec.ts
├── accessibility.spec.ts
├── permissions.spec.ts
├── performance.spec.ts
└── visual-preservation.spec.ts
```

**Structure decision**: Use one feature boundary and four focused view groups.
Keep route files thin. Keep fixtures immutable, mutations in one state module,
HTTP behavior in one handler module, and contract validation in the repository.
Do not build a schema-driven page framework or split into five repositories.

## Phase 1: Existing Pattern Documentation (T001)

The following existing Admin Web patterns will be reused by Phase 6:

### Route and Navigation Pattern
- **File**: `src/components/admin/AdminShell.tsx`
- **Pattern**: Navigation groups with icons, labels, and route permissions
- **Role Check**: `hasPermission(role, routePermissionKey)` from `role-map.ts`
- **Route Guard**: Direct route denial via `resolveRoutePermission()` in `shell-state.ts`
- **Accessibility**: ARIA labels, active route indicators, mobile responsive sidebar

### Permission System Pattern
- **Files**: `src/core/permissions/permissions.ts` and `src/core/permissions/role-map.ts`
- **Constants**: `ADMIN_ROLES` array and `PERMISSION_KEYS` array with string literal union types
- **Role Mapping**: `permissionsByRole` record mapping roles to permission arrays
- **Helper**: `hasPermission(role, permissionKey)` returns boolean
- **Actors**: `SIMULATED_ACTORS` provides stable fictional actor IDs per role
- **Testing**: Contract-based Vitest tests in `role-map.test.ts` for all role/permission combinations

### API Client and Repository Pattern
- **Files**: Feature-specific `repository.ts` and `contracts.ts` (e.g., `src/features/users/`)
- **Pattern**: Repository functions with typed requests/responses via Zod schemas
- **Error Handling**: `ApiError` from `@/core/api/errors` with `safeApiMessage()` for safe error messages
- **Base URL**: All existing repositories use `/api/v1/admin` prefix
- **Testing**: `repository.test.ts` validates request construction, response parsing, error handling

### Mock Service Worker Pattern
- **Files**: `src/mocks/handlers/[feature].ts` and `src/mocks/handlers/index.ts`
- **Registration**: Specific paths registered before parameterized paths in handlers array
- **Pattern**: HTTP method handlers with request validation, permission projections, response mocking
- **Integration**: `src/mocks/browser.ts` and `src/mocks/server.ts` configure MSW for Vitest/Playwright

### Locked Mutation Pattern
- **File**: `src/features/foundation/useLockedMutation.ts`
- **Purpose**: Prevents duplicate concurrent mutations using resource/action lock keys
- **Implementation**: `useLockedMutation({ lockKey, mutationFn, onSuccess })` wraps TanStack Query mutations
- **Error**: Returns 409 Conflict error for locked resources
- **Testing**: Repository/hook tests verify lock rejection and proper invalidation

### Contract Schema Pattern
- **File**: `src/features/shared/admin-schemas.ts`
- **Library**: Zod for runtime validation and TypeScript inference
- **Pattern**: Strict schemas with `.refine()` for custom validation, `.enum()` for allowed values
- **Reuse**: Feature schemas import and extend shared schemas (e.g., `metricSchema`, `severitySchema`)
- **Testing**: `contracts.test.ts` validates all schemas accept valid input and reject invalid cases

### Test Structure Pattern
- **Unit Tests**: `src/features/[feature]/[module].test.ts` for contracts, repository, hooks
- **State Tests**: `src/mocks/phase[X]-[domain]-state.test.ts` for mutation logic
- **Component Tests**: `src/features/[feature]/[views].test.tsx` for React component behavior
- **E2E Tests**: `tests/e2e/[feature].spec.ts` for full user journeys
- **Assertions**: Vitest `expect()` with specific success/failure cases, no snapshot-only tests

### Admin UI Component Pattern
- **Files**: `src/components/admin/` (AdminShell, AccessDenied, DateRangeControl, etc.)
- **Styling**: Tailwind CSS with Gulf Premium Design System tokens
- **Icons**: Lucide Icons via `lucide-react`
- **Charts**: Recharts for data visualization
- **Tables**: TanStack Table for operational lists with pagination
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: Arabic-first RTL with English LTR readiness via `applyDocumentLocale()`

## Phase 1: OpenAPI Contract Validation (T002)

The OpenAPI contract defines 27 operations across five domains:

### Support Operations (7)
1. `getSupportOverview` - Privacy-safe support metrics
2. `listSupportTickets` - Role-projected ticket page with filters
3. `getSupportTicket` - Detailed ticket with messages and actions
4. `actOnSupportTicket` - Assignment, priority, reply, note, state transitions
5. `listSupportCategories` - Category management list
6. `createSupportCategory` - Create new category
7. `actOnSupportCategory` - Update or retire categories

### Feedback Operations (5)
8. `listFeedback` - Feedback list with filters
9. `getFeedback` - Detailed feedback with linked records
10. `actOnFeedback` - Review, plan, link, resolve, dismiss feedback
11. `listAbuseReports` - Restricted abuse report list
12. `actOnAbuseReport` - Investigate, escalate, resolve abuse reports

### Content Operations (6)
13. `listContent` - Content items across all collections
14. `createContent` - Create new content items
15. `getContent` - Detailed content item
16. `actOnContent` - Update, publish, retire content
17. `listTemplates` - Template management list
18. `createTemplate` - Create new templates
19. `actOnTemplate` - Update, activate, retire templates

### Notification Operations (6)
20. `getNotificationOverview` - Delivery health metrics
21. `previewNotificationAudience` - Aggregate audience preview
22. `listCampaigns` - Campaign list with filters
23. `createCampaignDraft` - Create draft campaign
24. `getCampaign` - Detailed campaign with wizard state
25. `actOnCampaign` - Schedule, send, pause, cancel campaigns

### Transactional & Delivery Operations (3)
26. `listTransactionalTemplates` - Transactional template management
27. `listDeliveryLogs` - Privacy-safe delivery log monitoring

**Validation Status**: ✅ All 27 operations align with Spec 007 requirements (FR-001 through FR-025) and entity names in data-model.md. No documentation drift detected.

## Phase 1: Scope Confirmation (T004)

**Scope Validation**: ✅ No scope conflicts detected

The implementation confirms the following constraints:

### No New Dependencies
- ✅ All required packages are already installed: `@tanstack/react-query`, `@tanstack/react-table`, `zod`, `msw`, `vitest`, `playwright`, `recharts`, `lucide-react`, `react-hook-form`
- ✅ No `npm install` or package upgrades required
- ✅ Existing TypeScript strict mode and project configuration will be reused

### No Backend Implementation
- ✅ Frontend-only implementation in `apps/admin-web`
- ✅ Mock HTTP boundary via MSW (`src/mocks/handlers/`)
- ✅ Typed contracts replaceable by future NestJS API
- ✅ No NestJS, Supabase, database, or server-side code

### No Database Persistence
- ✅ Deterministic in-memory mock state in `src/mocks/phase6-communications-state.ts`
- ✅ No browser storage (localStorage, sessionStorage, IndexedDB)
- ✅ No file system or backend persistence
- ✅ Reset capability restores initial state

### No Provider Integration
- ✅ Mock-only notification campaigns and delivery monitoring
- ✅ No real email, push, or in-app message delivery
- ✅ No provider credentials, API keys, or secrets
- ✅ No real recipient resolution or audience targeting

### No Real Authentication
- ✅ Existing role simulation in `src/core/permissions/`
- ✅ Development-only permission controls
- ✅ Future backend authorization documented but not implemented

### No Raw Attachment Bytes
- ✅ Fictional metadata-only records
- ✅ Safe filename, media type, declared size ≤10 MiB
- ✅ No file upload/download, storage paths, or byte operations
- ✅ PDF/PNG/JPEG/plain-text media types only

**Scope Conflict**: None detected. The implementation aligns with all Phase 6 requirements and constraints.

## Design and Data Flow

```text
Thin App Router page
  → focused communications view
  → communications query/action hook
  → CommunicationsRepository
  → shared versioned API client
  → MSW communications handler
  → structural role projection
  → immutable fixture or revisioned Phase 6 runtime state
```

- Query keys begin with `["phase6-communications"]` and include resource,
  validated filters, platform, period, and IDs.
- Mutation locks use `resource:id:action`; success invalidates only affected
  list/detail/overview keys.
- Specific MSW routes such as `/feedback/abuse-reports` are registered before
  parameterized `/feedback/:feedbackId` routes.
- Ticket access requests call the existing Spec 003 `useCreateAccessRequest`
  boundary; Phase 6 stores only the returned safe reference.
- Content Manager/Security limited projections are linked-only inside an
  already authorized feedback/abuse/domain record; direct route guards remain
  denied.
- Contract schemas are strict and reject unknown fields on requests and
  responses.
- Pages never derive SLA, severity, audience eligibility, consent exclusions,
  rate denominators, or provider outcomes.

## Implementation Sequence

### Phase A — Shared contracts and permissions

1. Add Phase 6 permission keys, role mappings, route rules, navigation items,
   and tests.
2. Define strict shared IDs, text, query, pagination, projection, attachment,
   metric, action, and error contracts.
3. Define support, feedback/abuse, content/template, campaign, and delivery
   schemas and invariant tests.
4. Add repository methods, query keys, hooks, mutation locks, and targeted
   invalidation tests.

### Phase B — Deterministic mock boundary

1. Add fictional Arabic/English, iOS/Android/multi-platform/Unknown fixtures.
2. Add revisioned ticket, feedback, abuse, content, template, and campaign
   transition functions with reset tests.
3. Add MSW GET/POST handlers for every OpenAPI operation, including strict
   validation, permission projection, filters, pagination, scenarios, and safe
   errors.
4. Register handlers in browser/server and reset runtime state in test setup.

### Phase C — Support and feedback journeys

1. Add support dashboard/list/detail/category views and thin routes.
2. Add ticket assignment, priority, reply/note, and status flows; wire the
   access-request control to the existing Spec 003 hook.
3. Add feedback overview/detail/link/disposition and restricted abuse review.
4. Verify safe text, attachments metadata, stale state, pending locks, focus,
   structural projections, and 390px monitoring.

### Phase D — Content and template journeys

1. Add default-category hierarchy/editor and collection views for tips, FAQs,
   onboarding, help center, and announcements.
2. Add bilingual structured editors/previews, platform/audience scope,
   ordering/scheduling, publication, retirement, and conflict recovery.
3. Add email/push/transactional template views with trigger placeholder
   allowlists and safe previews.

### Phase E — Notification journeys and hardening

1. Add notification overview, campaign list/detail, and five-step creation
   wizard.
2. Enforce one channel, Send Now/future-only schedule, authoritative audience
   version/counts, template revision, opt-out exclusions, and duplicate locks.
3. Add delivery-log monitoring with privacy-safe fields and rate denominators.
4. Extend global permission, accessibility, performance, visual preservation,
   RTL/LTR, five-viewport, and route smoke coverage.
5. Run the complete verification sequence from `quickstart.md`.

## Test Strategy

- **Contracts**: strict unknown-field rejection, IDs, bounds, bidi/unsafe text,
  Unicode NFC/code-point/UTF-8 measurement, attachment metadata, localization,
  single-language audience refinements, action-specific required fields,
  platform semantics, rates, projections, and timestamp/state invariants.
- **State**: ticket ownership and reply rules, feedback links, abuse lifecycle,
  category cycles, translation/publication gates, template references,
  campaign audience/template revisions, injected-clock schedule conflicts, and
  reset.
- **Repository/handlers**: every GET/POST path, encoding, query serialization,
  permission matrix, structural projections, response validation, scenarios,
  and safe errors.
- **Components**: loading/empty/partial/error/success/warning/permission states,
  tables/cards, editors, preview, wizard, confirmations, pending locks, and
  focus restoration.
- **Playwright**: all 22 routes, primary stories, direct forbidden mutation,
  privacy, keyboard, Arabic RTL/English LTR, reduced motion, performance, and
  1440/1280/1024/768/390.

## Backend Alignment

**Planned modules**: `support`, `feedback`, `notifications`, `content`, `files`,
`users`, `profiles`, `devices`, `roles`, `permissions`, `audit-logs`  
**Planned entities**: `support_tickets`, `support_messages`,
`support_assignments`, `support_categories`, `support_internal_notes`,
`feedback_items`, `abuse_reports`, `attachments`, `default_categories`,
`financial_tips`, `faq_entries`, `onboarding_content`,
`help_center_articles`, `announcement_banners`, `notification_templates`,
`notification_campaigns`, `notification_deliveries`,
`notification_preferences`, `users`, `profiles`, `devices`, `roles`,
`permissions`, `audit_logs`  
**Proposed contracts**: Typed frontend schemas and MSW endpoints documented in
`contracts/admin-support-content-notifications.openapi.yaml`  
**Deferred production security**: Independent NestJS authorization, consent/
suppression, audience resolution, idempotency, rate limits, provider secrets,
delivery signing, queues, attachment scanning/storage, sanitization service,
retention, immutable audit, bounce/complaint handling, monitoring, and incident
response

## Post-Design Constitution Re-evaluation

- The design extends the existing app and uses only installed dependencies.
- All routes remain thin and cross typed repository/MSW boundaries.
- Sensitive data is structurally excluded or projected before presentation.
- Raw HTML/Markdown/JSON/file/provider handling is unnecessary and prohibited.
- Mobile preserves monitoring and safe urgent actions; complex configuration
  receives the specified desktop-required notice.
- Every sensitive mutation has validation, expected revision/state,
  confirmation, pending lock, safe outcomes, and planned audit alignment.
- All constitution gates remain passed. No exception or amendment is required.

## Complexity Tracking

No constitution deviation is planned.

| Violation | Why Required | Approved By | Follow-up |
|---|---|---|---|
| None | Not applicable | Not applicable | Not applicable |
