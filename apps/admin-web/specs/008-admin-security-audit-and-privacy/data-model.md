# Data Model: Spec 008 Security, Audit, and Data Privacy Requests

This is a frontend contract and read-model design. It is not a database schema
and does not authorize backend, authentication, audit infrastructure, archive,
deletion, cleanup, storage, queue, or job work.

## Shared value objects

### SecurityRecordId

- Maximum 48 characters.
- Allowlisted fictional prefixes:
  - `AUTH-`: authentication event
  - `SUS-`: suspicious activity
  - `INC-`: security incident
  - `ASA-`: Admin security projection
  - `PCH-`: permission change
  - `SAC-`: support-access grant
  - `AUD-`: immutable audit event or planned audit reference
  - `EXP-`: data export request
  - `DEL-`: account deletion request
  - `RET-`: retention policy
- Parsed before route interpolation and URL-encoded by the repository.

### AccessProjection

- `full`: complete allowlisted fields and permitted actions.
- `own_access`: only the current Support Agent’s active-access projection.
- `linked_status`: minimum request status inside an already authorized prior
  feature route.
- `denied`: safe access-denied result with no protected record fields.

Handlers select the projection before serialization. Presentation code never
receives a full object and hides fields afterward.

### PlatformScope

- `all`
- `ios`
- `android`
- `unknown`
- `global`

`unknown` means missing mobile attribution. `global` means platform attribution
does not apply, such as an Admin permission change or retention policy.

### SafeReference

- `id`: allowlisted fictional identifier.
- `kind`: `customer | admin | device | session | ticket | incident | request |
  subscription | service`.
- `label`: bounded masked or operational label.
- Optional safe status only.
- No raw email, phone, IP address, device ID, token, credential, private
  payload, financial value, or precise location.

### Pagination

- `page`: positive integer.
- `pageSize`: `25 | 50 | 100`; default `25`.
- `totalItems`: non-negative integer.
- `totalPages`: zero for empty results, otherwise the authoritative page count.
- Page item count never exceeds `pageSize`.

### SafeText

- Search: at most 120 Unicode code points.
- Reason or internal note: at most 2 KiB UTF-8.
- Human-readable input is normalized to Unicode NFC.
- Bidirectional override/isolate controls, C0/C1 controls, invalid Unicode,
  script-like markup, HTML, Markdown, URLs, ANSI sequences, and executable JSON
  are rejected where not explicitly allowlisted.
- All values are fictional, bounded, and rendered as plain text.

### SafeMetadataEntry

- `key`: one allowlisted display key, at most 64 ASCII characters.
- `label`: localized bounded label.
- `value`: string, number, boolean, or null rendered as text.
- String value maximum: 500 Unicode code points.
- Maximum 40 entries per audit event.
- No nested object, array, URL, HTML, Markdown, binary value, or unknown key.

### PlatformMetric

- `key`, localized label, non-negative value, unit, entity semantic, freshness.
- Optional `ios`, `android`, and `unknown` event/session/device counts.
- Optional authoritative deduplicated unique-customer total.
- Event/session/device counts may be additive only when one record has one
  origin.
- Unique-customer total is never calculated by adding platform counts.

### ActionContext

- `action`: resource-specific allowlisted action.
- `reason`: required where the transition specifies it.
- `expectedState`: current lifecycle state.
- `expectedRevision`: positive integer.
- `confirmationToken`: fixed mock-only confirmation marker.

Every mutation returns resource ID, previous/current state, outcome, timestamp,
safe message, current revision, and optional planned audit reference.

## Security domain

### SecurityOverview

- Period, platform, freshness, partial-region state.
- Metrics: failed login events, suspicious sessions, locked accounts, revoked
  sessions, permission changes, active support-access grants, and critical
  security events.
- Each metric declares whether it counts events, sessions, accounts, grants, or
  permission changes.
- Only attributable event/session metrics use a mobile platform breakdown.

### AuthenticationEvent

- Immutable `id`.
- Actor reference and `actorType`: `customer | admin | system`.
- `eventType`: allowlisted authentication-event label.
- Safe device label and broad region.
- Platform and app version when applicable.
- Authoritative risk level and result.
- Timestamp and correlation ID.
- No raw IP address, precise location, device identifier, token, credential,
  password, recovery code, telemetry payload, or risk-rule detail.

### SuspiciousActivity

- `id`, actor reference, safe event label.
- Authoritative integer risk score in the contract’s allowed range.
- Bounded allowlisted signal labels.
- Platform/app/session summary where applicable.
- State, optional reviewer reference, optional existing incident reference.
- Created/updated timestamps, revision, allowed actions, safe timeline.

#### Suspicious activity transitions

| Current | Allowed next states | Additional rule |
|---|---|---|
| New | Investigating | Reviewer may be assigned |
| Investigating | Escalated, Resolved, Dismissed | Escalated requires an existing incident |
| Escalated | Resolved, Dismissed | Existing incident reference remains |
| Resolved | none | Terminal |
| Dismissed | none | Terminal |

Reviewer replacement does not change lifecycle state but increments revision.

### AdminSecuritySummary

- Immutable Admin reference.
- Role summary.
- Two-factor state: `enabled | disabled | recovery_required`.
- Last login time.
- Active-session count.
- Authoritative risk state.
- No credentials, secrets, recovery codes, session identifiers, or raw login
  history.

### PermissionChange

- Immutable `id`.
- Subject Admin reference.
- Permission or role summary.
- Allowlisted previous and new values.
- Changed-by reference, bounded reason, time, result, correlation ID.
- Read-only in Phase 7; permission editing belongs to Spec 010.

### SupportAccessGrant

- `id`, agent reference, masked customer reference, ticket reference.
- Allowlisted approved scope labels.
- Start, expiry, remaining-time state, lifecycle state.
- State: `active | expired | revoked`.
- Revision and safe timeline.

#### Support-access transition

| Current | Allowed next states |
|---|---|
| Active | Revoked |
| Expired | none |
| Revoked | none |

Revocation requires reason, current state, expected revision, permission, and
confirmation. Expiry is evaluated against the injected clock.

### SecurityIncident

- `id`, severity, state, owner reference.
- Ordered safe timeline and internal notes.
- Affected-service summaries.
- Authoritative deduplicated affected-customer count.
- Optional platform-attributed event breakdown.
- Action and resolution summaries.
- Created/updated timestamps, revision, allowed actions, audit references.

#### Incident transitions

| Current | Allowed next states |
|---|---|
| Open | Contained |
| Contained | Monitoring |
| Monitoring | Resolved |
| Resolved | Monitoring, Closed |
| Closed | none |

Notes may be added in non-Closed states without changing state. Every state
change uses current state and expected revision.

## Audit domain

### AuditEvent

- Immutable `id`, time, actor reference, actor type.
- Action, resource type/reference, masked target reference.
- Result, severity, broad region, correlation ID.
- Bounded `SafeMetadataEntry[]`.
- Bounded allowlisted before and after entry lists.
- Optional related ticket and incident references.
- Omission labels explaining unavailable protected fields.

There is no create, update, delete, retry, replace, or rollback contract for an
AuditEvent. A missing related resource does not alter the evidence.

### Audit metadata allowlist

The exact allowed keys are contract-owned. Fixtures cover operational keys such
as `state`, `role`, `permission`, `scope`, `platform`, `result`, `reasonCode`,
and `revision`. Keys suggesting secrets, credentials, tokens, IP addresses,
payloads, messages, financial records, archive content, or file paths are
rejected before response serialization.

## Data export domain

### ExportScopeCategory

- `profile`
- `devices_sessions`
- `financial_records`
- `imports`
- `ai_data`
- `support_feedback`
- `notifications`
- `files`

These are metadata-only labels. Phase 7 never contains or previews category
contents.

### ExportFileMetadata

- Safe basename only.
- Allowlisted fictional media type: `application/zip`.
- Declared non-negative byte size.
- Checksum label, not a customer-derived checksum value.
- Generated and expiry timestamps.
- State: `unavailable | ready | expired`.
- No path, URL, token, bytes, Blob, archive contents, or storage identifier.

### ExportRequest

- `id`, masked customer reference, allowlisted scope set.
- Eligibility summary and lifecycle state.
- Requested, processing-started, completed, and expiry timestamps when
  applicable.
- Optional fictional `ExportFileMetadata`.
- Safe error summaries, timeline, revision, allowed actions, audit references.

#### Export transitions

| Current | Allowed next states |
|---|---|
| Requested | Validating, Failed, Cancelled |
| Validating | Processing, Failed, Cancelled |
| Processing | Ready, Failed |
| Ready | Expired |
| Failed | Processing |
| Expired | none |
| Cancelled | none |

Only an unexpired Ready request allows `simulate_download`. Its result contains
`allowed`, `expiresAt`, and a mock-only message only.

## Account deletion domain

### DeletionChecklistItem

- Category:
  - `customer_notified`
  - `subscription_cancelled`
  - `sessions_revoked`
  - `exports_handled`
  - `files_removed`
  - `financial_data_deleted_or_anonymized`
  - `ai_data_deleted`
  - `audit_records_preserved`
  - `completion_confirmed`
- State: `pending | in_progress | completed | blocked | preserved`.
- Responsible capability, bounded safe reason, updated time.
- `required` and `preserved` booleans.
- No underlying customer data.

### DeletionRequest

- `id`, masked customer reference, lifecycle state.
- Requested and scheduled timestamps, subscription-cancellation state.
- Checklist, blockers, legal-hold state, progress summary.
- Completion timestamp, revision, allowed actions, audit references.

#### Deletion transitions

| Current | Allowed next states | Additional rule |
|---|---|---|
| Requested | Review Required, Cancelled | — |
| Review Required | Scheduled, Cancelled | Legal hold blocks Scheduled |
| Scheduled | In Progress, Cancelled | — |
| In Progress | Completed, Blocked | Completed requires all required items resolved |
| Blocked | In Progress | Retry requires blocker resolution |
| Completed | none | Terminal |
| Cancelled | none | Terminal |

`audit_records_preserved` in Preserved state is resolved, not an incomplete
customer-data deletion item. No transition deletes or anonymizes real data.

## Retention domain

### RetentionPolicy

- `id`, data category, storage category.
- Positive integer `retentionDays`.
- Contract-provided positive integer `minimumDays` and `maximumDays`, where
  minimum is not greater than maximum.
- Cleanup process reference, last cleanup time, state.
- State: `active | suspended | review_required`.
- Legal-hold state and explanation.
- `protectedAuditPolicy` boolean.
- Revision, last change, bounded change history, allowed actions.

### Retention invariants

- `minimumDays ≤ retentionDays ≤ maximumDays`.
- Protected audit retention cannot fall below its approved `minimumDays`.
- An active legal hold makes effective cleanup status Suspended regardless of
  configured retention days.
- Update requires integer days, reason, impact acknowledgement, current state,
  expected revision, and confirmation.
- Update changes mock policy state only; it does not run cleanup, change
  storage, schedule a job, or modify customer data.

## Relationships

- A SuspiciousActivity may reference one existing SecurityIncident.
- A SecurityIncident may aggregate many security events and references only
  safe service and customer-count summaries.
- A SupportAccessGrant references one agent, one masked customer, and one
  support ticket.
- An AuditEvent may reference one support ticket and/or one security incident;
  the related resource may later be unavailable.
- An ExportRequest belongs to one masked customer and has one or more scope
  labels plus zero or one fictional file-metadata record.
- A DeletionRequest belongs to one masked customer and owns the approved
  checklist.
- A RetentionPolicy governs one data category; an active legal hold overrides
  cleanup regardless of policy period.
- No entity contains raw customer records, archive contents, deletion payloads,
  credentials, tokens, or full device/session identifiers.

## Deterministic mock reset

- Fixtures are immutable inputs.
- Runtime state owns mutable copies only for the six actionable resource groups.
- Time-sensitive transitions accept the fixed Phase 7 clock
  (`2026-07-30T12:00:00+03:00` by default in mocks/tests); handlers and state do
  not call `Date.now()` or `Math.random()`.
- Reset restores the initial mutable records, clock, and deterministic audit
  counter. UI mutation locks use the existing hook and release in `finally`;
  Phase 7 adds no state-level lock manager.
- No browser storage, filesystem, database, network, provider, queue, or job
  persistence is used.
