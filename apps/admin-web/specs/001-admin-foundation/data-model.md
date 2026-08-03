# Frontend Data Model: Admin Foundation

**Phase / Spec**: Phase 0 / Spec 001  
**Boundary**: Frontend contracts and fictional mock data only

## Shared Contract Rules

- All external and mock values are untrusted until validated.
- Zod schemas are authoritative at request and response boundaries.
- Identifiers are opaque non-empty strings; the UI does not infer meaning from
  identifier prefixes.
- Dates cross contracts as ISO 8601 strings and are formatted only for display.
- Sensitive values are masked or omitted before they reach presentation.
- No model contains secrets, credentials, tokens, raw provider payloads, raw
  imported content, or full customer financial records.
- Application code uses no `any`.

## AdminSession

Represents a fictional development-only Admin session.

| Field | Type | Rules |
|-------|------|-------|
| `adminId` | string | Fictional opaque identifier |
| `displayName` | string | Sanitized display value |
| `role` | `AdminRole` | One of seven Phase 0 roles |
| `permissions` | `PermissionKey[]` | Limited to six Phase 0 keys |
| `environment` | `production \| staging \| development` | Display context only |
| `locale` | `ar \| en` | `ar` is default |
| `direction` | `rtl \| ltr` | Must match locale selection |
| `theme` | `light \| dark` | Functional on all four routes |
| `expiresAt` | ISO date-time | Drives simulated expiry state |
| `developmentOnly` | literal `true` | Prevents production-security claims |

**Relationships**: One session has one role and many permission keys.

**State transitions**:

```text
active → expired
active → role-switched → active
```

## AdminRole and PermissionKey

`AdminRole` values:

- `super-admin`
- `support-agent`
- `billing-operator`
- `import-operator`
- `ai-operator`
- `content-manager`
- `security-administrator`

`PermissionKey` values:

- `admin.overview.read`
- `users.read`
- `imports.read`
- `system-health.read`
- `global-search.use`
- `attention.read`

Role-to-route relationships are defined by the clarification matrix in
`spec.md`. Future permission keys are out of scope.

## NavigationGroup and NavigationItem

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Stable group or item key |
| `labelKey` | string | Resolves to Arabic and English labels |
| `items` | `NavigationItem[]` | Group only |
| `route` | string or null | Null means planned/unavailable |
| `iconKey` | string | Maps to an approved Lucide icon |
| `permission` | `PermissionKey` or null | Required for active route |
| `availability` | `active \| planned \| denied` | Never creates a broken link |
| `attentionCount` | non-negative integer or absent | Permission-filtered |

**Relationships**: Navigation groups contain items; active items reference one
Phase 0 permission.

## PlatformOption and PlatformBreakdown

`PlatformOption` uses `all`, `ios`, or `android`.

| Field | Type | Rules |
|-------|------|-------|
| `value` | platform union | Stable contract value |
| `labelKey` | string | Localized presentation |
| `isDefault` | boolean | Only `all` is default |

`PlatformBreakdown`:

| Field | Type | Rules |
|-------|------|-------|
| `total` | non-negative number | Semantic total supplied by contract |
| `ios` | non-negative number | iOS count |
| `android` | non-negative number | Android count |
| `multiPlatformCustomers` | non-negative number or absent | Required for customer overlap scenarios |
| `metricKind` | `unique-customers \| devices \| events` | Determines additivity |

For `unique-customers`, `total` is deduplicated and is not derived by adding
the platform values.

## DateRange

| Field | Type | Rules |
|-------|------|-------|
| `start` | ISO date | Required |
| `end` | ISO date | Required and not before `start` |
| `preset` | `7d \| 30d \| 90d \| custom` | Must match selected range |

Invalid ranges produce field-level validation errors before a request.

## ApiError

| Field | Type | Rules |
|-------|------|-------|
| `status` | integer | HTTP status |
| `code` | string | Stable safe code |
| `message` | string | Localizable and safe for users |
| `fieldErrors` | record of string arrays or absent | No private input echo |
| `correlationId` | string or absent | Fictional in mocks |

Raw exceptions and provider payloads never enter this model.

## Pagination and PaginatedResponse

| Field | Type | Rules |
|-------|------|-------|
| `page` | positive integer | Defaults to 1 |
| `pageSize` | `25 \| 50 \| 100` | Validated |
| `totalItems` | non-negative integer | Server/mock supplied |
| `totalPages` | non-negative integer | Consistent with total and size |
| `data` | typed array | Contains one page only |

## AttentionItem

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Opaque identifier |
| `type` | `incident \| notification \| job` | Phase 0 shell categories |
| `severity` | `info \| low \| medium \| high \| critical` | Label and icon accompany color |
| `summary` | string | Sanitized, no private payload |
| `occurredAt` | ISO date-time | Required |
| `route` | string | Must be an allowed Phase 0 target |
| `permission` | `PermissionKey` | Used for filtering |
| `platform` | `all \| ios \| android` or absent | Only when attribution applies |

## GlobalSearchQuery and GlobalSearchResult

`GlobalSearchQuery`:

| Field | Type | Rules |
|-------|------|-------|
| `query` | string | Trimmed, normalized, 2–100 characters |
| `entityTypes` | search entity array | Optional filter |
| `platform` | platform union or absent | Validated |
| `page` | positive integer | Defaults to 1 |
| `pageSize` | `25 \| 50 \| 100` | Defaults to 25 |

Phase 0 search entities are `navigation`, `user`, `import`, and
`system-health`.

`GlobalSearchResult`:

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Opaque identifier |
| `entityType` | Phase 0 search entity | No future type is active |
| `primaryLabel` | string | Sanitized |
| `secondaryLabel` | string or absent | Masked when sensitive |
| `route` | string | Allowed Phase 0 target only |
| `permission` | `PermissionKey` | Result removed when unauthorized |

## ConfirmationIntent

| Field | Type | Rules |
|-------|------|-------|
| `action` | string | Stable action key |
| `scope` | string | Safe human-readable scope |
| `consequence` | string | Required before confirmation |
| `permission` | `PermissionKey` | UI check only |
| `auditEvent` | string | Future backend expectation |
| `state` | mutation state | Controls duplicate submission |

**State transitions**:

```text
idle → confirming → pending → success
                         ↘ failure → idle
                         ↘ conflict → idle
```

The confirmation control is locked while `pending`.

## AsyncState

```text
idle | loading | success | empty | error | forbidden | conflict | unavailable
```

Each state has one presentation mapping. Error-like states carry `ApiError`;
success carries typed data; empty carries no synthetic row.

## Existing Feature Models

Overview metrics, users, imports, service health, incidents, and chart points
retain their current display fields during migration. Feature contracts wrap
them in validated response envelopes instead of redefining their visual
meaning. Any field that is currently sensitive remains masked in its fixture
before the repository returns it.
