# Data Model: Spec 009 System Health, External Providers, Jobs, and Queues

This is a frontend contract and read-model design. It is not a database schema
and does not authorize backend, telemetry, provider, Redis, BullMQ, worker,
scheduler, storage, monitoring, or incident infrastructure.

## Shared value objects

### OperationalRecordId

- Maximum 64 ASCII characters.
- Allowlisted fictional prefixes:
  - `SVC-`: service observation
  - `PRV-`: provider observation
  - `Q-`: queue
  - `JOB-`: job run
  - `SCH-`: scheduled job
  - `INC-`: linked incident
  - `AUD-`: planned audit reference
- Parsed before route interpolation and URL-encoded by the repository.

### OperationalRange

- `1h`
- `24h` — default
- `7d`
- `30d`

The range is a closed contract enum. Unsupported values fail validation and
fall back only through the explicit clear-filter action, never silently.

### PlatformScope

- `all`
- `ios`
- `android`
- `unknown`
- `global`

`unknown` means a mobile origin was expected but not attributed. `global`
means mobile attribution does not apply. Infrastructure health and provider
availability remain global.

### AccessProjection

- `full`: every allowlisted operational field and permitted action.
- `domain`: only assigned providers, queues, runs, schedules, and metadata.
- `linked_status`: minimum job status inside an already authorized prior route.
- `denied`: safe denial with no protected operational record fields.

Handlers choose the projection before serialization. Components never receive
a full object and hide prohibited fields afterward.

### Freshness

- `observedAt`: offset-aware timestamp.
- `staleAt`: offset-aware timestamp strictly later than `observedAt`.
- `state`: `fresh | stale | unknown`.
- Optional safe source label from an allowlist.

The future backend supplies both timestamps. At or after `staleAt`, the
frontend presents stale. Missing, invalid, or reversed timestamps produce
Unknown and never Operational by inference.

### MetricValue

- `key`: allowlisted stable key.
- `label`: localized bounded label.
- `value`: finite number or `null` when unavailable.
- `unit`: `count | percent | milliseconds | seconds | bytes | ratio`.
- `semantic`: `snapshot | selected_range`.
- `completeness`: `complete | partial | unavailable | not_applicable`.
- `freshness`: required for observed values.
- Optional bounded trend and text summary.

Zero is a valid value. `null` plus completeness/reason represents unavailable;
the frontend never substitutes zero.

### TimeSeriesPoint

- Offset-aware `at` timestamp.
- Finite numeric `value` or `null` for an unavailable point.
- Optional `platform`: `ios | android | unknown` only for attributable series.
- Points are ordered ascending and fall inside the selected range.

### PlatformOperationalBreakdown

- `total`: authoritative attributed event/job/request total.
- `ios`, `android`, and optional `unknown` non-negative counts.
- `semantic`: `events | jobs | requests | failures | unique_customers`.
- `completeness`: `complete | partial | unavailable`.

For unique customers, `total` is authoritative and deduplicated. It is never
computed from iOS plus Android. Global metrics do not use this object.

### Pagination

- `page`: positive integer.
- `pageSize`: `25 | 50 | 100`; default `25`.
- `totalItems`: non-negative integer.
- `totalPages`: zero for empty results, otherwise authoritative page count.
- A response contains at most `pageSize` records.

### SafeText

- Search: maximum 120 Unicode code points.
- Retry/cancellation reason: 10–500 Unicode code points after trimming.
- Human-readable input is normalized to Unicode NFC.
- C0/C1 controls, bidirectional override/isolate controls, invalid Unicode,
  HTML, Markdown, URLs, ANSI sequences, and script-like markup are rejected
  where not explicitly allowlisted.
- Values are fictional, bounded, and rendered as plain text.

### SafeMetadataEntry

- `key`: allowlisted ASCII key, maximum 64 characters.
- `label`: localized bounded label.
- `value`: string, number, boolean, or null rendered as text.
- String value maximum: 500 Unicode code points.
- Maximum 20 entries per job or provider detail.
- No nested object, array, URL, raw JSON, HTML, Markdown, binary, payload,
  header, credential, token, path, filename, SQL, or unknown key.

### ActionContext

- `reason`: required SafeText reason.
- `expectedVersion`: positive integer.
- `submissionKey`: fictional bounded idempotency key, maximum 64 ASCII characters.

Every action result contains resource ID, previous/current state, current
version, safe outcome, timestamp, correlation ID, and planned audit reference.

## Health domain

### HealthStatus

- `operational`
- `degraded`
- `partial_outage`
- `major_outage`
- `maintenance`
- `unknown`

The status is authoritative. Text and icon accompany semantic color.

### ServiceHealthSummary

- `id`, display name, and category.
- Authoritative `HealthStatus`.
- `uptime`, `latency`, and `errorRate` MetricValues.
- Optional safe `lastIncident` reference.
- `Freshness` and safe impact summary.
- Optional `PlatformOperationalBreakdown` for attributable impact only.

Approved service categories:

1. NestJS API
2. Supabase Database
3. Supabase Auth
4. Supabase Storage
5. Redis
6. BullMQ Workers
7. Stripe
8. AI Providers
9. Email Provider
10. Push Providers
11. Exchange-Rate Provider
12. Sentry

### HealthOverview

- Selected OperationalRange.
- Authoritative overall safe summary and partial-data indicator.
- Ordered `ServiceHealthSummary[]`, with outage/degraded/stale first.
- Safe authorized incident/attention references.
- Response-level Freshness.

The frontend does not calculate an overall health state from cards.

### EndpointGroup

- Normalized route pattern, maximum 160 characters.
- Request volume, error rate, and p95 latency metrics.
- Optional safe status-code group.
- No query string, path identifier, header, request body, response body,
  customer identifier, token, host, or port.

### ApiMonitoring

- OperationalRange and Freshness.
- Request volume, error rate, and latency summaries and series.
- Bounded safe `EndpointGroup[]`.
- Status-code distribution with authoritative denominator.
- Partial/unavailable reasons.

### SlowQueryGroup

- Safe fingerprint label, maximum 80 characters.
- Operation class: `select | insert | update | delete | maintenance | unknown`.
- Count and p95 duration metrics.
- No raw SQL, parameters, table contents, schema secret, connection string, or query plan.

### DatabaseMonitoring

- OperationalRange and Freshness.
- Connection usage, query latency, storage usage, and slow-query metrics.
- Bounded `SlowQueryGroup[]`.
- Backup state: `healthy | delayed | failed | unavailable`.
- Recovery state: `healthy | degraded | unavailable | not_applicable`.
- Safe status/incident reference and partial/unavailable reasons.

### StorageMonitoring

- OperationalRange and Freshness.
- Storage usage, upload count, failed uploads, and temporary-file count.
- Retention-cleanup state: `healthy | delayed | failed | unavailable`.
- Safe status/incident reference and partial/unavailable reasons.
- No object names, keys, buckets, filenames, signed URLs, checksums, MIME types,
  uploaded content, or customer identifiers.

## Provider domain

### ProviderCategory

- `stripe`
- `ai`
- `email`
- `push`
- `exchange_rates`

### ProviderHealthSummary

- `id`, safe display name, and ProviderCategory.
- Authoritative HealthStatus.
- Latency and error-rate MetricValues.
- Last successful operation and last check timestamps.
- Freshness.
- Bounded affected-capability labels.
- Fallback state: `active | available | unavailable | not_applicable | unknown`.
- Optional safe error code and summary.
- Optional attributable impact breakdown; availability itself remains global.
- AccessProjection and no configuration fields.

Provider credentials, account IDs, endpoints, API keys, webhook configuration,
models, fallback priorities, request/response bodies, payment data, AI content,
and notification content never appear.

## Queue and job domain

### QueueKey

- `imports`
- `ai_processing`
- `notifications`
- `reports`
- `data_exports`
- `account_deletion`
- `subscription_reconciliation`

### JobState

- `waiting`
- `active`
- `completed`
- `failed`
- `delayed`
- `cancelled`
- `unknown`

`retried` is not a JobState. It is a selected-range relationship count.

### QueueCounters

- Point-in-time: `waiting`, `active`, `delayed`.
- Selected-range: `completed`, `failed`, `retried`.
- Every counter is a non-negative integer with its semantic declared.

### QueueSnapshot

- QueueKey and localized label.
- QueueCounters.
- Oldest waiting age, recent throughput, failure rate, and last processed time.
- Freshness and authoritative backlog state.
- Optional platform/app-version impact only when origin is available.
- AccessProjection.

Queue snapshots are derived from current job state and immutable selected-range
history. They are not mutated independently.

### JobRunSummary

- `id`, safe job name, and QueueKey.
- JobState and positive attempt number.
- `startedAt`; optional `completedAt`; authoritative duration.
- Optional safe error code and bounded summary.
- Correlation ID.
- Optional `platform`: `ios | android | unknown` and safe app version.
- Positive `version`.
- Optional `retryOfJobRunId`.
- AccessProjection.

No raw input, customer reference, financial value, message, file, AI prompt or
output, notification content, payment payload, token, credential, or secret.

### JobTimelineEntry

- Allowlisted event: `queued | started | completed | failed | delayed |
  retry_requested | cancelled`.
- Offset-aware timestamp.
- Safe bounded summary.
- Optional linked attempt reference.
- Entries are ordered, monotonic, and contain no raw logs.

### JobRunDetail

- JobRunSummary.
- Maximum 20 SafeMetadataEntries from a queue-specific allowlist.
- Ordered JobTimelineEntry list.
- Linked prior/next attempt references.
- Authoritative allowed actions: `retry`, `cancel`, or none.
- Expected audit-event labels and authorized prior-module references.

### RetryJobRequest

- Job run ID.
- ActionContext.
- No target state, queue override, payload, priority, schedule, or input data.

### RetryJobResult

- Unchanged source Failed JobRunSummary.
- New linked Waiting JobRunSummary with attempt incremented by one.
- Updated QueueSnapshot.
- Safe outcome and planned `job.retry_requested` audit reference.

#### Retry transition

| Source state | Result | Rule |
|---|---|---|
| Failed | Source remains Failed; linked run begins Waiting | Permission, expected version, valid reason, and unique pending submission required |
| Any other state | No transition | Return current state or safe conflict |

Only one new attempt may be created for the same accepted submission. A second
operator or stale client receives the current result or a safe conflict.

### CancelJobRequest

- Job run ID.
- ActionContext.
- No target state, queue override, payload, or schedule data.

### CancelJobResult

- Updated Cancelled JobRunSummary.
- Updated QueueSnapshot.
- Safe outcome and planned `job.cancel_requested` audit reference.

#### Cancellation transition

| Source state | Allowed next state |
|---|---|
| Waiting | Cancelled |
| Delayed | Cancelled |
| Active | none |
| Completed | none |
| Failed | none |
| Cancelled | none |
| Unknown | none |

Cancellation increments version exactly once. It does not delete the run or
claim production rollback.

### ScheduledJobSummary

- `id`, safe job name, and QueueKey.
- Human-readable bounded schedule label.
- Optional last-run reference and timestamp.
- Optional next-run timestamp.
- Last JobState.
- `enabled` boolean.
- Freshness and AccessProjection.

Schedules are read-only. No create, edit, enable, disable, delete, or run-now
request model exists.

## Safe error model

### OperationalApiError

- HTTP status and allowlisted code.
- Localized safe message.
- Optional field errors keyed only by known request fields.
- `retryable` boolean.
- Correlation ID.
- No stack, internal path, raw exception, topology, host, port, SQL, queue
  connection, provider payload, secret, customer content, or unauthorized
  resource existence.

Required cases: unauthorized, forbidden, not found, validation, conflict,
stale version, duplicate submission, ineligible transition, rate limited,
provider unavailable, and internal error.

## Relationships

- HealthOverview contains 12 ServiceHealthSummaries and authorized incident references.
- API, Database, and Storage monitoring are sibling read models keyed by range.
- ProviderHealthSummary may link to a safe service/incident reference but not configuration.
- QueueSnapshot summarizes current JobRunSummaries and immutable selected-range history.
- JobRunDetail extends one JobRunSummary and links attempt history by ID.
- A retry creates one new JobRunSummary whose `retryOfJobRunId` points to the Failed source.
- A scheduled job may reference its last run but does not own or mutate it.
- Planned audit references align to immutable `audit_logs` owned by Spec 008/future backend.
- Domain entities such as `ai_processing_jobs`, `transaction_imports`,
  `notifications`, `data_export_requests`, and `payment_events` remain owned by
  their modules and are represented only through safe job references.

## Deterministic mock reset

- Reset restores the original sanitized JobRunSummary records and versions.
- Reset clears linked retry runs, submission locks, and mutation results.
- Reset restores deterministic job and audit counters.
- Reset restores the fixed Phase 8 clock.
- Queue snapshots are recomputed after reset.
- Tests call reset before each case; no state enters localStorage, sessionStorage,
  IndexedDB, filesystem, database, worker, provider, or network infrastructure.
