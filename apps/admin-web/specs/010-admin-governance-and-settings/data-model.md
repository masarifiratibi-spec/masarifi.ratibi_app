# Data Model: Spec 010 Admin Governance, Settings, and Final Integration

This model defines frontend read models, validated requests, deterministic mock
state, and future backend alignment. It does not define database migrations or
authorize real persistence.

## Shared Value Objects

### Identifiers

| Value | Format | Example |
|-------|--------|---------|
| Admin ID | `ADM-` plus 3–64 uppercase letters, digits, or hyphens | `ADM-DEMO-SECURITY-02` |
| Invitation ID | `INV-` plus 3–64 uppercase letters, digits, or hyphens | `INV-DEMO-PENDING-01` |
| Role ID | `ROLE-` plus 3–64 uppercase letters, digits, or hyphens | `ROLE-DEMO-SUPPORT` |
| Session reference | `ASES-` plus 3–64 uppercase letters, digits, or hyphens | `ASES-DEMO-02` |
| Flag ID | `FLAG-` plus 3–64 uppercase letters, digits, or hyphens | `FLAG-DEMO-IOS-SHORTCUT` |
| Audit reference | `AUD-` plus 3–80 uppercase letters, digits, or hyphens | `AUD-DEMO-ROLE-01` |
| Submission key | 16–128 URL-safe ASCII characters | `SUB-DEMO-ROLE-UPDATE-01` |

Identifiers are normalized before comparison and rendered with direction
isolation. Unknown or malformed identifiers fail before lookup. Forbidden and
unknown targets use non-enumerating safe errors.

### Versions and Time

- `version` is a positive integer beginning at 1 and incrementing exactly once
  per successful mutation.
- Timestamps are valid ISO 8601 values with an explicit offset.
- Start/end pairs require `startAt < endAt`.
- The Phase 9 mock uses one injected fixed clock. UI rendering never determines
  an authoritative lifecycle transition from client time alone.

### Localized Text

```text
LocalizedText
├── ar: trimmed Unicode plain text
└── en: trimmed Unicode plain text
```

- Both languages are required for maintenance messages and localized role names.
- Raw HTML, Markdown, control characters, and bidirectional control characters
  are rejected.
- Each field applies the entity-specific length bound below.

### Safe References

```text
SafeReference
├── id
├── kind
└── label
```

References carry no private payload. Destinations are constructed only from
validated route types, not from arbitrary URLs.

## Admin Team

### AdminStatus

```text
invited | active | disabled
```

### AdminUserSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | Admin ID | Stable and unique |
| `displayName` | string | 1–120 trimmed characters; fictional |
| `maskedEmail` | string | Masked summary only |
| `roleSummaries` | RoleReference[] | Unique role IDs; at least one for Active Admins |
| `department` | string | 1–80 characters from fixture allowlist |
| `status` | AdminStatus | Authoritative mock state |
| `twoFactorState` | `required_enabled \| optional_enabled \| missing` | Text/icon state, not a real MFA result |
| `lastLoginAt` | timestamp or null | Null for never logged in |
| `activeSessionCount` | nonnegative integer | Derived from active safe sessions |
| `createdAt` | timestamp | Must not be future relative to mock clock |
| `version` | positive integer | Optimistic concurrency token |
| `allowedActions` | action enum[] | Advisory UI actions; never authorization |

### AdminUserDetail

Extends `AdminUserSummary` with:

| Field | Type | Rules |
|-------|------|-------|
| `profile` | allowlisted safe profile | No full email, phone, address, or customer data |
| `effectivePermissionGroups` | PermissionGroupSummary[] | Derived from assigned roles |
| `assignedTickets` | TicketAssignmentSummary | Count and safe references only |
| `recentActions` | SafeAdminAction[] | Bounded allowlisted summaries |
| `sessions` | AdminSessionSummary[] | Role-shaped projection |
| `securityState` | AdminSecurityState | Safe two-factor, session, and risk summary |
| `auditReferences` | SafeReference[] | No audit payload |

Security Administrator detail omits invitation data, full identity values,
assignable-role inputs, restricted session identifiers, and all mutation actions.

### AdminSessionSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | session reference | Fictional stable value; omitted from limited projection if not needed |
| `deviceLabel` | string | 1–80 safe characters |
| `broadRegion` | string | Country or broad region only; never IP or precise location |
| `startedAt` | timestamp | Valid ISO 8601 |
| `lastActivityAt` | timestamp | `>= startedAt` |
| `isCurrentSession` | boolean | Current operator's session cannot be revoked |
| `riskLabel` | `low \| medium \| high` | Safe label only |
| `state` | `active \| revoked \| expired` | Revoked and Expired are terminal |

### AdminUser Relationships

```text
AdminUser M:N Role
AdminUser 1:N AdminSessionSummary
AdminUser 1:N SafeAdminAction
AdminUser 0:N TicketAssignmentSummary references
```

### Admin Mutations

#### AssignAdminRolesRequest

- `adminId`: matches path.
- `roleIds`: unique, nonempty, Active, assignable roles.
- `reason`: 10–500 safe characters.
- `expectedVersion`: positive integer.
- `submissionKey`: valid and unique for the pending operation.

#### RevokeAdminSessionsRequest

- `adminId`: matches path.
- `sessionIds`: unique eligible Active session references, or explicit
  `revokeAllEligible: true`.
- Current session is excluded.
- `reason`, `expectedVersion`, and `submissionKey` are required.

#### DisableAdminRequest

- `adminId`: matches path.
- `reason`: 10–500 safe characters.
- `revokeEligibleSessions`: explicit boolean.
- `replacementAdminId`: required when open ticket assignments exist; must be a
  different eligible Active Admin.
- `expectedStatus`: `active`.
- `expectedVersion` and `submissionKey`: required.

### Admin State Transitions

| Current | Action | Result | Preconditions |
|---------|--------|--------|---------------|
| Active | Assign roles | Active, version +1 | Unique Active roles; no last-Super-Admin or governance-path loss |
| Active | Revoke eligible sessions | Active, version +1 | Not current session; at least one eligible session |
| Active | Disable | Disabled, version +1 | Not self; not last Active Super Admin; ticket replacement satisfied |
| Disabled | Disable | Conflict | Already terminal for this action |
| Invited | Any Admin mutation | Conflict | Invitation is not an Active Admin account |
| Disabled | Assign roles/revoke sessions | Conflict | Target is not Active |

Reactivation and Invited → Active are not implemented.

## Invitations

### InvitationStatus

```text
pending | accepted | expired | revoked
```

### AdminInvitationSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | Invitation ID | Stable and unique |
| `maskedEmail` | string | Masked in all repository responses |
| `name` | string | 1–120 safe characters |
| `role` | RoleReference | Active and assignable when Pending is created |
| `department` | string | 1–80 characters from allowlist |
| `createdAt` | timestamp | Fixed mock clock for new records |
| `expiresAt` | timestamp | Whole-day expiry 1–30 days after creation |
| `status` | InvitationStatus | Only Pending creation is mutable |
| `version` | positive integer | Begins at 1 |
| `auditReference` | SafeReference | `admin.invitation.created` for new Pending record |

### InviteAdminRequest

| Field | Rules |
|-------|-------|
| `email` | Trim, Unicode normalize, case-fold for uniqueness, valid email, maximum 254 characters |
| `name` | 1–120 trimmed safe characters |
| `roleId` | Existing Active assignable role |
| `department` | Existing allowlisted department |
| `expiryDays` | Whole integer 1–30; default 7 |
| `message` | Optional 0–1,000 safe plain-text characters |
| `submissionKey` | Valid submission key |

The full fictional email and message exist only in ephemeral form state. The
response, cache, list, search, audit reference, fixture, URL, log, and screenshot
contain only the masked email and no message.

### Invitation State Transitions

| Current | Action in Spec 010 | Result |
|---------|--------------------|--------|
| None | Create | Pending |
| Pending | Accept / expire / revoke / resend | Not implemented |
| Accepted | Any mutation | Read-only seeded scenario |
| Expired | Any mutation | Read-only seeded scenario |
| Revoked | Any mutation | Read-only seeded scenario |

## Roles and Permissions

### RoleKind and RoleStatus

```text
RoleKind   = system | custom
RoleStatus = active | disabled
```

### RoleSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | Role ID | Stable and unique |
| `key` | string | Unique canonical role key |
| `name` | LocalizedText | Arabic and English each 2–80 characters |
| `description` | string | 0–500 safe characters |
| `assignedAdminCount` | nonnegative integer | Derived from Active Admin assignments |
| `permissionCount` | nonnegative integer | Derived from unique assignment keys |
| `kind` | RoleKind | System is immutable |
| `status` | RoleStatus | System roles always Active |
| `updatedAt` | timestamp | Deterministic |
| `version` | positive integer | Optimistic concurrency token |
| `allowedActions` | action enum[] | Empty for system roles and read-only projections |

### Custom Role Key

- Length 3–64.
- First character: lowercase ASCII letter.
- Remaining characters: lowercase ASCII letters, digits, dots, or hyphens.
- Trimmed and compared exactly after canonicalization.
- Cannot equal any system or existing custom role key.

### RoleDetail

Extends `RoleSummary` with:

- unique ordered `permissionKeys`;
- grouped `permissionDefinitions`;
- safe assigned-Admin summaries;
- `expirationBehavior`: `none | assignment_expiry_allowed` descriptive metadata;
- `approvalPolicy`: `none | recommended | required_by_backend` descriptive metadata only;
- invariant/immutability constraints;
- bounded safe change-history references.

No approval queue, pending approval state, or second-approver action exists.

### PermissionDefinition

| Field | Type | Rules |
|-------|------|-------|
| `key` | PermissionKey | Must appear exactly once in metadata catalog |
| `group` | PermissionGroup | Exact owning group |
| `action` | PermissionAction | Exact semantic action |
| `label` | LocalizedText | Safe bounded display text |
| `description` | LocalizedText | Safe bounded explanation |
| `sensitivity` | `standard \| sensitive \| privileged` | UI warning metadata |
| `assignable` | boolean | System or protected permissions may be nonassignable |
| `owningSpec` | `001` through `010` | Traceability |

### PermissionGroup

```text
users
billing
imports
parsers
ai
content
support
security
audit
jobs_health
admin_team
settings
```

### PermissionAction

```text
read | create | update | delete | approve | export | temporary_access
```

### PermissionMatrixResponse

| Field | Rules |
|-------|-------|
| `roles` | Seven immutable system roles followed by deterministic custom roles |
| `groups` | Fixed group order above |
| `permissions` | Every `PERMISSION_KEYS` member exactly once |
| `assignments` | One boolean cell per role/permission pair |
| `activePermissionCount` | Equals `PERMISSION_KEYS.length` |
| `definedPermissionCount` | Must equal active count |
| `duplicatePermissionKeys` | Must be empty |
| `version` | Changes when custom-role assignments change |

### CreateRoleRequest / UpdateRoleRequest

- Create requires unique key, localized name, description, nonempty unique
  assignable permission keys, status implicitly Active, expiration behavior,
  descriptive approval policy, reason, and submission key.
- Update requires role ID matching the path, mutable custom role, changed
  fields, expected version, reason, and submission key.
- System role updates always conflict.
- A custom role may not receive permissions outside the current operator's
  assignable set.

### Role State Transitions

| Kind | Current | Action | Result | Preconditions |
|------|---------|--------|--------|---------------|
| Custom | None | Create | Active v1 | Unique key; valid nonempty permissions |
| Custom | Active | Edit fields/permissions | Active, version +1 | Assignable scope; invariants hold |
| Custom | Active | Disable through edit | Disabled, version +1 | Zero Active Admin assignments |
| Custom | Disabled | Enable through edit | Active, version +1 | Valid permissions and unique key |
| Custom | Disabled | Edit metadata | Disabled, version +1 | Valid mutable fields |
| System | Active | Any mutation | Conflict | System roles are immutable |
| Any | Any | Delete | No operation | Delete is not exposed |

## Settings

### SettingsGroupKey

```text
general | mobile | imports | ai | subscriptions | security
```

Feature flags and maintenance use their own typed resources and versions.

### SettingsGroupDetail

| Field | Type | Rules |
|-------|------|-------|
| `group` | SettingsGroupKey | Matches route |
| `values` | group-specific object | Strict allowlisted fields only |
| `semantics` | per-field metadata | `effective \| inherited \| unavailable` |
| `version` | positive integer | One version for the whole group |
| `updatedAt` | timestamp | Deterministic |
| `allowedAction` | `read \| update` | Role-shaped advisory metadata |

### UpdateSettingsGroupRequest

```text
group
changedValues     strict partial of the matching group schema
reason            10–500 safe characters
impactAcknowledged boolean when a high-impact field changes
expectedVersion   positive integer
submissionKey     valid submission key
```

- Path group and body group must match.
- `changedValues` must contain at least one field.
- All changed fields validate before one atomic replacement.
- Omitted means unchanged; zero, empty allowed collection, and false remain
  explicit values only where the group schema permits them.
- Stale version rejects the whole patch and exposes no unrestricted current object.

### GeneralSettings

| Field | Type | Rules |
|-------|------|-------|
| `platformName` | string | 2–80 safe characters |
| `supportedCountries` | string[] | Nonempty, unique, allowlisted ISO country codes |
| `supportedCurrencies` | string[] | Nonempty, unique, allowlisted ISO currency codes |
| `supportedLanguages` | string[] | Nonempty, unique; must include Arabic |
| `defaultTimeZone` | string | Allowlisted IANA time zone |
| `registrationState` | enum | `open \| invite_only \| closed` |
| `maintenanceSummary` | summary | Read-only link/state from Maintenance resource |

### MobileSettings

```text
MobileSettings
├── ios
│   ├── minimumVersion
│   ├── latestVersion
│   ├── updateMode
│   ├── storeUrl
│   ├── shortcutEnabled
│   ├── appIntentsEnabled
│   ├── shareExtensionEnabled
│   ├── screenshotImportEnabled
│   ├── widgetEnabled
│   └── quickActionsEnabled
├── android
│   ├── minimumVersion
│   ├── latestVersion
│   ├── updateMode
│   ├── storeUrl
│   ├── smsTrackingEnabled
│   ├── notificationListenerEnabled
│   ├── backgroundTrackingEnabled
│   └── bankFilteringEnabled
└── shared
    ├── receiptScanEnabled
    ├── voiceEntryEnabled
    ├── aiAssistantEnabled
    ├── budgetsEnabled
    ├── debtsEnabled
    ├── goalsEnabled
    ├── advancedReportsEnabled
    ├── investmentsEnabled
    └── maintenanceState (read-only projection)
```

Version rules:

- Dotted numeric form with 1–4 integer segments.
- Each segment is 0–999.
- Minimum version must compare less than or equal to latest version.
- `updateMode = none | optional | force`.
- iOS store URL host is exactly `apps.apple.com` over HTTPS.
- Android store URL host is exactly `play.google.com` over HTTPS.
- Capability fields are strict booleans and cannot move across platform sections.

### ImportSettings

| Field | Type | Rules |
|-------|------|-------|
| `maxFileSizeMb` | integer | 1–100 |
| `supportedFileTypes` | enum[] | Nonempty unique subset of `csv,pdf,jpeg,png` |
| `processingTimeoutSeconds` | integer | 5–600 |
| `retentionDays` | integer | 1–365 |
| `duplicateThresholdPercent` | integer | 0–100 |
| `aiFallbackEnabled` | boolean | No provider secret/configuration |

### AiSettings

| Field | Type | Rules |
|-------|------|-------|
| `dailyFeatureLimits` | safe key/integer map | Known feature keys; each 0–100,000 |
| `providerPriority` | provider enum[] | Unique nonempty allowlisted providers |
| `costWarningThreshold` | number | 0–100,000; maximum two decimal places |
| `safetyEnabled` | boolean | No safety-rule internals |
| `fallbackEnabled` | boolean | No provider credentials or payloads |

### SubscriptionSettings

| Field | Type | Rules |
|-------|------|-------|
| `gracePeriodDays` | integer | 0–30 |
| `retryAttempts` | integer | 0–10 |
| `retryIntervalHours` | integer or null | 1–168 when attempts >0; null when attempts =0 |
| `planLimits` | safe key/integer map | Known limit keys; nonnegative integers |
| `trialLengthDays` | integer | 0–90 |
| `cancellationPolicy` | enum | `immediate \| period_end` |

### SecuritySettings

| Field | Type | Rules |
|-------|------|-------|
| `adminSessionMinutes` | integer | 15–1,440 |
| `twoFactorRequired` | boolean | Mock setting only |
| `passwordMinimumLength` | integer | 8–128; no real password rule enforcement |
| `temporaryAccessMaxMinutes` | integer | 15–480 |
| `riskThresholds` | object | Low/medium/high/critical integers 0–100, strictly increasing |

## Feature Flags

### FeatureFlagAudience

```text
all_customers | free_plan | basic_plan | premium_plan | internal_testers
```

`internal_testers` is a fictional aggregate label. No member identifiers or
custom expression exist.

### FeatureFlagStatus and PlatformScope

```text
FeatureFlagStatus = disabled | scheduled | active | ended
PlatformScope     = ios | android | shared
```

### FeatureFlagSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | Flag ID | Stable |
| `key` | string | Stable allowlisted key; not editable |
| `label` | LocalizedText | Safe bounded text |
| `compatiblePlatformScopes` | PlatformScope[] | Nonempty authoritative allowlist |
| `targetScope` | PlatformScope | Must be compatible |
| `audience` | FeatureFlagAudience | Fixed enum only |
| `rolloutPercent` | integer | 0–100; 0 is valid while Active |
| `status` | FeatureFlagStatus | Ended is read-only seeded state |
| `startAt` | timestamp or null | Required for Scheduled |
| `endAt` | timestamp or null | Optional; must be after start when both exist |
| `version` | positive integer | Optimistic concurrency |
| `updatedAt` | timestamp | Deterministic |

### UpdateFeatureFlagRequest

- Flag ID matches path.
- Strict changed values from target scope, audience, rollout, editable status,
  start, and end.
- No custom audience, customer ID, custom query, or incompatible scope.
- Requires reason, impact acknowledgement, expected version, and submission key.

### Feature Flag Transitions

| Current | Target | Allowed |
|---------|--------|---------|
| Disabled | Active | Yes, with compatible scope and valid fields |
| Disabled | Scheduled | Yes, with future valid schedule |
| Scheduled | Active | Yes, authoritative mock action/update |
| Scheduled | Disabled | Yes, cancels schedule |
| Scheduled | Scheduled | Yes, reschedules with version check |
| Active | Disabled | Yes, explicit stop |
| Active | Scheduled | Yes, schedules a future reactivation after explicit disable semantics in one validated update |
| Ended | Any | No; read-only seeded terminal state |

No client timer changes status.

## Maintenance

### MaintenanceState

| Field | Type | Rules |
|-------|------|-------|
| `state` | `off \| scheduled \| active` | Authoritative mock state |
| `message` | LocalizedText or null | Arabic/English each 10–500 when Scheduled/Active |
| `platforms` | `ios \| android` array | Nonempty when Scheduled/Active; both means All Platforms |
| `startAt` | timestamp or null | Future for scheduling; mock clock for immediate activation |
| `endAt` | timestamp or null | Required and after start when Scheduled/Active |
| `allowedRoleIds` | Role ID[] | Nonempty and must include active Super Admin role |
| `version` | positive integer | Optimistic concurrency |
| `lastChangedAt` | timestamp | Deterministic |
| `mockOnly` | literal true | Visible boundary |

### UpdateMaintenanceRequest

- Target state and current state form an allowed transition.
- Scheduled/Active requires messages, nonempty platforms, start/end, allowed
  roles including Super Admin, reason, consequence acknowledgement, expected
  version, and submission key.
- Immediate Active additionally requires `mockOnlyAcknowledged: true`.
- Off requires reason, expected version, submission key, and explicit confirmation.

### Maintenance Transitions

| Current | Target | Meaning |
|---------|--------|---------|
| Off | Scheduled | Schedule fictional maintenance |
| Off | Active | Activate immediately after second acknowledgement |
| Scheduled | Scheduled | Reschedule atomically |
| Scheduled | Active | Activate authoritative scheduled state |
| Scheduled | Off | Cancel scheduled state |
| Active | Off | End maintenance |
| Active | Scheduled | Rejected; end first |
| Off | Off | Conflict/no-op |

No real route, mobile client, registration flow, provider, job, or service is affected.

## Global Search

### SearchEntity

```text
navigation
user
subscription
payment_event
import
support_ticket
audit_event
job
parser_rule
bank
admin_user
```

### GlobalSearchQuery

- `query`: Unicode-normalized and trimmed, 2–120 characters.
- `entityTypes`: optional unique subset of SearchEntity.
- `page`: positive integer.
- `pageSize`: 25, 50, or 100.
- `role`: valid simulated role sent through the established safe development header.

### GlobalSearchResult

| Field | Rules |
|-------|-------|
| `id` | Stable safe result ID |
| `entityType` | SearchEntity |
| `title` | Bounded safe plain text |
| `context` | Masked or bounded safe summary |
| `owningPermission` | Valid active permission used for defense-in-depth filtering; not rendered as result content |
| `destination` | Normalized internal route from closed route schema |
| `platformScope` | `global \| all \| ios \| android \| unknown` where applicable |
| `rank` | Deterministic nonnegative integer |

Results are filtered by `global-search.use` and owning permission before count
and serialization. Same owning record appears once per entity group. Ordering
is rank, entity-group order, then stable ID. Partial group failure does not
discard successful groups.

## Attention

### AttentionType

```text
critical_incident
failed_payment_spike
ai_provider_outage
queue_backlog
import_failure_spike
security_alert
urgent_support_ticket
account_deletion_failure
backup_issue
parser_regression
```

### AttentionSeverity

```text
critical | high | medium | low | info
```

### AttentionItem

| Field | Rules |
|-------|-------|
| `id` | Stable safe ID |
| `type` | AttentionType |
| `severity` | AttentionSeverity |
| `summary` | 1–240 safe plain-text characters |
| `occurredAt` | Valid timestamp |
| `platformScope` | `global \| all \| ios \| android \| unknown` |
| `owningPermission` | Valid active permission; used for filtering, not rendered as policy content |
| `destination` | Optional normalized internal route the role can open |

Items require `attention.read` and owning permission before count and
serialization. Order is severity descending, occurred time descending, then
stable ID. Attention is read-only; no acknowledged/dismissed state exists.

## Mutation Outcome and Errors

### GovernanceMutationResult

```text
resource             role-shaped updated safe resource
outcome              accepted | completed
version              resulting positive integer
affectedScope        bounded safe summary
auditReference       SafeReference
mockOnly             true
```

Invitation and role creation return creation status; updates return success.
No response echoes reasons, invitation messages, unrestricted settings, secrets,
or full identity values.

### GovernanceApiError

| Status | Meaning | Safe behavior |
|--------|---------|---------------|
| 400 | Validation | Localized message and allowlisted field errors |
| 401 | Session expired | No protected resource data |
| 403 | Permission denied | Generic denial; no target existence |
| 404 | Unknown or hidden target | Non-enumerating safe result |
| 409 | Stale, duplicate, invariant, or idempotency conflict | Code, message, optional authorized current version/correlation ID |
| 429 | Rate limited | Retryable message and optional bounded retry time |
| 500/503 | Safe internal/unavailable | No exception, path, policy, provider, or infrastructure detail |

## Deterministic State Derivations

- `activeSessionCount` derives from sessions with `state = active`.
- `assignedAdminCount` derives from Active Admin role assignments.
- `permissionCount` derives from unique permission assignments.
- Admin effective permissions are the unique union of assigned Active roles.
- Permission matrix completeness compares active permission keys with exhaustive metadata.
- The last-Active-Super-Admin guard derives from Active Admin assignments at
  mutation time, not from a cached displayed count.
- Search and attention totals derive after permission filtering.
- General and Mobile maintenance summaries derive from MaintenanceState.
- Every successful mutation increments exactly its resource/group version once
  and invalidates only dependent read models.

## Privacy and Persistence Boundary

The deterministic mock state may retain only sanitized fictional allowlisted
fields. It must not retain full invitation email after request processing,
invitation message, customer data, IP address, session token, device fingerprint,
password data, secret, credential, provider payload, private endpoint, customer
identifier list, search history, or attention history.

No Phase 9 state is written to local storage, session storage, IndexedDB, URL
parameters beyond validated filters, public environment variables, logs, files,
or a backend.
