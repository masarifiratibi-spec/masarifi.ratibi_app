# Admin Web Feature Specification: Security, Audit, and Data Privacy Requests

**Phase / Spec**: Phase 7 / Spec 008 of 010  
**Created**: 2026-07-30  
**Status**: Draft  
**Input**: "Read the complete masarifi-admin-dashboard-full-frontend-specification-v3-10-specs.md and create Phase 7 — Spec 008: Security, Audit, and Data Privacy Requests."

## Phase

- **Phase**: Phase 7 — Security, audit, and privacy operations
- **Spec**: `008-admin-security-audit-and-privacy`
- **Delivery position**: Eighth of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only operational views and simulated workflows using typed mock contracts and sanitized fictional data

## Goal

Enable authorized Admin operators to monitor security risk, investigate
authentication and suspicious-activity events, review administrator security
posture and permission changes, end active support access, explore immutable
audit evidence, and safely manage simulated data-export, account-deletion, and
retention-policy workflows.

This phase extends the approved Admin Dashboard and Specs 001–007. It does not
perform real authentication, detect production threats, grant production
permissions, generate or download customer archives, delete or anonymize real
data, enforce retention, modify immutable audit records, or implement backend
security controls.

## Clarifications

### Session 2026-07-30

- Q: Which state transitions govern suspicious activity and security incidents? → A: Suspicious activity follows New → Investigating → Escalated, Resolved, or Dismissed; escalation requires an existing incident reference. Incidents follow Open → Contained → Monitoring → Resolved → Closed, with Resolved allowed to return to Monitoring and Closed terminal.
- Q: Which customer-data categories may an export request identify? → A: Metadata-only scope labels are Profile, Devices and Sessions, Financial Records, Imports, AI Data, Support and Feedback, Notifications, and Files; Phase 7 never exposes category contents.
- Q: Which transitions and download eligibility govern export requests? → A: Requested → Validating → Processing → Ready → Expired; Requested, Validating, or Processing may fail; Requested or Validating may be cancelled; Failed may retry to Processing; only unexpired Ready requests allow the no-file download simulation.
- Q: Which transitions govern account-deletion requests? → A: Requested → Review Required → Scheduled → In Progress → Completed; Requested, Review Required, or Scheduled may be cancelled; In Progress may become Blocked; Blocked retries to In Progress; legal holds block scheduling and completion; Completed and Cancelled are terminal.
- Q: How are retention periods bounded and how do legal holds behave? → A: Periods are positive whole days within contract-provided per-policy minimum and maximum values; protected audit retention cannot fall below its approved minimum, and an active legal hold always suspends cleanup regardless of period.

## Dependencies

- **Prior phase/specs**: Specs 001–007 MUST remain reusable and visually
  unchanged.
- **Existing foundation**: Reuse the Admin shell, grouped navigation,
  breadcrumbs, page headers, date/platform filters, metric cards, tables,
  drawers, dialogs, confirmations, timelines, masked fields, safe structured
  data preview, permission boundary, query provider, typed repository pattern,
  mock scenario controls, semantic tokens, and RTL/LTR behavior.
- **Cross-module references**: Spec 003 supplies masked customer, device,
  session, temporary-access, and support-access references. Spec 004 supplies a
  bounded subscription-cancellation status. Spec 007 supplies ticket references
  for support access and security-related support activity.
- **Sequence**: This spec MUST NOT implement system-health, provider-health,
  jobs and queues, admin-team management, role editing, system settings, or
  final cross-module hardening assigned to Specs 009–010.

## Assumptions

- All people, accounts, devices, regions, events, incidents, requests, files,
  policies, and identifiers are fictional and sanitized.
- Operational lists default to 25 rows and allow 25, 50, or 100 rows, with 100
  as the maximum page size.
- Security and audit views default to the last 30 calendar days in the Admin
  application time zone.
- Search input is limited to 120 Unicode characters; internal notes and reasons
  are limited to 2 KiB.
- Risk levels are Informational, Low, Medium, High, and Critical. Every risk
  state has a text label and icon in addition to color.
- Security event states are New, Investigating, Escalated, Resolved, and
  Dismissed. Incident states are Open, Contained, Monitoring, Resolved, and
  Closed.
- Export request states are Requested, Validating, Processing, Ready, Expired,
  Failed, and Cancelled. “Ready” exposes fictional file metadata and a
  simulated action only; no archive is generated or downloaded.
- Deletion request states are Requested, Review Required, Scheduled, In
  Progress, Blocked, Completed, and Cancelled. Progress and completion are mock
  state only and never delete data.
- Audit events are immutable. The frontend exposes no create, edit, replace, or
  delete action for audit records.
- Authentication outcomes, risk scores, signals, session state, authorization,
  legal holds, deletion eligibility, export scope, retention minimums, and
  workflow transitions are authoritative future-backend values. The frontend
  does not calculate production security or legal policy.
- Region is presented at country or broad region level. Full IP addresses,
  precise locations, raw device identifiers, credentials, tokens, secrets, and
  private payloads are excluded.
- Standard mock pages target usable content within 2 seconds and filter, sort,
  or pagination updates within 1 second at the 95th percentile. Explicitly
  labeled slow scenarios are excluded.

## Backend Alignment

### Planned Backend Modules

- `auth`
- `users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `support`
- `audit`
- `data-requests`
- `files`
- `subscriptions`

The future backend remains responsible for authentication, authorization,
security-event collection, risk evaluation, incident state, session revocation,
permission enforcement, support-access expiry, immutable and tamper-evident
audit storage, export generation, signed downloads, deletion and anonymization,
legal holds, retention enforcement, rate limiting, persistence, and production
monitoring.

### Planned Entities

- `authentication_events`
- `security_events`
- `security_incidents`
- `admin_sessions`
- `permission_change_events`
- `support_access_grants`
- `audit_logs`
- `data_export_requests`
- `account_deletion_requests`
- `retention_policies`
- `users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `support_tickets`
- `subscriptions`

Names are alignment references only. This phase creates no schema, migration,
database query, storage object, archive, queue, job, authentication mechanism,
encryption key, or backend route.

## Roles and Permissions

### Roles

- **Super Admin**: May view every Phase 7 route and perform all permitted mock
  security, support-access, privacy-request, and retention actions.
- **Security Administrator**: May investigate security events and incidents,
  review Admin security and permission changes, end active support access,
  explore audit evidence, and manage simulated export, deletion, and retention
  workflows.
- **Support Agent**: May see only the agent’s own active support-access summary
  and end that access. May see a bounded privacy-request status when it is
  linked to an authorized support ticket; no general security, audit, export,
  deletion, or retention route access.
- **Billing Operator**: May see only the subscription-cancellation projection
  attached to an authorized deletion request when separately permitted; no
  general Phase 7 route access.
- **Parser and Import Operator**, **AI Operator**, and **Content Manager**: No
  direct Phase 7 route access by default.

### Permission Matrix

| Capability | Proposed permission | Super Admin | Security Admin | Support Agent |
|---|---|---|---|---|
| Security overview and authentication events | `security.events.read` | Allowed | Allowed | No |
| Investigate suspicious activity and incidents | `security.incidents.manage` | Allowed | Allowed | No |
| Admin security posture | `security.admins.read` | Allowed | Allowed | No |
| Permission-change history | `security.permissions.read` | Allowed | Allowed | No |
| Active support-access list | `security.support_access.read` | Allowed | Allowed | Own active access only |
| End active support access | `security.support_access.revoke` | Allowed | Allowed | Own active access only |
| Audit explorer and event detail | `audit.logs.read` | Allowed | Allowed | No |
| Export-request list and detail | `data_requests.exports.read` | Allowed | Allowed | Linked status only |
| Manage export-request mock workflow | `data_requests.exports.manage` | Allowed | Allowed | No |
| Deletion-request list and detail | `data_requests.deletions.read` | Allowed | Allowed | Linked status only |
| Manage deletion-request mock workflow | `data_requests.deletions.manage` | Allowed | Allowed | No |
| Retention-policy view | `data_retention.read` | Allowed | Allowed | No |
| Retention-policy change | `data_retention.manage` | Allowed | Allowed | No |

- A missing route permission MUST show the shared access-denied state without
  protected actor, target, event, signal, metadata, request, or policy fields.
- Missing action permission MUST hide the action or disable it with a clear
  reason. Direct mock mutations MUST return a safe forbidden result.
- Limited views MUST be structural projections rather than full objects hidden
  by presentation rules.
- “Own active access” MUST be returned as a dedicated least-privilege
  projection and MUST NOT grant access to the general support-access route.
- Permission-aware UI remains a development-only UX simulation and is not
  production authorization.

## User Scenarios and Testing

### User Story 1 — Investigate Security Risk (Priority: P1)

A Security Administrator reviews the security overview, filters authentication
events by platform and risk, opens suspicious activity, assigns a reviewer, and
uses the incident timeline to record a simulated disposition.

**Why this priority**: Fast, consistent triage of high-risk activity is the
primary operational purpose of the Security Center.

**Independent test**: An authorized operator can locate a fictional critical
event, inspect only sanitized evidence, and record an allowed state transition
in under two minutes.

**Acceptance scenarios**:

1. **Given** the Security Overview, **When** the date range or platform changes,
   **Then** failed logins, suspicious sessions, locked accounts, revoked
   sessions, permission changes, active support access, and critical-event
   metrics update with labels, units, freshness, and non-color status cues.
2. **Given** authentication events, **When** an operator searches, filters,
   sorts, or paginates, **Then** validated state remains visible and results
   show actor class, event, masked device, broad region, risk, time, and status.
3. **Given** suspicious activity, **When** a record is opened, **Then** the UI
   shows bounded signals, score, status, reviewer, platform, app version,
   session context, and linked incident without raw credentials, IP address,
   token, fingerprint, or private payload.
4. **Given** an allowed assignment, escalation, containment note, resolution,
   or dismissal, **When** the operator confirms where required, **Then** the
   mock state changes once, success is announced, and a planned audit reference
   appears.
5. **Given** an invalid identifier, stale version, missing permission,
   duplicate submission, or unsafe note, **When** an action is attempted,
   **Then** it is rejected safely without losing valid operator input.

### User Story 2 — Review Admin Security and Support Access (Priority: P1)

A Security Administrator checks administrator two-factor and session posture,
reviews permission changes, and ends inappropriate or expired support access.

**Why this priority**: Privileged access and temporary customer access require
least-privilege visibility and rapid revocation.

**Independent test**: An authorized operator can trace a fictional permission
change to its actor and reason and end one active support-access grant with an
explicit consequence confirmation.

**Acceptance scenarios**:

1. **Given** Admin Security, **When** the page loads, **Then** each projected
   Admin record shows role, two-factor status, last login, active-session count,
   and risk state without credentials or raw session values.
2. **Given** Permission Changes, **When** filters are applied, **Then** the
   changed subject, previous and new permission summaries, actor, reason, time,
   result, and correlation reference remain traceable.
3. **Given** Active Support Access, **When** an authorized operator opens it,
   **Then** agent, masked customer, ticket reference, approved scope, start,
   expiry, remaining time, and status are visible.
4. **Given** active support access, **When** End Access is confirmed, **Then**
   the pending control locks, the mock grant becomes Revoked once, focus
   returns, and the expected audit reference is announced.
5. **Given** expired, already revoked, stale, or unauthorized access, **When**
   End Access is attempted, **Then** the action returns a safe conflict or
   forbidden result and protected data remains unavailable.

### User Story 3 — Explore Immutable Audit Evidence (Priority: P1)

A Security Administrator searches audit history, narrows it by actor, action,
resource, target, result, date, or severity, and inspects a sanitized immutable
event with related references.

**Why this priority**: Audit evidence is required to understand privileged
actions without allowing the evidence itself to be altered.

**Independent test**: An authorized operator can find a known fictional audit
event by correlation ID, inspect its safe before/after summary, and verify that
no mutation control exists.

**Acceptance scenarios**:

1. **Given** the Audit Log Explorer, **When** an operator filters, searches,
   sorts, or paginates, **Then** validated URL-safe state and total result count
   remain visible.
2. **Given** an audit row, **When** it renders, **Then** time, actor, actor type,
   action, resource, masked target, result, broad region, metadata summary, and
   correlation ID are readable without relying on color.
3. **Given** an Audit Event Detail, **When** it loads, **Then** actor summary,
   action, resource, allowlisted before/after summary, bounded structured
   metadata, and related ticket or incident references appear as plain text.
4. **Given** any audit route, **When** any authorized role uses it, **Then** no
   create, edit, delete, replace, retry, or rollback action for the audit event
   is available.
5. **Given** malformed, deeply nested, oversized, or sensitive metadata,
   **When** validation occurs, **Then** unsafe fields are excluded and a safe
   unavailable or validation state replaces the raw payload.

### User Story 4 — Process Data Export Requests Safely (Priority: P1)

A Security Administrator reviews export-request status and scope, investigates
validation or processing failures, and advances a permitted simulated request
without generating or exposing real customer data.

**Why this priority**: Customer privacy requests require traceable, bounded,
and least-privilege operational handling.

**Independent test**: An authorized operator can review one fictional export
request, verify its approved scope and expiry, and complete an allowed mock
transition without receiving archive contents or a real download URL.

**Acceptance scenarios**:

1. **Given** Data Export Requests, **When** filters change, **Then** request,
   masked customer, status, requested time, processing start, completion,
   expiry, and download state update without exposing archive contents.
2. **Given** Export Request Details, **When** it loads, **Then** the requested
   scope, eligibility summary, processing timeline, fictional file metadata,
   expiry, errors, and planned audit references are visible.
3. **Given** a permitted validate, retry, cancel, expire, or mock-ready
   transition, **When** it is confirmed, **Then** expected state and record
   version are enforced and the request changes once.
4. **Given** a fictional Ready request, **When** the simulated download action
   is activated, **Then** no URL, token, binary data, archive contents, or
   browser-stored customer data is produced.
5. **Given** expired, cancelled, unauthorized, stale, unsafe-scope, or duplicate
   action, **When** it is attempted, **Then** the action is blocked with a safe
   recovery message.

### User Story 5 — Govern Account Deletion and Retention (Priority: P1)

A Security Administrator reviews account-deletion progress, resolves a blocked
checklist item, simulates an allowed workflow transition, and reviews or updates
retention-policy configuration with explicit impact confirmation.

**Why this priority**: Deletion and retention decisions are destructive,
privacy-sensitive, and must be visible without pretending the frontend is the
system of record.

**Independent test**: An authorized operator can verify every deletion
checklist category, identify a blocker, and propose one valid mock policy
change while no real customer data is modified.

**Acceptance scenarios**:

1. **Given** Account Deletion Requests, **When** filters change, **Then**
   request, masked customer, status, requested and scheduled times,
   subscription-cancellation state, cleanup progress, and completion update.
2. **Given** Account Deletion Detail, **When** it loads, **Then** user
   notification, subscription, sessions, exports, files, financial-data,
   AI-data, audit-preservation, and completion checklist states are visible
   with blockers and responsibility.
3. **Given** a permitted schedule, block, retry, cancel, or mock-complete
   transition, **When** it is confirmed, **Then** the dialog states that no
   production deletion occurs and expected state/version is enforced.
4. **Given** Retention Policies, **When** an authorized operator reviews a
   policy, **Then** data type, period, storage category, cleanup process
   reference, last cleanup, status, legal-hold behavior, and last change appear.
5. **Given** a valid policy change, **When** it is confirmed with reason and
   impact, **Then** the mock version changes once and an audit reference
   appears; invalid ranges, protected audit-retention reductions, stale
   versions, and duplicate submissions are rejected.

## Routes

| Route | Purpose | Roles | Existing/New |
|---|---|---|---|
| `/admin/security` | Security overview | Super Admin, Security Administrator | Approved addition |
| `/admin/security/authentication-events` | Authentication event explorer | Super Admin, Security Administrator | Approved addition |
| `/admin/security/suspicious-activity` | Suspicious activity queue | Super Admin, Security Administrator | Approved addition |
| `/admin/security/admins` | Administrator security posture | Super Admin, Security Administrator | Approved addition |
| `/admin/security/permission-changes` | Permission-change history | Super Admin, Security Administrator | Approved addition |
| `/admin/security/support-access` | Active temporary support access | Super Admin, Security Administrator | Approved addition |
| `/admin/security/incidents/[incidentId]` | Security incident detail | Super Admin, Security Administrator | Approved addition |
| `/admin/audit` | Immutable audit log explorer | Super Admin, Security Administrator | Approved addition |
| `/admin/audit/[eventId]` | Immutable audit event detail | Super Admin, Security Administrator | Approved addition |
| `/admin/data-requests/exports` | Data export requests | Super Admin, Security Administrator | Approved addition |
| `/admin/data-requests/exports/[requestId]` | Export request detail | Super Admin, Security Administrator | Approved addition |
| `/admin/data-requests/deletions` | Account deletion requests | Super Admin, Security Administrator | Approved addition |
| `/admin/data-requests/deletions/[requestId]` | Account deletion detail | Super Admin, Security Administrator | Approved addition |
| `/admin/data-requests/retention` | Retention policies | Super Admin, Security Administrator | Approved addition |

Support Agent and Billing Operator limited projections appear only inside
already authorized routes from prior specs and do not grant direct access to
the Phase 7 routes above.

## Functional Requirements

### Shared Security and Data Behavior

- **FR-001**: Every Phase 7 route MUST enforce its proposed read permission
  before returning protected mock data.
- **FR-002**: Every Phase 7 mutation MUST enforce its proposed action
  permission independently of control visibility.
- **FR-003**: Pages MUST consume validated typed repository results and MUST
  NOT import fixture arrays directly.
- **FR-004**: List requests MUST validate search, filters, sort, page, page
  size, date range, platform, and identifiers before use.
- **FR-005**: Detail and mutation requests MUST validate identifiers, current
  state, expected record version, reason, note, and action payload.
- **FR-006**: Lists MUST support deterministic filtering, sorting, pagination,
  result counts, and reset-to-default behavior.
- **FR-007**: Dynamic routes MUST distinguish invalid, not-found, forbidden,
  failed, and stale/conflict outcomes without leaking record existence.
- **FR-008**: Sensitive mutations MUST show scope and consequences, require
  confirmation, lock while pending, prevent duplicate submission, announce the
  result, and expose a planned audit reference.
- **FR-009**: Dates MUST show the Admin application time zone and support
  locale-appropriate absolute presentation; relative times MUST have an
  accessible absolute equivalent.
- **FR-010**: Every security, workflow, and risk state MUST use text and icon or
  another non-color cue in addition to semantic color.
- **FR-011**: Customer, actor, Admin, device, region, session, and request
  projections MUST contain only fields needed by the current view.
- **FR-012**: Raw IP addresses, coordinates, device identifiers, session
  tokens, authentication tokens, passwords, recovery codes, secrets, API keys,
  private financial records, and raw provider or archive payloads MUST NOT be
  returned by Phase 7 mock contracts.

### Security Center

- **FR-013**: Security Overview MUST show failed logins, suspicious sessions,
  locked accounts, revoked sessions, Admin permission changes, active support
  access, and critical security events for the selected period and platform.
- **FR-014**: Overview metrics MUST declare whether they count events,
  sessions, accounts, access grants, or permission changes.
- **FR-015**: Authentication Events MUST show actor projection, actor type,
  event type, masked device, broad region, platform, app version when
  applicable, risk, time, and outcome.
- **FR-016**: Authentication Events MUST filter by actor class, event type,
  platform, risk, result, broad region, and date.
- **FR-017**: Suspicious Activity MUST show actor projection, event, risk score,
  bounded signal labels, platform context, time, state, and assigned reviewer.
- **FR-018**: Risk score and signal labels MUST be presented as
  future-backend-provided values and MUST NOT be recalculated by the frontend.
- **FR-019**: Suspicious activity MUST follow New → Investigating →
  Escalated, Resolved, or Dismissed. Escalation requires an existing incident
  reference; Resolved and Dismissed are terminal. An authorized action MAY
  assign or replace one reviewer without changing the lifecycle state and MUST
  include a reason and expected record version.
- **FR-020**: Admin Security MUST show Admin projection, role, two-factor
  status, last login, active-session count, and risk state without credential
  or session detail.
- **FR-021**: Permission Changes MUST show subject Admin, permission or role
  summary, previous state, new state, changed-by projection, reason, time,
  result, and correlation ID.
- **FR-022**: Permission-change records MUST be read-only in Phase 7; role and
  permission editing remains assigned to Spec 010.
- **FR-023**: Active Support Access MUST show agent, masked customer, ticket
  reference, approved scope, start, expiry, remaining-time state, and status.
- **FR-024**: End Access MUST require a reason and confirmation and MUST reject
  expired, revoked, stale, unauthorized, or duplicate requests safely.
- **FR-025**: Security Incident Detail MUST show severity, state, timeline,
  affected-service summaries, deduplicated affected-customer count, actions,
  internal notes, owner, and resolution summary.
- **FR-026**: Incidents MUST follow Open → Contained → Monitoring → Resolved →
  Closed. Resolved MAY return to Monitoring when risk recurs; Closed is
  terminal. Notes and state changes MUST enforce the current state, allowed
  transition, reason when required, and expected record version.

### Audit Logs

- **FR-027**: Audit Log Explorer MUST show time, actor projection, actor type,
  action, resource, masked target, result, broad region, metadata summary, and
  correlation ID.
- **FR-028**: Audit logs MUST filter by actor, action, resource type, masked
  target reference, result, date, and severity.
- **FR-029**: Audit Event Details MUST show actor summary, action, resource,
  allowlisted before/after summary, bounded structured metadata, related ticket
  reference, related incident reference, and correlation ID when present.
- **FR-030**: Audit records MUST appear immutable and MUST expose no action that
  changes, deletes, retries, replaces, or rolls back the record.
- **FR-031**: Structured audit metadata MUST be size- and depth-bounded,
  allowlisted, safely rendered as text, and copyable only when the user has the
  audit read permission.
- **FR-032**: Unknown or prohibited metadata fields MUST be omitted rather than
  displayed with masking that could be removed in the browser.
- **FR-033**: Audit search and copy actions MUST NOT place protected metadata in
  the URL, browser storage, logs, or error messages.

### Data Export Requests

- **FR-034**: Data Export Requests MUST show request ID, masked customer,
  status, requested time, processing start, completion, expiry, and download
  state.
- **FR-035**: Export Request Detail MUST show requested scope, eligibility
  summary, timeline, fictional generated-file metadata, expiry, safe errors,
  and planned audit references.
- **FR-036**: Export scope MUST be a structured allowlisted set containing only
  Profile, Devices and Sessions, Financial Records, Imports, AI Data, Support
  and Feedback, Notifications, and Files. Phase 7 MUST expose these as
  metadata-only labels and MUST NOT accept or return category contents,
  arbitrary field names, paths, query expressions, or payloads.
- **FR-037**: Export requests MUST follow Requested → Validating → Processing →
  Ready → Expired. Requested, Validating, or Processing MAY move to Failed;
  Requested or Validating MAY move to Cancelled; and Failed MAY retry to
  Processing. Cancelled and Expired are terminal. Every action MUST enforce the
  current state and expected record version.
- **FR-038**: Only an unexpired Ready request MAY activate the simulated
  download action. The action MUST NOT create a URL, token, Blob, archive,
  filesystem write, network request, or browser-stored customer data.
- **FR-039**: Ready and expiry indicators MUST clearly state that file metadata
  and download behavior are demonstrations only.

### Account Deletion and Retention

- **FR-040**: Account Deletion Requests MUST show request ID, masked customer,
  state, requested time, scheduled time, subscription-cancellation state,
  cleanup progress, and completion time.
- **FR-041**: Account Deletion Detail MUST show checklist states for customer
  notice, subscription cancellation, active-session revocation, export
  handling, file removal, financial-data deletion or anonymization, AI-data
  deletion, required audit preservation, and completion confirmation.
- **FR-042**: Each deletion checklist item MUST show Pending, In Progress,
  Completed, Blocked, or Preserved with responsible capability, safe reason,
  and updated time.
- **FR-043**: Deletion requests MUST follow Requested → Review Required →
  Scheduled → In Progress → Completed. Requested, Review Required, or Scheduled
  MAY move to Cancelled; In Progress MAY move to Blocked; and Blocked MAY retry
  to In Progress. Legal hold blocks scheduling and completion. Completed and
  Cancelled are terminal. Every action MUST include the required reason,
  confirmation, current state, and expected record version.
- **FR-044**: The UI MUST state before every deletion mutation that it changes
  fictional mock state only and does not delete production data.
- **FR-045**: A deletion request MUST NOT reach mock Completed while any
  required checklist item is Pending, In Progress, or Blocked.
- **FR-046**: Preserved audit evidence MUST be visibly separated from deleted
  or anonymized customer data and explained as policy-governed retention.
- **FR-047**: Retention Policies MUST show data type, retention period in whole
  days, contract-provided minimum and maximum days, storage category, cleanup
  process reference, last cleanup, state, legal-hold behavior, version, and last
  change.
- **FR-048**: A retention-policy edit MUST require a valid policy identifier,
  allowed period, reason, impact summary, confirmation, and expected version.
- **FR-049**: Retention-policy validation MUST reject negative, zero,
  non-integer, unsupported, stale, or out-of-range periods. Protected audit
  retention MUST NOT fall below its contract-provided approved minimum.
- **FR-050**: Retention changes MUST affect mock policy state only and MUST NOT
  execute cleanup, reschedule a job, alter storage, or change customer data. An
  active legal hold MUST visibly suspend cleanup regardless of the configured
  retention period.

### Complete States and Feedback

- **FR-051**: Each major route MUST provide relevant loading, empty, error,
  success, warning, permission, and stale/conflict states.
- **FR-052**: Loading states MUST preserve page context without presenting
  skeleton values as real security or privacy data.
- **FR-053**: Empty states MUST distinguish no matching results, no activity in
  the selected period, and no permission to view activity.
- **FR-054**: Safe errors MUST include a recovery action and optional
  correlation reference without raw exception, internal path, stack trace,
  query, policy rule, private payload, or record existence.
- **FR-055**: Mutation success MUST update the deterministic mock state and
  related list/detail views consistently for the current session.
- **FR-056**: Slow, partial, unavailable, rate-limited, forbidden, not-found,
  validation, conflict, and internal-error scenarios MUST be independently
  selectable for verification.

## Platform Data Rules

- Relevant security, authentication, suspicious-activity, incident, audit,
  support-access, export, and deletion views MUST support All Platforms, iOS,
  and Android when an originating client or device is known.
- All Platforms is the default. Platform filtering MUST use explicit
  attribution and MUST NOT infer platform from actor name, event text, or
  unrelated device ownership.
- Security event totals may add iOS and Android event counts only when each
  event has one origin and the total is labeled as events.
- Account, Admin, request, permission-change, audit, and support-access totals
  MUST NOT be split by platform when platform attribution does not apply.
- Affected-customer totals spanning platforms MUST use a deduplicated unique
  count supplied by the contract; iOS plus Android MUST NOT be treated as the
  unique total.
- Device and session counts may be additive when each record has one platform
  and the metric is labeled accordingly.
- Each applicable record SHOULD show device platform, app version, session
  platform, and platform-specific risk labels supplied by the contract.
- Missing attribution MUST display Unknown as an explicit data-quality state
  and MUST NOT be silently included in iOS or Android.
- iOS views MUST NOT imply access to unrestricted notifications, SMS inbox
  content, or private device data. Android views MUST NOT display raw SMS,
  notification, sender, or bank content.

## UX and Design Constraints

- Preserve approved pages and Masarifi Gulf Premium Design System Version 2.1.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep surfaces neutral, data-dense, professional, and operational.
- Keep financial semantics separate from operational, risk, and workflow
  semantics.
- Reuse semantic status and severity tokens; do not scatter raw colors.
- Present high-risk metrics with restrained emphasis, never decorative alarm
  styling or animation.
- Keep immutable audit evidence visually distinct from editable operational
  notes and workflows.
- Display persistent mock-only notices on export download, account deletion,
  and retention mutation surfaces.
- Prefer compact summary cards and tables on desktop. Avoid excessive card
  nesting, gradients, decorative security imagery, or generic cyber-dashboard
  styling.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, breadcrumbs, timelines, filters, table
  reading order, drawers, dialogs, pagination, and action placement follow RTL.
  Identifiers, correlation IDs, versions, and structured metadata use isolated
  direction-safe text.
- **English LTR readiness**: Logical layout properties and mirrored directional
  controls support LTR without duplicated markup.
- **1440px**: Full sidebar, persistent filters, complete tables, multi-column
  overview, and side detail panels may appear simultaneously.
- **1280px**: Compact sidebar, reduced horizontal padding, and lower-priority
  columns move into row details or overflow actions.
- **1024px**: Collapsible sidebar, two-column metrics, filter drawer where
  needed, and horizontally scrollable tables with sticky identifying columns.
- **768px**: Drawer navigation, stacked overview, compact filter summary,
  essential columns only, and full-width dialogs or sheets.
- **390px**: Prioritize critical incidents, active support access, urgent
  privacy blockers, search, status, and safe approval/revocation actions.
  Complex audit metadata and retention editing show a desktop-required notice
  while preserving read-only summaries and urgent actions.
- No viewport may cause page-level horizontal overflow. A bounded table or
  structured-data region may scroll horizontally with a visible affordance.
- Touch actions MUST meet the 44px minimum target and remain separated from
  adjacent destructive or privileged actions.

## Accessibility

- All routes MUST use semantic headings, landmarks, lists, tables, form labels,
  descriptions, and logical heading order.
- Keyboard users MUST be able to reach filters, rows, tabs, dialogs, detail
  views, copy controls, confirmations, and recovery actions.
- Focus MUST be visible, trapped inside modal dialogs, restored to the invoker
  after close, and moved to the main heading after route transitions.
- Risk, severity, result, request, and policy states MUST expose readable text
  and must not rely on color, position, icon, or animation alone.
- Tables MUST provide headers, accessible names, sortable-state announcements,
  and a usable small-screen alternative.
- Timelines and before/after summaries MUST expose a linear screen-reader
  reading order and must not communicate sequence by layout alone.
- Charts and aggregate metrics MUST provide textual summaries and units.
- Loading, validation, success, conflict, expiry, and failure feedback MUST be
  announced through an appropriate live region without repeated announcements.
- Remaining-time displays MUST not require animation and MUST expose an
  absolute expiry time.
- Reduced-motion preference MUST disable nonessential transitions.
- Arabic and English labels, mixed-direction identifiers, and structured
  metadata MUST remain understandable to screen readers.

## Proposed API Contracts

All paths are proposed frontend contracts. The backend is not implemented.

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|---|---|---|---|---|
| GET | `/api/v1/admin/security/overview` | `SecurityOverviewQuery` | `SecurityOverview` | Security aggregates |
| GET | `/api/v1/admin/security/authentication-events` | `AuthenticationEventQuery` | `PaginatedResponse<AuthenticationEventSummary>` | Authentication event search |
| GET | `/api/v1/admin/security/suspicious-activity` | `SuspiciousActivityQuery` | `PaginatedResponse<SuspiciousActivitySummary>` | Risk event search |
| POST | `/api/v1/admin/security/suspicious-activity/{activityId}/actions` | `SuspiciousActivityActionRequest` | `SuspiciousActivityDetail` | Risk review workflow |
| GET | `/api/v1/admin/security/admins` | `AdminSecurityQuery` | `PaginatedResponse<AdminSecuritySummary>` | Admin security posture |
| GET | `/api/v1/admin/security/permission-changes` | `PermissionChangeQuery` | `PaginatedResponse<PermissionChangeSummary>` | Permission history |
| GET | `/api/v1/admin/security/support-access` | `SupportAccessQuery` | `PaginatedResponse<SupportAccessSummary>` | Active support-access search |
| POST | `/api/v1/admin/security/support-access/{accessId}/revoke` | `RevokeSupportAccessRequest` | `SupportAccessDetail` | Support-access revocation |
| GET | `/api/v1/admin/security/incidents/{incidentId}` | `IncidentDetailQuery` | `SecurityIncidentDetail` | Incident detail |
| POST | `/api/v1/admin/security/incidents/{incidentId}/actions` | `SecurityIncidentActionRequest` | `SecurityIncidentDetail` | Incident workflow |
| GET | `/api/v1/admin/audit-events` | `AuditEventQuery` | `PaginatedResponse<AuditEventSummary>` | Immutable audit search |
| GET | `/api/v1/admin/audit-events/{eventId}` | `AuditEventDetailQuery` | `AuditEventDetail` | Immutable audit detail |
| GET | `/api/v1/admin/data-requests/exports` | `ExportRequestQuery` | `PaginatedResponse<ExportRequestSummary>` | Export-request search |
| GET | `/api/v1/admin/data-requests/exports/{requestId}` | `DataRequestDetailQuery` | `ExportRequestDetail` | Export-request detail |
| POST | `/api/v1/admin/data-requests/exports/{requestId}/actions` | `ExportRequestActionRequest` | `ExportRequestDetail` | Export mock workflow |
| POST | `/api/v1/admin/data-requests/exports/{requestId}/simulate-download` | `SimulatedDownloadRequest` | `SimulatedDownloadResult` | Download eligibility demonstration |
| GET | `/api/v1/admin/data-requests/deletions` | `DeletionRequestQuery` | `PaginatedResponse<DeletionRequestSummary>` | Deletion-request search |
| GET | `/api/v1/admin/data-requests/deletions/{requestId}` | `DataRequestDetailQuery` | `DeletionRequestDetail` | Deletion-request detail |
| POST | `/api/v1/admin/data-requests/deletions/{requestId}/actions` | `DeletionRequestActionRequest` | `DeletionRequestDetail` | Deletion mock workflow |
| GET | `/api/v1/admin/data-retention/policies` | `RetentionPolicyQuery` | `PaginatedResponse<RetentionPolicySummary>` | Retention-policy search |
| GET | `/api/v1/admin/data-retention/policies/{policyId}` | `RetentionPolicyDetailQuery` | `RetentionPolicyDetail` | Retention-policy detail |
| PATCH | `/api/v1/admin/data-retention/policies/{policyId}` | `RetentionPolicyUpdateRequest` | `RetentionPolicyDetail` | Retention-policy mock update |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays.

## Frontend Types

- **SecurityOverviewQuery**: Period, platform, and optional scenario.
- **SecurityOverview**: Metric definitions with value, unit, entity semantics,
  platform breakdown when applicable, freshness, and trend summary.
- **AuthenticationEventQuery**: Validated event, actor class, platform, risk,
  result, region, period, search, sort, and pagination.
- **AuthenticationEventSummary**: Event ID, actor projection, actor type, event
  type, masked device, broad region, platform, app version, risk, time, result,
  and correlation ID.
- **SuspiciousActivitySummary / SuspiciousActivityDetail**: Actor projection,
  event, backend-provided score and signal labels, platform context, state,
  reviewer, version, safe timeline, and linked incident reference.
- **SuspiciousActivityActionRequest**: Allowed action, reason or note when
  required, reviewer or incident reference when applicable, and expected
  version.
- **AdminSecuritySummary**: Admin projection, role summary, two-factor state,
  last login, active-session count, and risk state.
- **PermissionChangeSummary**: Subject, previous/new permission summaries,
  changed-by projection, safe reason, time, result, and correlation ID.
- **SupportAccessSummary / SupportAccessDetail**: Agent, masked customer,
  ticket reference, allowed scope labels, start, expiry, status, version, and
  safe timeline.
- **RevokeSupportAccessRequest**: Reason, expected state, and expected version.
- **SecurityIncidentDetail**: Incident ID, severity, state, owner, timeline,
  affected-service summaries, deduplicated affected-customer count, actions,
  safe notes, resolution, version, and audit references.
- **SecurityIncidentActionRequest**: Allowed action, reason or note, expected
  state, and expected version.
- **AuditEventQuery**: Validated actor, action, resource, target reference,
  result, severity, period, search, sort, and pagination.
- **AuditEventSummary / AuditEventDetail**: Immutable event identity, actor,
  action, resource, masked target, result, broad region, bounded metadata
  summary, allowlisted before/after fields, related references, time, and
  correlation ID.
- **ExportScopeCategory**: Profile, Devices and Sessions, Financial Records,
  Imports, AI Data, Support and Feedback, Notifications, or Files; labels only,
  with no category contents.
- **ExportRequestSummary / ExportRequestDetail**: Request identity, masked
  customer, allowlisted scope categories, eligibility, state, timeline,
  fictional file metadata, expiry, safe errors, version, and audit references.
- **ExportRequestActionRequest**: Allowed action, reason when required,
  expected state, and expected version.
- **SimulatedDownloadRequest / SimulatedDownloadResult**: Request identity,
  expected version, allowed boolean result, mock-only message, and expiry; no
  URL, token, content, or binary value.
- **DeletionRequestSummary / DeletionRequestDetail**: Request identity, masked
  customer, state, schedule, subscription status, checklist, blockers,
  completion, version, and audit references.
- **DeletionChecklistItem**: Allowlisted category, state, responsible
  capability, safe reason, updated time, and required/preserved flags.
- **DeletionRequestActionRequest**: Allowed action, reason when required,
  expected state, and expected version.
- **RetentionPolicySummary / RetentionPolicyDetail**: Policy identity, data
  category, integer period in days, minimum and maximum days, storage category,
  cleanup-process reference, last cleanup, state, legal-hold behavior,
  protected flag, version, and change history.
- **RetentionPolicyUpdateRequest**: Positive integer retention days within the
  policy bounds, reason, impact acknowledgement, and expected version.
- **PlatformBreakdown**: Total plus iOS, Android, and Unknown where applicable,
  with a declared entity semantic and deduplicated unique count where required.
- **ApiError**: Safe status, code, message, optional field errors, and optional
  correlation ID.
- **PaginatedResponse<T>**: Validated records and pagination metadata.
- Application types MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success with fictional UAE and Saudi data, Arabic and English Admin
  names, iOS-only, Android-only, multi-platform, Admin-only, and global events.
- Empty selected period, no suspicious activity, no active support access, no
  pending privacy requests, and no retention policies matching filters.
- Large deterministic result sets that exercise filtering, sorting, and
  pagination without random order or current-time drift.
- Slow response, partial aggregate response, unauthorized, forbidden,
  not-found, validation error, stale-version conflict, already-transitioned
  conflict, rate limited, provider or capability unavailable, and internal
  error.
- High-risk authentication event, active and expired support access, permission
  escalation, resolved incident, export Ready/Expired/Failed, deletion Blocked/
  Scheduled/Completed, and protected retention policy.
- Malformed identifier, invalid enum, oversized search/reason, unsafe markup,
  bidi-control abuse, prohibited metadata key, excessive JSON depth/size,
  invalid platform, reversed date range, and unknown filter.
- Duplicate submission for support-access revocation, incident transition,
  export action, deletion action, and retention update.

### Loading States

- Overview metrics, charts, tables, detail summaries, timelines, checklist, and
  policy forms use labeled skeletons that do not imply real values.
- A detail route preserves the page heading and safe record reference while
  protected content loads.
- A pending sensitive mutation locks only the relevant controls and keeps the
  consequence text visible.

### Empty States

- Empty states distinguish no activity, no matching filters, completed queues,
  and unavailable platform attribution.
- Each empty state offers only safe relevant actions such as clear filters,
  change period, or return to the list.
- Access denied is never represented as an empty result.

### Error States

- Failures show a safe summary, optional correlation ID, and retry or return
  action without raw exceptions or protected data.
- Validation errors are attached to labeled fields and preserve valid input.
- Conflict states refresh the current mock record before another action.
- Partial overview data identifies unavailable metrics without presenting zero.

### Success States

- Assignment, state transition, support-access revocation, export/deletion
  workflow action, and retention update show one concise live announcement,
  updated state, and planned audit reference.
- Simulated export download success states clearly say no customer archive was
  generated or downloaded.

### Warning and Confirmation States

- Escalation, resolution, dismissal, support-access revocation, export
  cancellation/retry, deletion scheduling/cancellation/completion, and
  retention changes explain scope, consequence, mock-only boundary, current
  state, proposed state, and audit expectation.
- Destructive or privileged confirmations require an explicit action button;
  closing a dialog is not confirmation.

### Permission States

- Access-denied pages name the missing capability and offer a safe return
  action without showing protected data.
- Read-only views omit mutation controls while preserving a clear explanation
  of the role boundary.
- Direct denied mock requests return a generic forbidden result.

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

The future backend is expected to record successful and rejected privileged
actions with actor, action, target reference, approved field-level change
summary, reason, result, time, and correlation ID. Expected event families
include:

- `security.suspicious_activity.assigned`
- `security.suspicious_activity.escalated`
- `security.incident.updated`
- `security.support_access.revoked`
- `data_export.validated`
- `data_export.retried`
- `data_export.cancelled`
- `data_export.simulated_download`
- `account_deletion.scheduled`
- `account_deletion.blocked`
- `account_deletion.retried`
- `account_deletion.cancelled`
- `account_deletion.mock_completed`
- `retention_policy.updated`

Viewing or copying allowed audit metadata MAY itself produce a future audit
event. This phase only displays mock audit references; it does not create
tamper-evident records.

### Privacy Rules

- Use masked names or email fragments only when necessary to distinguish
  fictional customers or Admins.
- Show broad region instead of IP address or precise location.
- Show device type and safe label instead of raw device identifier,
  fingerprint, advertising ID, push token, or session value.
- Show allowlisted risk-signal labels rather than raw telemetry.
- Show aggregate affected-customer counts and bounded references rather than
  customer lists by default.
- Export details show scope and file metadata only, never archive contents,
  download credentials, or real URLs.
- Deletion details show workflow categories and state, never the customer data
  being deleted.
- Audit before/after summaries include only approved operational fields and
  exclude credentials, tokens, secrets, private messages, financial records,
  provider payloads, and protected content.
- Fixtures, tests, screenshots, errors, and logs MUST use sanitized fictional
  values.

### Sensitive Actions

- Suspicious-activity disposition, incident change, support-access revocation,
  privacy-request transition, simulated download, deletion transition, and
  retention update are privileged or privacy-sensitive.
- Each sensitive action requires purpose-limited fields, confirmation, pending
  lock, expected state/version, safe result, and planned audit reference.
- No Phase 7 action may grant a new permission, create support access, mutate an
  audit event, generate an export, delete data, enforce retention, or contact a
  customer.

## Security Requirements

- **Untrusted inputs**: All query parameters, route identifiers, searches,
  filters, sorts, page values, platform values, dates, reasons, notes, action
  names, expected states/versions, scope keys, metadata, checklist values, and
  policy fields MUST be parsed, normalized, and validated before use.
- **Safe rendering**: Event text, notes, reasons, signal labels, metadata,
  before/after summaries, errors, filenames, and policy text MUST render as
  bounded plain text or allowlisted structured fields. Raw HTML, Markdown,
  scripts, URLs, ANSI sequences, and executable JSON are prohibited.
- **Sensitive projections**: Protected fields MUST be omitted at the repository
  boundary. CSS hiding, client-only masking of full values, or deleting fields
  after a full object reaches the page is insufficient.
- **Client storage and environment**: Authentication/session values, customer
  data, audit metadata, export/deletion details, support-access data, IP values,
  secrets, tokens, credentials, and private identifiers MUST NOT be stored in
  local or session storage, IndexedDB, URLs, public environment values, logs,
  or screenshots.
- **Files and links**: No real file is uploaded or downloaded. Fictional file
  metadata requires a safe basename, allowlisted archive type, declared size,
  checksum label, expiry, and invalid/unsafe scenarios. No download URL or
  redirect is accepted. Any future external link opened in a new tab must
  prevent opener access.
- **Permissions**: Route guards, hidden navigation, disabled controls, and mock
  permissions are UX controls only. Every future operation and field projection
  requires independent backend authorization and least-privilege response
  shaping.
- **Errors and logs**: User-facing errors and development logs MUST NOT expose
  stack traces, internal paths, raw exceptions, policy internals, detection
  rules, credentials, tokens, IP addresses, private payloads, archive content,
  customer data, or unauthorized record existence.
- **Dependencies**: No new dependency is required. Any later dependency change
  requires scoped review for necessity, maintenance, compatibility, and known
  vulnerability exposure.
- **Security mock scenarios**: Denied, expired, revoked, invalid, unsafe-input,
  masked-projection, not-found, stale, duplicate-submission, protected-policy,
  malformed-metadata, and safe-error cases MUST be testable.
- **Deferred production controls**: Future NestJS and infrastructure must
  enforce authentication, authorization, risk policy, session revocation,
  tamper-evident audit storage, signed short-lived export access, archive
  encryption, deletion/anonymization, legal holds, retention enforcement,
  background execution, rate limits, monitoring, alerting, and secure secret
  management.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- The same customer uses iOS and Android; affected-customer total remains one
  while event or session counts may be two.
- Platform attribution is Unknown; it remains visible in All Platforms and is
  not silently assigned to iOS or Android.
- An event has an Admin actor and no mobile platform; platform filtering does
  not invent one.
- A support-access grant expires while its confirmation dialog is open; the
  revoke request returns a safe conflict and refreshes current state.
- A permission change removes the current operator’s access; the next request
  shows access denied and clears protected query data from the view.
- An incident contains both global service impact and mobile-originated events;
  only attributable event breakdowns are platform-filtered.
- An audit event references a deleted or unavailable resource; immutable event
  detail remains readable while the related link is unavailable.
- Audit metadata contains a prohibited key, excessive depth, excessive length,
  malformed Unicode, or bidirectional controls; it is omitted or rejected
  before rendering.
- A correlation ID or search contains reserved URL characters; validation and
  encoding prevent route or query injection.
- An export becomes Ready and expires while open; the simulated action is
  blocked and current expiry state replaces stale detail.
- An export request contains an unsupported scope key; the request cannot be
  advanced.
- A deletion request has a legal hold or unresolved checklist blocker; schedule
  or completion is rejected.
- A deletion request preserves required audit evidence; the preserved state is
  not counted as an incomplete customer-data deletion.
- A retention policy edit attempts to reduce protected audit retention below
  its allowed minimum; the field error explains the policy boundary without
  exposing internal enforcement details.
- A mutation is submitted twice or receives a delayed response; one transition
  occurs and the later request returns the current state or a safe conflict.
- A partial aggregate response omits one platform; the UI shows unavailable
  rather than zero and does not calculate a misleading total.
- Arabic labels surround Latin identifiers and JSON keys; direction isolation
  preserves readable order.

## Out of Scope

- Real backend, database, Supabase, storage, authentication, authorization,
  session revocation, encryption, secrets, risk engine, alerting, or audit
  infrastructure.
- Real export generation, archive content, download URLs, signed links,
  customer delivery, or file persistence.
- Real account deletion, anonymization, legal-hold enforcement, retention
  cleanup, storage mutation, queueing, or scheduled jobs.
- Creating or editing Admin users, roles, or permissions; those belong to
  Spec 010.
- Creating support-access grants; controlled access originates in Spec 003.
- System health, external providers, queues, jobs, and scheduled jobs; those
  belong to Spec 009.
- Final global search, settings, feature flags, and cross-module release
  hardening; those belong to Spec 010.
- Penetration testing, production incident response, legal or regulatory
  certification, and backend security guarantees.

## Acceptance Criteria

- **AC-001**: All 14 approved routes render their authorized loading, default,
  empty, safe-error, and access-denied states without runtime errors.
- **AC-002**: Every route and mutation enforces its proposed permission, and
  unauthorized responses contain no protected Phase 7 record fields.
- **AC-003**: An authorized operator can locate a known fictional critical
  authentication event and open its related security context in under two
  minutes.
- **AC-004**: An authorized operator can find a known audit event by correlation
  ID and inspect its safe immutable detail in under 60 seconds.
- **AC-005**: No audit route exposes a control or contract that creates, edits,
  deletes, retries, replaces, or rolls back an audit event.
- **AC-006**: Support-access revocation, security workflow actions, privacy
  transitions, and retention updates require confirmation, lock during pending
  state, reject duplicate or stale submissions, and announce a safe outcome.
- **AC-007**: Export views expose no archive content, real download URL, token,
  binary value, or browser-stored customer data.
- **AC-008**: Deletion views change deterministic fictional state only and
  cannot reach mock Completed while a required checklist item is unresolved.
- **AC-009**: All applicable security and privacy views support All Platforms,
  iOS, and Android without double-counting unique customers or inventing
  platform attribution.
- **AC-010**: Risk, severity, result, workflow, and expiry states are
  distinguishable without color on every target viewport.
- **AC-011**: Arabic RTL and English LTR preserve logical order, readable mixed
  direction identifiers, visible focus, keyboard completion, and 44px touch
  targets at 1440, 1280, 1024, 768, and 390 pixels.
- **AC-012**: Unsafe identifiers, filters, notes, metadata, scope keys, and
  policy values are rejected before rendering or mutation with safe field-level
  feedback.
- **AC-013**: Standard mock pages present usable content within 2 seconds and
  filter, sort, or pagination updates within 1 second at the 95th percentile,
  excluding explicitly labeled slow scenarios.
- **AC-014**: No Phase 7 source, fixture, rendered view, error, log, screenshot,
  URL, or browser storage contains secrets, raw IP addresses, tokens,
  credentials, archive contents, full device identifiers, or real personal
  data.
- **AC-015**: Phase 7 passes the required typecheck, lint, unit/component,
  end-to-end, production-build, responsive, accessibility, and security review
  gates without weakening prior approved behavior.

## Success Criteria

- **SC-001**: 100% of the 14 approved routes can be completed with keyboard-only
  navigation in both Arabic RTL and English LTR.
- **SC-002**: Operators complete the critical-event investigation scenario in
  under two minutes and the audit-event lookup scenario in under 60 seconds in
  at least 9 of 10 verification attempts.
- **SC-003**: 100% of privileged or privacy-sensitive mock actions show scope,
  consequence, confirmation, pending lock, result feedback, and audit
  expectation.
- **SC-004**: 100% of denied-route and denied-action scenarios return no
  protected actor, signal, metadata, request, file, checklist, or policy data.
- **SC-005**: 100% of applicable platform totals pass event-addition and
  unique-customer-deduplication checks.
- **SC-006**: 100% of automated unsafe-input cases render as plain text,
  validation feedback, or safe unavailable states without executable content or
  sensitive error detail.
- **SC-007**: At all five approved widths, all critical security and privacy
  tasks remain operable with no page-level horizontal overflow and no status
  communicated by color alone.
- **SC-008**: No real customer data, export archive, deletion, retention
  enforcement, audit mutation, production authentication, or provider operation
  occurs during any Phase 7 scenario.

## Verification

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Focused verification**: Run Phase 7 contract, repository, permission,
  projection, metadata-safety, mutation-transition, component, route, and
  Playwright tests.
- **Viewport and accessibility checks**: Verify every Phase 7 route at 1440,
  1280, 1024, 768, and 390 pixels in Arabic RTL and representative English LTR;
  check keyboard operation, visible focus, focus restoration, semantic
  structure, live feedback, table alternatives, mixed-direction identifiers,
  reduced motion, 44px targets, and non-color status.
- **Security review**: Review sensitive-data projections, unsafe rendering,
  route and payload validation, permission denial, expected versions,
  duplicate-submission locks, client storage, public environment exposure,
  downloads and links, safe errors and logs, dependencies, fictional fixtures,
  privacy masking, immutable audit behavior, and deferred backend protections.

Successful verification MUST NOT be claimed unless each named command was
executed successfully.
