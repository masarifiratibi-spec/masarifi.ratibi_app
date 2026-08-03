# Data Model: Spec 005 Imports and Parser Management

This document defines frontend read models, commands, validation invariants, and
state transitions. It does not define a database schema or authorize backend
implementation.

## Shared value objects

### SafeId

- Bounded fictional identifier, maximum 48 characters.
- Uses an entity-specific allowlisted prefix such as `IMP-`, `IFL-`, `DUP-`,
  `FMT-`, `BNK-`, `SND-`, `PRL-`, `PTC-`, `PV-`, `MR-`, or `CR-`.
- Parsed before route interpolation and URL-encoded by the repository.

### AccessLevel

- `full`: all allowlisted fields for the route and permitted actions.
- `limited`: masked operational status without previews, parser definitions, or
  sensitive actions.
- `context`: minimal state and audit/security context only.

Handlers must select the correct projection before returning data. Components
must not receive a full record and hide fields client-side.

### PlatformScope

- `all`
- `android`
- `ios`
- `unknown`, only for an explicit data-quality bucket

### ImportSource

- `android_sms`
- `android_notification`
- `ios_shortcut`
- `ios_app_intent`
- `ios_share_extension`
- `screenshot`
- `receipt`
- `csv`
- `pdf_statement`
- `voice`
- `manual`

Each source declares its applicable platform. Incompatible source/platform
combinations are invalid.

### Pagination

- `page`: positive integer.
- `pageSize`: `25 | 50 | 100`; default `25`.
- `totalItems`: non-negative integer.
- `totalPages`: zero when `totalItems` is zero; otherwise
  `ceil(totalItems / pageSize)`.
- Page items contain unique identifiers and never exceed `pageSize`.

### BoundedText

- Search and names: maximum 120 Unicode characters.
- Reasons and internal notes: maximum 500 Unicode characters.
- Sender and rule patterns: maximum 256 Unicode characters.
- Sanitized fictional samples: maximum 4 KiB UTF-8.
- Rule definitions and expected outputs: maximum 8 KiB UTF-8 each.
- Merchant aliases: maximum 20 aliases, each at most 120 Unicode characters.

Byte limits are measured after UTF-8 encoding, not by JavaScript string length.

### ApiError

- `status`: safe HTTP status.
- `code`: allowlisted safe error code.
- `message`: localized safe message.
- `fieldErrors`: optional bounded field-to-message-list map.
- `correlationId`: optional safe opaque reference.

No stack trace, internal path, raw exception, parser detail, imported content,
secret, token, or private identifier is included.

### AuditReference

- Safe fictional audit identifier.
- Event name.
- Timestamp with offset.
- No mutable or raw audit payload.

## Import read models

### ImportMetric

- `key`
- `label`
- `value`
- `unit`: `sessions | items | failures | duplicates | unsupported | banks |
  percent | duration_ms | customers`
- `platform`
- `deduplicationState`: `authoritative | non_duplicated_events | unavailable`
- optional trend and freshness

Customer totals are authoritative and are never derived from platform segments.
Event totals may add platform counts only when `non_duplicated_events` is
explicit.

### ImportOverview

- Reporting period and freshness.
- `accessLevel`.
- Required KPIs from FR-001.
- Source distribution and source success.
- Failure trend and processing-time trend.
- Bank coverage.
- Platform distribution.
- Parser performance summary.
- Independent region state for each major section.

### ImportSessionListItem

- `id`
- masked customer reference
- source and platform
- status
- total, successful, and failed item counts
- parser version
- start time and duration
- bank label where safely available
- application version
- `accessLevel`
- permitted actions

Count invariant:

`successfulItems + failedItems <= totalItems`

The difference may represent pending/review items and must be labelled.

### SanitizedExtractionPreview

Allowlisted customer-linked fields only:

- source
- masked bank/sender
- transaction direction/type
- ISO currency
- coarse date
- masked merchant/category
- confidence
- warnings
- omission labels

Amounts and other value-bearing fields are absent or explicitly masked.
Unknown response fields invalidate the preview.

### ImportSessionDetail

- All safe list fields.
- Processing timeline.
- Item summary.
- Duplicate summary.
- Parser reference.
- Safe failure reason.
- `SanitizedExtractionPreview`, only for `full` access.
- Action eligibility and expected current state.
- Safe audit references.

Limited/context projections structurally omit the preview, parser definition,
and protected action data.

### FailedImportItem

- safe failure and import identifiers
- masked customer reference
- source, platform, bank, parser version, application version
- safe failure reason and severity
- occurrence date
- resolution state
- permitted actions

### LowConfidenceItem

- safe item/import identifiers
- backend-supplied suggested merchant/category
- confidence and review eligibility
- source/platform
- masked content summary
- current review state
- permitted outcomes:
  - `accept_suggestion`
  - `correct_merchant_category`
  - `defer`
  - `mark_unsupported`

The frontend never calculates the confidence threshold or creates/updates a
transaction.

### DuplicateCandidate

- safe candidate/import/item references
- existing-transaction metadata summary without values
- match score
- safe match reasons
- current resolution
- user-decision state
- permitted outcomes:
  - `confirm_duplicate`
  - `reject_match`
  - `defer`

### UnsupportedFormatItem

- safe format identifier
- masked sender
- bank, country, platform
- frequency
- first/last detected
- sanitized structural preview
- current state
- bank/sender assignment and rule-draft eligibility

## Parser coverage read models

### BankCoverageItem

- safe bank identifier
- Arabic/English display names
- country
- supported sources
- sender count
- active-rule count
- success rate
- last parser update
- status: `active | limited | review | unsupported`

### BankDetail

- `BankCoverageItem`
- coverage overview
- senders
- sanitized message-template summaries
- parser rules
- test results
- performance summary
- version history
- independent region states
- `accessLevel`

Limited/context projections omit sanitized samples, rule definitions, and
actions.

### SenderRule

- safe sender identifier
- sender label
- bank
- platform
- language
- bounded safe match pattern
- status: `active | inactive | review`
- last seen
- revision used for stale-state checks
- permitted actions

Patterns must be unique within their declared bank/platform/language scope and
must pass bounded safe-pattern validation.

## Parser rule models

### MatchCondition

Allowlisted fields:

- source field
- operator: `equals | contains | starts_with | safe_pattern`
- bounded operand
- case-sensitivity flag

### CaptureField

- allowlisted source segment
- normalized target field
- bounded capture selector
- required/optional flag

### NormalizationTransform

- operator: `trim | normalize_digits | normalize_currency |
  normalize_date | map_literal | lowercase_latin`
- bounded allowlisted arguments

### OutputMapping

- allowlisted normalized target field
- captured or literal source
- required/optional flag

### ParserRuleDefinition

- bounded arrays of `MatchCondition`, `CaptureField`,
  `NormalizationTransform`, and `OutputMapping`
- no unknown operation
- no arbitrary map
- no recursion
- no dynamic expression
- no script/shell/network capability
- maximum 8 KiB UTF-8 serialized form

### ParserRuleDetail

- safe rule identifier and name
- bank, sender, language, and declared scope
- priority
- version
- status: `draft | active | inactive`
- `ParserRuleDefinition`
- performance summary
- revision and last update
- permitted actions

### FictionalParserSample

- `isFictional: true`
- sanitized source type and fictional sample input
- expected normalized output
- no customer-derived identifier or content
- sample maximum 4 KiB UTF-8
- expected output maximum 8 KiB UTF-8

### ParserTestPreviewResult

- deterministic preview identifier
- explicit fictional marker
- expected output
- simulated actual output
- field differences
- pass/fail
- safe diagnostics

No real parser is executed.

### ParserTestCase

- safe test identifier and name
- source type
- `required` and `enabled`
- fictional sanitized sample summary
- expected and simulated actual output
- pass/fail
- version and rule references

### ParserVersion

- safe version identifier and display version
- declared parser scope
- status: `draft | testing | active | retired`
- released-by safe display reference
- released-at timestamp where applicable
- rule count
- required/enabled test totals and pass totals
- pass rate
- revision
- permitted actions

Only one version may be active per declared scope.

## Normalization rule models

### MerchantRule

- safe rule identifier
- canonical merchant label
- up to 20 sanitized aliases
- default category reference
- country
- priority
- scope: `global | country | bank`
- status: `active | inactive | review`
- revision and last update
- permitted actions

Aliases are unique after trim, case normalization, and Unicode normalization
within an overlapping scope.

### CategoryRule

- safe rule identifier
- bounded matching pattern
- suggested category reference
- confidence
- user-override count
- accuracy
- priority
- status: `active | inactive | review`
- revision and last update
- permitted actions

Confidence and accuracy are bounded from zero through one and are returned by
the contract.

## Command models

Every command includes:

- safe target identifier
- allowlisted action
- bounded reason
- expected state and/or revision
- explicit confirmation token
- optional action-specific allowlisted proposal

### ImportRetryHandoffRequest

- expected session state
- reason
- confirmation token

### FailedImportActionRequest

Actions:

- `retry_handoff`
- `assign_parser_issue`
- `mark_unsupported`
- `create_rule_handoff`
- `add_note`

### ConfidenceReviewRequest

Actions match `LowConfidenceItem` permitted outcomes. A correction proposal
contains only bounded merchant/category references.

### DuplicateResolutionRequest

Actions match `DuplicateCandidate` permitted outcomes.

### UnsupportedFormatActionRequest

Actions:

- `assign_bank_sender`
- `mark_unsupported`
- `create_rule_handoff`
- `defer`

### SenderActionRequest

Actions:

- `update`
- `activate`
- `deactivate`

The proposal contains only the sender fields defined above.

### ParserRuleActionRequest

Actions:

- `save_draft`
- `activate`
- `deactivate`

The proposal contains a complete bounded declarative rule.

### ParserVersionActionRequest

Actions:

- `begin_testing`
- `activate`
- `retire`
- `rollback`

Rollback references an immutable prior version and creates a new draft.

### MerchantRuleActionRequest / CategoryRuleActionRequest

Actions:

- `create`
- `update`
- `activate`
- `deactivate`

### ImportActionResult / ParserActionResult

- affected safe identifier
- previous and current state
- outcome: `success | partial | rejected | conflict`
- timestamp
- safe localized message
- optional safe conflict metadata
- optional newly created draft identifier
- planned audit reference

## Relationships

- One import session contains zero or more import items.
- One import item may have zero or more duplicate candidates.
- One import session references at most one parser version.
- One parser version contains one or more parser rules.
- One parser rule belongs to one declared scope and may reference a bank/sender.
- One bank has zero or more senders, parser rules, tests, and versions.
- One parser test case references a parser rule/version and a fictional sample.
- One merchant rule has zero to 20 aliases and one default category.
- A category rule references one suggested category.
- Import exception handoffs may reference a parser-rule draft identifier but do
  not share mutable presentation state.

## State transitions

### Import session

```text
received -> processing -> succeeded
                       -> partial -> pending_review
                       -> failed
                       -> unsupported
```

A retry handoff records a new mock outcome/reference; it does not rewrite the
original session history.

### Failed import

```text
open -> retry_handoff
     -> parser_issue_assigned
     -> unsupported
     -> rule_draft_handoff
     -> reviewed
```

### Low-confidence review

```text
pending -> accepted
        -> corrected
        -> deferred
        -> unsupported
```

### Duplicate candidate

```text
pending -> confirmed_duplicate
        -> rejected_match
        -> deferred
```

### Unsupported format

```text
detected -> assigned
         -> unsupported
         -> rule_draft_handoff
         -> deferred
```

### Parser version

```text
draft -> testing -> active -> retired
```

- Testing may return to draft after a failed/changed test set.
- Activation requires every enabled required test to pass.
- Only one active version exists per scope.
- Rollback creates a new draft from an immutable prior version.

### Sender, parser, merchant, and category rules

```text
review/draft -> active -> inactive
```

Updates require the expected revision. A stale revision returns conflict and
does not change state.

## Validation invariants

1. All request/response objects reject unknown fields.
2. Route identifiers are validated before URL construction.
3. All list pagination follows the shared pagination formula and uniqueness
   rules.
4. Combined event totals are additive only when explicitly classified as
   non-duplicated; customer totals are authoritative.
5. Full customer-linked amounts and raw imported content never appear in
   response models.
6. Parser-test values are full only for `isFictional: true` samples.
7. Limited/context projections structurally omit protected fields.
8. Declarative parser rules contain only the allowlisted bounded operations.
9. Every mutation validates permission, action, reason, confirmation,
   expected state/revision, and pending lock.
10. Parser version activation satisfies lifecycle, scope uniqueness, and
    mandatory-test invariants.
11. Runtime mutations never persist to browser storage.
12. Safe errors never include private content, implementation details, or raw
    payloads.
