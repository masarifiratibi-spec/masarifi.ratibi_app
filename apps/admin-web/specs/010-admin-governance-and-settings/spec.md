# Admin Web Feature Specification: Admin Team, Roles, Permissions, Settings, and Final Integration

**Phase / Spec**: Phase 9 / Spec 010 of 010  
**Created**: 2026-08-01  
**Status**: Draft  
**Input**: "Read the complete masarifi-admin-dashboard-full-frontend-specification-v3-10-specs.md and create Phase 9 — Spec 010: Admin Team, Roles, Permissions, Settings, and Final Integration."

## Phase

- **Phase**: Phase 9 — Platform administration, governance, configuration, and final frontend integration
- **Spec**: `010-admin-governance-and-settings`
- **Delivery position**: Tenth and final specification in the approved sequential Admin Web plan
- **Boundary**: Frontend-only governance and configuration workflows using typed mock contracts, sanitized fictional data, and release-readiness evidence

## Goal

Enable authorized Admin operators to manage the fictional Admin team, inspect
and safely change role assignments and permission sets, configure platform and
mobile settings, control staged feature availability, simulate maintenance
mode, search across all completed Admin modules, and review permission-filtered
operational attention items.

Complete the ten-spec Admin frontend by verifying that Specs 001–009 remain
visually consistent, responsive, accessible, permission-aware, privacy-safe,
contract-consistent, and free of route regressions. This phase does not invite
real people, change real access, revoke real sessions, alter production
configuration, release mobile features, enter production maintenance, or
replace future backend authorization and audit enforcement.

## Clarifications

### Session 2026-08-01

- Q: Which invitation lifecycle actions are implemented in Spec 010? → A: Only creating a Pending fictional invitation is mutable; Accepted, Expired, and Revoked invitations are read-only seeded scenarios, and acceptance, expiry processing, resend, and revocation are deferred.
- Q: Does the role editor implement a second-approver workflow? → A: No; approval requirements are descriptive policy metadata only in Spec 010, while custom-role mutations use one authorized Super Admin confirmation and future backend audit expectation.
- Q: What lifecycle applies to custom roles? → A: A custom role is created Active, may move between Active and Disabled through the existing edit operation, cannot be deleted, and must have no Active Admin assignments before disablement.
- Q: What is the transaction and conflict boundary for settings saves? → A: Each settings group saves only its changed allowlisted fields as one atomic operation against one group version; any stale version rejects the whole group change and reloads current values.
- Q: Which feature-flag audiences are supported? → A: Use the fixed audiences All Customers, Free Plan, Basic Plan, Premium Plan, and Internal Testers; no custom query, identifier list, or customer-level targeting is allowed.

## Dependencies

- **Prior phase/specs**: Specs 001–009 MUST be complete, reusable, and visually unchanged.
- **Existing foundation**: Reuse the Admin shell, Governance navigation group,
  breadcrumbs, page headers, global search, attention panel, role switcher,
  permission boundary, tables, filters, pagination, drawers, forms, dialogs,
  confirmations, timelines, status badges, masked fields, query provider,
  typed repository pattern, mock scenario controls, semantic tokens, and
  Arabic RTL / English LTR behavior.
- **Cross-module references**: Every prior specification supplies its final
  routes, permission keys, safe searchable summaries, attention destinations,
  validation rules, and verification baseline. Spec 008 supplies immutable
  permission-change and audit evidence. Spec 009 supplies health, provider,
  queue, and job destinations used by search and attention.
- **Governing sources**: Admin Web Constitution 1.1.0, the Full Frontend Product
  Specification Version 3, the Full Product Technical Plan Version 3, and
  Masarifi Gulf Premium Design System Version 2.1.
- **Sequence**: No later Admin Web feature specification exists. New product
  capabilities discovered during final integration require a separately
  approved future specification rather than silent expansion of Spec 010.

## Assumptions

- All Admins, invitations, departments, roles, sessions, settings, flags,
  maintenance events, searches, and attention items are fictional and sanitized.
- The seven established simulated roles remain Super Admin, Support Agent,
  Billing Operator, Parser and Import Operator, AI Operator, Content Manager,
  and Security Administrator. The development role switcher continues to use
  only these stable roles.
- The seven established roles are system roles. Their keys, permission
  assignments, names, system status, and enabled state are immutable in Spec
  010. Their complete permission matrix may be inspected; custom roles provide
  the editable role-governance workflow.
- A custom role is created Active and may move between Active and Disabled
  through the existing edit operation. It cannot be deleted and must have no
  Active Admin assignments before disablement. It does not become a new
  development-session identity or expand the current operator's own permissions.
- Role approval requirements are descriptive policy metadata. Spec 010 has no
  approval queue, second-approver action, or pending-approval role state.
- Admin states are Invited, Active, and Disabled. Invitation states are Pending,
  Accepted, Expired, and Revoked. Only Pending invitation creation is mutable;
  the other invitation states are read-only seeded scenarios. No real email or
  account is created.
- Invitations expire after seven days by default and permit a whole-day expiry
  from 1 through 30 days.
- Lists default to 25 rows and permit 25, 50, or 100 rows, with 100 as the
  maximum page size. Search input is 2–120 trimmed Unicode characters.
- Privileged reasons are 10–500 trimmed Unicode characters and reject control
  characters. Optional invitation messages are at most 1,000 characters.
- Admin and role mutations use the current record version. Settings and feature
  flags use the current configuration version. Stale submissions return a safe
  conflict and refresh the current value.
- Each settings group is an independent atomic change boundary. One save sends
  only changed allowlisted fields with one group version; partial success within
  a group is not permitted.
- At least one Active Super Admin must always remain. An operator cannot disable
  their own Admin account, revoke their current session, or remove the
  permissions needed to preserve this invariant.
- System settings are versioned, non-secret configuration. Provider keys,
  credentials, tokens, connection strings, private endpoints, and secret values
  never enter the frontend contract.
- Feature rollout is an integer from 0 through 100 percent. A flag may target
  iOS, Android, or Shared scope and may have an optional bounded start and end.
- Feature-flag audience is one of All Customers, Free Plan, Basic Plan, Premium
  Plan, or Internal Testers. Internal Testers is a fictional aggregate label;
  no member identities, custom queries, or customer lists enter the contract.
- Maintenance states are Off, Scheduled, and Active. Mock activation changes
  deterministic frontend state only and cannot affect any real client or service.
- Global search preserves the existing Navigation group and adds the ten entity
  groups required by the master specification. Results are summaries, never
  unrestricted records.
- The attention panel remains read-only in Spec 010. It shows the ten approved
  operational notification types and safe destinations; acknowledging,
  dismissing, subscribing, or delivering notifications is out of scope.
- Standard mock pages target usable content within 2 seconds and search,
  filtering, sorting, pagination, or local settings updates within 1 second at
  the 95th percentile, excluding explicitly labeled slow scenarios.

## Backend Alignment

### Planned Backend Modules

- `admin`
- `auth`
- `users`
- `roles`
- `permissions`
- `system-settings`
- `notifications`
- `audit-logs`
- Domain modules from Specs 002–009 for permission-filtered search and attention projections

### Planned Database Entities

- `auth.users`
- `profiles`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `audit_logs`
- `system_settings`
- `notifications`

`AdminInvitation`, `AdminSession`, `FeatureFlag`, `MaintenanceWindow`, and
`AttentionItem` are proposed backend capability models; they do not authorize
new database tables in this frontend phase.

### Boundary

Proposed typed contracts and mock HTTP behavior only. No NestJS module,
Supabase query, database schema, row-level security policy, real authentication,
email delivery, session revocation, configuration persistence, flag service,
mobile release control, or maintenance infrastructure is implemented.

## Roles and Permissions

### Roles

- **Super Admin**: Full Admin-team, role, permission, settings, flag, and
  maintenance access; subject to self-lockout and last-Super-Admin protections.
- **Security Administrator**: Read Admin profiles, roles, and permissions;
  manage security settings; inspect safe governance history; no invite, disable,
  role-edit, general-setting, mobile-setting, feature-flag, or maintenance mutation.
- **Support Agent, Billing Operator, Parser and Import Operator, AI Operator,
  and Content Manager**: No Spec 010 governance route access. They retain only
  their existing permission-filtered global search and attention experience.

### Permission Keys

- Admin team: `admin-team.read`, `admin-team.invite`, `admin-team.disable`,
  `admin-team.sessions.revoke`, `admin-team.roles.assign`.
- Role governance: `roles.read`, `roles.manage`, `permissions.read`,
  `permissions.manage`.
- Settings: `settings.general.read`, `settings.general.manage`,
  `settings.mobile.read`, `settings.mobile.manage`, `settings.flags.read`,
  `settings.flags.manage`, `settings.imports.read`, `settings.imports.manage`,
  `settings.ai.read`, `settings.ai.manage`, `settings.subscriptions.read`,
  `settings.subscriptions.manage`, `settings.security.read`,
  `settings.security.manage`, `settings.maintenance.read`, and
  `settings.maintenance.manage`.
- Shared completion: existing `global-search.use` and `attention.read` remain
  available to all seven simulated roles, but each result and destination also
  requires its owning permission.

### Permission Matrix

| Capability | Super Admin | Security Administrator | Other five roles |
|------------|-------------|------------------------|------------------|
| Admin list and safe profiles | Manage | Read | Deny |
| Invitations and disabling | Manage | Deny | Deny |
| Session revocation | Manage | Read only | Deny |
| Role and permission inventory | Manage | Read | Deny |
| General, mobile, flag, import, AI, and subscription settings | Manage | Deny | Deny |
| Security settings | Manage | Manage | Deny |
| Maintenance settings | Manage | Read | Deny |
| Global search | Permission-filtered | Permission-filtered | Permission-filtered |
| Attention panel | Permission-filtered | Permission-filtered | Permission-filtered |

- Navigation and route denial MUST omit protected counts, names, roles,
  permissions, settings, flag values, and maintenance details.
- Read-only roles MUST not receive mutation controls or mutation-capable
  response fields.
- Direct mock requests MUST independently return safe forbidden responses.
- Permission-aware UI, route guards, hidden controls, disabled controls, and
  development roles are UX simulation only. Future backend authorization MUST
  independently authorize every operation and shape every response.

## User Scenarios and Testing

### User Story 1 — Govern the Admin Team Safely (Priority: P1)

As a Super Admin, I need to inspect fictional Admin accounts, invite an Admin,
assign an allowed role, revoke eligible sessions, and disable an eligible Admin
without locking out the platform.

**Why this priority**: Platform governance depends on knowing who has Admin
access and on preventing unsafe access changes.

**Independent test**: Locate an Active fictional Admin, review their safe
profile and security state, invite a new fictional Admin, then disable another
eligible Admin with session revocation and ticket reassignment confirmation.

**Acceptance scenarios**:

1. **Given** an authorized Super Admin and a valid unique fictional email,
   **When** the invitation is confirmed, **Then** exactly one Pending invitation
   appears with the selected role, department, expiry, safe audit expectation,
   and an explicit message that no email or real account was created.
2. **Given** an eligible Active Admin, **When** disablement is confirmed with a
   valid reason, session-revocation choice, and ticket reassignment where
   required, **Then** the mock Admin becomes Disabled once and the safe outcome
   names the affected responsibilities.
3. **Given** the current operator or last Active Super Admin, **When** disablement
   is attempted, **Then** the action is unavailable and a safe explanation
   preserves access continuity.
4. **Given** a Security Administrator, **When** Admin team data is opened,
   **Then** safe profile and security summaries are readable but invitation,
   assignment, revocation, and disable controls are absent.

### User Story 2 — Review and Maintain Least-Privilege Roles (Priority: P1)

As a Super Admin, I need a complete permission matrix and controlled custom-role
editor so Admin responsibilities are understandable and changes do not create
hidden privilege escalation.

**Why this priority**: Spec 010 must consolidate the permission keys introduced
across all ten specifications and make least privilege verifiable.

**Independent test**: Open the matrix, filter by permission group, compare all
seven system roles, create a custom read-only role, edit its permissions, and
verify system-role and lockout protections.

**Acceptance scenarios**:

1. **Given** the completed ten-spec permission inventory, **When** the matrix is
   opened, **Then** every permission is shown once under its owning group with
   Read, Create, Update, Delete, Approve, Export, or Temporary Access semantics.
2. **Given** valid role details and an allowed permission selection, **When** a
   custom role is confirmed, **Then** one versioned fictional role is created
   with assigned-Admin count, status, and audit expectation.
3. **Given** a system role, **When** an operator attempts to rename, delete, or
   disable it, **Then** the operation is rejected without changing its stable key.
4. **Given** a permission selection that would grant outside the operator's own
   assignable scope or remove the last governance path, **When** submitted,
   **Then** validation blocks the mutation and identifies the conflicting group.

### User Story 3 — Configure Platform and Mobile Settings (Priority: P1)

As a Super Admin, I need versioned settings grouped by domain so platform and
mobile behavior can be reviewed and safely simulated without exposing secrets.

**Why this priority**: The final frontend must represent all approved platform
configuration while keeping iOS, Android, and shared mobile behavior distinct.

**Independent test**: Update one General setting and one setting in each of the
iOS, Android, Shared, Import, AI, Subscription, and Security groups, then verify
validation, conflict, audit, and no-secret behavior.

**Acceptance scenarios**:

1. **Given** General Settings, **When** supported countries, currencies,
   languages, default time zone, or registration state is changed, **Then** the
   review shows only changed fields and requires a reason and confirmation.
2. **Given** Mobile Application Settings, **When** the operator changes a value,
   **Then** iOS-only, Android-only, and Shared settings remain visibly separated
   and the impact scope is explicit.
3. **Given** Import, AI, Subscription, or Security Settings, **When** an invalid
   value or unsafe text is entered, **Then** field-level validation preserves
   valid input and no change occurs.
4. **Given** a stale configuration version, **When** a save is submitted,
   **Then** a safe conflict presents the latest mock values before retry.

### User Story 4 — Stage Feature Availability and Maintenance (Priority: P1)

As a Super Admin, I need to configure fictional feature rollouts and simulated
maintenance so platform changes state their audience, timing, and consequences.

**Why this priority**: Flags and maintenance can affect the whole customer
experience and therefore need the strongest confirmation and audit behavior.

**Independent test**: Schedule a platform-scoped flag and a maintenance window,
activate an eligible mock maintenance state, then return it to Off without any
real application or service impact.

**Acceptance scenarios**:

1. **Given** an approved flag, **When** platform, audience, rollout percentage,
   status, start, and end are valid, **Then** the mock flag saves once with a
   version and clear effective scope.
2. **Given** a mobile-specific feature, **When** its platform is changed to an
   incompatible target, **Then** validation blocks the change rather than
   implying unsupported availability.
3. **Given** a maintenance window, **When** it is scheduled or activated, **Then**
   the confirmation names affected platforms, Arabic and English messages,
   time window, allowed Admin roles, recovery action, and audit expectation.
4. **Given** maintenance is Active, **When** a Super Admin ends the simulation,
   **Then** state returns to Off once and the UI states that no real service was changed.

### User Story 5 — Search the Completed Admin Product (Priority: P1)

As any simulated Admin role, I need one global search that finds only the safe
entities I am authorized to open across Specs 001–010.

**Why this priority**: Completing search is required for cross-module
integration and efficient operational navigation.

**Independent test**: Search known fictional identifiers in every approved
result group while switching through all seven roles and verify grouping,
keyboard navigation, safe summaries, and destination permissions.

**Acceptance scenarios**:

1. **Given** a valid query, **When** results are returned, **Then** they are
   grouped as Navigation, Users, Subscriptions, Payment Events, Imports,
   Support Tickets, Audit Events, Jobs, Parser Rules, Banks, or Admin Users.
2. **Given** a role without permission for an entity or destination, **When**
   search runs, **Then** that result and its protected metadata are omitted.
3. **Given** a masked email query, **When** the result is displayed, **Then** the
   summary remains masked and does not reveal the underlying address.
4. **Given** malformed, oversized, or script-like input, **When** search is
   attempted, **Then** it is rejected or rendered as plain text with no unsafe destination.

### User Story 6 — Review Cross-Module Attention (Priority: P1)

As any simulated Admin role, I need a permission-filtered attention panel that
links urgent fictional conditions to the correct completed module.

**Why this priority**: Operational awareness must remain consistent after all
ten modules are integrated.

**Independent test**: Open the attention panel for every role and verify the ten
approved notification types, severity order, non-color cues, safe destination,
and denial filtering.

**Acceptance scenarios**:

1. **Given** mixed attention items, **When** the panel opens, **Then** Critical,
   High, Medium, Low, and Info are conveyed by label, icon, text, and color and
   ordered by severity then recency.
2. **Given** a destination the role cannot open, **When** attention data is
   projected, **Then** the item is omitted rather than exposed as a broken link.
3. **Given** an item for a global service, **When** platform context is shown,
   **Then** it remains Global and is not attributed to iOS or Android.
4. **Given** an empty or partially unavailable attention response, **When** the
   panel opens, **Then** it distinguishes no attention from unavailable data.

### User Story 7 — Verify the Complete Admin Frontend (Priority: P1)

As the product owner and release reviewer, I need evidence that all ten specs
work together without visual, responsive, accessibility, permission, privacy,
contract, route, or console regressions.

**Why this priority**: Spec 010 is the release-readiness integration gate for
the complete frontend-only Admin product.

**Independent test**: Execute the complete verification matrix over every
approved route, role, locale direction, theme, viewport, contract, and major UI
state and produce traceable pass/fail evidence.

**Acceptance scenarios**:

1. **Given** every approved route from Specs 001–010, **When** route verification
   runs, **Then** each route opens in its authorized default state with no
   runtime or console error.
2. **Given** Arabic RTL and representative English LTR, **When** all five
   viewports are reviewed, **Then** content remains operable, readable, and free
   of unintended page-level horizontal overflow.
3. **Given** the complete permission inventory, **When** all seven role journeys
   run, **Then** navigation, search, attention, routes, fields, and mutations
   agree with one consolidated matrix.
4. **Given** all named quality commands, **When** completion is claimed, **Then**
   the report records actual successful results and any remaining limitation.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/admin/admin-team` | Admin list, filters, invite entry, and status actions | Super Admin; Security Administrator read-only | New |
| `/admin/admin-team/invite` | Invite a fictional Admin | Super Admin | New |
| `/admin/admin-team/[adminId]` | Safe Admin profile, roles, sessions, security, tickets, and activity | Super Admin; Security Administrator read-only | New |
| `/admin/roles` | System and custom role inventory | Super Admin; Security Administrator read-only | New |
| `/admin/roles/new` | Create a fictional custom role | Super Admin | New |
| `/admin/roles/[roleId]` | Role detail, assigned Admins, permissions, and history | Super Admin; Security Administrator read-only | New |
| `/admin/roles/[roleId]/edit` | Edit an eligible custom role | Super Admin | New |
| `/admin/roles/permissions` | Complete grouped permission matrix | Super Admin; Security Administrator read-only | New |
| `/admin/settings` | General Settings | Super Admin | New; activates planned navigation |
| `/admin/settings/mobile` | iOS, Android, and Shared mobile settings | Super Admin | New |
| `/admin/settings/feature-flags` | Feature-availability inventory and editor | Super Admin | New |
| `/admin/settings/imports` | Import limits and processing settings | Super Admin | New |
| `/admin/settings/ai` | AI limits, priorities, thresholds, safety, and fallback settings | Super Admin | New |
| `/admin/settings/subscriptions` | Grace, retry, limit, trial, and cancellation settings | Super Admin | New |
| `/admin/settings/security` | Admin access and risk settings | Super Admin; Security Administrator | New |
| `/admin/settings/maintenance` | Read, schedule, activate, and end simulated maintenance | Super Admin manage; Security Administrator read-only | New |

Global search and attention remain shell surfaces and do not require new routes.
Dynamic identifiers MUST use validated fictional Admin and role identifiers.

## Functional Requirements

### Admin Team

- **FR-001**: The frontend MUST show Admin, role, department, status,
  two-factor state, last login, active-session count, and created time for every
  authorized Admin list row.
- **FR-002**: The Admin list MUST support bounded search, status, role,
  department, two-factor state, sort, and pagination without exposing denied data.
- **FR-003**: Admin Profile MUST show profile summary, roles, effective
  permissions, assigned-ticket summary, recent safe actions, sessions, and
  security state with independent partial-data handling.
- **FR-004**: Email values MUST be masked in lists and read-only views. The full
  fictional invitation email may appear only in the active invitation form and
  immediate confirmation result for an authorized Super Admin.
- **FR-005**: Invite Admin MUST validate a normalized email, 1–120 character
  name, active assignable role, bounded department, 1–30 day expiry, and optional
  bounded plain-text message.
- **FR-006**: Duplicate Pending invitations and emails already assigned to an
  Active Admin MUST return a safe conflict without disclosing unrequested data.
- **FR-007**: A successful mock invitation MUST create exactly one Pending
  record and MUST state that no message was sent and no account was created.
  Acceptance, expiry processing, resend, and revocation controls and contracts
  MUST NOT be exposed.
- **FR-008**: Disable Admin MUST require an eligible target, 10–500 character
  reason, current version, explicit session-revocation choice, ticket
  reassignment when open assignments exist, consequence review, and confirmation.
- **FR-009**: The current operator and last Active Super Admin MUST not be
  disableable. A Disabled Admin MUST not be disabled twice.
- **FR-010**: Eligible session revocation MUST name the target Admin and session
  count, lock while pending, reject the current operator's own current session,
  and update fictional state once.
- **FR-011**: Role assignment MUST allow only Active roles within the operator's
  assignable scope and MUST reject removal of the last Super Admin assignment.

### Roles and Permissions

- **FR-012**: Roles List MUST show role name, key, assigned Admin count,
  permission count, system/custom state, status, and last update.
- **FR-013**: Role Details MUST show a safe summary, assigned Admins, grouped
  permissions, effective constraints, and immutable change-history references.
- **FR-014**: Permission Matrix MUST contain every active permission key defined
  across Specs 001–010 exactly once and MUST support group, action, role, and
  assignment-state filtering.
- **FR-015**: Permission groups MUST cover Users, Billing, Imports, Parsers, AI,
  Content, Support, Security, Audit, Jobs and Health, Admin Team, and Settings.
- **FR-016**: Permission actions MUST use the approved Read, Create, Update,
  Delete, Approve, Export, and Temporary Access semantics where applicable.
- **FR-017**: Create or Edit Role MUST validate a unique stable key, localized
  display name, bounded description, at least one permission, status,
  expiration behavior, descriptive approval requirements, current version when
  editing, reason, and one authorized Super Admin confirmation. It MUST NOT
  create an approval task or imply that metadata is backend enforcement. New
  custom roles MUST begin Active.
- **FR-018**: System-role keys, names, permission assignments, enabled state,
  deletion state, and system status MUST be immutable. The UI MUST explain this
  boundary without presenting unsupported mutation controls.
- **FR-019**: Role changes MUST show added and removed permissions grouped by
  domain and MUST warn when a selection creates broader access than the role's
  previous state.
- **FR-020**: An operator MUST NOT assign a permission outside their own
  assignable scope or create a role capable of changing its creator's protected
  governance constraints.
- **FR-021**: A custom role may move between Active and Disabled through the
  existing edit operation and MUST never expose delete. Disablement MUST be
  rejected while any Active Admin is assigned; those assignments must be
  changed before a later disable attempt.

### Settings and Flags

- **FR-022**: Settings MUST be grouped as General, Mobile Application, Feature
  Flags, Import, AI, Subscription, Security, and Maintenance with independent
  read, edit, loading, error, and permission states.
- **FR-023**: General Settings MUST include platform name, supported countries,
  currencies, languages, default time zone, maintenance summary, and
  registration state.
- **FR-024**: Mobile Application Settings MUST keep iOS, Android, and Shared
  values in separate labeled sections and MUST never imply that one platform's
  capability applies to the other.
- **FR-025**: iOS settings MUST include minimum and latest iOS versions, store
  link, force-update state, Shortcut, App Intents, Share Extension, screenshot
  import, widget, and quick-action flags.
- **FR-026**: Android settings MUST include minimum and latest Android versions,
  store link, force-update state, SMS tracking, Notification Listener,
  background tracking, and bank-filtering flags.
- **FR-027**: Shared settings MUST include receipt scan, voice entry, AI
  assistant, budgets, debts, goals, advanced reports, investments, and
  maintenance state.
- **FR-028**: Minimum and latest mobile versions MUST use a validated dotted
  numeric form, and a minimum version MUST NOT exceed its latest version.
- **FR-029**: Store links MUST be approved HTTPS destinations for the matching
  platform and MUST never accept executable, credential-bearing, or
  non-allowlisted destinations.
- **FR-030**: Feature Flags MUST show feature, platform scope, audience,
  integer rollout percentage, status, start, end, current version, and update
  time. Audience MUST be All Customers, Free Plan, Basic Plan, Premium Plan, or
  Internal Testers.
- **FR-031**: Flag schedules MUST reject an end before start, a rollout outside
  0–100, a platform incompatible with the feature, an unknown audience, a
  custom audience query, or a customer-identifier list.
- **FR-032**: Import Settings MUST include maximum file size, supported file
  types, processing timeout, retention, duplicate threshold, and AI fallback.
- **FR-033**: AI Settings MUST include feature limits, provider priorities,
  cost-warning thresholds, safety state, and fallback behavior without exposing
  credentials, raw prompts, private conversations, or provider payloads.
- **FR-034**: Subscription Settings MUST include grace period, retry behavior,
  plan limits, trial length, and cancellation policy without modifying plans,
  prices, payments, or subscriptions owned by Spec 004.
- **FR-035**: Security Settings MUST include Admin session duration,
  two-factor requirement, password-policy summary, temporary-access maximum
  duration, and risk thresholds without revealing detection internals.
- **FR-036**: Every settings mutation MUST show field-level changes, affected
  scope, reason, current version, consequence, confirmation, pending lock,
  safe result, and expected audit event. It MUST send only changed allowlisted
  fields and apply them atomically against one settings-group version; a stale
  version MUST reject the whole group change and reload current values.
- **FR-037**: Settings forms MUST distinguish an explicit zero or Off value
  from missing, unavailable, inherited, or invalid data.

### Maintenance

- **FR-038**: Maintenance Mode MUST show Off, Scheduled, or Active state,
  localized message, affected platform scope, start, end, allowed Admin roles,
  current version, and last change.
- **FR-039**: Scheduling MUST require a future start, end after start, at least
  one affected platform, Arabic and English safe messages, at least one allowed
  Admin role including Super Admin, reason, consequence review, and confirmation.
- **FR-040**: Immediate mock activation MUST require a second explicit
  acknowledgement that no production system is affected.
- **FR-041**: Ending mock maintenance MUST remain available to an authorized
  Super Admin, lock while pending, and return the state to Off once.
- **FR-042**: Maintenance MUST NOT hide the Admin shell, block verification
  routes, affect real mobile clients, or claim production enforcement.

### Global Search and Attention

- **FR-043**: Global search MUST preserve Navigation and support User ID,
  masked email, Subscription ID, Payment Event ID, Import ID, Support Ticket ID,
  Audit Event ID, Job ID or correlation ID, Parser Rule, Bank, and Admin User.
- **FR-044**: Search results MUST be grouped by entity type, identify a safe
  title and context, and expose only normalized internal destinations that the
  current role can open.
- **FR-045**: Search MUST omit fields and result existence for unauthorized
  entities and MUST not rely on disabling an otherwise exposed result.
- **FR-046**: Search MUST support keyboard opening, clear loading and empty
  states, visible focus, deterministic ordering, and safe mixed-direction text.
- **FR-047**: The attention system MUST cover Critical Incident, Failed Payment
  Spike, AI Provider Outage, Queue Backlog, Import Failure Spike, Security Alert,
  Urgent Support Ticket, Account Deletion Failure, Backup Issue, and Parser Regression.
- **FR-048**: Each attention item MUST include safe identity, type, severity,
  summary, occurrence time, platform scope when applicable, owning permission,
  and optional authorized destination.
- **FR-049**: Attention severity MUST use text, icon, and color; ordering MUST be
  deterministic by severity, recency, then stable identity.
- **FR-050**: Search and attention MUST validate responses at their trust
  boundary and MUST reject unsafe destinations, unknown entity or event types,
  malformed timestamps, oversized summaries, and prohibited metadata.

### Final Integration

- **FR-051**: The complete Admin navigation MUST expose all approved groups and
  destinations from Specs 001–010 according to the consolidated permission matrix.
- **FR-052**: All routes MUST resolve their most specific permission before a
  broader parent route and MUST show a safe access-denied state on direct denial.
- **FR-053**: Pages and presentation components across all ten specs MUST obtain
  data through typed service or repository boundaries and MUST NOT import raw
  fixture arrays.
- **FR-054**: All cross-module identifiers, statuses, severity levels, platform
  semantics, pagination shapes, safe errors, and audit references MUST remain
  consistent or explicitly adapt at one documented boundary.
- **FR-055**: Every approved route MUST retain relevant loading, empty, error,
  success, warning, conflict, and permission states without redesigning prior pages.
- **FR-056**: Final review MUST cover Arabic RTL, English LTR readiness, light
  and dark themes, keyboard operation, reduced motion, visible focus, accessible
  names, contrast, tables, charts, dialogs, live feedback, and 44px touch targets.
- **FR-057**: Final review MUST cover 1440, 1280, 1024, 768, and 390 pixel widths
  with no unintended page-level horizontal overflow.
- **FR-058**: Final review MUST verify platform filters, unique-customer
  deduplication, event-count addition, global infrastructure semantics, Unknown
  attribution, and iOS/Android settings separation wherever applicable.
- **FR-059**: Final review MUST verify no secrets, real personal data, raw
  financial content, private AI content, provider payloads, credentials, tokens,
  private identifiers, unsafe HTML, raw exceptions, or internal infrastructure
  details appear in source, fixtures, UI, URLs, browser storage, logs, or screenshots.
- **FR-060**: The frontend MUST introduce no real backend, database, provider,
  email, session, mobile-release, flag, maintenance, or infrastructure effect.

## Platform Data Rules

- Admin accounts, roles, permissions, general settings, security settings, and
  governance history are platform-wide and MUST NOT be incorrectly split by
  mobile platform.
- Mobile settings and feature flags MUST declare `ios`, `android`, or `shared`
  scope. iOS-only and Android-only capabilities MUST not accept the other platform.
- Maintenance may target All Platforms, iOS, or Android. All Platforms is an
  explicit scope and is not inferred by adding mobile counts.
- Search results preserve the platform semantic of their owning entity. A
  global Admin, role, permission, setting, audit, or infrastructure result has
  no invented mobile attribution.
- Attention items use Global for infrastructure or governance conditions and
  iOS, Android, or All Platforms only when the underlying event supports that attribution.
- Existing combined unique-customer totals remain authoritative deduplicated
  values. Event, device, import, request, payment, ticket, or job totals remain
  additive only where their owning contract declares that semantic.
- Unknown or unavailable attribution remains visible in All Platforms where
  supported and MUST not be assigned to iOS or Android.

## UX and Design Constraints

- Preserve all approved pages and Masarifi Gulf Premium Design System Version 2.1.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep Admin surfaces neutral, data-dense, professional, and operational.
- Keep financial semantic colors separate from system-status and governance colors.
- Reuse existing semantic tokens and shared components; do not introduce a
  second shell, matrix language, form language, dialog pattern, or status system.
- Admin list and role list use compact tables on wide screens. Admin profile and
  role detail use clear summaries, tabs or sections, and chronological history.
- Permission Matrix MUST keep row and column headers visible, provide text for
  assignment state, and offer a non-grid grouped alternative on narrow screens.
- Settings use one consistent domain navigation and a persistent unsaved-change
  warning. Save actions remain scoped to the visible settings group.
- Change reviews show only changed fields with safe old/new summaries; secret
  fields do not exist in the contract.
- High-impact controls are not visually adjacent to routine navigation without
  separation and consequence text.
- Global search and attention preserve their established shell placement and
  interaction language while adding completed-module coverage.
- Prior pages MUST not be redesigned during final integration. Fix only
  evidenced inconsistency, accessibility, responsive, contract, or permission defects.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, forms, matrix labels, change summaries,
  dialogs, timelines, and table priority flow from the right. Latin emails,
  identifiers, versions, URLs, permission keys, and timestamps use direction isolation.
- **English LTR readiness**: Logical layout properties preserve order, focus,
  icons, drawers, and dialogs without mirrored-content defects.
- **1440px**: Full sidebar, persistent filters, full Admin/role/settings tables,
  side detail areas, and complete permission matrix fit the content region.
- **1280px**: Compact sidebar and reduced gutters preserve primary columns;
  secondary metadata may move into detail drawers.
- **1024px**: Collapsible sidebar, wrapped settings navigation, selective table
  columns, and horizontal matrix container retain labeled headers.
- **768px**: Drawer navigation, one- or two-column summaries, filter drawer,
  card-list alternatives, and grouped permission sections replace dense layouts.
- **390px**: Prioritize Admin lookup, role summary, search, attention, security
  status, and maintenance status. Complex role editing, permission-matrix edits,
  bulk Admin operations, and full configuration show an accessible
  desktop-required notice; read-only summaries and safe return actions remain available.
- No viewport may introduce page-level horizontal overflow. A deliberately
  scrollable table or matrix must identify its scroll region and preserve headers.

## Accessibility

- All routes and shell surfaces MUST support keyboard-only navigation, visible
  focus, logical order, semantic landmarks, headings, labels, and accessible names.
- Tables MUST use associated headers; card alternatives MUST preserve the same
  labels and reading order. The permission matrix MUST expose role, permission,
  group, action, and assignment state to assistive technology.
- Dialogs MUST announce title and consequence, trap focus, support Escape where
  safe, prevent background interaction, and restore focus to the trigger.
- Validation errors MUST be programmatically associated with fields and
  summarized after failed submission without erasing valid input.
- Loading, success, conflict, and failure feedback MUST use concise live-region
  announcements without duplicate announcements.
- Status, two-factor, invitation, role, flag, maintenance, and severity states
  MUST use text or icons in addition to color.
- Every interactive target MUST be at least 44 by 44 CSS pixels at the approved
  touch viewports unless an equivalent grouped control provides that target.
- Motion MUST respect reduced-motion preferences. No essential meaning may
  depend on animation.
- Mixed Arabic and Latin values MUST remain readable and copyable without
  changing their logical value.

## Proposed API Contracts

| Method | Mock path | Request type | Response type | Planned backend capability |
|--------|-----------|--------------|---------------|----------------------------|
| `GET` | `/api/v1/admin/admin-users` | `AdminUsersQuery` | `PaginatedResponse<AdminUserSummary>` | admin / roles / auth |
| `GET` | `/api/v1/admin/admin-users/:adminId` | `AdminUserDetailRequest` | `AdminUserDetail` | admin / roles / auth / audit-logs |
| `GET` | `/api/v1/admin/admin-invitations` | `AdminInvitationsQuery` | `PaginatedResponse<AdminInvitation>` | admin / roles; requires Admin-team read and invite permissions |
| `POST` | `/api/v1/admin/admin-invitations` | `InviteAdminRequest` | `AdminInvitationResult` | admin / auth / roles / audit-logs |
| `POST` | `/api/v1/admin/admin-users/:adminId/disable` | `DisableAdminRequest` | `AdminUserMutationResult` | admin / auth / support / audit-logs |
| `POST` | `/api/v1/admin/admin-users/:adminId/sessions/revoke` | `RevokeAdminSessionsRequest` | `AdminUserMutationResult` | auth / admin / audit-logs |
| `PUT` | `/api/v1/admin/admin-users/:adminId/roles` | `AssignAdminRolesRequest` | `AdminUserMutationResult` | roles / permissions / admin / audit-logs |
| `GET` | `/api/v1/admin/roles` | `RolesQuery` | `PaginatedResponse<RoleSummary>` | roles / permissions |
| `GET` | `/api/v1/admin/roles/:roleId` | `RoleDetailRequest` | `RoleDetail` | roles / permissions / audit-logs |
| `POST` | `/api/v1/admin/roles` | `CreateRoleRequest` | `RoleMutationResult` | roles / permissions / audit-logs |
| `PUT` | `/api/v1/admin/roles/:roleId` | `UpdateRoleRequest` | `RoleMutationResult` | roles / permissions / audit-logs |
| `GET` | `/api/v1/admin/permissions` | `PermissionMatrixQuery` | `PermissionMatrixResponse` | permissions / roles |
| `GET` | `/api/v1/admin/settings/:group` | `SettingsGroupQuery` | `SettingsGroupDetail` | system-settings |
| `PUT` | `/api/v1/admin/settings/:group` | `UpdateSettingsGroupRequest` | `SettingsMutationResult` | system-settings / audit-logs |
| `GET` | `/api/v1/admin/feature-flags` | `FeatureFlagsQuery` | `PaginatedResponse<FeatureFlagSummary>` | system-settings |
| `PUT` | `/api/v1/admin/feature-flags/:flagId` | `UpdateFeatureFlagRequest` | `FeatureFlagMutationResult` | system-settings / audit-logs |
| `GET` | `/api/v1/admin/maintenance` | `MaintenanceQuery` | `MaintenanceState` | system-settings |
| `PUT` | `/api/v1/admin/maintenance` | `UpdateMaintenanceRequest` | `MaintenanceMutationResult` | system-settings / audit-logs |
| `GET` | `/api/v1/admin/search` | `GlobalSearchQuery` | `GlobalSearchResponse` | admin plus owning domain projections |
| `GET` | `/api/v1/admin/attention` | `AttentionQuery` | `AttentionResponse` | notifications plus owning domain projections |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays. Proposed paths describe the replaceable
frontend boundary and do not prescribe a production backend implementation.

## Frontend Types

- **`AdminStatus`**: Invited, Active, or Disabled.
- **`AdminUserSummary`**: Stable Admin ID, masked identity, role summaries,
  department, status, two-factor state, last login, active-session count,
  created time, version, and allowed actions.
- **`AdminUserDetail`**: Summary plus safe profile fields, effective permission
  groups, assigned-ticket counts, safe recent actions, bounded sessions,
  security state, and audit references.
- **`AdminSessionSummary`**: Fictional session ID, safe device label, broad
  region, started time, last activity, current-session flag, risk label, and state.
- **`AdminInvitation`**: Stable invitation ID, masked email after submission,
  name, role, department, created time, expiry, state, version, and audit reference.
- **`InviteAdminRequest`**: Normalized email, name, role ID, department, expiry
  days, optional plain-text message, and client-generated submission key.
- **`DisableAdminRequest`**: Admin ID, reason, session-revocation choice,
  optional replacement Admin ID, expected status, expected version, and
  client-generated submission key.
- **`AssignAdminRolesRequest`**: Admin ID, unique active role IDs, reason,
  expected version, and client-generated submission key.
- **`RoleStatus`**: Active or Disabled.
- **`RoleSummary`**: Stable role ID and key, localized name, description,
  assigned-Admin count, permission count, system/custom state, status, update
  time, version, and allowed actions.
- **`RoleDetail`**: Summary plus grouped permissions, assigned safe Admin
  summaries, expiration behavior, descriptive approval-policy metadata,
  constraints, and history.
- **`PermissionDefinition`**: Stable key, group, action semantic, localized
  label, safe description, sensitivity, assignability, and owning spec.
- **`PermissionMatrixResponse`**: Ordered roles, ordered permission groups,
  definitions, assignment cells, completeness metadata, and current version.
- **`CreateRoleRequest` / `UpdateRoleRequest`**: Stable key when creating,
  localized name, bounded description, unique permission keys, expiration
  behavior, descriptive approval-policy metadata, status, reason, expected
  version when updating, and submission key.
- **`SettingsGroupKey`**: General, Mobile, Imports, AI, Subscriptions, or Security.
- **`SettingsGroupDetail`**: Group key, allowlisted typed fields, effective
  values, inherited/unavailable semantics, group version, update time, and allowed action.
- **`MobileSettings`**: Separate iOS, Android, and Shared settings with version
  values, store links, update modes, and approved capability flags.
- **`FeatureFlagSummary`**: Stable flag ID and key, localized label, compatible
  platform scopes, active target scope, audience, rollout, status, optional
  schedule, version, and update time.
- **`FeatureFlagAudience`**: All Customers, Free Plan, Basic Plan, Premium Plan,
  or Internal Testers; no customer identifiers or custom audience expression.
- **`UpdateSettingsGroupRequest` / `UpdateFeatureFlagRequest`**: Allowlisted
  changed values, reason, impact acknowledgement where required, expected group
  or flag version, and submission key.
- **`MaintenanceState`**: Off, Scheduled, or Active state; localized message;
  platform scope; time window; allowed roles; version; last change; and mock-only label.
- **`UpdateMaintenanceRequest`**: Target state, localized messages, platform
  scope, time window, allowed roles, reason, consequence acknowledgement,
  expected version, and submission key.
- **`GlobalSearchEntity`**: Navigation, User, Subscription, Payment Event,
  Import, Support Ticket, Audit Event, Job, Parser Rule, Bank, or Admin User.
- **`GlobalSearchResult`**: Stable safe ID, entity group, title, masked or
  bounded context, owning permission, internal destination, platform semantic,
  and deterministic rank.
- **`AttentionType`**: The ten approved critical, financial, AI, queue, import,
  security, support, deletion, backup, and parser event types.
- **`AttentionItem`**: Stable safe ID, type, severity, bounded summary,
  occurrence time, platform scope, owning permission, and optional internal destination.
- **`GovernanceApiError`**: Safe status, code, localized message, optional field
  errors, retryability, and optional correlation ID without internal details.
- **`GovernanceMutationResult`**: Updated safe resource, outcome, version,
  affected-scope summary, and expected audit reference.
- **`PaginatedResponse<T>`**: Validated records and pagination metadata.
- Application types MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success with seven system roles, Active/Invited/Disabled Admins,
  Arabic and English fictional names, varied departments, two-factor states,
  bounded sessions, custom roles, settings, flags, and Off maintenance.
- Empty Admin filters, no invitations, no custom roles, no search results, no
  attention items, and no role history beyond immutable system initialization.
- Large deterministic Admin, role, permission, search, and attention results
  that exercise filtering, sorting, pagination, and narrow layouts.
- Slow response, partial Admin profile, partial settings group, stale values,
  unavailable search group, and unavailable attention region.
- Unauthorized, forbidden, not found, validation error, conflict, rate limited,
  provider or capability unavailable, and safe internal error.
- Invite success, duplicate invitation, existing Admin, expired invitation,
  unsafe email, invalid role, and duplicate submission.
- Disable success, current-self target, last Active Super Admin, already
  Disabled target, open-ticket reassignment required, session conflict, and stale version.
- Custom-role creation and edit success, duplicate key, empty permissions,
  system-role mutation, out-of-scope permission, assigned-role disable conflict,
  privilege escalation, and stale matrix version.
- Valid and invalid General, iOS, Android, Shared, Import, AI, Subscription, and
  Security setting updates, including missing and inherited values.
- Valid flag rollout, invalid percentage, incompatible platform, reversed
  schedule, overlapping mock change, stale version, and duplicate submission.
- Maintenance Off, Scheduled, Active, invalid time window, missing language,
  no emergency Admin role, activation conflict, end success, and duplicate request.
- Search hit for every approved entity group, mixed groups, duplicate IDs,
  denied projections, masked email, unsafe destination, and partial group failure.
- All ten attention types, each severity, global/iOS/Android scope, denied
  destination, stale item, malformed timestamp, and empty result.
- Unsafe markup, Markdown, script-like text, bidirectional controls, control
  characters, oversized strings, invalid URL, secret-like key, token-like
  value, malformed identifier, unknown enum, and raw internal error.

### Loading States

- Admin, role, matrix, settings, flag, maintenance, search, and attention loads
  use labeled skeletons or status text that preserves page structure.
- Detail routes may show only the heading and validated safe record reference
  while protected content loads.
- Existing values may remain visible during refresh with a clear refreshing or
  stale state; missing values MUST not appear as zero or Off.
- Sensitive mutations lock only the relevant controls and cannot submit twice.

### Empty States

- Distinguish no Admins for filters, no invitations, no custom roles, no role
  history, no flags for filters, no search results, and no attention items.
- Empty settings data is unavailable, not a successful configuration with
  invented defaults.
- Each empty state offers only safe relevant actions such as clear filters,
  return, invite when authorized, or create a custom role when authorized.
- Access denied MUST never be represented as empty data.

### Error States

- List, detail, matrix, settings, flag, maintenance, search, and attention
  failures show safe localized summaries, optional correlation IDs, and a
  relevant retry or return action.
- Validation errors attach to labeled fields and preserve valid input.
- Conflict and stale-version states refresh the current mock resource before
  another action.
- Partial search, attention, profile, or settings responses identify unavailable
  regions without presenting zero values or broadening access.
- Forbidden and not-found responses MUST not reveal whether a protected Admin,
  role, permission, setting, flag, or maintenance record exists.

### Success States

- Invitation, Admin disablement, session revocation, role assignment, custom-role
  change, settings save, flag update, and maintenance change announce one concise
  safe result, updated state/version, affected scope, and expected audit reference.
- Every successful mutation explicitly states that only fictional mock state changed.
- Search result activation closes the search surface and moves focus to the
  destination heading. Attention activation closes the panel and moves focus similarly.

### Warning and Confirmation States

- Admin disablement, session revocation, role assignment, role creation/edit,
  custom-role disablement, settings change, flag rollout, and maintenance change
  explain scope, consequence, current state, proposed state, mock-only boundary,
  recovery or replacement behavior, and audit expectation.
- Privilege-widening role changes receive a stronger warning that names added
  permission groups without exposing internal enforcement details.
- Force update, two-factor requirement, registration closure, AI fallback,
  subscription retry, and maintenance changes require explicit impact acknowledgement.
- Closing a dialog or navigating away is never confirmation. Unsaved settings
  prompt before loss.

### Permission States

- Full route denial reveals no protected governance or configuration data.
- Security Administrator views are structurally read-only except Security
  Settings; denied mutation contracts return a generic forbidden result.
- Other five roles see no governance navigation or route data while retaining
  permission-filtered search and attention.
- Permission loss while a route is open clears protected query data and shows
  the shared access-denied or session-expired state.

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

Future backend audit event families include:

- `admin.invitation.created`
- `admin.roles.changed`
- `admin.sessions.revoked`
- `admin.disabled`
- `role.created`
- `role.updated`
- `role.disabled`
- `settings.general.updated`
- `settings.mobile.updated`
- `settings.imports.updated`
- `settings.ai.updated`
- `settings.subscriptions.updated`
- `settings.security.updated`
- `feature_flag.updated`
- `maintenance.scheduled`
- `maintenance.activated`
- `maintenance.ended`

Each successful and rejected privileged action is expected to record actor,
role, target reference, approved field-level change summary, reason, prior and
resulting version or state, result, timestamp, and correlation ID. It MUST omit
invitation messages, full email values, session values, secrets, credentials,
private configuration, and unrestricted permission payloads.

Search and attention reads do not require a per-result mutation event, though
future backend access logging may apply. This frontend displays mock audit
references only and does not create tamper-evident records.

### Privacy Rules

- Admin lists, role assignments, history, search, attention, errors, and audit
  summaries use masked fictional identities and minimum operational fields.
- Full email is limited to the authorized active invitation form and immediate
  mock result. It MUST not persist in URL parameters, browser storage, logs,
  screenshots, search results, or attention items.
- Session summaries show safe device label and broad region only. They exclude
  IP addresses, tokens, cookies, fingerprints, credentials, and private device identifiers.
- Assigned tickets show counts and safe references, not customer messages,
  attachments, financial data, or support-access content.
- Permission and role history shows allowlisted keys and change summaries, not
  hidden backend policy, authentication tokens, or customer data.
- Settings and flags exclude secrets, provider credentials, private endpoints,
  connection strings, webhook secrets, signing material, and service-role keys.
- Search and attention responses use least-privilege projections from owning
  domains and do not aggregate broader data than their source route permits.
- Fixtures, tests, screenshots, errors, and logs MUST contain only sanitized
  fictional values.

### Sensitive Actions

- Invitation, role assignment, Admin disablement, session revocation, role
  mutation, settings mutation, flag rollout, and maintenance mutation are privileged.
- Each privileged action requires explicit permission, eligible state,
  purpose-limited validated fields, current state/version, visible scope and
  consequence, confirmation, pending lock, duplicate protection, safe result,
  and expected audit reference.
- The frontend MUST not describe confirmation, route guards, disabled buttons,
  role switching, versions, or submission keys as sufficient production protection.

## Security Requirements

- **Untrusted inputs**: Validate and normalize route IDs, queries, filters,
  sorts, pagination, emails, names, departments, roles, permissions, reasons,
  invitation messages, dates, versions, setting keys and values, file types,
  thresholds, percentages, URLs, audiences, platform scopes, localized messages,
  submission keys, mock responses, search results, attention items, and destinations.
- **Safe rendering**: Render identities, descriptions, permission keys, change
  summaries, messages, values, URLs, search text, attention summaries, and errors
  as bounded plain text or allowlisted structured fields. Raw HTML, Markdown,
  scripts, ANSI sequences, executable JSON, and arbitrary metadata are prohibited.
- **Sensitive projections**: Unauthorized fields MUST be omitted at the
  repository or mock-response boundary. CSS hiding or masking after a full
  protected object reaches the page is insufficient.
- **Client storage and environment**: Admin identity details, invitation data,
  session data, permission inventories, private settings, reasons, configuration
  changes, customer summaries, secrets, tokens, credentials, and private
  identifiers MUST NOT be stored in local storage, session storage, IndexedDB,
  URLs, public environment values, logs, or screenshots. The existing isolated
  development-only role simulation remains clearly labeled and carries no real credential.
- **Files and links**: Spec 010 uploads or downloads no files. Supported file
  types are setting labels only. Store links accept only approved HTTPS
  destinations; new-tab links prevent opener access. Search and attention
  destinations are normalized internal routes only.
- **Permissions**: Every future backend read and mutation MUST independently
  authenticate, authorize, enforce least privilege, prevent horizontal and
  vertical escalation, shape response fields, and re-check current access at mutation time.
- **Errors and logs**: Safe errors MUST omit stack traces, internal paths, raw
  exceptions, database details, policy internals, permission-evaluation traces,
  email values, session values, customer data, secrets, credentials, tokens,
  provider payloads, private settings, and unauthorized record existence.
- **Dependencies**: No new dependency is required. Any later dependency change
  requires scoped review for necessity, maintenance, compatibility, weight,
  duplication, and known vulnerability exposure.
- **Security mock scenarios**: Denied, expired, disabled, invalid, unsafe-input,
  masked-projection, not-found, stale, duplicate-submission, self-lockout,
  last-Super-Admin, system-role mutation, privilege escalation, unsafe URL,
  secret-like setting, and safe-error cases MUST be testable.
- **Deferred production controls**: Future NestJS, Supabase, authentication,
  email, session, configuration, feature-management, mobile-release, and
  infrastructure layers must enforce identity verification, invitation lifecycle,
  MFA policy, authorization, separation of duties, role-assignment constraints,
  idempotency, concurrency control, audit logging, secret management, rate
  limits, rollout safety, maintenance recovery, monitoring, alerts, and incident response.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- The current operator opens their own Admin profile; self-disable and current-
  session revocation remain unavailable even if other Admin actions are allowed.
- Two Active Super Admins exist and one is disabled; the remaining one becomes
  protected from disablement until another eligible Super Admin is active.
- An invitation email differs only by case or surrounding whitespace; it is
  normalized and treated as a duplicate.
- An invitation expires while its confirmation is open; the mutation returns
  current state or a safe conflict and does not recreate it silently.
- An Admin has open tickets and no eligible reassignment target; disablement is
  blocked with a safe operational explanation.
- A role loses a permission while an Admin profile or settings page is open;
  the next response clears protected data and shows access denied.
- A custom role is assigned to multiple Active Admins; disabling it requires a
  safe conflict, and the Admins must be reassigned before a later disable attempt.
- Two operators edit the same role, setting group, flag, or maintenance state;
  one succeeds and the other receives the latest version or a safe conflict.
- A role edit contains duplicate, unknown, deprecated, or out-of-scope
  permission keys; invalid entries are rejected and valid selections remain.
- A permission key belongs to a newly completed module but is missing from the
  matrix; the completeness gate fails rather than silently omitting it.
- A mobile minimum version exceeds latest version or contains localized digits,
  whitespace, prerelease text, or excessive segments; normalization follows the
  approved dotted numeric rule or returns a field error.
- A flag has 0 percent rollout while Active; the UI states that no audience is
  currently included rather than displaying it as unavailable.
- A Shared feature is placed under iOS or Android; validation preserves its
  Shared scope.
- Maintenance start passes while the confirmation dialog is open; current time
  and state are revalidated before the mock transition.
- Maintenance is Active and the scheduled end passes; the frontend shows stale
  or conflict state until authoritative mock data confirms Off, rather than
  ending it from client time alone.
- A search query matches the same safe record by ID and text; the result appears
  once in its owning group.
- Search returns one allowed group and one failed group; the allowed results
  remain usable while the failed group is labeled unavailable.
- An attention item points to a removed, denied, or malformed route; it is
  omitted or shown without a link and never bypasses route permission checks.
- Arabic labels surround email, version, permission-key, correlation-ID, or URL
  text; direction isolation preserves readable order without mutating values.
- A final route is intentionally unavailable on mobile for complex editing;
  the desktop-required state still provides route identity, safe summary,
  reason, and return action rather than a blank page.
- A prior spec has no applicable platform filter; final integration does not
  add one merely for uniformity or invent platform attribution.

## Out of Scope

- Real Admin account creation, invitation email, acceptance, authentication,
  invitation resend or revocation, expiry processing, password reset,
  two-factor enrollment, role assignment, session revocation, user disablement,
  or directory synchronization.
- Real backend, Supabase, database, row-level security, secret manager,
  configuration service, feature-flag service, mobile store, push provider,
  maintenance infrastructure, monitoring, deployment, or release operation.
- Creating or deleting system roles or permission definitions. Custom-role
  deletion is excluded; eligible custom roles may only move between Active and
  Disabled in mock state.
- Role approval queues, maker-checker assignment, second-approver actions, and
  pending-approval role states.
- Real secrets, provider credentials, API keys, tokens, connection strings,
  webhooks, private endpoints, password rules, or risk-detection rules.
- Real mobile force updates, store releases, audience segmentation, experiments,
  flag evaluation, customer targeting, registration closure, or maintenance impact.
- Search indexing infrastructure, fuzzy-search service, saved searches, search
  history, recent searches, cross-tenant search, or unrestricted record previews.
- Attention acknowledgement, dismissal, subscription, notification delivery,
  paging, incident creation, escalation, or alert-rule configuration.
- Redesigning or materially refactoring prior approved pages during final review.
- Penetration testing, production load testing, backend security guarantees,
  deployment, hosting, continuous-delivery configuration, release approval, or launch.
- New product features outside the ten-spec master specification.

## Acceptance Criteria

- **AC-001**: All 16 new Spec 010 routes render authorized loading, default,
  empty where applicable, partial, safe-error, conflict, and access-denied states
  without runtime errors.
- **AC-002**: Admin list and profile show every approved safe field, and
  Security Administrator projections contain no invitation, disablement,
  assignment, revocation, full email, session token, or mutation-capable data.
- **AC-003**: A Super Admin completes a valid fictional invitation in under two
  minutes; one Pending invitation results and the UI states that no email or
  account was created.
- **AC-004**: Self-disablement, current-session revocation, duplicate invitation,
  and last-Active-Super-Admin disablement each produce no state change.
- **AC-005**: Disablement of an eligible fictional Admin requires a reason,
  session choice, required ticket reassignment, confirmation, pending lock,
  version check, safe result, and audit expectation.
- **AC-006**: The permission matrix contains 100% of active permission keys from
  Specs 001–010 exactly once and assigns every key to one owning group and action semantic.
- **AC-007**: System roles cannot be renamed, deleted, or disabled; custom-role
  changes cannot assign unknown permissions, exceed the operator's scope, or
  leave Active Admins without a valid role.
- **AC-008**: General, iOS, Android, Shared, Import, AI, Subscription, and
  Security settings expose every approved field with type, range, missing-value,
  current-version, and confirmation behavior.
- **AC-009**: iOS-only, Android-only, and Shared settings and flags remain
  separated in 100% of automated compatibility scenarios.
- **AC-010**: Flag rollout rejects values below 0 or above 100, incompatible
  platforms, invalid audiences, and reversed schedules without changing mock state.
- **AC-011**: Maintenance scheduling, activation, and ending require all
  approved fields and protections, preserve an emergency Super Admin path, and
  never affect a real route, client, service, or environment.
- **AC-012**: Global search returns safe grouped results for Navigation and all
  ten required entity groups, while 100% of denied result scenarios omit both
  the result and protected metadata.
- **AC-013**: The attention panel covers all ten approved notification types,
  all five severities, authorized destinations, and applicable platform scopes
  without using color alone.
- **AC-014**: An operator locates and opens a known authorized fictional entity
  through global search in under 30 seconds in at least 9 of 10 verification attempts.
- **AC-015**: Every route from Specs 001–010 opens in its authorized default
  state and resolves the correct permission with no runtime or console error.
- **AC-016**: Arabic RTL and representative English LTR preserve logical order,
  mixed-direction values, visible focus, keyboard completion, 44px targets, and
  no unintended page-level horizontal overflow at 1440, 1280, 1024, 768, and 390 pixels.
- **AC-017**: Unsafe identifiers, fields, settings, URLs, search values,
  attention values, and mock responses are rejected, omitted, redacted, or
  rendered as bounded plain text without executable or sensitive content.
- **AC-018**: Standard mock pages present usable content within 2 seconds and
  search, filtering, sorting, pagination, or local updates within 1 second at
  the 95th percentile, excluding explicitly labeled slow scenarios.
- **AC-019**: Final integration finds no production source importing raw fixture
  arrays, no application `any`, and no real backend, provider, database,
  authentication, email, configuration, flag, maintenance, or deployment operation.
- **AC-020**: Phase 9 passes typecheck, lint, unit/component, end-to-end,
  production-build, responsive, accessibility, design-consistency, contract,
  route, permission, privacy, and security-review gates without weakening Specs 001–009.

## Success Criteria

- **SC-001**: Super Admins complete the invitation and eligible-disablement
  scenarios in under two minutes each in at least 9 of 10 verification attempts.
- **SC-002**: 100% of active permission keys across all ten specs appear once in
  the consolidated matrix and match navigation, route, field, search, attention,
  and mutation behavior for all seven simulated roles.
- **SC-003**: 100% of privileged mock governance and configuration actions show
  scope, consequence, confirmation, pending lock, duplicate protection, safe
  result, and audit expectation.
- **SC-004**: 100% of self-lockout, last-Super-Admin, system-role, stale-version,
  duplicate-submission, and out-of-scope-permission scenarios preserve a safe
  valid state.
- **SC-005**: 100% of approved settings and feature flags declare platform or
  global scope and pass iOS, Android, Shared, missing-value, range, schedule,
  and compatibility checks.
- **SC-006**: Operators find an authorized known entity through global search
  in under 30 seconds in at least 9 of 10 verification attempts, while denied
  entities are absent in every role scenario.
- **SC-007**: All ten attention types and five severities are recognizable by
  text and icon and route only to destinations the active role may open.
- **SC-008**: At all five approved widths, every critical read and urgent action
  remains operable in Arabic RTL and English LTR with no page-level horizontal
  overflow and no state communicated by color alone.
- **SC-009**: 100% of automated unsafe-input, secret-like-value, projection,
  storage, error, and logging checks expose no executable content, real personal
  data, credentials, tokens, private configuration, or unrestricted records.
- **SC-010**: Every approved route across Specs 001–010 opens without runtime or
  console error, and every named quality command completes successfully before
  the frontend is declared ready.
- **SC-011**: No real Admin, customer, session, permission, setting, feature,
  mobile application, maintenance state, backend, database, provider, or
  infrastructure resource is read or changed during any Spec 010 scenario.

## Verification

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Focused verification**: Run Spec 010 contract, repository, permission-matrix,
  route-resolution, Admin-invariant, role-transition, settings-validation,
  platform-compatibility, feature-flag, maintenance-transition, search-projection,
  attention-projection, component, route, and Playwright tests.
- **Full route verification**: Open every approved static and representative
  dynamic route from Specs 001–010 in its allowed role and verify direct denial
  with a disallowed role; record runtime and console results.
- **Viewport and accessibility checks**: Verify every new Spec 010 route and a
  representative route from every prior spec at 1440, 1280, 1024, 768, and 390
  pixels in Arabic RTL and representative English LTR, light and dark themes;
  check keyboard operation, visible focus, focus restoration, semantics, live
  feedback, matrix/table alternatives, mixed-direction values, reduced motion,
  44px targets, and non-color state.
- **Design consistency review**: Compare shared shell, navigation, headers,
  tables/cards, forms, filters, statuses, dialogs, spacing, typography, semantic
  tokens, and bronze usage across all ten specs against the approved baseline.
- **Contract consistency review**: Reconcile route permissions, active
  permission keys, pagination, error shapes, platform semantics, status and
  severity values, audit references, query behavior, and mock scenarios across
  Specs 001–010.
- **Security and privacy review**: Review least-privilege projections,
  self-lockout and privilege-escalation prevention, sensitive-data masking,
  unsafe rendering, route/form/response validation, versions and duplicate
  mutation handling, storage and public environment exposure, files and links,
  safe errors and logs, dependencies, fictional fixtures, screenshots, and all
  deferred backend and infrastructure protections.

Successful verification MUST NOT be claimed unless each named command was
executed successfully and its actual result was recorded.
