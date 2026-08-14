# Daily Money Service Contract

## Purpose

Define the typed boundary between Daily Money UI, local repositories, deterministic mock analysis, and native platform adapters. Production providers are not part of this feature. Domain shapes and transitions are defined in [data-model.md](../data-model.md).

## Contract Rules

1. Routes and components call services; they do not access SQLite, operating-system permissions, audio files, or analysis providers directly.
2. Every mutation returns a typed result containing affected entity identifiers and query scopes.
3. Expected failures use stable localization/error keys and never expose stack traces, SQL, raw SMS text, audio paths, or transcripts.
4. Commands carrying a client request id are idempotent.
5. Financial multi-entity changes are atomic.
6. Query results preserve original monetary values; estimated conversions are explicit.

## AccountService

| Operation | Input | Output | Required behavior |
|---|---|---|---|
| `listAccounts` | status/search/page | Account page and totals | Stable order; archived excluded unless requested |
| `getAccount` | account id | Account detail or not-found | Includes derived recent activity summary |
| `createAccount` | validated account draft | Account | Enforces currency/credit/default rules |
| `updateAccount` | id, expected version, changes | Account | Detects concurrent conflict |
| `archiveAccount` | id, expected version | Account | Rejects invalid new-use state; history retained |
| `restoreAccount` | id | Account | Does not silently replace current default |
| `adjustBalance` | account id, amount, reason, request id | Financial change and adjustment transaction | Requires preview/confirmation from UI |

## CategoryService

| Operation | Input | Output | Required behavior |
|---|---|---|---|
| `listCategories` | search/use/status | Category list | Locale-aware labels and hierarchy |
| `createCategory` | bilingual label, parent, icon/color | Category | Rejects invalid hierarchy and missing labels |
| `updateCategory` | id, expected version, changes | Category | Preserves system-category restrictions |
| `setFavorite` | id, favorite | Category | Idempotent |
| `archiveCategory` | id, replacement policy | Impact preview or confirmed result | Requires impact confirmation when in use |
| `mergeCategory` | source, target, request id | Merge result | Atomically reassigns current references; no cycles |

## TransactionQueryService

### TransactionQuery

- Free-text search.
- Period start/end.
- Account, category, type, source, operational status, sync status, and review-status sets.
- Minimum/maximum `MoneyValue` in one selected currency context.
- Sort by occurrence date or amount with stable id tie-break.
- Page cursor and page size.

### Operations

| Operation | Output | Required behavior |
|---|---|---|
| `listTransactions(query)` | page of date-grouped records plus next cursor | Repository-side filtering; deterministic ordering |
| `getTransaction(id)` | detail or not-found | Includes eligible actions and related records |
| `getHomeSummary(period, reportingCurrency)` | HomeSummary | Derived; never a second owner of balances |
| `getAccountSummary(accountId, period)` | account summary | Uses transaction semantics, not amount sign alone |
| `getFilterOptions()` | available choices and counts | Excludes inaccessible/archived choices where appropriate |

## TransactionCommandService

| Operation | Input | Output | Trust behavior |
|---|---|---|---|
| `previewCreate` | transaction draft | exact effects or validation issues | No write |
| `create` | valid draft, request id | transaction + financial change | Manual may save pending sync offline |
| `previewUpdate` | id, expected version, changes | before/after effects | No write |
| `update` | confirmed preview token, request id | transaction + financial change | Atomic; invalidates related summaries |
| `delete` | id, expected version, confirmation, request id | lifecycle result + financial change | Soft delete; preserves relationship history |
| `duplicateAsDraft` | transaction id | TransactionDraft | No financial write |
| `previewTransfer` | transfer draft | source, destination, fee, conversion effects | Rejects same account or unavailable estimate |
| `createTransfer` | confirmed preview token, request id | linked transfer records + financial change | One atomic mutation |
| `previewRefundOrReversal` | original id, amount, type | relationship/effect preview | Prevents unsupported duplicate/over-refund |
| `createRefundOrReversal` | confirmed preview token, request id | linked record + financial change | Never classified as salary/income |
| `undoChange` | financial-change id | restored entities + status | Idempotent while eligible |
| `reportIncorrect` | transaction id, reason key | acknowledgement | No automatic silent correction |

## DraftService

| Operation | Behavior |
|---|---|
| `saveDraft` | Upserts meaningful validated or partially valid input locally |
| `loadDraft` | Restores the last active draft for its flow |
| `discardDraft` | Requires the UI's explicit discard confirmation token |
| `markSaved` | Links draft to created transaction, then removes draft payload safely |

## DetectionService

| Operation | Input | Output | Required behavior |
|---|---|---|---|
| `ingestMockDetection` | synthetic evidence, source reference | DetectedItem | Idempotent; never directly writes ledger |
| `analyzeDetection` | detected item id | classified DetectedItem | Clear/review/rejected/failed with reasons |
| `findDuplicateCandidates` | detected item id | ranked transaction references and reason codes | No automatic merge |
| `applyClearDetection` | clear item id, request id | transaction + financial change | Exposes edit/undo/view |
| `retryDetection` | failed item id | DetectedItem | Safe repeat with same source identity |
| `ignoreDetection` | eligible item id | terminal result | No ledger mutation |

Excluded patterns include OTP, failure-only messages, unsupported currency, multiple unresolved amounts, and repeated source references.

## ReviewService

| Operation | Behavior |
|---|---|
| `listReviewItems` | Returns pending items with reason, candidates, and safe evidence preview |
| `getReviewItem` | Returns one item plus valid context-specific actions |
| `previewResolution` | Returns exact before/after result without writing |
| `resolveReviewItem` | Applies a confirmed valid resolution atomically and records outcome |
| `retryResolution` | Retries a failed resolution without creating duplicate records |

`resolveReviewItem` accepts only actions valid for the item's reason set. Duplicate actions distinguish keep existing, keep new, keep both, and merge.

## TrackingService

| Operation | Platform behavior |
|---|---|
| `getStatus` | Android returns permission + service status; iOS returns direct SMS unavailable with alternatives |
| `enable` | Android only after education/consent and granted permission |
| `pause` / `resume` | Android tracking service state only; manual/voice unaffected |
| `openPermissionRecovery` | Delegates to current platform permission adapter |
| `runDemo` | Uses synthetic evidence and the normal detection pipeline |
| `listKeywords` / `updateKeywords` | Extends established onboarding preference owner |

No operation claims that operating-system permission is limited to keyword-matched messages.

## AudioRecordingService

Native adapter contract; no background recording.

| Operation | Output / behavior |
|---|---|
| `getPermissionStatus` | Shared permission status |
| `requestPermission` | Native permission result; no repeated prompt after permanent denial |
| `prepare` | Ready or safe localized failure |
| `start` | Session reference; foreground recording only |
| `getStatus` | Recording flag, duration, optional metering, interruption flag |
| `stop` | Cache URI and duration |
| `cancel` | Stops and deletes cache file |
| `deleteRecording` | Idempotently removes cache file |

Audio URI and native errors never enter analytics or user-visible raw errors.

## VoiceAnalysisService

Deterministic mock boundary.

| Operation | Output | Required behavior |
|---|---|---|
| `transcribe(sessionReference)` | transcript or typed safe failure | No network/provider call |
| `analyze(transcript)` | one or more VoiceProposals | Covers clear, missing, low confidence, multiple, income, transfer, obligation, and failure fixtures |
| `previewConfirmation(proposalIds)` | exact financial effects or validation issues | No write |
| `confirmProposals(previewToken, requestId)` | transactions + financial changes | Explicit user confirmation required; atomic per confirmed set |

After cancel, failure, re-record, or successful confirmation, the caller MUST request audio deletion. Transcript retention follows conversation/draft privacy rules and is never included in logs.

## Error Contract

| Error family | Example keys | UI obligation |
|---|---|---|
| Validation | `dailyMoney.validation.amountRequired`, `sameTransferAccount` | Preserve draft; focus field |
| Not found/archived | `dailyMoney.error.accountUnavailable` | Refresh choices; retain input |
| Conflict | `dailyMoney.sync.conflict` | Show current vs draft; offer safe resolution |
| Offline | `dailyMoney.offline.savedPending`, `operationUnavailable` | Save eligible manual drafts; explain unavailable operation |
| Permission | `dailyMoney.permission.microphoneDenied`, `smsPermanentlyDenied` | State-specific recovery and fallback |
| Analysis | `dailyMoney.capture.unclear`, `noSpeech`, `unsupportedLanguage` | Retry/re-record/manual fallback |
| Financial rule | `dailyMoney.transfer.sameAccount`, `refund.exceedsOriginal` | Explain exact constraint; no partial write |
| Unknown | `dailyMoney.error.tryAgain` | Safe generic message plus retry; raw error retained only in protected development diagnostics |

## Query Invalidation Contract

Successful financial mutations invalidate or update exactly the affected scopes:

- Transaction list/detail.
- Source and destination account detail/summary.
- Home summary.
- Review count and detail.
- Companion budget, obligation, report, and assistant read models when relevant.

Failed, rejected, previewed, or cancelled operations MUST NOT invalidate financial totals as if a change occurred.

