# Data Model: Mobile Product Foundation

These models define frontend contracts and local mock state. They are not production backend
schemas.

## ProductCapability

Represents one user-visible capability and its approved scope.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable, unique capability identifier |
| `titleKey` | message key | Must resolve in Arabic and English |
| `scope` | enum | `core_v1`, `platform_v1`, `post_mvp`, or `excluded` |
| `platforms` | set | One or both of `android`, `ios` |
| `primaryOutcome` | message key | One clear user outcome |
| `manualFallbackId` | capability id or null | Required for automated essential outcomes |

**Validation**:

- Excluded and Post-MVP capabilities cannot appear in Core V1 navigation.
- Android SMS capability cannot include iOS in `platforms`.
- An automatic essential capability must reference a usable manual fallback.

## CaptureMethod

Represents how a financial activity enters the application.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `automatic`, `voice`, `manual`, `platform_assisted` |
| `platformAvailability` | set | Supported operating systems |
| `permissionId` | permission id or null | Required only when the method needs permission |
| `fallbackCapabilityId` | capability id or null | Required when denial would otherwise block capture |
| `availability` | enum | `available`, `permission_required`, `unavailable`, `paused` |

## FinancialChange

Represents a proposed or completed mock financial record change.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique local identifier |
| `source` | enum | `automatic`, `voice`, `manual`, `assistant`, `platform_assisted` |
| `certainty` | enum | `clear`, `review_required`, `rejected` |
| `status` | enum | See transition table |
| `sourceReference` | string or null | Display only when privacy rules allow |
| `confirmationRequired` | boolean | Always true for assistant-originated changes |
| `correctionActions` | set | At least one of `undo`, `edit`, `report` after automatic add |
| `createdAt` | timestamp | Stored consistently for ordering and recovery |

**State transitions**:

```text
proposed -> awaiting_confirmation -> applied
proposed -> review_required -> applied
proposed -> review_required -> rejected
applied -> undone
applied -> corrected
```

- `clear` automatic changes may move directly from `proposed` to `applied`.
- Uncertain, conflicting, duplicate, or low-confidence changes must enter `review_required`.
- Assistant changes must enter `awaiting_confirmation` before `applied`.
- An applied automatic change must expose correction actions.

## PlatformCapability

Represents an operating-system feature and its honest alternative.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable capability identifier |
| `platform` | enum | `android` or `ios` |
| `availability` | enum | `supported`, `unsupported`, `permission_required` |
| `explanationKey` | message key | Required for unavailable or permission-gated behavior |
| `fallbackCapabilityIds` | capability id list | Must contain an available alternative when essential |

## PermissionState

Represents an optional permission and user recovery path.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique permission identifier |
| `status` | enum | `not_requested`, `granted`, `denied`, `permanently_denied`, `revoked`, `unavailable` |
| `purposeKey` | message key | Explains what and why before request |
| `dataUseKey` | message key | Explains analyzed data |
| `disableAction` | action | Always present after grant |
| `recoveryAction` | action or null | Required for denied, revoked, and recoverable states |
| `blocking` | boolean | Must be false for optional permissions |

**State transitions**:

```text
not_requested -> granted
not_requested -> denied
denied -> granted
denied -> permanently_denied
granted -> revoked
revoked -> granted
```

## FrontendState

Represents the visible condition of an asynchronous surface.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `initial`, `loading`, `success`, `empty`, `error`, `offline`, `partial`, `permission_required`, `permission_denied`, `permission_permanently_denied`, `sync_pending`, `sync_failed`, `read_only`, `disabled`, `archived` |
| `messageKey` | message key | Must resolve in both languages |
| `recoveryAction` | action or null | Required for actionable failure states |
| `isDataComplete` | boolean | False for partial, stale, and pending states |

## ReportingCurrency

Defines the base currency used by summaries.

| Field | Type | Rules |
|---|---|---|
| `currencyCode` | ISO currency code | Exactly one selected per session |
| `originalAmount` | decimal | Preserved with original transaction currency |
| `convertedAmount` | decimal or null | Present only when a conversion is available |
| `conversionAsOf` | timestamp or null | Required with converted amount |
| `isEstimated` | boolean | True for every converted aggregate in Core V1 |

## UserPreferences

| Field | Type | Rules |
|---|---|---|
| `locale` | enum | `ar` or `en` |
| `direction` | derived enum | `rtl` for Arabic, `ltr` for English |
| `theme` | enum | `light`, `dark`, `system` |
| `hideBalances` | boolean | Persistent across sessions |
| `baseCurrencyCode` | ISO currency code | Required |
| `reducedMotion` | derived boolean | Honors system preference |

Sensitive values are visible only in an authenticated app session and when `hideBalances` is
false. Lock-screen notifications and app-switcher previews remain masked regardless.

## OfflineEntry

Represents a manual financial entry saved without confirmed synchronization.

| Field | Type | Rules |
|---|---|---|
| `localId` | string | Unique and stable before remote identity exists |
| `payload` | typed financial input | Validated before local save |
| `syncStatus` | enum | `pending`, `syncing`, `synced`, `failed`, `conflict` |
| `createdAt` | timestamp | Required |
| `updatedAt` | timestamp | Changes after an offline edit |
| `lastErrorKey` | message key or null | Never contains raw provider errors |

**State transitions**:

```text
pending -> syncing -> synced
pending -> syncing -> failed -> pending
pending -> syncing -> conflict -> pending
pending -> deleted
```

An offline entry remains editable or removable until synchronization is confirmed. The UI
must never label `pending`, `syncing`, `failed`, or `conflict` as synchronized.

## Relationships

- `ProductCapability` may reference one manual fallback capability.
- `CaptureMethod` may reference one `PermissionState` and one fallback capability.
- `FinancialChange` originates from one `CaptureMethod` or assistant proposal.
- `PlatformCapability` references one or more fallback `ProductCapability` records.
- `UserPreferences` selects one `ReportingCurrency` and controls sensitive-value visibility.
- `OfflineEntry` becomes a normal financial record only after confirmed synchronization.
