# Data Model: Spec 006 AI Management and Automation Intelligence

This document defines frontend read models, commands, validation invariants,
relationships, and state transitions. It is not a database schema and does not
authorize backend or provider implementation.

## Shared value objects

### SafeAiId

- Bounded fictional identifier, maximum 48 characters.
- Uses an allowlisted prefix: `AIP-` provider, `AIM-` model, `AIPR-` prompt,
  `AIU-` usage, `AIF-` failure, `AIR-` report, `AIS-` safety rule, or `AIA-`
  audit reference.
- Parsed before route interpolation and URL-encoded by the repository.

### AccessLevel

- `full`: all allowlisted fields and permitted actions.
- `aggregate`: totals/trends only, with no item-level customer context.
- `context`: minimal health, safety, or linked-support context.
- `denied`: safe access-denied result.

Handlers select the projection before returning data. Protected fields are not
sent and hidden client-side.

### PlatformScope

- `all`
- `ios`
- `android`
- `unknown`, only for explicit missing attribution

Platform is request-origin reporting context. It does not select provider
fallback configuration.

### AiFeature

- `receipt_analysis`
- `screenshot_analysis`
- `voice_parsing`
- `categorization`
- `financial_assistant`
- `spending_insights`
- `budget_suggestions`
- `behavior_analysis`
- `report_explanation`

### LocaleScope

- `ar`
- `en`

### Pagination

- `page`: positive integer, bounded by the existing shared convention.
- `pageSize`: `25 | 50 | 100`; default `25`.
- `totalItems`: non-negative integer.
- `totalPages`: zero for no items; otherwise `ceil(totalItems / pageSize)`.
- Page identifiers are unique and item count never exceeds `pageSize`.

### BoundedText

- Search and names: at most 120 Unicode characters.
- Reasons/reviewer notes: at most 500 Unicode characters.
- Sanitized prompt preview: at most 4 KiB UTF-8.
- Sanitized response-report excerpt: at most 280 Unicode characters.
- Declarative safety definition: at most 8 KiB UTF-8.

### MoneyEstimate

- `amount`: non-negative decimal represented without binary floating-point
  assumptions in the contract.
- `currency`: ISO 4217 code.
- `estimated`: always `true`.
- `freshness`: timestamp with offset.
- Optional `normalizedAmount`, `normalizedCurrency`, and
  `conversionTimestamp` must appear together.

Different currencies are not summed without the complete authoritative
normalized fields.

### AuthoritativeClassification

- `value`: allowlisted classification.
- `source`: `future_backend` in production contracts and `mock_fixture` now.
- `evaluatedAt`: timestamp with offset.

Used for provider health, report severity, failure impact, action eligibility,
normalized cost availability, prompt-test outcome, and safety coverage.

### RegionState

- `available`
- `empty`
- `stale`
- `partial`
- `unavailable`
- `forbidden`

Includes a safe bounded message and retryability flag where applicable.

### ApiError

- safe HTTP status and allowlisted code
- localized bounded message
- optional bounded field errors
- optional safe correlation ID

It never contains stacks, internal paths, provider payloads, prompts,
responses, customer data, financial values, keys, tokens, or credentials.

### AuditReference

- safe fictional identifier
- event name
- timestamp with offset
- no raw or mutable audit payload

## Overview models

### AiMetric

- key and localized label
- value
- unit: `requests | attempts | failures | reports | percent | duration_ms |
  input_units | output_units | customers | estimated_cost`
- platform
- period and freshness
- authoritative denominator
- optional `MoneyEstimate`

### AiOverview

- selected period, platform, feature, provider, model, plan, and status
- total/successful/failed original requests
- retry and fallback attempt counts
- average response time
- average input/output units
- user report count
- estimated cost summaries
- feature, provider, platform, and trend series
- independent `RegionState` for metrics and each chart/table region

Invariant: original requests are counted once. Attempt and fallback totals use
separate denominators.

## Provider and model models

### AiProviderSummary

- safe provider ID and display name
- authoritative health: `healthy | degraded | partial_outage | unavailable`
- default model reference
- supported features/locales
- average latency and failure rate
- estimated cost summary
- fallback priority summaries
- rate-limit state summary
- freshness, revision, access level, and allowed actions

No credential, secret account identifier, raw header, quota token, or provider
payload is present.

### FallbackRoute

- AI feature and locale scope
- unique positive priority
- provider and model references
- compatibility state
- terminal eligibility
- enabled state

For each feature/locale chain:

1. priorities are unique;
2. no cycle exists;
3. every model supports the feature and locale;
4. at least one enabled terminal route is eligible;
5. platform is not part of the identity.

### AiProviderDetail

- `AiProviderSummary`
- model inventory
- feature/locale coverage
- safe rate-limit summary
- health, latency, error, and cost trends
- fallback routes grouped by feature/locale
- action eligibility and expected revision
- independent region states

### AiModelSummary

- safe model ID/name and provider reference
- supported features/locales
- assigned feature/locale scopes
- input limit
- estimated input/output cost
- status: `active | limited | inactive | unavailable`
- display version
- authoritative eligibility
- revision and permitted actions

One feature/locale may have several eligible fallback models but only one
primary assignment in the returned routing projection.

## Prompt models

### PromptVariable

- allowlisted variable name
- bounded description
- primitive/structured category
- required flag
- safe example only when fictional

### PromptSchemaSummary

- schema name/version
- allowlisted field names and types
- required fields
- bounded validation rules
- no executable validators or arbitrary JSON

### PromptTestCase

- safe test ID/name
- `isFictional: true`
- feature and locale
- sanitized input summary
- expected safe classification/schema outcome
- authoritative result: `passed | failed | blocked`
- required and enabled flags

### AiPromptVersionSummary

- safe prompt/version ID
- prompt name, feature, locale, and declared scope
- status: `draft | testing | active | retired`
- creator display reference and update time
- success metric
- required/enabled test totals and results
- authoritative action eligibility
- revision and allowed actions

### AiPromptVersionDetail

- `AiPromptVersionSummary`
- sanitized fictional prompt preview, maximum 4 KiB UTF-8
- allowlisted variables
- `PromptSchemaSummary`
- bounded validation rules
- immutable version history
- fictional tests
- visible omission labels

No raw customer prompt, conversation, response, provider instruction, secret,
or production-only configuration is present.

## Usage and failure models

### AiUsageRecord

- safe usage ID and original-request reference
- masked user reference
- feature, provider, model, platform, locale, and plan
- input/output units
- estimated cost and currency
- request status
- attempt and fallback counts
- occurred-at timestamp
- access level

The model contains no prompt, response, financial value, or provider payload.

### AiFailureRecord

- safe failure and original-request references
- feature, provider, model, platform, and locale
- safe error code/class
- attempt count and fallback outcome
- authoritative impact: `none | low | medium | high | critical`
- state: `open | acknowledged | assigned | resolved | escalated | reopened`
- safe correlation reference
- occurred/updated timestamps
- revision and permitted actions

## Report and safety models

### SanitizedResponseExcerpt

- supplied by the future backend, or deterministic mock equivalent
- positive allowlist only
- maximum 280 Unicode characters
- omission and masking labels
- no raw prompt, conversation, response, private financial value, personal
  data, or provider payload

Unknown fields or boundary violations invalidate the whole response projection.

### AiResponseReport

- safe report ID
- masked user reference
- feature, model, prompt version, platform, and locale
- report reason
- authoritative severity: `info | low | medium | high | critical`
- optional `SanitizedResponseExcerpt`
- status: `new | in_review | confirmed_issue | no_issue | escalated |
  duplicate | reopened`
- reviewer display reference
- created/updated timestamps
- revision and permitted actions

### SafetyCondition

- allowlisted field
- operator: `equals | contains_label | exceeds_authoritative_threshold |
  classification_in`
- bounded operand or classification list

No pattern executes code and no threshold is invented by the frontend.

### SafetyOutcome

- allowlisted outcome: `block | require_review | redact | warn | route_fallback`
- bounded safe label
- no script, network call, provider request, or dynamic expression

### AiSafetyRule

- safe rule ID/name
- feature and locale scope
- authoritative severity
- status: `draft | active | inactive | retired`
- bounded arrays of `SafetyCondition` and `SafetyOutcome`
- trigger count and last-trigger time
- required-coverage flag
- authoritative action eligibility
- revision and permitted actions

Active required coverage must remain present for every protected feature/locale
scope declared by the response.

## Command models

Every command contains:

- safe target identifier
- allowlisted action
- bounded reason
- expected state and revision
- explicit confirmation token
- optional action-specific bounded proposal

### ProviderActionRequest

Actions:

- `update_fallback`
- `activate`
- `deactivate`

Fallback proposals contain complete feature/locale routes and must satisfy all
chain invariants.

### ModelActionRequest

Actions:

- `assign`
- `unassign`
- `activate`
- `deactivate`

Assignment proposals contain only feature/locale scope.

### PromptActionRequest

Actions:

- `begin_testing`
- `activate`
- `retire`
- `rollback`

Rollback references an immutable historical version and creates a new Draft.

### FailureActionRequest

Actions:

- `acknowledge`
- `assign`
- `resolve`
- `reopen`
- `escalate`

### ReportActionRequest

Actions:

- `confirm_issue`
- `mark_no_issue`
- `escalate`
- `mark_duplicate`
- `reopen`

### SafetyRuleActionRequest

Actions:

- `save_draft`
- `activate`
- `deactivate`
- `retire`

The proposal contains only bounded declarative conditions and outcomes.

### AiActionResult

- affected safe ID
- previous and current state
- outcome: `success | rejected | conflict`
- timestamp and localized safe message
- optional safe conflict metadata
- optional created Draft ID
- planned audit reference

## Relationships

- One provider owns one or more models.
- One model belongs to one provider and supports zero or more feature/locale
  scopes.
- One feature/locale fallback chain contains one or more ordered provider/model
  routes.
- One prompt name has one or more immutable versions.
- One prompt version belongs to one feature/locale scope and has zero or more
  fictional test cases.
- One feature/locale scope has at most one Active prompt version.
- One original AI request has one usage record and one or more attempts.
- One original request may have zero or more failures and response reports.
- One response report references one model and one prompt version.
- One safety rule applies to one or more protected feature/locale scopes.
- A mutation may return one safe audit reference but never an audit payload.

## State transitions

### Provider/model

```text
active -> limited -> inactive
   \----------------> unavailable
```

Authoritative health may change independently of simulated configuration state.
All mutations require expected revision and valid coverage.

### Prompt version

```text
draft -> testing -> active -> retired
```

- Failed or changed tests may return Testing to Draft.
- Activation requires valid variables/schema and every enabled required test.
- Only one Active version exists per feature/locale.
- Rollback creates a new Draft from immutable history.

### Failure

```text
open -> acknowledged -> assigned -> resolved
  \          \------------> escalated
   \----------------------> resolved
resolved -> reopened
```

### Response report

```text
new -> in_review -> confirmed_issue
                -> no_issue
                -> escalated
                -> duplicate
confirmed_issue/no_issue/escalated/duplicate -> reopened
```

### Safety rule

```text
draft -> active -> inactive -> retired
```

Activation/deactivation must preserve required feature/locale coverage.

## Validation invariants

1. All request and response objects reject unknown fields.
2. Route identifiers are validated before URL construction.
3. Pagination follows the shared formula and page-uniqueness rules.
4. Original requests are counted once; attempts and fallbacks are separate.
5. Customer totals are authoritative and never added across platforms.
6. Unknown platform attribution is explicit and never guessed.
7. Mixed currencies remain separate unless complete authoritative normalized
   values and conversion time are present.
8. Health, severity, impact, eligibility, cost normalization, test outcomes,
   and safety coverage are authoritative values.
9. Fallback chains are per feature/locale, acyclic, compatible, uniquely
   prioritized, and retain an eligible terminal route.
10. Limited projections structurally omit protected fields.
11. Raw AI/customer/provider content never appears in a model.
12. Sanitized response excerpts are future-backend supplied and at most 280
    Unicode characters.
13. Prompt examples/tests are explicitly fictional.
14. Prompt and safety definitions contain only bounded allowlisted data.
15. Every mutation validates permission, confirmation, expected state/revision,
    action eligibility, and pending lock.
16. Prompt and safety transitions preserve scope uniqueness/coverage.
17. Mock runtime mutations never persist to browser storage.
18. Safe errors and logs contain no private data or implementation details.
