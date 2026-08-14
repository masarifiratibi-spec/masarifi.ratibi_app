# Data Model: Voice Transaction Capture and Smart Categorization UX

## Ownership and Persistence

| Data | Owner | Persistence |
|---|---|---|
| Voice capture session, audio reference, transcript, proposals, selections | Voice session store | Memory only |
| Accounts, categories, confirmed transactions | Existing Core Finance | Existing SQLite tables |
| Merchant-category preferences | Voice category preference repository | SQLite schema version 4 |
| Obligation preview | Existing mock obligation boundary | No voice-owned persistence |
| Notification outcome | Existing mock notification boundary | No voice-owned persistence |

Audio and transcript content must never enter SQLite, AsyncStorage, analytics, logs,
notifications, or raw error payloads.

## 1. Voice Capture Session

Represents one attempt from permission education through save or cancellation.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable for one attempt; regenerated on a new recording |
| `state` | enum | `idle`, `permission_required`, `ready`, `recording`, `stopping`, `transcribing`, `transcript_review`, `analyzing`, `proposal_review`, `saving`, `saved`, `failed`, `canceled` |
| `permission` | enum | `not_requested`, `granted`, `denied`, `permanently_denied`, `unavailable` |
| `language` | enum | `ar`, `en`; mixed supported content remains tied to the initiating locale |
| `startedAt` | integer or null | Device epoch time captured when recording begins |
| `timezoneOffsetMinutes` | integer or null | Captured with `startedAt` for relative-date resolution |
| `durationMs` | integer | `0..60000` |
| `audioReference` | string or null | Temporary private reference; cleared after transcription or cancellation |
| `transcript` | Voice Transcript or null | Cleared after save or cancellation |
| `group` | Proposal Group or null | Exists only after successful analysis |
| `errorCode` | enum or null | Safe localized code only; never provider text |

### State Transitions

```text
idle -> permission_required -> ready -> recording -> stopping -> transcribing
transcribing -> transcript_review -> analyzing -> proposal_review -> saving -> saved
permission_required -> canceled
recording -> ready                    (cancel or recoverable interruption)
transcribing/analyzing/saving -> failed -> prior recoverable state
any unsaved state -> canceled
proposal_review -> ready              (re-record after cleanup)
```

Invalid transitions are rejected without financial changes. Entering `saved` or `canceled`
clears all temporary content. Re-recording deletes any prior audio reference first.

## 2. Voice Transcript

| Field | Type | Rules |
|---|---|---|
| `text` | string | Trimmed, non-empty for analysis; editable before analysis |
| `language` | enum | `ar`, `en`, `mixed`, `unsupported` |
| `confidence` | integer | `0..100` |
| `capturedAt` | integer | Recording completion time |
| `editedByUser` | boolean | True after any user text edit |

An unsupported language or empty transcript does not create a Proposal Group. A user-edited
supported transcript may be analyzed again.

## 3. Field Assessment

Represents confidence and review requirements for one material proposal field.

| Field | Type | Rules |
|---|---|---|
| `field` | enum | `type`, `amount`, `currency`, `merchant`, `category`, `subcategory`, `payment_method`, `account`, `date`, `time`, `beneficiary`, `recurring_intent`, `obligation`, `notes` |
| `confidence` | integer | `0..100` |
| `status` | enum | `clear`, `confirm`, `missing`, `conflict` |
| `reasonCode` | string | Safe localizable reason |
| `confirmed` | boolean | Required for `confirm`; correction replaces `missing` or `conflict` |

### Confidence Mapping

- `90..100`: `clear`
- `60..89`: `confirm`
- `0..59`: `missing`
- Contradictory candidates: `conflict`, independent of score

## 4. Voice Transaction Proposal

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique within its Proposal Group |
| `type` | existing transaction type or null | Expense, income, transfer, or obligation payment |
| `amountMinor` | safe integer or null | Positive when present |
| `currencyCode` | string or null | Three uppercase letters when present |
| `merchant` | string or null | Trimmed display text |
| `categoryId` | string or null | Active category when required |
| `subcategoryId` | string or null | Active child category when present |
| `paymentMethod` | enum or null | `cash`, `card`, `transfer`, `wallet`, `apple_pay`, `google_pay`, `other` |
| `accountId` | string or null | Active funding account when selected |
| `destinationAccountId` | string or null | Required for transfer and different from source account |
| `occurredAt` | integer or null | Resolved local date/time |
| `beneficiary` | string or null | Required only when the selected transfer flow requires it |
| `recurringSuggestion` | Recurring or Obligation Suggestion or null | No effect until confirmed |
| `obligationId` | string or null | Set only after confirmed link |
| `notes` | string or null | Maximum existing transaction note length |
| `assessments` | Field Assessment[] | At most one current assessment per field |
| `selected` | boolean | Controls inclusion in group save |
| `status` | enum | `proposed`, `edited`, `ready`, `removed`, `saved` |

### Validation

- Type, amount, currency, and occurred date are always required.
- A missing analyzed account may remain unresolved during review, but the final ledger input must
  satisfy existing Core Finance account or payment-source rules. SPEC-006 does not make shared
  ledger account references nullable.
- Non-transfer items require a valid category under existing ledger rules.
- Transfers require distinct source and destination accounts and do not require a category.
- Every `confirm` assessment must be explicitly confirmed.
- Every `missing` or `conflict` assessment on a required/material field must be corrected.
- Removed or unselected proposals are excluded from save.

## 5. Proposal Group

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable operation ID for retry idempotency |
| `sessionId` | string | References one Voice Capture Session |
| `proposals` | Voice Transaction Proposal[] | `1..10` deterministic frontend limit |
| `selectedIds` | string[] | Unique IDs belonging to the group |
| `status` | enum | `reviewing`, `validating`, `saving`, `saved`, `failed`, `canceled` |
| `saveErrorCode` | string or null | Safe retryable code |

All selected proposals are prevalidated. The group then saves atomically: every selected item
becomes a confirmed `source: voice` transaction, or none does. Failure preserves the group and
selection for retry.

## 6. Category Preference

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable generated identity |
| `merchantKey` | string | Trimmed, case-folded, normalized merchant; unique |
| `merchantLabel` | string | Last user-confirmed display label |
| `categoryId` | string | Active category reference |
| `createdAt` | integer | Creation time |
| `updatedAt` | integer | Last confirmed change |

Deleting or archiving the referenced category makes the preference unavailable until the user
chooses another active category. A one-time correction never creates or updates this entity.

### Suggestion Precedence

```text
Category Preference
-> known merchant fixture
-> keyword fixture
-> smart mock suggestion
-> user selection when unresolved
```

## 7. Recurring or Obligation Suggestion

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `one_time`, `recurring`, `existing_obligation`, `new_obligation` |
| `cadence` | enum or null | `weekly`, `monthly`, or null |
| `candidateObligationIds` | string[] | Empty, one, or multiple candidates |
| `confidence` | integer | `0..100` |
| `confirmed` | boolean | False by default |

One clear candidate may be previewed, but linking still requires confirmation. Multiple
candidates require selection. New obligation details are handed to SPEC-007's confirmation flow;
SPEC-006 does not persist a second obligation model.

## 8. Atomic Voice Save Result

| Field | Type | Rules |
|---|---|---|
| `operationId` | string | Proposal Group ID; idempotent across retry |
| `transactions` | existing Transaction[] | Every item has `source: voice` |
| `affectedScopes` | string[] | Existing Home, accounts, transactions, categories, reports, and obligation scopes as applicable |
| `notificationOutcomes` | enum[] | Mock outcomes aligned by saved transaction |

No result is returned as successful until the complete ledger write commits. A repeated
successful operation ID returns the original result without duplicate transactions.

## 9. SQLite Schema Addition

Schema version 4 adds only:

```text
voice_category_preferences
- id TEXT PRIMARY KEY
- merchant_key TEXT NOT NULL UNIQUE
- merchant_label TEXT NOT NULL
- category_id TEXT NOT NULL
- created_at INTEGER NOT NULL
- updated_at INTEGER NOT NULL
- FOREIGN KEY(category_id) REFERENCES finance_categories(id)
```

Indexes beyond the unique merchant key are unnecessary for Core V1 scale.
