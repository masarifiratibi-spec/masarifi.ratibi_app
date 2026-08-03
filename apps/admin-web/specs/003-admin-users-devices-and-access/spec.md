# Admin Web Feature Specification: Users, Devices, Sessions, and Controlled Access

**Phase / Spec**: Phase 2 / Spec 003 of 010  
**Created**: 2026-07-28  
**Status**: Draft  
**Input**: "Create a specification for Phase 2 — Spec 003: Users, Devices, Sessions, and Controlled Access"

## Phase

- **Phase**: Phase 2
- **Spec**: `003-admin-users-devices-and-access`
- **Delivery position**: Third of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only, privacy-safe customer operations using proposed
  contracts and fictional mock data

## Goal

Enable authorized Admin operators to find a customer, understand account,
device, session, verification, and risk context, perform controlled account
actions, and request or use time-limited support access without exposing private
financial records by default.

This phase extends the approved Users baseline and shared foundation. It does
not redesign the Admin Dashboard, implement production authorization, or
deliver later security, audit-explorer, support-ticket, notification, billing,
or data-request modules.

## Dependencies

- **Prior phase/specs**: Spec 001 Admin Foundation and Spec 002 Platform
  Overview MUST remain complete and reusable.
- **Existing route**: `/admin/users` MUST be extended in place.
- **Existing boundaries**: Reuse the Admin shell, page header, filters, table,
  responsive cards, drawer/dialog patterns, permission boundary, confirmation
  pattern, masked field, typed API client, query provider, repository pattern,
  mock scenarios, and shared UI states.
- **Existing identity**: Reuse approved components, semantic tokens, spacing,
  typography, RTL behavior, assets, and configuration.
- **Sequence**: Spec 003 MUST NOT implement functionality assigned to Specs
  004–010.

## Assumptions

- A temporary-access request always references an existing fictional support
  ticket; ticket creation and ticket conversation management belong to a later
  phase.
- Temporary access defaults to 30 minutes and cannot exceed 60 minutes in this
  phase's mock contracts.
- The requester cannot approve their own request. Approval, rejection, scope
  reduction, duration reduction, and revocation are demonstrated through role
  simulation only.
- Customer approval may be represented as a request condition and status, but
  collecting real customer consent is outside this frontend-only phase.
- Device totals are additive; customer totals remain unique and each customer
  appears once in the Users List even when they use both platforms.
- Session records are a future authentication capability and need not introduce
  a new application database entity in this specification.
- Temporary access exposes only approved support fields. Raw transaction
  history, account balances, salary, debt details, merchant names, bank
  statements, SMS content, notification content, tokens, and device
  fingerprints remain unavailable in this phase.

## Related Backend Modules

The proposed frontend contracts align with these planned future capabilities:

- `users`
- `profiles`
- `devices`
- `auth`
- `roles`
- `permissions`
- `support`
- `audit-logs`

The future backend remains responsible for identity, authorization, session
revocation, persistence, access expiry, immutable audit logging, and policy
enforcement.

## Related Database Entities

- Supabase-managed `auth.users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `support_tickets`
- `admin_access_requests`
- `audit_logs`
- `subscriptions`, for masked plan and status context only

Entity names are alignment references. No database schema, migration, policy,
or connection is implemented in this phase.

## Roles

- **Super Admin**: May view summaries and perform permitted customer actions;
  may approve or revoke access when not the requester.
- **Support Agent**: May search and view privacy-safe customer summaries,
  request temporary access, and enter a workspace only for their own active,
  approved request.
- **Security Administrator**: May review device/session risk context, revoke
  sessions or devices, approve/reject/shorten/revoke access, and review the
  planned audit summary.
- **Billing Operator**: No Phase 2 customer route access unless a future
  permission grants a minimal billing-specific summary.
- **Import Operator**, **AI Operator**, and **Content Manager**: No Phase 2
  customer route access by default.

## Permissions

| Capability | Proposed permission | Super Admin | Support Agent | Security Administrator |
|------------|---------------------|-------------|---------------|------------------------|
| Users list and profile summary | `users.read` | Allowed | Allowed | Allowed |
| Device summary | `devices.read` | Allowed | Allowed | Allowed |
| Session summary | `sessions.read` | Allowed | Allowed | Allowed |
| Suspend/reactivate customer | `users.status.manage` | Allowed | Allowed | Allowed |
| Update verification state | `users.verification.manage` | Allowed | Allowed | Allowed |
| Revoke device | `devices.revoke` | Allowed | Not allowed | Allowed |
| Force logout/revoke session | `sessions.revoke` | Allowed | Allowed | Allowed |
| Export masked summary | `users.export_summary` | Allowed | Allowed | Allowed |
| Create access request | `support.request_access` | Allowed | Allowed | Allowed |
| Review access requests | `support.access.read` | Allowed | Own requests | Allowed |
| Approve/reject/modify request | `support.access.approve` | Allowed, except own request | Not allowed | Allowed, except own request |
| Revoke active access | `support.access.revoke` | Allowed | May end own access | Allowed |
| Use temporary workspace | `support.access.use` | Approved assignee only | Approved assignee only | Approved assignee only |

- Missing route permission MUST show the shared access-denied state without
  protected content.
- Missing action permission MUST hide the action or show it disabled with a
  clear reason; direct mutation attempts MUST produce a forbidden state.
- Permission-aware UI is a development simulation and MUST NOT be described as
  production authorization.

## User Stories

### User Story 1 — Find and Triage a Customer (Priority: P1)

An authorized operator searches and filters unique customer accounts, compares
platform and account status, and opens a privacy-safe summary.

**Why this priority**: Every device, session, status, and access workflow starts
with accurate customer identification.

**Independent test**: From `/admin/users`, an operator can find a fictional
multi-platform customer, see one customer row, and open a masked profile summary
without viewing private financial records.

**Acceptance scenarios**:

1. **Given** the default All Platforms view, **When** the list loads, **Then**
   each unique customer appears once with masked email, primary platform, all
   registered platforms, status, verification, last activity, and risk label.
2. **Given** a multi-platform customer, **When** iOS or Android is selected,
   **Then** the customer appears in either applicable filter without being
   duplicated in All Platforms.
3. **Given** Multi-platform is selected, **When** results load, **Then** only
   customers with at least one registered iOS device and one registered Android
   device are shown.
4. **Given** no result or a failed request, **When** the view resolves, **Then**
   the operator sees the relevant empty or recoverable error state.

### User Story 2 — Review Profile, Devices, and Sessions (Priority: P1)

An authorized operator opens a customer detail route and reviews account
summary, registered devices, session state, verification, and risk context.

**Why this priority**: Support and security actions require device- and
session-specific context before intervention.

**Independent test**: A customer detail route displays masked overview,
platform-specific devices, and sanitized sessions while keeping identifiers and
financial records hidden.

**Acceptance scenarios**:

1. **Given** an iOS device, **When** its details are reviewed, **Then** app/OS
   version, last seen, push state, Shortcut state, and Share Extension state are
   shown while Android-only capabilities are labelled not applicable.
2. **Given** an Android device, **When** its details are reviewed, **Then**
   app/OS version, last seen, push state, SMS tracking, Notification Listener,
   and background state are shown while iOS-only capabilities are labelled not
   applicable.
3. **Given** a session, **When** it is reviewed, **Then** device label, coarse IP
   region, start time, last activity, state, and risk label are shown without
   raw IP address, token, fingerprint, or credential data.
4. **Given** missing permissions, **When** a protected tab is selected, **Then**
   its content is denied independently without leaking row counts or values.

### User Story 3 — Perform Controlled Customer Actions (Priority: P1)

An authorized operator suspends or reactivates a customer, updates verification,
revokes a device, or forces logout after reviewing scope and consequences.

**Why this priority**: These are the core operational controls named in Phase 2
and have direct customer and security impact.

**Independent test**: Each action validates its input, requires confirmation,
locks while pending, shows success/failure/conflict feedback, and updates the
affected mock view without changing unrelated records.

**Acceptance scenarios**:

1. **Given** an active customer, **When** suspension is confirmed with reason,
   duration, and internal note, **Then** the mock account becomes suspended and
   a planned audit event is identified.
2. **Given** a suspended customer, **When** reactivation is confirmed, **Then**
   the mock account becomes active and the prior suspension context remains in
   the activity summary.
3. **Given** selected sessions or all devices, **When** force logout is
   confirmed, **Then** only the selected scope becomes revoked and duplicate
   submission is prevented.
4. **Given** an already revoked device/session or stale account state, **When**
   the action is submitted, **Then** a safe conflict message prompts refresh
   rather than falsely reporting success.

### User Story 4 — Request and Decide Temporary Access (Priority: P1)

A support operator requests a narrow, time-limited workspace for a documented
support case, and a separate authorized operator reviews the request.

**Why this priority**: Controlled support access is the privacy boundary that
prevents unrestricted customer surveillance.

**Independent test**: A request cannot be submitted without ticket, reason,
scope, and duration; the requester cannot approve it; and approval cannot widen
the requested scope or duration.

**Acceptance scenarios**:

1. **Given** a support case, **When** an operator submits a valid request,
   **Then** it enters Pending with ticket reference, requested fields, masking
   rules, reason, creation time, and expiry proposal.
2. **Given** the requester views their own pending request, **When** approval
   controls render, **Then** approval is unavailable with a separation-of-duty
   explanation.
3. **Given** an approver reduces scope or duration, **When** approval is
   confirmed, **Then** the approved result never exceeds the original request.
4. **Given** an expired, rejected, revoked, or duplicate active request,
   **When** workspace access is attempted, **Then** protected content is denied
   and a safe status-specific message is shown.

### User Story 5 — Work Within Temporary Access (Priority: P1)

The approved assignee opens a limited workspace with persistent context and
access expiry, reviews only approved fields, and ends access when finished.

**Why this priority**: Approval is useful only if the resulting workspace
enforces time, scope, masking, and visibility.

**Independent test**: The active workspace continuously shows assignee, ticket,
approved scope, expiry, access notice, and audit indicator; expiry or end-access
immediately replaces protected content.

**Acceptance scenarios**:

1. **Given** an active approved request, **When** the assignee opens the
   workspace, **Then** only approved sections render and disallowed sections do
   not expose labels, counts, or values.
2. **Given** access is active, **When** the page is viewed or printed, **Then**
   a persistent access notice identifies the fictional operator, ticket, and
   expiry without exposing secrets.
3. **Given** the access window expires, **When** the next clock check or request
   occurs, **Then** protected content is removed, unsaved input is discarded,
   and the session-expired state is announced.
4. **Given** the assignee chooses End Access, **When** confirmation succeeds,
   **Then** the workspace closes and cannot be reopened without a new approval.

### User Story 6 — Apply Bulk Actions Safely (Priority: P2)

An authorized operator selects users across the current result page and performs
an allowlisted masked export, suspension, reactivation, force logout, or
notification handoff.

**Why this priority**: Bulk operations improve operational efficiency but are
secondary to correct single-customer controls.

**Independent test**: The bulk toolbar reports selection count and action scope;
only eligible rows are affected, partial failures are itemized safely, and
selection clears after a completed result.

**Acceptance scenarios**:

1. **Given** mixed account states, **When** a bulk action is selected, **Then**
   ineligible records are identified before confirmation.
2. **Given** a sensitive bulk action, **When** confirmation is cancelled,
   **Then** no record changes and selection remains.
3. **Given** partial success, **When** the response returns, **Then** aggregate
   succeeded/failed counts and masked row identifiers are shown without raw
   payloads.
4. **Given** Send Notification is chosen, **When** the action is confirmed,
   **Then** this phase records only a proposed handoff result and does not
   implement notification campaigns or delivery.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/admin/users` | Search, filter, select, and review unique customers | Super Admin, Support Agent, Security Administrator | Existing, extend in place |
| `/admin/users/[userId]` | Privacy-safe profile with Overview, Devices, and Sessions sections | Super Admin, Support Agent, Security Administrator | New approved addition |
| `/admin/access-requests` | List and filter controlled support-access requests | Super Admin, Support Agent, Security Administrator | New approved addition |
| `/admin/access-requests/[requestId]` | Review request scope, timeline, status, and decisions | Super Admin, requesting Support Agent, Security Administrator | New approved addition |
| `/admin/access-requests/[requestId]/workspace` | Time-limited, scope-limited support workspace | Approved assignee only | New approved addition |

Subscription, Support, Notifications, Data Requests, Security Events, and Audit
History labels may appear as unavailable future tabs or links only when the
existing design uses that pattern. Their later-phase content MUST NOT be
implemented here.

## Functional Requirements

### Users List and Profile

- **FR-001**: The Users List MUST present one row per unique customer account.
- **FR-002**: The list MUST support search by customer ID, name, or masked email
  and filters for status, plan, country, language, registration date, last
  activity, platform, app version, verification state, and risk state.
- **FR-003**: Platform filtering MUST provide All Platforms, iOS, Android, and
  Multi-platform values with the semantics defined in Platform Data
  Requirements.
- **FR-004**: Each row MUST show customer, masked email, country, language,
  primary or most recently active platform, all registered platforms, plan,
  account status, verification, registration date, last activity, risk, and
  permitted actions.
- **FR-005**: The list MUST support validated sorting and pagination without
  importing fixture arrays into the page.
- **FR-006**: The profile MUST show customer ID, name, masked email, country,
  language, currency, time zone, registration date, last activity, account
  status, onboarding status, platforms, current app context, and current plan.
- **FR-007**: Financial context MUST be limited to aggregate counts for
  accounts, transactions, goals, active debts, last synchronization, and import
  sources; amounts and item-level financial records MUST remain hidden.
- **FR-008**: Verification and risk MUST use text and icon/status labels rather
  than color alone.

### Devices and Sessions

- **FR-009**: Devices MUST show a safe device label, platform, OS version, app
  version, last seen, push state, platform-specific permission states, session
  state, and revoke availability.
- **FR-010**: The device summary MUST show iOS, Android, total, active, and
  revoked device counts.
- **FR-011**: Sessions MUST show a safe device label, coarse IP region, start
  time, last activity, state, risk, and permitted revoke action.
- **FR-012**: Raw IP addresses, device fingerprints, push tokens, session
  tokens, authentication tokens, and credentials MUST never be returned to or
  displayed by the frontend contracts.
- **FR-013**: Revoked, expired, current, and suspicious session states MUST be
  distinguishable with text and status semantics.
- **FR-014**: Device and session actions MUST update or invalidate relevant
  views so stale active state is not presented as current.

### Customer Actions

- **FR-015**: Suspension MUST require reason, duration, internal note, optional
  user-notification preference, consequence summary, and confirmation.
- **FR-016**: Reactivation MUST require reason, confirmation, and a current
  suspended state.
- **FR-017**: Force logout MUST support selected sessions and all-device scope,
  require a reason and confirmation, and exclude already revoked sessions.
- **FR-018**: Device revocation MUST identify the device, consequence, reason,
  and planned audit event before confirmation.
- **FR-019**: Verification changes MUST show current and proposed states,
  require a reason, and prevent unsupported transitions.
- **FR-020**: Every sensitive mutation MUST validate input, lock while pending,
  prevent duplicate submission, and show loading, success, error, forbidden,
  and conflict outcomes.

### Bulk Actions

- **FR-021**: Page-level selection MUST expose selected count, clear-selection,
  and eligibility before an action is confirmed.
- **FR-022**: Bulk actions MUST be limited to masked summary export,
  suspend/reactivate, force logout, and notification handoff.
- **FR-023**: Bulk actions MUST never silently expand from selected rows to all
  filtered results.
- **FR-024**: Bulk results MUST report aggregate success and failure counts plus
  masked identifiers for failed items.
- **FR-025**: Exported summaries MUST use allowlisted fields and must not contain
  full email, raw identifiers beyond approved customer IDs, financial amounts,
  device identifiers, IP addresses, or access-workspace data.

### Controlled Access

- **FR-026**: The Access Requests List MUST show request ID, masked customer,
  ticket, requester, scope summary, reason summary, status, created, starts,
  expires, and approver.
- **FR-027**: Access Requests MUST support Pending, Approved, Active, Expired,
  Rejected, and Revoked states. Pending MAY become Approved or Rejected;
  Approved MAY become Active, Expired, or Revoked; Active MAY become Expired or
  Revoked; Rejected, Expired, and Revoked are terminal in this phase.
- **FR-028**: A request MUST require an existing support-ticket reference,
  business reason, allowlisted field scope, masking rules, requested duration,
  and assignee.
- **FR-029**: The frontend MUST prevent a requester from approving their own
  request.
- **FR-030**: Approval MAY reduce scope or duration but MUST NOT exceed the
  originally requested scope or duration.
- **FR-031**: Duplicate pending or active access for the same assignee,
  customer, ticket, and overlapping scope MUST return a visible conflict.
- **FR-032**: The detail view MUST show ticket summary, masked customer summary,
  requested and approved fields, masking rules, duration, business reason,
  approval timeline, and planned audit timeline.
- **FR-033**: Approve, reject, modify scope, shorten duration, revoke, and end
  access actions MUST require permission, reason where applicable, consequence
  summary, confirmation, and pending lock.
- **FR-034**: Temporary workspace access MUST require an Approved or Active
  request, matching assignee, valid time window, valid ticket, and permitted
  scope.
- **FR-035**: The workspace MUST display a persistent expiration banner, ticket
  reference, approved scope, masking notice, access notice/watermark, planned
  audit indicator, and End Access action.
- **FR-036**: The workspace MUST remove protected content after expiry,
  revocation, end-access, permission loss, or session expiry.
- **FR-037**: Workspace sections MUST be generated only from the approved
  allowlist; unauthorized sections MUST not expose labels, counts, placeholders,
  or cached values.
- **FR-038**: Refresh and direct navigation MUST re-evaluate access state rather
  than trusting previous client state.

### Architecture and Integrity

- **FR-039**: Pages MUST consume parsed contracts through typed feature hooks
  and services or repositories; pages MUST NOT import raw mock arrays.
- **FR-040**: All URL parameters, filters, identifiers, forms, mutation
  payloads, and mock responses MUST be normalized and validated at their trust
  boundary.
- **FR-041**: Application code MUST use explicit types and MUST NOT use `any`.
- **FR-042**: Fictional mock records MUST include iOS-only, Android-only,
  multi-platform, multi-device, active/revoked device, active/expired session,
  suspended, pending-verification, elevated-risk, pending-access,
  active-access, expired-access, and conflicting-access cases.

## Platform Data Requirements

- **All Platforms** includes each unique customer once regardless of device
  count or platform count.
- **iOS** includes customers with at least one registered iOS device, including
  multi-platform customers.
- **Android** includes customers with at least one registered Android device,
  including multi-platform customers.
- **Multi-platform** includes customers with both iOS and Android registered
  devices.
- `uniqueCustomersTotal` MUST be supplied as a deduplicated value and MUST NOT
  be calculated by adding iOS and Android customer counts.
- `totalDeviceCount` MAY equal `iosDeviceCount + androidDeviceCount` because
  devices are additive and one customer may own multiple devices.
- Every customer summary MUST distinguish primary/most recently active platform
  from all registered platforms.
- Last activity MUST be available per platform when activity exists; missing
  activity MUST be labelled unavailable rather than fabricated.
- iOS devices MAY show Shortcut, App Intents, Share Extension, screenshot
  import, and push state. They MUST NOT imply SMS inbox or unrestricted
  notification access.
- Android devices MAY show SMS tracking, Notification Listener, background
  processing, bank filtering, and push state.
- Platform-specific capability states MUST distinguish enabled, disabled,
  denied, unavailable, unknown, and not applicable.
- Access-request totals count requests, not customers; a customer may have
  multiple historical requests.

## UX and Design Requirements

- Preserve the approved Masarifi Admin Dashboard and Gulf Premium Design System
  Version 2.1 without redesigning existing pages.
- Deep teal remains the primary interaction color; bronze remains a limited
  premium accent at approximately 2%–3% coverage.
- Admin surfaces remain neutral, compact, data-dense, professional, and
  operational.
- Reuse the approved table, responsive card, drawer, dialog, badge, filter,
  pagination, notice, timeline, and state patterns.
- Financial semantic colors MUST remain separate from account, verification,
  access, risk, and session status colors.
- Masked values MUST be visibly identified as masked and MUST not offer a reveal
  action outside an active approved scope.
- Risk, verification, session, device, and access status MUST use label, icon or
  text, and color rather than color alone.
- The temporary-access banner MUST remain visible while protected content is
  visible and MUST not be dismissible.
- Destructive dialogs MUST name affected customer/device/session count, action
  consequence, required permission, and planned audit event.
- No generic dashboard template, decorative customer imagery, excessive
  gradients, or new design language may be introduced.

## Responsive Requirements

- **Arabic RTL default**: Navigation, tabs, table reading order, drawers,
  dialogs, timelines, selection controls, and action placement follow logical
  RTL order.
- **English LTR readiness**: Logical properties and direction-safe components
  preserve equivalent order; IDs, versions, dates, and technical values use
  appropriate isolated direction.
- **1440px**: Full Users table, persistent filters, profile content, device and
  session tables, request list, and side drawer/dialog patterns fit without
  unintended page overflow.
- **1280px**: Compact sidebar and reduced spacing preserve primary columns;
  secondary columns move to detail without hiding action scope.
- **1024px**: Collapsible sidebar, scroll-safe tables, condensed filters, and
  overflow action menus retain all critical functions.
- **768px**: Drawer navigation, filter drawer, selective columns, two-column
  summaries, and full-width dialogs preserve keyboard and touch operation.
- **390px**: Prioritize user lookup, masked summary, status, risk, urgent
  actions, device/session cards, access approval summary, and End Access. Dense
  secondary detail MAY require a desktop notice, but confirmation and access
  expiry MUST remain usable.
- Horizontal table scrolling MUST not trap focus or hide the selected row,
  current status, or action feedback.

## Accessibility Requirements

- All routes and states MUST use semantic landmarks, headings, lists, tables,
  field labels, descriptions, and status regions.
- All actions MUST support keyboard operation, visible focus, logical tab order,
  Escape behavior where safe, and return focus after dialogs/drawers close.
- Touch targets MUST be at least 44px at touch-oriented viewports.
- Dialogs MUST have accessible names, described consequences, focus
  containment, initial focus, and safe dismissal behavior.
- Status changes, validation errors, bulk outcomes, access expiry, and revoked
  access MUST be announced without stealing focus unexpectedly.
- Tables MUST expose headers, selection labels, sort state, row action names,
  pagination state, and accessible alternatives on compact layouts.
- Countdown information MUST include an absolute expiry timestamp and MUST not
  update assistive technology every second.
- Masking MUST not rely on visual punctuation alone; accessible labels MUST
  identify values as masked or aggregated.
- Reduced-motion preferences MUST disable nonessential transitions.
- No status, risk, platform, verification, or permission meaning may rely on
  color alone.

## Proposed API Contracts

All paths are proposed frontend contracts; no backend is implemented.

| Method | Mock path | Request type | Response type | Planned capability |
|--------|-----------|--------------|---------------|--------------------|
| GET | `/api/v1/admin/users` | `AdminUsersQuery` | `AdminUsersPage` | users/profiles/devices search |
| GET | `/api/v1/admin/users/:userId` | `UserDetailRequest` | `UserProfileSummary` | users/profiles summary |
| GET | `/api/v1/admin/users/:userId/devices` | `UserDevicesQuery` | `UserDevicesResponse` | device inventory |
| GET | `/api/v1/admin/users/:userId/sessions` | `UserSessionsQuery` | `UserSessionsResponse` | auth session summary |
| POST | `/api/v1/admin/users/:userId/suspend` | `SuspendUserRequest` | `UserActionResult` | account suspension |
| POST | `/api/v1/admin/users/:userId/reactivate` | `ReactivateUserRequest` | `UserActionResult` | account reactivation |
| POST | `/api/v1/admin/users/:userId/verification` | `UpdateVerificationRequest` | `UserActionResult` | verification workflow |
| POST | `/api/v1/admin/users/:userId/devices/:deviceId/revoke` | `RevokeDeviceRequest` | `DeviceActionResult` | device revocation |
| POST | `/api/v1/admin/users/:userId/sessions/revoke` | `RevokeSessionsRequest` | `SessionActionResult` | selected/all session revocation |
| POST | `/api/v1/admin/users/bulk-actions` | `UserBulkActionRequest` | `UserBulkActionResult` | controlled bulk operation |
| GET | `/api/v1/admin/access-requests` | `AccessRequestsQuery` | `AccessRequestsPage` | support-access search |
| POST | `/api/v1/admin/access-requests` | `CreateAccessRequest` | `AccessRequestDetail` | support-access request |
| GET | `/api/v1/admin/access-requests/:requestId` | `AccessRequestDetailQuery` | `AccessRequestDetail` | support-access detail |
| POST | `/api/v1/admin/access-requests/:requestId/decision` | `AccessDecisionRequest` | `AccessRequestDetail` | approve/reject/reduce scope |
| POST | `/api/v1/admin/access-requests/:requestId/revoke` | `RevokeAccessRequest` | `AccessRequestDetail` | access revocation |
| GET | `/api/v1/admin/access-requests/:requestId/workspace` | `TemporaryWorkspaceRequest` | `TemporaryWorkspace` | scope-limited workspace |
| POST | `/api/v1/admin/access-requests/:requestId/end` | `EndTemporaryAccessRequest` | `EndTemporaryAccessResult` | end active access |

Every request and response MUST be parsed. Pages MUST consume the contracts
through typed hooks and repositories/services and MUST NOT import raw fixtures.

## Frontend Types

- **AdminUsersQuery**: bounded search, allowlisted filters and sort, page, page
  size, and optional mock scenario.
- **AdminUserListItem**: customer ID, display name, masked email, locale context,
  unique account status, verification, risk, primary platform, registered
  platforms, device counts, plan context, and timestamps.
- **UserProfileSummary**: privacy-safe identity/profile fields, platform
  activity, account status, verification, risk indicators, plan summary, and
  aggregated financial metadata.
- **UserDevice**: safe ID/label, platform, OS/app versions, last seen, push,
  relevant capability states, session state, and revocation state; no token or
  fingerprint.
- **UserSession**: safe ID, safe device label, coarse region, timestamps, state,
  risk, and revocation state; no raw IP or token.
- **UserActionResult**: affected masked customer ID, previous/current state,
  outcome, timestamp, safe message, and planned audit reference.
- **UserBulkActionResult**: requested/eligible/succeeded/failed counts and safe
  per-item failures.
- **AccessRequestSummary**: safe identifiers, masked customer, ticket, requester,
  assignee, scope summary, status, and lifecycle timestamps.
- **AccessRequestDetail**: requested/approved scope, masking rules, business
  reason, duration, customer-approval condition, decisions, and audit timeline.
- **TemporaryWorkspace**: request/ticket/assignee context, approved allowlisted
  sections, masked values, absolute expiry, access notice, and audit indicator.
- **ApiError**: status, safe code, localized message, optional field errors, and
  correlation ID without stack traces or private payloads.
- All application types MUST be explicit and MUST NOT use `any`.

## Mock Scenarios

- Default success with iOS-only, Android-only, and multi-platform customers
- Empty Users List and empty filtered result
- Large paginated result set
- Slow Users, Devices, Sessions, or Access Requests response
- Partial profile where one secondary region is unavailable
- Unauthorized and forbidden route/action
- Customer, device, session, request, or ticket not found
- Invalid identifier, filter, sort, date range, duration, reason, or scope
- Already suspended/reactivated/verified/revoked conflict
- Partial bulk success with safe itemized errors
- Rate-limited sensitive mutation
- Internal error with safe correlation ID
- Pending, approved, active, expired, rejected, and revoked access requests
- Requester attempts self-approval
- Approval attempts to widen scope or duration
- Duplicate overlapping access request
- Access expires while workspace is open
- Permission or session is lost while workspace is open
- Unsafe text values that must render as text
- Masked-data contract violation rejected by response validation

## Loading States

- Users page and profile shell skeletons
- Table/card, profile region, device list, session list, request list, request
  detail, and workspace loading states
- Pending buttons and locked forms for every mutation
- Previous safe list data MAY remain visible during pagination/filter refresh
  only when clearly marked updating and never in an expired workspace

## Empty States

- No users
- No filtered users
- No registered devices
- No active or historical sessions
- No access requests
- No requests for the selected status
- Approved workspace section contains no permitted data

Every empty state MUST explain the context and offer a safe recovery action when
one exists.

## Error States

- Failed list/detail/region load with retry
- Invalid filter or identifier
- Not found
- Unauthorized, forbidden, and session expired
- Conflict caused by stale state or duplicate action
- Rate limited
- Partial bulk failure
- Access expired or revoked
- Safe internal error with correlation ID

Errors MUST not expose stack traces, internal routes/paths, tokens, raw
exceptions, private payloads, or unmasked customer data.

## Success States

- Customer suspended or reactivated
- Verification updated
- Device revoked
- Selected/all sessions revoked
- Masked export prepared
- Bulk action completed or partially completed
- Access request submitted
- Request approved, rejected, shortened, or revoked
- Temporary access started or ended

Success MUST be announced accessibly and reflected in the relevant current
state.

## Warning and Confirmation States

- Suspension, reactivation, verification change, device revocation, force
  logout, masked export, sensitive bulk action, access approval/rejection,
  scope/duration change, access revocation, and End Access
- Active temporary-access banner with absolute expiry and scope
- Unsaved work warning before access expiry or end
- Stale-state conflict that requires refresh
- Multi-platform counting notice where customer and device totals appear

Confirmations MUST identify scope, consequence, permission, and planned audit
event and MUST remain keyboard and screen-reader accessible.

## Audit Expectations

The future backend is expected to append audit events for:

- User summary access where policy requires it
- Suspension/reactivation and verification changes
- Device and session revocation
- Masked export and each bulk action
- Access request creation
- Approval, rejection, scope/duration change, revocation, and expiration
- Temporary workspace entry, approved section access where policy requires it,
  and End Access

Frontend mock responses MAY expose a safe audit reference and timeline. Audit
rows remain immutable and the full Audit Log Explorer belongs to Spec 008.

## Privacy Rules

- Mask customer email and private identifiers by default.
- Show coarse IP region only; never return raw IP.
- Show safe device labels only; never return fingerprint, push token, auth
  token, or credential values.
- Show financial metadata only as aggregate counts and synchronization/import
  summaries; never show values or item-level records.
- Keep raw SMS, notification, receipt, statement, import, and AI content absent.
- Temporary access follows least privilege, field allowlisting, masking by
  default, assignee binding, ticket binding, and time expiry.
- Search, filters, cache, error messages, logs, screenshots, exports, and tests
  MUST use fictional sanitized values.
- Protected workspace data MUST not persist to local storage, session storage,
  URL query values, browser-accessible environment values, or logs.
- Cache entries containing temporary workspace data MUST be removed when access
  expires, is revoked, ends, or loses permission.

## Security Requirements

- **Untrusted inputs**: Parse and normalize route identifiers, query parameters,
  search, filters, sorting, pagination, form values, reasons, notes, scopes,
  durations, selected IDs, mutation responses, and mock API data.
- **Safe rendering**: Names, notes, reasons, ticket summaries, regions, device
  labels, and error text MUST render as plain text. Raw HTML, Markdown, JSON,
  imported messages, and provider payloads are not rendered.
- **Identifiers**: Reject malformed, oversized, repeated, or unsupported IDs
  before requests or state transitions.
- **Client storage and environment**: Do not store customer details,
  selections, access data, tokens, secrets, or credentials in browser storage.
  Role/scenario simulation remains development-only and visibly identified.
- **Files and links**: This phase accepts no uploads. Mock exports use
  allowlisted fields and safe filenames. External links, if any, use approved
  destinations and prevent opener access.
- **Permissions**: Route visibility, hidden/disabled actions, and mock permission
  checks are UX controls only; every future operation requires independent
  backend authorization.
- **Mutation safety**: Sensitive actions lock while pending, reject duplicates,
  confirm scope and consequences, and handle stale-state conflicts.
- **Temporary access**: Recheck status, assignee, ticket, time window, scope, and
  permission on initial load, refresh, protected reads, and mutations.
- **Dependencies**: Add no dependency unless required, reviewed, scoped, and
  approved; this specification requires none.
- **Security mock scenarios**: Cover denied access, session/access expiry,
  self-approval, widened approval, invalid scope/duration, duplicate request,
  unsafe text, contract masking failure, stale action, and duplicate
  submission.
- **Deferred production controls**: NestJS authorization, Supabase Auth session
  control, database policies, immutable audit storage, consent enforcement,
  encryption, rate limiting, monitoring, and incident response remain future
  backend/infrastructure responsibilities.

Security controls MUST use defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- A customer changes primary platform while the list is open.
- A multi-platform customer loses their last device on one platform and no
  longer qualifies for Multi-platform.
- A customer owns multiple devices with the same display name.
- A device or session is revoked from another Admin session before confirmation.
- The current session is included in an all-session force logout request.
- A customer is suspended while an access request is pending or active.
- Verification state changes while the profile is open.
- A bulk selection spans eligible and ineligible account states.
- Pagination/filter changes occur while rows are selected.
- An access request has an invalid/missing ticket, expired proposed start, empty
  scope, or duration above the mock maximum.
- The requester and approver resolve to the same operator.
- Approval is attempted after rejection, expiry, or revocation.
- An active access window expires while a dialog or unsaved note is open.
- Browser refresh or back navigation targets an expired workspace.
- Clock display differs from the authoritative absolute expiry timestamp.
- A localized value is very long or mixes Arabic, English, and technical IDs.
- A partial response omits an optional platform capability.
- Unsafe markup appears in a name, reason, note, or ticket summary.

## Out of Scope

- Real authentication, authorization, NestJS, Supabase, database, audit, queue,
  notification, email, file, payment, or AI integration
- Admin login, two-factor, forgot-password, and production session flows
- Full Support ticket management and conversations
- Notification campaign creation, templates, delivery, and real customer
  messaging
- Subscription/payment operations and private financial detail
- Import content, raw messages, statements, receipts, and transaction lists
- Security Overview, security incidents, authentication-event explorer, and
  full Audit Log Explorer
- Data export/deletion request workflows and retention policies
- Admin-team role/permission management
- Real customer consent collection
- Features assigned to Specs 004–010
- Redesign of any approved page, route shell, component, token, style, or asset

## Acceptance Criteria

- **AC-001**: `/admin/users` shows one row per unique customer and supports All,
  iOS, Android, and Multi-platform filters with the documented membership rules.
- **AC-002**: A multi-platform fixture appears once in All Platforms, appears in
  both iOS and Android filters, and appears in Multi-platform.
- **AC-003**: Customer totals are not derived by adding iOS and Android counts;
  device totals are explicitly labelled as additive.
- **AC-004**: Default user/profile/device/session views contain no unmasked
  email, raw IP, device fingerprint, push/session/auth token, financial amount,
  transaction detail, raw message, or uploaded content.
- **AC-005**: Profile, Devices, and Sessions regions demonstrate loading, empty,
  error, success, and permission outcomes relevant to each region.
- **AC-006**: iOS and Android device fixtures show only applicable capability
  states and label non-applicable states accurately.
- **AC-007**: Suspend, reactivate, verification, device revoke, and force logout
  flows validate input, confirm consequence, lock pending submission, and
  demonstrate success, failure, forbidden, and conflict.
- **AC-008**: Bulk actions affect only explicitly selected eligible customers,
  require confirmation where sensitive, and safely report partial results.
- **AC-009**: An access request cannot be submitted without a valid ticket,
  reason, nonempty allowlisted scope, assignee, and duration within the mock
  maximum.
- **AC-010**: The requester cannot approve their own request, and an approver
  cannot widen scope or duration.
- **AC-011**: Pending, Approved, Active, Expired, Rejected, and Revoked request
  states and allowed transitions are testable.
- **AC-012**: Only the approved assignee can open the temporary workspace during
  its valid time window.
- **AC-013**: Expiry, revocation, end-access, permission loss, or session expiry
  removes protected workspace content and blocks direct reopening.
- **AC-014**: The workspace persistently shows ticket, approved scope, masking
  notice, absolute expiry, access notice, audit indicator, and End Access.
- **AC-015**: Every route and protected action demonstrates permission-aware UI
  while identifying future backend authorization as mandatory.
- **AC-016**: Arabic RTL and English LTR-ready behavior works at 1440px, 1280px,
  1024px, 768px, and 390px without losing access expiry, status, masking, or
  confirmation context.
- **AC-017**: Keyboard-only operation can search, filter, paginate, open
  details, operate tabs, select rows, complete/cancel dialogs, review requests,
  enter/exit a workspace, and recover focus.
- **AC-018**: All status and risk meanings use text/icon semantics in addition
  to color, and reduced motion is respected.
- **AC-019**: Pages consume typed service/repository contracts and no page or
  presentation component imports raw fixtures.
- **AC-020**: Typecheck, lint, Vitest, Playwright, production build, viewport,
  accessibility, privacy, and security review all pass before implementation is
  claimed complete.

## Success Criteria

- **SC-001**: In moderated verification, an authorized operator can find a
  specified fictional customer and identify account, platform, verification,
  and risk state in 90 seconds or less.
- **SC-002**: 100% of seeded multi-platform customers satisfy the documented
  All/iOS/Android/Multi-platform filter behavior with zero duplicate All rows.
- **SC-003**: Privacy review finds zero default-view exposures of prohibited
  customer financial, device, session, message, token, or raw-IP data.
- **SC-004**: 100% of destructive or privacy-sensitive actions show scope,
  consequence, confirmation, pending lock, and outcome.
- **SC-005**: 100% of temporary-workspace checks deny non-assignees, invalid
  states, expired windows, widened scopes, and missing permissions.
- **SC-006**: Protected workspace content disappears within five seconds of the
  displayed expiry during the expiry scenario and remains unavailable after
  refresh.
- **SC-007**: Keyboard review completes all six primary user journeys with no
  keyboard trap, lost modal focus, or inaccessible action.
- **SC-008**: All five approved viewports complete the primary user lookup,
  customer action, request decision, and End Access journeys without blocking
  overflow or hidden critical context.
- **SC-009**: Every relevant loading, empty, error, success, warning, and
  permission scenario is observable and recoverable where recovery is valid.
- **SC-010**: Verification reports zero blocking accessibility, RTL/LTR,
  design-preservation, contract-validation, privacy, or security defects.

## Verification

Implementation verification for this future phase MUST include:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests**: `npm run test`
- **End-to-end tests**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Route review**: Open every Phase 2 route in default, loading, empty, error,
  forbidden, and relevant mutation/access scenarios.
- **Platform review**: Verify iOS-only, Android-only, and multi-platform users;
  confirm unique-customer deduplication and additive device totals.
- **Viewport review**: Verify 1440px, 1280px, 1024px, 768px, and 390px in Arabic
  RTL, plus an English LTR-readiness pass.
- **Accessibility review**: Verify keyboard navigation, visible focus, semantic
  tables/forms/dialogs, announcements, status alternatives, touch targets,
  reduced motion, and expiry behavior.
- **Privacy/security review**: Scan changed source, fixtures, tests, logs, URLs,
  storage, environment usage, errors, exports, and screenshots for unmasked
  data, raw fixtures, unsafe rendering, missing validation, incorrect
  permissions, duplicate mutation, and expired-access leakage.

No verification result may be reported as successful unless the named command
or manual procedure was actually completed successfully.
