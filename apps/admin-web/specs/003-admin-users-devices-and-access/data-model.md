# Frontend Data Model: Users, Devices, Sessions, and Controlled Access

**Phase / Spec**: Phase 2 / Spec 003  
**Boundary**: Typed frontend/MSW contracts only; no database implementation

## Shared Contract Rules

- All identifiers, query values, mutation bodies, and responses are parsed
  before use.
- Unknown object keys are rejected for sensitive mutation and access schemas.
- Text is trimmed, length-bounded, and rendered as text.
- Dates are ISO 8601 strings with offsets; date-only values use ISO dates.
- Lists and pagination are bounded.
- Email is masked before it enters a frontend response.
- Raw IP addresses, device fingerprints, push/session/auth tokens, credentials,
  financial amounts, transaction details, raw messages, and uploaded content
  do not exist in these contracts.
- `scenario`/`__scenario` is development-only and never a production
  authorization input.

## Enumerations

### Platform

| Value | Meaning |
|-------|---------|
| `ios` | Apple iOS device or activity |
| `android` | Android device or activity |

### PlatformFilter

| Value | Membership rule |
|-------|-----------------|
| `all` | Every unique customer once |
| `ios` | Customer has at least one registered iOS device |
| `android` | Customer has at least one registered Android device |
| `multi` | Customer has at least one iOS and one Android device |

### AccountStatus

`active | suspended | pending`

### VerificationState

`verified | pending`

### RiskLevel

`low | medium | high`

Risk values are operational summaries, not full security-event records.

### CapabilityState

`enabled | disabled | denied | unavailable | unknown | not-applicable`

`not-applicable` is required when a capability belongs to the other platform.

### DeviceState

`active | revoked`

### SessionState

`active | expired | revoked`

Suspicion is represented by `risk`, not a second overlapping state.

### AccessStatus

`pending | approved | active | expired | rejected | revoked`

### AccessScope

| Value | Permitted projection |
|-------|----------------------|
| `profile-contact` | Masked email and locale/contact context |
| `account-status` | Account, verification, onboarding, and risk summary |
| `device-diagnostics` | Sanitized device/app/capability summary |
| `session-diagnostics` | Sanitized session state and coarse region |
| `subscription-summary` | Plan/status context without payment or amount data |
| `import-summary` | Aggregate source/sync counts without imported content |

### AccessDecision

`approve | reject`

An approval body may reduce scope and duration. Rejection requires a reason and
creates no workspace.

### UserBulkAction

`export-summary | suspend | reactivate | force-logout | notification-handoff`

### RegionAvailability

`available | empty | partial | stale | unavailable | forbidden`

### Phase2Permission

| Permission | Purpose |
|------------|---------|
| `users.read` | Users list and privacy-safe profile |
| `devices.read` | Device summary |
| `sessions.read` | Session summary |
| `users.status.manage` | Suspend/reactivate |
| `users.verification.manage` | Verification change |
| `devices.revoke` | Device revocation |
| `sessions.revoke` | Selected/all session revocation |
| `users.export_summary` | Allowlisted masked export |
| `support.request_access` | Create access request |
| `support.access.read` | Read visible access requests |
| `support.access.approve` | Approve/reject/reduce request |
| `support.access.revoke` | Revoke or end active access |
| `support.access.use` | Enter assigned approved workspace |

### SimulatedActor

The development role simulation maps roles to stable fictional actors:

| Role | Actor ID |
|------|----------|
| Super Admin | `ADM-DEMO-SUPER` |
| Support Agent | `ADM-DEMO-SUPPORT` |
| Billing Operator | `ADM-DEMO-BILLING` |
| Import Operator | `ADM-DEMO-IMPORT` |
| AI Operator | `ADM-DEMO-AI` |
| Content Manager | `ADM-DEMO-CONTENT` |
| Security Administrator | `ADM-DEMO-SECURITY` |

This map exists only for deterministic mock requester/approver/assignee checks.

## Identifier Rules

| Identifier | Pattern | Maximum |
|------------|---------|---------|
| User ID | `USR-` followed by uppercase letters, digits, or hyphens | 48 characters |
| Device ID | `DEV-` followed by uppercase letters, digits, or hyphens | 48 characters |
| Session ID | `SES-` followed by uppercase letters, digits, or hyphens | 48 characters |
| Access request ID | `ACC-` followed by uppercase letters, digits, or hyphens | 48 characters |
| Support ticket ID | `TKT-` followed by uppercase letters, digits, or hyphens | 48 characters |
| Audit reference | `AUD-` followed by uppercase letters, digits, or hyphens | 48 characters |

Identifiers are safe fictional references, not credentials.

## AdminUsersQuery

| Field | Type | Rules |
|-------|------|-------|
| `query` | string, optional | Trimmed; 1–100 characters when present |
| `status` | `AccountStatus`, optional | Allowlisted |
| `plan` | `Free | Basic | Premium`, optional | Read-only plan context |
| `country` | `SA | AE`, optional | Stable contract codes |
| `language` | `ar | en`, optional | Stable contract codes |
| `registeredFrom` | ISO date, optional | Must not exceed `registeredTo` |
| `registeredTo` | ISO date, optional | Must not precede `registeredFrom` |
| `lastActiveFrom` | ISO timestamp, optional | Must not exceed `lastActiveTo` |
| `lastActiveTo` | ISO timestamp, optional | Must not precede `lastActiveFrom` |
| `platform` | `PlatformFilter` | Defaults to `all` |
| `appVersion` | string, optional | Trimmed; version-safe; max 32 |
| `verification` | `VerificationState`, optional | Allowlisted |
| `risk` | `RiskLevel`, optional | Allowlisted |
| `sort` | `name | registeredAt | lastActive | risk` | Defaults to `lastActive` |
| `order` | `asc | desc` | Defaults to `desc` |
| `page` | integer | 1 or greater; defaults to 1 |
| `pageSize` | integer | `25 | 50 | 100`; defaults to 25 |
| `scenario` | string, optional | Development-only allowlist |

Changing search, filter, sort, or page size resets the page to 1 and clears
page-scoped selection.

## AdminUserListItem

| Field | Type | Rules |
|-------|------|-------|
| `id` | User ID | Safe fictional identifier |
| `displayName` | string | 1–100 characters |
| `maskedEmail` | string | Must contain masking; max 160 |
| `country` | `SA | AE` | Display localized by the UI |
| `language` | `ar | en` | Direction-safe |
| `primaryPlatform` | `Platform` | Most recently active platform |
| `registeredPlatforms` | unique `Platform[]` | 1–2 entries |
| `iosDeviceCount` | integer | 0 or greater |
| `androidDeviceCount` | integer | 0 or greater |
| `totalDeviceCount` | integer | Equals iOS plus Android counts |
| `plan` | `Free | Basic | Premium` | No price/amount |
| `status` | `AccountStatus` | Text/icon/color presentation |
| `verification` | `VerificationState` | Text/icon/color presentation |
| `registeredAt` | ISO timestamp | With offset |
| `lastActiveAt` | ISO timestamp | With offset |
| `risk` | `RiskLevel` | Summary only |

### User-list invariants

- `registeredPlatforms` contains `ios` iff `iosDeviceCount > 0`.
- `registeredPlatforms` contains `android` iff `androidDeviceCount > 0`.
- `totalDeviceCount = iosDeviceCount + androidDeviceCount`.
- `primaryPlatform` exists in `registeredPlatforms`.
- One response page cannot contain duplicate user IDs.
- All Platforms returns each matching user once.
- iOS/Android filters may overlap; Multi-platform requires both.

## AdminUsersPage

| Field | Type | Rules |
|-------|------|-------|
| `items` | `AdminUserListItem[]` | Maximum page size |
| `pagination` | `Pagination` | Consistent totals/pages |
| `uniqueCustomersTotal` | integer | Authoritative deduplicated total |
| `iosCustomers` | integer | May overlap Android |
| `androidCustomers` | integer | May overlap iOS |
| `multiPlatformCustomers` | integer | Cannot exceed any platform count |
| `region` | `RegionState` | Safe UI state metadata |

`uniqueCustomersTotal` is not derived from `iosCustomers + androidCustomers`.

## UserProfileSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | User ID | Matches route |
| `displayName` | string | Safe fictional text |
| `maskedEmail` | string | Masked before response |
| `country` | `SA | AE` | Localized in UI |
| `language` | `ar | en` | Direction-safe |
| `currency` | `SAR | AED` | No financial amount |
| `timezone` | string | IANA name; max 64 |
| `registeredAt` | ISO timestamp | With offset |
| `lastActiveAt` | ISO timestamp | With offset |
| `lastActivityByPlatform` | partial platform map | Timestamp only when present |
| `status` | `AccountStatus` | Current authoritative mock state |
| `onboardingStatus` | `complete | incomplete` | Summary only |
| `verification` | `VerificationState` | Current mock state |
| `risk` | `RiskSummary` | Bounded summary |
| `primaryPlatform` | `Platform` | In registered platforms |
| `registeredPlatforms` | `Platform[]` | Unique, 1–2 |
| `currentPlan` | `Free | Basic | Premium` | No amount/payment data |
| `aggregates` | `UserAggregates` | Nonnegative counts only |
| `region` | `RegionState` | Partial/permission behavior |

### RiskSummary

| Field | Type | Rules |
|-------|------|-------|
| `level` | `RiskLevel` | Required |
| `label` | string | Safe localized key/text |
| `updatedAt` | ISO timestamp | Required |
| `signalsCount` | integer | Aggregate only; no raw signals |

### UserAggregates

| Field | Type | Rules |
|-------|------|-------|
| `accountsCount` | integer | 0 or greater |
| `transactionsCount` | integer | 0 or greater |
| `goalsCount` | integer | 0 or greater |
| `activeDebtsCount` | integer | 0 or greater |
| `importSourcesCount` | integer | 0 or greater |
| `lastSyncAt` | ISO timestamp or null | No raw imported content |

No aggregate includes an amount, merchant, salary, debt balance, or
transaction row.

## Route Read Inputs

Read operations use small validated input objects:

- **UserDetailRequest**: `userId`, simulated role, and optional scenario.
- **UserDevicesQuery**: `userId`, simulated role, and optional scenario.
- **UserSessionsQuery**: `userId`, simulated role, and optional scenario.
- **AccessRequestDetailQuery**: `requestId`, simulated role, and optional
  scenario.

Role and scenario values are development-only. Future production identity and
authorization come from the server session.

## UserDevice

| Field | Type | Rules |
|-------|------|-------|
| `id` | Device ID | Safe fictional identifier |
| `userId` | User ID | Matches parent |
| `safeLabel` | string | 1–80; no fingerprint |
| `platform` | `Platform` | Required |
| `osVersion` | string | 1–32 |
| `appVersion` | string | 1–32 |
| `lastSeenAt` | ISO timestamp | With offset |
| `pushState` | `CapabilityState` | Required |
| `shortcutState` | `CapabilityState` | iOS or not-applicable |
| `shareExtensionState` | `CapabilityState` | iOS or not-applicable |
| `smsTrackingState` | `CapabilityState` | Android or not-applicable |
| `notificationListenerState` | `CapabilityState` | Android or not-applicable |
| `backgroundState` | `CapabilityState` | Android or not-applicable |
| `sessionState` | `active | none | revoked` | Summary |
| `state` | `DeviceState` | Active or revoked |
| `revokedAt` | ISO timestamp or null | Required when revoked |

### Device invariants

- iOS devices use `not-applicable` for Android-only capability fields.
- Android devices use `not-applicable` for iOS-only capability fields.
- Revoked devices have `revokedAt`; active devices do not.
- No fingerprint, push token, raw device ID, credential, or IP exists.

## UserDevicesResponse

| Field | Type | Rules |
|-------|------|-------|
| `items` | `UserDevice[]` | Maximum 100 |
| `iosDeviceCount` | integer | Matches items |
| `androidDeviceCount` | integer | Matches items |
| `totalDeviceCount` | integer | iOS plus Android |
| `activeDeviceCount` | integer | Matches active items |
| `revokedDeviceCount` | integer | Matches revoked items |
| `region` | `RegionState` | Required |

## UserSession

| Field | Type | Rules |
|-------|------|-------|
| `id` | Session ID | Safe fictional identifier |
| `userId` | User ID | Matches parent |
| `deviceId` | Device ID | References a safe device |
| `safeDeviceLabel` | string | 1–80 |
| `platform` | `Platform` | Required |
| `coarseRegion` | string | Country/city level only; max 80 |
| `startedAt` | ISO timestamp | With offset |
| `lastActivityAt` | ISO timestamp | Not before start |
| `state` | `SessionState` | Required |
| `risk` | `RiskLevel` | Required |
| `isCurrentAdminVisibleSession` | boolean | Used only to warn on all-session action |
| `revokedAt` | ISO timestamp or null | Required when revoked |

No raw IP, token, credential, or browser fingerprint exists.

## UserSessionsResponse

| Field | Type | Rules |
|-------|------|-------|
| `items` | `UserSession[]` | Maximum 100 |
| `activeCount` | integer | Matches active items |
| `expiredCount` | integer | Matches expired items |
| `revokedCount` | integer | Matches revoked items |
| `region` | `RegionState` | Required |

## Customer Action Inputs

### SuspendUserRequest

| Field | Rules |
|-------|-------|
| `reason` | Trimmed; 5–200 characters |
| `durationDays` | Integer; 1–365 |
| `internalNote` | Trimmed; 0–500 characters |
| `notifyUser` | Boolean preference only; no delivery in this phase |

Valid only when current status is `active` or `pending`.

### ReactivateUserRequest

| Field | Rules |
|-------|-------|
| `reason` | Trimmed; 5–200 characters |
| `internalNote` | Trimmed; 0–500 characters |

Valid only when current status is `suspended`.

### UpdateVerificationRequest

| Field | Rules |
|-------|-------|
| `nextState` | `verified | pending`; must differ from current state |
| `reason` | Trimmed; 5–200 characters |

### RevokeDeviceRequest

| Field | Rules |
|-------|-------|
| `reason` | Trimmed; 5–200 characters |

Valid only for an active device.

### RevokeSessionsRequest

| Field | Rules |
|-------|-------|
| `scope` | `selected | all` |
| `sessionIds` | Unique Session IDs; 1–100 for selected; empty for all |
| `reason` | Trimmed; 5–200 characters |

Already expired/revoked sessions are excluded and reported safely.

### UserActionResult

| Field | Type | Rules |
|-------|------|-------|
| `userId` | User ID | Mask-safe |
| `action` | allowlisted action | Required |
| `previousState` | string | Allowlisted for the action |
| `currentState` | string | Allowlisted for the action |
| `outcome` | `success | partial` | Required |
| `affectedCount` | integer | 0 or greater |
| `occurredAt` | ISO timestamp | Required |
| `message` | string | Safe; max 200 |
| `auditReference` | Audit reference | Fictional |

`DeviceActionResult` and `SessionActionResult` are named aliases of this
bounded result shape so the contract names remain explicit without duplicating
fields.

## UserBulkActionRequest

| Field | Type | Rules |
|-------|------|-------|
| `action` | `UserBulkAction` | Required |
| `userIds` | unique User ID[] | 1–100; explicit current selection |
| `reason` | string, conditional | 5–200 for sensitive actions |
| `durationDays` | integer, conditional | 1–365 for suspension |
| `notifyUser` | boolean, optional | Preference/handoff only |

The request never means “all filtered results.”

## UserBulkActionResult

| Field | Type | Rules |
|-------|------|-------|
| `requestedCount` | integer | Equals submitted IDs |
| `eligibleCount` | integer | Cannot exceed requested |
| `succeededCount` | integer | Cannot exceed eligible |
| `failedCount` | integer | Equals requested minus succeeded |
| `failures` | `BulkFailure[]` | Maximum submitted count |
| `auditReference` | Audit reference | Fictional |

### BulkFailure

| Field | Type | Rules |
|-------|------|-------|
| `userId` | User ID | Safe identifier |
| `code` | stable safe code | No raw error |
| `message` | string | Safe; max 200 |

## AccessRequestsQuery

| Field | Type | Rules |
|-------|------|-------|
| `query` | string, optional | Request/customer/ticket masked search; max 100 |
| `status` | `AccessStatus`, optional | Allowlisted |
| `assignee` | string, optional | Safe fictional admin ID; max 48 |
| `page` | integer | 1 or greater |
| `pageSize` | integer | `25 | 50 | 100` |
| `scenario` | string, optional | Development-only allowlist |

Support agents receive only requests visible to the simulated identity;
production filtering belongs to the backend.

## AccessRequestSummary

| Field | Type | Rules |
|-------|------|-------|
| `id` | Access request ID | Required |
| `userId` | User ID | Required |
| `maskedCustomerLabel` | string | No unmasked email |
| `supportTicketId` | Ticket ID | Required |
| `requestedBy` | safe Admin actor | Required |
| `assignee` | safe Admin actor | Required |
| `requestedScope` | unique `AccessScope[]` | 1–6 |
| `approvedScope` | unique `AccessScope[]` or null | Subset of requested |
| `reasonSummary` | string | Safe; max 160 |
| `status` | `AccessStatus` | Required |
| `createdAt` | ISO timestamp | Required |
| `startsAt` | ISO timestamp or null | Required for approved/active |
| `expiresAt` | ISO timestamp or null | Required for approved/active/expired |
| `approvedBy` | safe Admin actor or null | Not requester |

## CreateAccessRequest

| Field | Type | Rules |
|-------|------|-------|
| `userId` | User ID | Existing fictional customer |
| `supportTicketId` | Ticket ID | Existing fictional ticket |
| `assignee` | safe Admin actor | Required |
| `reason` | string | Trimmed; 10–500 |
| `requestedScope` | unique `AccessScope[]` | 1–6 |
| `maskingRequired` | literal `true` | Cannot be disabled |
| `durationMinutes` | integer | 5–60; defaults to 30 |
| `customerApprovalRequired` | boolean | Status context only |

A pending/approved/active request with the same assignee, user, ticket, and
overlapping scope causes conflict.

## AccessDecisionRequest

| Field | Type | Rules |
|-------|------|-------|
| `decision` | `approve | reject` | Required |
| `reason` | string | Trimmed; 5–500 |
| `approvedScope` | `AccessScope[]`, approve only | Nonempty subset of requested |
| `durationMinutes` | integer, approve only | 5–requested duration |
| `startsAt` | ISO timestamp, approve only | Not in the past beyond tolerance |

The approver cannot equal `requestedBy`. Rejection does not accept scope or
duration.

## RevokeAccessRequest

| Field | Rules |
|-------|-------|
| `reason` | Trimmed; 5–500 characters |

Valid only for Approved or Active requests.

## EndTemporaryAccessRequest

| Field | Rules |
|-------|-------|
| `reason` | Optional trimmed string; max 300 |

Valid only for the assigned operator while status is Active.

## AccessRequestDetail

Includes all `AccessRequestSummary` fields plus:

| Field | Type | Rules |
|-------|------|-------|
| `ticketSummary` | string | Sanitized; max 300 |
| `customerSummary` | `MaskedCustomerSummary` | Privacy-safe |
| `reason` | string | Sanitized; max 500 |
| `requestedDurationMinutes` | integer | 5–60 |
| `approvedDurationMinutes` | integer or null | Not above requested |
| `maskingRules` | string[] | Allowlisted descriptions; max 12 |
| `customerApprovalRequired` | boolean | Required |
| `customerApprovalState` | `not-required | pending | received` | Required |
| `timeline` | `AccessTimelineItem[]` | Chronological; max 50 |
| `region` | `RegionState` | Required |

### MaskedCustomerSummary

`userId`, `displayName`, `maskedEmail`, `status`, `primaryPlatform`,
`registeredPlatforms`, and `risk`. No financial values or raw identifiers.

### AccessTimelineItem

| Field | Type | Rules |
|-------|------|-------|
| `id` | safe ID | Unique within request |
| `event` | allowlisted event | Created/approved/rejected/active/revoked/expired/ended |
| `actor` | safe actor label | Required |
| `occurredAt` | ISO timestamp | Chronological |
| `summary` | string | Safe; max 240 |
| `auditReference` | Audit reference | Fictional |

## Access State Transitions

| Current | Allowed next | Trigger |
|---------|--------------|---------|
| Pending | Approved | Separate authorized approver accepts reduced/equal scope and duration |
| Pending | Rejected | Separate authorized approver rejects with reason |
| Approved | Active | Assigned operator enters during valid start/expiry window |
| Approved | Expired | Expiry reached before/during use |
| Approved | Revoked | Authorized revoker confirms |
| Active | Expired | Expiry reached |
| Active | Revoked | Authorized revoker or assignee ends access |
| Rejected | None | Terminal |
| Expired | None | Terminal |
| Revoked | None | Terminal |

Every invalid transition returns a safe 409 conflict.

## TemporaryWorkspaceRequest

| Field | Type | Rules |
|-------|------|-------|
| `requestId` | Access request ID | Route value |
| `simulatedActor` | safe Admin actor | Development-only identity context |

The development mock maps each simulated role to one stable fictional Admin
actor ID so requester/approver/assignee rules remain deterministic. The future
backend derives actor identity and permission from the authenticated session,
not a client-supplied value.

## TemporaryWorkspace

| Field | Type | Rules |
|-------|------|-------|
| `requestId` | Access request ID | Required |
| `supportTicketId` | Ticket ID | Required |
| `assignee` | safe Admin actor | Must match current simulated actor |
| `status` | `active` | Workspace returns only active access |
| `approvedScope` | `AccessScope[]` | Required, nonempty |
| `startsAt` | ISO timestamp | Required |
| `expiresAt` | ISO timestamp | Must be in future at response time |
| `accessNotice` | string | Safe; max 240 |
| `auditIndicator` | string | Safe audit reference/label |
| `sections` | `WorkspaceSection[]` | Exactly permitted projections |
| `region` | `RegionState` | Required |

### WorkspaceSection

| Field | Type | Rules |
|-------|------|-------|
| `scope` | `AccessScope` | Must be in approved scope |
| `title` | string | Safe; max 100 |
| `fields` | `WorkspaceField[]` | 1–20 |

### WorkspaceField

| Field | Type | Rules |
|-------|------|-------|
| `label` | string | Safe; max 100 |
| `value` | string or integer | Masked/aggregated only |
| `classification` | `masked | aggregate | status` | Required |

The workspace contract has no generic record map and no raw customer object.

## RegionState

| Field | Type | Rules |
|-------|------|-------|
| `availability` | `RegionAvailability` | Required |
| `message` | string, optional | Safe; max 240 |
| `retryable` | boolean, optional | Required for unavailable states |
| `updatedAt` | ISO timestamp, optional | No internal metadata |

## Pagination

| Field | Type | Rules |
|-------|------|-------|
| `page` | integer | 1 or greater |
| `pageSize` | integer | 25, 50, or 100 |
| `totalItems` | integer | 0 or greater |
| `totalPages` | integer | Consistent with total/page size |

## ApiError

| Field | Type | Rules |
|-------|------|-------|
| `status` | integer | Approved HTTP status |
| `code` | string | Stable safe allowlist |
| `message` | string | Localized safe text; max 240 |
| `fieldErrors` | field-to-message map, optional | Allowlisted form fields only |
| `correlationId` | safe ID, optional | No infrastructure detail |

Approved statuses include 400, 401, 403, 404, 409, 422, 429, 500, and 503.

## Relationships

```text
AdminUserListItem 1 ── 1 UserProfileSummary
UserProfileSummary 1 ── N UserDevice
UserProfileSummary 1 ── N UserSession
UserDevice 1 ── N UserSession
UserProfileSummary 1 ── N AccessRequestSummary
AccessRequestDetail N ── 1 support ticket reference
AccessRequestDetail N ── 1 requester
AccessRequestDetail N ── 1 assignee
AccessRequestDetail 0..1 ── 1 approver
AccessRequestDetail 0..1 ── 1 TemporaryWorkspace
AccessRequestDetail 1 ── N AccessTimelineItem
TemporaryWorkspace 1 ── N WorkspaceSection
WorkspaceSection 1 ── N WorkspaceField
```

These are frontend projection relationships, not database migrations.

## Cache and Invalidation Rules

- List filter/page queries are keyed by normalized query values.
- Profile, devices, and sessions are keyed by validated user ID.
- User status/verification changes update detail and invalidate affected list
  pages.
- Device revocation invalidates device summary, profile platform counts, and
  affected list rows.
- Session revocation invalidates sessions and profile activity.
- Bulk success invalidates users list and affected detail keys.
- Access request create/decision/revoke invalidates request list/detail.
- Workspace is keyed by request ID and current simulated role/actor context.
- Expiry, revocation, end-access, permission loss, or session expiry cancels
  and removes workspace cache immediately.
- No sensitive response is persisted beyond in-memory query state.

## Mock Fixture Coverage

Fixtures include:

- iOS-only, Android-only, and multi-platform customers
- Multiple devices for one customer
- Active and revoked devices
- iOS and Android platform-specific capability states
- Active, expired, and revoked sessions
- Active, suspended, pending-verification, and elevated-risk customers
- Empty, large, partial, stale, unavailable, forbidden, and unsafe-text cases
- Pending, approved, active, expired, rejected, and revoked access requests
- Requester/approver separation, reduced scope, duplicate overlap, and expiry
- Masked and aggregate-only workspace sections

All names, emails, IDs, regions, tickets, notes, and summaries are fictional and
sanitized.
