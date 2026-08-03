# Admin Web Feature Specification: Admin Foundation and Design Preservation

**Phase / Spec**: Phase 0 / Spec 001 of 010  
**Created**: 2026-07-27  
**Status**: Draft  
**Input**: "Create Phase 0 — Spec 001: Admin Foundation and Design Preservation from the approved ten-spec Admin frontend plan."

## Phase

- **Phase**: Phase 0
- **Spec**: 001-admin-foundation
- **Sequence**: First of ten; required before Specs 002–010

## Goal

Establish the reusable Admin Web foundation required by Specs 002–010 while
preserving the approved four-page implementation and Masarifi visual identity.
This specification prepares shared frontend boundaries, operational shell
behavior, mock contracts, permission simulation, responsive behavior,
accessibility, security, and verification without delivering later-phase
business features or any production backend.

## Clarifications

### Session 2026-07-27

- Q: Must Phase 0 migrate all four approved pages behind typed hooks and service/repository interfaces, or only establish shared boundaries? → A: Migrate all four approved pages during Phase 0 without visual changes.
- Q: Must Phase 0 define the complete future permission matrix or only permissions for the shared shell and four existing routes? → A: Define shell and existing-route permissions in Phase 0; complete the full matrix in Spec 010.
- Q: Must Phase 0 fully support dark theme or only prepare theme infrastructure? → A: Fully support and verify light and dark themes across the shell and all four approved pages.
- Q: Must Phase 0 global search cover every future Admin module or only existing Phase 0 routes and entities? → A: Search only existing Phase 0 routes and entities; defer future result groups to Specs 002–010.
- Q: What measurable responsiveness gate applies to the Phase 0 foundation? → A: Show primary shell content within 2.5 seconds and acknowledge interactions within 200 milliseconds under documented reference conditions, excluding deliberate slow-response mocks.

## Dependencies

- **Prior phase/spec**: None; this is the prerequisite for Specs 002–010.
- **Existing routes/components/tokens/assets**: Reuse `/admin`, `/admin/users`,
  `/admin/imports`, `/admin/system-health`, the current root redirect,
  `AdminShell`, Admin UI/chart components, existing design tokens, typography,
  logos, images, responsive rules, fixtures, types, tests, and project
  configuration.
- **Governing documents**: Masarifi Admin Dashboard Full Frontend Specification
  Version 3, Masarifi Full Product Technical Plan Version 3, Masarifi Gulf
  Premium Design System Version 2.1, and Admin Web Constitution Version 1.1.0.
- **Delivery dependency**: No later specification may assume a shared
  foundation capability until its Phase 0 acceptance criterion is satisfied.

## Assumptions

- The current four Admin pages are the approved visual and interaction
  baseline, including behavior that is not yet behind the target data boundary.
- Existing direct fixture imports and isolated raw visual values are migration
  debt. Phase 0 MUST move all four approved page data flows behind typed hooks
  and service or repository boundaries while keeping rendered design and
  working behavior unchanged.
- Role switching, permissions, authentication, incidents, notifications, and
  environments are fictional development simulations in this phase.
- Proposed contracts describe the frontend integration boundary; endpoint
  names remain subject to backend planning before production implementation.
- Phase 0 may add only the approved missing dependencies and configuration
  needed to establish the fixed frontend stack.

## Related Backend Modules

- auth, users, profiles, devices, roles, permissions, notifications, health,
  jobs, audit, files, and platform configuration.
- **Boundary**: Proposed typed contracts and mock HTTP behavior only. No NestJS,
  Supabase, database, provider, queue, or production-authentication code is
  permitted.

## Related Database Entities

- AdminUser
- AdminSession
- Role
- Permission
- AuditEvent
- Notification
- Incident
- Device
- FeatureFlag
- SystemSetting

These names provide future backend alignment only and do not authorize schema,
migration, policy, or persistence work.

## Roles

- **Roles**: Super Admin, Support Agent, Billing Operator, Parser and Import
  Operator, AI Operator, Content Manager, and Security Administrator.

## Permissions

- **Development simulation**: A clearly labeled development-only role switcher
  may change mock visibility and access-denied states.
- **Phase 0 permission keys**: `admin.overview.read`, `users.read`,
  `imports.read`, `system-health.read`, `global-search.use`, and
  `attention.read`.
- **Phase 0 route mapping**:

  | Role | Overview | Users | Imports | System Health |
  |------|----------|-------|---------|---------------|
  | Super Admin | Allow | Allow | Allow | Allow |
  | Support Agent | Allow | Allow | Deny | Deny |
  | Billing Operator | Allow | Deny | Deny | Deny |
  | Parser and Import Operator | Allow | Deny | Allow | Deny |
  | AI Operator | Allow | Deny | Deny | Deny |
  | Content Manager | Allow | Deny | Deny | Deny |
  | Security Administrator | Allow | Allow | Deny | Allow |

- **Shell mapping**: All simulated roles may use global search and read
  permission-filtered attention items. Results MUST omit entities and targets
  outside the role's Phase 0 route permissions.
- **Search scope**: Phase 0 search groups are Navigation, Users, Imports, and
  System Health. Groups introduced by Specs 002–010 are unavailable until their
  owning specification defines their contracts and permissions.
- **Navigation behavior**: Navigation groups and actions are shown, disabled, or
  hidden according to the simulated permission contract.
- **Direct-route behavior**: A simulated forbidden response shows an accessible
  access-denied state with the missing permission and safe return action.
- **Production boundary**: Client navigation, disabled controls, hidden actions,
  route guards, and mock roles are UX controls only. Future backend operations
  independently authorize every request.
- **Deferred matrix**: Permissions for routes and actions introduced by Specs
  002–010 are defined in their owning specifications and consolidated into the
  complete cross-module matrix in Spec 010.

## User Stories

### User Story 1 — Preserve the Approved Admin Experience (Priority: P1)

As a Masarifi product owner, I need the existing Admin pages to retain their
approved identity and behavior while the shared foundation is introduced so
future work does not replace or visually regress the approved frontend.

**Why this priority**: Every later phase depends on the approved implementation
remaining the visual source baseline.

**Independent test**: Compare all four existing routes before and after Phase 0
at every approved viewport and confirm that their content hierarchy, palette,
typography, density, RTL behavior, and interactions remain equivalent.

**Acceptance scenarios**:

1. **Given** an approved existing route, **When** Phase 0 foundation boundaries
   are applied, **Then** the page retains its approved layout, content,
   interactions, tokens, and responsive behavior.
2. **Given** a new shared state or component variant is required, **When** it is
   specified, **Then** it derives from the existing components and Gulf Premium
   Design System Version 2.1 without introducing another design language.
3. **Given** a semantic design token exists, **When** an affected component is
   updated, **Then** it uses that token rather than adding a scattered raw
   color.

### User Story 2 — Use a Consistent Operational Shell (Priority: P1)

As an Admin operator, I need a predictable Arabic-first shell with navigation,
context controls, alerts, and responsive behavior so I can orient myself and
reach permitted operational areas consistently.

**Why this priority**: The shell is shared by every later module.

**Independent test**: Use the shell at all five viewports in Arabic RTL and
English LTR modes and confirm that navigation, breadcrumbs, page headers,
search shell, date range, environment, notifications, incidents, profile,
language, and theme controls have defined behavior.

**Acceptance scenarios**:

1. **Given** an Arabic session at desktop width, **When** the Admin shell opens,
   **Then** the sidebar appears on the logical RTL side with grouped navigation
   and the active route identified by label, icon, and state.
2. **Given** a tablet or mobile viewport, **When** navigation is opened, **Then**
   it uses an accessible drawer and preserves logical focus order.
3. **Given** a user changes direction or theme, **When** the preference is
   applied, **Then** the shell and current page fully adopt the selected
   direction and theme without losing route context.
4. **Given** a development or staging simulation, **When** the shell is visible,
   **Then** the environment indicator is persistent and cannot be confused with
   production.

### User Story 3 — Consume Replaceable Typed Mock Contracts (Priority: P1)

As a frontend engineer, I need every page data flow to use typed hooks,
services or repositories, and mock HTTP contracts so later NestJS integration
does not require redesigning pages.

**Why this priority**: A stable data boundary is the principal architectural
deliverable of Phase 0.

**Independent test**: Exercise success and failure scenarios through mock HTTP
handlers on all four approved pages and confirm that none imports raw fixture
arrays and that each public service contract can accept a future real API
adapter.

**Acceptance scenarios**:

1. **Given** a page requests data, **When** the mock adapter responds, **Then**
   data reaches the page through a typed hook and service or repository.
2. **Given** a slow, empty, invalid, forbidden, conflict, or server response,
   **When** it is selected as the mock scenario, **Then** the relevant shared UI
   state is rendered with a safe recovery path.
3. **Given** a paginated collection, **When** filters, sorting, or pages change,
   **Then** validated query values and pagination metadata cross the contract
   boundary consistently.
4. **Given** a future NestJS adapter, **When** it implements the same public
   contract, **Then** presentation components require no contract-shape change.

### User Story 4 — Simulate Permissions and Sensitive Actions Safely (Priority: P1)

As an Admin operator, I need permission-aware controls, privacy-safe data, and
clear sensitive-action confirmation so the frontend demonstrates intended
operational safeguards without pretending to provide production security.

**Why this priority**: Admin actions and customer financial information carry
high privacy and access-control risk.

**Independent test**: Switch among all simulated roles and verify allowed,
disabled, hidden, denied, masked, pending, confirmed, failed, and conflict
states without exposing real data or relying on client controls as security.

**Acceptance scenarios**:

1. **Given** a role lacks a permission, **When** it views navigation or opens a
   protected mock route, **Then** the UI shows the specified permission state
   without exposing restricted content.
2. **Given** a destructive or privacy-sensitive mock action, **When** an
   operator initiates it, **Then** the confirmation explains scope and
   consequences, identifies the expected audit event, and locks duplicate
   submission while pending.
3. **Given** customer data is displayed, **When** the page loads, **Then**
   sensitive financial and personal values are masked, aggregated, or omitted
   by default.
4. **Given** an expired simulated session or temporary-access window, **When**
   access is attempted, **Then** an accessible expiration state replaces the
   protected content.

### User Story 5 — Verify an Accessible, Responsive Foundation (Priority: P2)

As a reviewer, I need repeatable automated and manual verification for
direction, viewports, states, accessibility, contracts, and security so every
later phase begins from an evidence-backed foundation.

**Why this priority**: Shared defects would otherwise propagate across all
remaining specifications.

**Independent test**: Run the required checks and complete the viewport,
keyboard, screen-reader, reduced-motion, security, and design-preservation
review with recorded results.

**Acceptance scenarios**:

1. **Given** the Phase 0 implementation, **When** required automated commands
   run, **Then** type checking, lint, unit/component tests, end-to-end tests, and
   production build complete successfully.
2. **Given** keyboard-only or assistive-technology use, **When** shell controls,
   tables, filters, dialogs, drawers, warnings, and denied states are used,
   **Then** focus, names, roles, announcements, and reading order remain clear.
3. **Given** reduced motion or either text direction, **When** the shell and
   shared states render, **Then** no essential information depends on motion,
   position, or color alone.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/` | Redirect to the Admin landing route | Simulated signed-in Admin roles | Existing |
| `/admin` | Approved overview and shell baseline | All simulated Admin roles | Existing |
| `/admin/users` | Approved user-management baseline | Super Admin, Support Agent, Security Administrator | Existing |
| `/admin/imports` | Approved import-operations baseline | Super Admin, Parser and Import Operator | Existing |
| `/admin/system-health` | Approved operational-health baseline | Super Admin, Security Administrator | Existing |

Phase 0 MUST NOT add later-phase business routes. Authentication, session
expired, and access denied are shared UI states or mock scenarios in this phase,
not production authentication routes.

## Functional Requirements

- **FR-001**: Phase 0 MUST preserve the approved rendered design and working
  behavior of all four existing Admin pages.
- **FR-002**: The foundation MUST retain deep teal as the primary interaction
  color and limit bronze to approximately 2%–3% of Admin screen coverage.
- **FR-003**: The foundation MUST keep financial semantic colors separate from
  operational status and severity colors.
- **FR-004**: Shared and affected components MUST use existing semantic tokens
  when a suitable token exists.
- **FR-005**: The application shell MUST provide grouped navigation,
  breadcrumbs, page headers, global search shell, date range, environment,
  notification, incident, language, theme, profile, and quick-action controls.
- **FR-006**: Shell controls without a Phase 0 business destination MUST expose
  an explicit unavailable or planned state rather than a broken route.
- **FR-007**: Arabic RTL MUST be the default direction and English LTR behavior
  MUST remain supported through direction-safe layout behavior.
- **FR-008**: The theme switcher MUST apply complete light and dark themes to
  the shared shell and all four approved pages, with readable semantic states
  and the approved Masarifi identity in both themes.
- **FR-009**: Relevant shared metric and filter foundations MUST support All
  Platforms, iOS, and Android.
- **FR-010**: Combined customer totals MUST represent unique customers and MUST
  NOT be calculated by adding iOS and Android customer counts.
- **FR-011**: Every data flow on `/admin`, `/admin/users`, `/admin/imports`, and
  `/admin/system-health` MUST use a feature hook and typed service or repository
  interface by the end of Phase 0.
- **FR-012**: The four approved pages and their presentation components MUST
  have zero direct raw fixture-array imports.
- **FR-013**: Mock handlers MUST simulate HTTP behavior and MUST remain
  replaceable by a NestJS adapter implementing the same public contracts.
- **FR-014**: The shared API error model MUST support status, stable code, safe
  message, optional field errors, and optional correlation identifier.
- **FR-015**: The shared pagination model MUST support page, page size, total
  items, and total pages.
- **FR-016**: Filters, search parameters, identifiers, and mutation payloads
  MUST be parsed, normalized, and validated before use.
- **FR-017**: The shared table foundation MUST define sorting, filtering,
  pagination, responsive overflow, selection, bulk-action, loading, empty,
  error, and permission behavior.
- **FR-018**: The shared chart foundation MUST define accessible summaries,
  loading, empty, error, RTL/LTR, responsive, and semantic-color behavior.
- **FR-019**: Shared feedback patterns MUST cover loading, skeleton, empty,
  error, success, warning, conflict, rate-limited, unavailable, and
  access-denied states where relevant.
- **FR-020**: Toasts MUST communicate transient outcomes without replacing
  persistent error guidance or accessible status announcements.
- **FR-021**: Dialogs and drawers MUST manage focus, restore focus on close,
  expose accessible names, and support Escape except where dismissal would
  cause data loss.
- **FR-022**: Destructive and sensitive actions MUST require a confirmation
  that explains scope and consequences and identifies the expected audit event.
- **FR-023**: Sensitive mutations MUST reject duplicate submission while a mock
  request is pending and MUST define success, failure, and conflict outcomes.
- **FR-024**: Role and permission simulation MUST implement the six Phase 0
  permission keys and route mapping defined in this specification and MUST be
  isolated and visibly identified as development-only behavior.
- **FR-025**: Permission-aware navigation and controls MUST NOT be described as
  production authorization.
- **FR-026**: Sensitive financial and customer information MUST be masked,
  aggregated, or excluded by default, using sanitized fictional mock data.
- **FR-027**: User-facing errors and development logs MUST exclude secrets,
  stack traces, internal paths, raw exceptions, private payloads, and unmasked
  customer data.
- **FR-028**: The frontend MUST NOT store tokens, financial data, sensitive
  customer details, temporary-access data, or private identifiers in client
  storage without explicit security approval.
- **FR-029**: Browser-exposed environment values MUST be intentionally public
  and MUST NOT contain secrets or private credentials.
- **FR-030**: Raw HTML, Markdown, JSON, imported content, provider payloads,
  notifications, and AI-generated content MUST use safe presentation and
  sanitization boundaries; undocumented `dangerouslySetInnerHTML` is forbidden.
- **FR-031**: External links opened in a new tab MUST prevent opener access, and
  redirect targets MUST be validated before navigation.
- **FR-032**: Any Phase 0 file-input foundation MUST define allowed types,
  maximum size, safe filename behavior, unsupported formats, failures, and
  malicious or invalid file states.
- **FR-033**: New dependencies MUST be limited to missing items in the approved
  fixed stack and reviewed for maintenance, duplication, weight, compatibility,
  and known unresolved security risk.
- **FR-034**: Dependency upgrades or replacements unrelated to the Phase 0
  foundation MUST NOT occur.
- **FR-035**: Application code introduced or modified in Phase 0 MUST compile in
  strict mode without `any`.
- **FR-036**: The project MUST provide repeatable unit/component,
  end-to-end, typecheck, lint, and production-build commands aligned with the
  approved testing stack.
- **FR-037**: Phase completion MUST include a review for design regression,
  unsafe rendering, validation gaps, permission assumptions, insecure storage,
  environment leakage, unsafe errors or logs, dependency risks, and broken
  masking.
- **FR-038**: Phase 0 MUST document all deferred production protections,
  including backend authorization, database policies, rate limiting,
  encryption infrastructure, provider-secret handling, and penetration
  testing.
- **FR-039**: Global search MUST return permission-filtered Navigation, Users,
  Imports, and System Health results only; later-module result groups MUST NOT
  be simulated as complete Phase 0 features.
- **FR-040**: Under reference conditions documented in the Phase 0 quickstart,
  primary shell content MUST become visible within 2.5 seconds and each local
  interaction MUST show visible acknowledgement within 200 milliseconds.
  Deliberate slow-response mock scenarios are excluded from this gate.

## Platform Data Requirements

- Shared platform controls MUST use `all`, `ios`, and `android` as stable
  semantic values with Arabic and English presentation labels.
- `all` is the default where a platform filter is relevant.
- `uniqueCustomersTotal` is a deduplicated account count supplied by the
  contract and MUST NOT be derived from `iosCustomers + androidCustomers`.
- Device and event totals may be additive only when the contract states the
  metric represents devices or non-duplicated events.
- The foundation MUST support `iosOnlyCustomers`, `androidOnlyCustomers`, and
  `multiPlatformCustomers` in typed scenarios.
- Unknown or unattributed platform values may appear only with a documented
  contract and visible data-quality state.
- Platform controls MUST not imply that unsupported iOS SMS or notification
  access exists.

## UX and Design Requirements

- Preserve every approved page and use Masarifi Gulf Premium Design System
  Version 2.1 as the visual source of truth.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep Admin surfaces neutral, data-dense, professional, operational, and less
  decorative than customer or marketing experiences.
- Preserve IBM Plex Sans Arabic and IBM Plex Sans usage, approved spacing,
  rounded surfaces, restrained borders and shadows, current light-mode design,
  and dark-mode compatibility.
- Keep financial semantic colors separate from system status and severity
  colors; status MUST also use text, label, and icon rather than color alone.
- Reuse existing Admin components before adding a missing state or variant.
- Do not add generic dashboard styling, excessive gradients or bronze,
  marketing imagery, crypto-dashboard patterns, or incompatible density.
- Preserve the current logo, assets, route hierarchy, and content direction.

## Responsive Requirements

- **Arabic RTL default**: Sidebar, navigation order, breadcrumbs, controls,
  tables, drawers, dialogs, charts, and directional icons follow logical RTL
  order.
- **English LTR readiness**: Direction changes without mirrored text, broken
  alignment, reversed data meaning, or physical left/right assumptions.
- **1440px**: Full RTL sidebar, complete topbar controls, persistent filters,
  multi-column summaries, and full table presentation.
- **1280px**: Full or approved compact sidebar, reduced spacing, and all
  essential controls retained.
- **1024px**: Collapsible sidebar, prioritized table columns, overflow actions,
  and no horizontal page-level clipping.
- **768px**: Drawer navigation, two-column or single-column content as needed,
  filter drawers, and selective table columns.
- **390px**: Simplified monitoring and urgent-action shell; complex
  configuration shows a desktop-required notice rather than an unusable form.

## Accessibility Requirements

- All interactive controls MUST be keyboard operable with visible focus and
  logical tab order in RTL and LTR.
- Navigation, dialogs, drawers, alerts, status changes, tables, filters,
  pagination, charts, masked fields, warnings, and access-denied states MUST
  expose appropriate semantic HTML and accessible names.
- Dialogs MUST trap focus while open and restore it to the initiating control
  on close.
- Touch targets MUST be at least 44px where touch interaction is expected.
- Status, severity, selection, and validation MUST NOT rely on color alone.
- Chart foundations MUST provide a textual summary or equivalent accessible
  data representation.
- Reduced-motion preferences MUST disable nonessential animation without hiding
  information.
- Security controls, confirmations, masked fields, and warnings MUST remain
  screen-reader accessible.

## Proposed API Contracts

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|--------|-----------|--------------|---------------|----------------------------|
| `GET` | `/api/v1/admin/session` | None | `AdminSessionResponse` | auth, roles, permissions |
| `GET` | `/api/v1/admin/navigation` | `NavigationQuery` | `AdminNavigationResponse` | roles, permissions, platform configuration |
| `GET` | `/api/v1/admin/attention` | `AttentionQuery` | `PaginatedResponse<AttentionItem>` | notifications, incidents, health, jobs |
| `GET` | `/api/v1/admin/search` | `GlobalSearchQuery` | `PaginatedResponse<GlobalSearchResult>` | users, imports, health, routing |
| `GET` | `/api/v1/admin/platform-options` | None | `PlatformOptionsResponse` | devices, platform configuration |

These are proposed frontend contracts only. Pages MUST consume them through
typed services or repositories and MUST NOT import raw mock arrays. Mock
handlers MUST validate request values and provide stable response envelopes.

## Frontend Types

- **`AdminRole`**: Stable union of the seven simulated Admin roles.
- **`PermissionKey`**: Stable permission identifier used by navigation and
  action visibility.
- **`AdminSessionResponse`**: Fictional development session, role,
  permissions, environment, locale, direction, theme, and expiration state.
- **`AdminNavigationItem`**: Label key, route, icon key, group, permission,
  availability, and optional attention count.
- **`AdminNavigationResponse`**: Ordered navigation groups for the current
  simulated role.
- **`EnvironmentName`**: `production | staging | development`.
- **`PlatformFilter`**: `all | ios | android`.
- **`PlatformBreakdown`**: Semantic total, iOS, Android, and optional
  multi-platform customer count.
- **`DateRange`**: Validated start and end values with a supported preset.
- **`ApiError`**: Status, stable code, safe message, optional field errors, and
  optional correlation identifier.
- **`PaginatedResponse<T>`**: Data plus page, page size, total items, and total
  pages.
- **`AttentionItem`**: Type, severity, safe summary, timestamp, route target,
  platform relevance, and permission.
- **`GlobalSearchQuery`**: Normalized query, entity filters, platform, page, and
  page size.
- **`GlobalSearchResult`**: Entity type, safe primary label, masked secondary
  label, route target, and permission. Phase 0 entity types are `navigation`,
  `user`, `import`, and `system-health`.
- **`AsyncState<T>`**: Idle, loading, success, empty, error, forbidden,
  conflict, or unavailable state with typed data or safe error.
- **`ConfirmationIntent`**: Action, scope, consequence, required permission,
  expected audit event, and duplicate-submission lock state.
- Application types MUST NOT use `any`.

## Mock Scenarios

- Default success
- Empty result
- Large result set
- Slow response
- Partial response
- Unauthorized
- Forbidden
- Not found
- Validation error
- Conflict
- Rate limited
- Provider unavailable
- Internal server error
- Fictional iOS-only, Android-only, multi-platform, multi-device, and
  deduplicated combined data

## Loading States

- **Loading**: Page, shell control, table, chart, drawer, and dialog skeletons
  preserve layout and expose an accessible busy state.

## Empty States

- **Empty**: No notifications, incidents, search results, table rows, or chart
  data show a contextual explanation and safe next action.

## Error States

- **Error**: Safe recoverable message for invalid input, not found, rate
  limited, provider unavailable, and internal error; private payloads and
  infrastructure details remain hidden.
- **Permission**: Unauthorized, forbidden, session-expired, temporary-access
  expired, hidden, disabled, and access-denied scenarios.
- **Conflict**: Duplicate or stale sensitive mutations preserve user context,
  unlock retry safely, and explain the conflict.
- **Partial response**: Available shell content remains usable while the failed
  region shows a local error and retry.

## Success States

- **Success**: Loaded shell data and completed mock actions show persistent
  content plus an accessible outcome message where relevant.

## Warning and Confirmation States

- **Warning**: Environment, temporary access, unsaved changes, sensitive
  actions, and degraded service states explain impact without relying on color.
- **Confirmation**: Destructive or sensitive intent explains scope,
  consequence, required permission, expected audit event, and pending lock
  before submission.
- **Large result set**: Search, tables, and attention lists use the shared
  pagination contract without rendering all records at once.

## Audit Expectations

- Simulated role changes, permission denials, environment changes, sensitive
  confirmations, and temporary-access expiration MUST identify the audit event
  expected from the future backend.
- Audit expectations MUST include actor, action, target, result, timestamp, and
  correlation identifier without fabricating an immutable production record.

## Privacy Rules

- Customer financial values, full email addresses, phone numbers, IP
  addresses, device identifiers, tokens, provider payloads, imported messages,
  and raw AI content remain masked, aggregated, sanitized, or omitted.
- Mocks, screenshots, tests, and documentation MUST contain fictional sanitized
  data only.
- Sensitive actions MUST explain scope and consequences and require explicit
  confirmation before the mock mutation begins.
- User-facing errors and logs MUST omit stack traces, internal paths, secrets,
  raw exceptions, private payloads, and unmasked personal or financial data.

## Security Requirements

- **Untrusted inputs**: Zod validation and normalization apply to forms,
  filters, search and URL parameters, identifiers, imported values, mock
  responses, and mutation payloads before use.
- **Safe rendering**: Phase 0 does not require raw HTML rendering.
  `dangerouslySetInnerHTML` is prohibited. Raw Markdown, JSON, provider,
  imported, notification, or AI content uses escaped text, constrained
  structured views, or an explicitly reviewed sanitizer.
- **Client storage and environment**: Secrets, tokens, financial data,
  temporary-access data, private identifiers, and sensitive customer details
  are prohibited from client storage and browser-exposed environment values.
- **Files and links**: Any shared file-input contract validates type, size,
  filename, unsupported format, failure, and malicious input. New-tab links
  prevent opener access, and redirect targets are allowlisted or rejected.
- **Permissions**: Mock roles, navigation, disabled controls, and route states
  improve UX only; future NestJS authorization remains mandatory for every
  operation.
- **Dependencies**: Only missing approved-stack dependencies may be introduced
  after maintenance, weight, duplication, compatibility, and known-risk review.
- **Security mock scenarios**: Invalid input, unsafe content, denied access,
  session expiration, temporary-access expiration, masked data, duplicate
  submission, conflict, and safe error behavior.
- **Deferred production controls**: Real authentication and authorization,
  Supabase policies, encryption infrastructure, rate limiting, provider-secret
  handling, penetration testing, and infrastructure protection are documented
  for later phases and MUST NOT be implemented now.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- A navigation item exists in the future route map but its feature route is not
  implemented; it shows a noninteractive planned state rather than a broken
  link.
- A simulated role changes while a drawer or dialog is open; unauthorized
  content closes and focus moves to a safe shell location.
- A date range has an end before its start or exceeds supported limits; it is
  rejected with a field-specific, localized validation message.
- A search query is empty, excessively long, contains control characters, or
  provides an unapproved redirect target; it is normalized or rejected before
  the mock request.
- A combined customer metric contains iOS and Android counts greater than its
  unique total because of multi-platform users; the total remains the supplied
  deduplicated value.
- One shell request fails while others succeed; the failure is isolated to its
  region and does not blank the entire page.
- A sensitive mock mutation is submitted twice; only the first request
  proceeds while the control remains locked.
- A session or temporary-access window expires with unsaved input; protected
  content is removed and the user receives a safe unsaved-change warning.
- A long Arabic or English label, large text scaling, or 390px viewport causes
  pressure; content wraps or truncates with an accessible full label and no
  overlap.
- Reduced motion is enabled; nonessential transitions stop while state changes
  remain understandable.
- Dark theme contains a status or financial color with insufficient contrast;
  the state fails acceptance until token contrast is corrected.
- A mock error contains a raw exception or private payload; the adapter maps it
  to the safe shared error model before presentation or logging.

## Out of Scope

- Any visual redesign of the approved Overview, Users, Imports, or System
  Health pages.
- Phase 1–9 business pages or completed feature workflows.
- Production login, two-factor authentication, password reset, session
  management, or authorization.
- NestJS modules, Supabase access, database schemas or policies, Stripe, AI
  providers, queues, storage, infrastructure monitoring, or real customer data.
- Penetration testing, encryption infrastructure, rate limiting, and
  provider-secret handling.
- Global-search result groups for subscriptions, payments, support, audit,
  jobs, parsers, AI, content, notifications, settings, and other later modules;
  their owning Specs 002–010 define and activate them.
- The complete future cross-module role and permission matrix; Spec 010
  consolidates permissions introduced by Specs 002–010.
- Production notification, incident, health, audit, export, or upload
  operations.
- Dependency upgrades or replacements unrelated to the missing approved
  foundation stack.
- New Mobile, API, or Marketing specifications.

## Acceptance Criteria

- **AC-001**: All four approved routes retain their visual identity and working
  behavior in light and dark themes at 1440px, 1280px, 1024px, 768px, and
  390px.
- **AC-002**: Arabic RTL is the default and every shared shell control remains
  usable in an English LTR verification scenario.
- **AC-003**: Every data flow on all four approved pages reaches presentation
  through a typed hook and service or repository, with zero direct raw fixture
  array imports from pages or presentation components.
- **AC-004**: Mock contracts demonstrate success, empty, slow, partial,
  unauthorized, forbidden, not-found, validation, conflict, rate-limited,
  provider-unavailable, and internal-error scenarios.
- **AC-005**: Shared platform scenarios include iOS-only, Android-only,
  multi-platform, multi-device, and correctly deduplicated unique-customer
  totals.
- **AC-006**: All seven simulated roles demonstrate their specified navigation,
  search, attention, allowed-route, disabled, and access-denied states for the
  Phase 0 permission map and are labeled development-only.
- **AC-007**: Sensitive data is masked or omitted in all foundation fixtures,
  screenshots, tests, errors, and logs.
- **AC-008**: Every sensitive mock mutation provides scope, consequence,
  confirmation, expected audit event, pending lock, success, failure, and
  conflict behavior.
- **AC-009**: Keyboard-only review can operate navigation, filters, tables,
  drawers, dialogs, confirmations, warnings, and permission states with visible
  focus and correct focus restoration.
- **AC-010**: Every shared chart has an accessible summary, and no financial,
  status, severity, validation, or selection state relies on color alone.
- **AC-011**: Application code added or modified by Phase 0 contains no `any`,
  avoids undocumented raw colors, and does not use
  `dangerouslySetInnerHTML`.
- **AC-012**: Security review finds no exposed secrets, unsafe client storage,
  unvalidated URL or form values, unsafe rendered content, private error or log
  payloads, unreviewed dependency additions, or broken privacy masking.
- **AC-013**: Typecheck, lint, Vitest, Playwright, and production build complete
  successfully with the commands recorded in the Phase 0 quickstart.
- **AC-014**: No real backend, database, authentication, payment, AI, queue,
  infrastructure, or provider integration is added.
- **AC-015**: Global search returns grouped, permission-filtered Navigation,
  Users, Imports, and System Health results, and exposes no active result group
  belonging to a later specification.
- **AC-016**: In the documented reference environment and default mock
  scenario, primary shell content is visible within 2.5 seconds and every
  tested local interaction displays pending, active, selected, open, or other
  visible acknowledgement within 200 milliseconds.

## Success Criteria

- **SC-001**: Reviewers can identify the shared source, mock, contract, and test
  location for any Phase 0 capability in no more than two navigation steps from
  the feature documentation.
- **SC-002**: 100% of the four approved routes pass the light-theme and
  dark-theme five-viewport design-preservation review with no unapproved visual
  change.
- **SC-003**: 100% of shared interactive components covered by Phase 0 have
  documented default, focus, disabled, loading, success, warning, and error
  behavior where applicable.
- **SC-004**: 100% of Phase 0 mock requests have at least one success scenario
  and every relevant failure scenario defined by this specification.
- **SC-005**: 100% of reviewed sensitive fields are masked, aggregated, or
  omitted by default.
- **SC-006**: All seven simulated roles can be evaluated without real
  authentication and without presenting client-side controls as production
  authorization.
- **SC-007**: All required automated verification commands finish successfully
  before Phase 0 is reported complete.
- **SC-008**: The accessibility review reports zero blocking keyboard,
  focus-order, accessible-name, color-only, or reduced-motion defects in shared
  Phase 0 behavior.
- **SC-009**: 100% of sampled Phase 0 shell loads and local interactions meet
  the 2.5-second visibility and 200-millisecond acknowledgement gates under the
  documented reference conditions, excluding deliberate slow mocks.

## Verification

The following are required Phase 0 completion commands. Their presence here is
not a claim that they have been executed:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Viewport and accessibility checks**: Run Playwright coverage at 1440px,
  1280px, 1024px, 768px, and 390px, followed by keyboard, focus, semantic,
  contrast, screen-reader, chart-summary, RTL/LTR, and reduced-motion review.
- **Security review**: Review sensitive data, rendering, Zod validation,
  permissions, storage, public environment values, redirects, files, errors,
  logs, dependencies, duplicate submissions, deferred backend controls, and
  privacy masking.
- **Design preservation review**: Compare the four existing approved routes
  against the pre-Phase 0 baseline in light mode, dark compatibility, Arabic
  RTL, English LTR, and all approved viewports.
- **Performance review**: Record the reference device, browser, production
  build, viewport, and default mock latency in the quickstart, then measure
  primary shell visibility and local interaction acknowledgement. Run slow
  mocks separately as state-behavior tests.

Successful verification MUST NOT be claimed unless each named command or review
was actually executed successfully.
