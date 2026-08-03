# Admin Web Feature Specification: System Health, External Providers, Jobs, and Queues

**Phase / Spec**: Phase 8 / Spec 009 of 010  
**Created**: 2026-08-01  
**Status**: Draft  
**Input**: "Read the complete masarifi-admin-dashboard-full-frontend-specification-v3-10-specs.md and create Phase 8 — Spec 009: System Health, External Providers, Jobs, and Queues."

## Phase

- **Phase**: Phase 8 — System health and background processing operations
- **Spec**: `009-admin-system-health-and-jobs`
- **Delivery position**: Ninth of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only monitoring and simulated job actions through typed mock contracts and sanitized fictional operational data

## Goal

Enable authorized Admin operators to understand platform health, distinguish
global infrastructure failures from mobile-originated impact, inspect external
provider degradation, identify queue backlogs, investigate job runs by
correlation ID, and safely simulate retrying or cancelling eligible jobs.

This phase extends the approved Admin Dashboard and Specs 001–008. It does not
connect to production monitoring, inspect real provider accounts, execute or
schedule background work, change infrastructure, expose secrets, or replace
future backend authorization and operational controls.

## Clarifications

### Session 2026-08-01

- Q: Which operational time ranges are available? → A: Use fixed relative ranges of 1 hour, 24 hours, 7 days, and 30 days; default to 24 hours.
- Q: How should operational data refresh? → A: Refresh read-only views every 60 seconds while visible, provide manual refresh, and pause automatic refresh when hidden, offline, or a job-action dialog is pending.
- Q: Who determines when a health observation is stale? → A: The contract supplies `observedAt` and `staleAt`; the frontend marks it stale at `staleAt` and shows Unknown when either timestamp is missing or invalid.
- Q: How is a retried job represented? → A: Keep the original Failed run immutable and create one linked Waiting run with attempt number incremented; Retried is a range count, not a job state.
- Q: What validation applies to retry and cancellation reasons? → A: Require 10–500 trimmed Unicode characters, store and render them as plain text, and reject control characters.

## Dependencies

- **Prior phase/specs**: Specs 001–008 MUST remain reusable and visually unchanged.
- **Existing foundation**: Reuse the Admin shell, grouped navigation,
  breadcrumbs, page headers, date and platform filters, metric cards, tables,
  charts, drawers, dialogs, confirmations, timelines, status and severity
  badges, safe structured-data preview, permission boundary, query provider,
  typed repository pattern, mock scenario controls, semantic tokens, and
  RTL/LTR behavior.
- **Cross-module references**: Spec 002 supplies overview health summaries and
  attention links. Specs 004–007 supply bounded references for payments,
  imports, AI, notifications, reports, exports, and deletion work. Spec 008
  supplies immutable audit and incident links.
- **Sequence**: This spec MUST NOT implement Admin team management, role or
  permission editing, system settings, maintenance controls, feature flags,
  global-search completion, or final release hardening assigned to Spec 010.

## Assumptions

- All services, providers, endpoints, databases, queues, jobs, incidents,
  identifiers, payload summaries, and metrics are fictional and sanitized.
- Operational views offer fixed relative ranges of 1 hour, 24 hours, 7 days,
  and 30 days and default to 24 hours. Times use the Admin application time
  zone and preserve an explicit source time zone where supplied.
- List pages default to 25 rows and allow 25, 50, or 100 rows, with 100 as the
  maximum page size.
- Health states are Operational, Degraded, Partial Outage, Major Outage,
  Maintenance, and Unknown. Every state includes text and an icon, not color alone.
- Provider and service health values are authoritative future-backend
  observations. The frontend does not derive an overall state from incomplete
  data or claim production availability. Each observation supplies valid
  `observedAt` and `staleAt` timestamps; missing or invalid freshness timestamps
  make that observation Unknown.
- Queue counters represent jobs, not customers. Completed and failed counts are
  range-bound totals; waiting, active, and delayed are point-in-time counts.
- Job states are Waiting, Active, Completed, Failed, Delayed, Cancelled, and
  Unknown. A retry is available only for a Failed job; the original run remains
  immutable and one linked fictional run begins in Waiting with its attempt
  number incremented. Retried is a selected-range count, not a job state.
  Cancellation is available only for Waiting or Delayed jobs. Completed and
  Cancelled jobs are terminal.
- Scheduled jobs are read-only in Phase 8. Their enabled state is visible, but
  schedule or enablement changes belong to future authorized backend operations.
- Search fields accept at most 120 Unicode characters. Correlation IDs and job
  IDs must match contract-provided bounded identifier formats.
- Retry and cancellation reasons require 10–500 Unicode characters after
  trimming, reject control characters, and remain plain text.
- Standard mock pages target usable content within 2 seconds and filter, sort,
  pagination, or range updates within 1 second at the 95th percentile. Explicit
  slow-response scenarios are excluded.

## Backend Alignment

### Planned Backend Modules

- `health`
- `jobs`
- `files`
- `transaction-imports`
- `ai`
- `notifications`
- `reports`
- `data-requests`
- `subscriptions`
- `payments`
- `audit-logs`

The future backend and infrastructure remain responsible for collecting and
aggregating telemetry, authenticating monitoring sources, authorizing every
view and action, controlling Redis and workers, scheduling jobs, executing
retries and cancellations, provider authentication and failover, rate limits,
secret management, incident creation, immutable audit recording, alerting,
retention, and production observability.

### Planned Entities

- `job_runs`
- `transaction_imports`
- `ai_processing_jobs`
- `notifications`
- `uploaded_files`
- `payment_events`
- `subscriptions`
- `data_export_requests`
- `account_deletion_requests`
- `exchange_rates`
- `audit_logs`

Service-health snapshots, endpoint metrics, database metrics, storage metrics,
provider observations, queue snapshots, schedules, and job-attempt timelines
are proposed read models. Their names do not authorize new database tables.
This phase creates no schema, migration, queue, worker, scheduler, provider
client, monitoring agent, credential, or backend route.

## Roles and Permissions

### Roles

- **Super Admin**: May view every Phase 8 route and perform all permitted mock
  retry and cancellation actions.
- **Security Administrator**: May view global health, provider health, queues,
  job runs, job details, schedules, safe errors, and linked incidents or audit
  evidence. May not retry or cancel jobs by default.
- **Billing Operator**: May view Stripe health and subscription-reconciliation
  jobs and may retry eligible reconciliation jobs. Other providers, queues, and
  payload summaries are excluded.
- **Parser and Import Operator**: May view import-related service indicators,
  the Imports queue, and import job details; may retry or cancel eligible import jobs.
- **AI Operator**: May view AI-provider health, the AI Processing queue, and AI
  job details; may retry or cancel eligible AI jobs.
- **Content Manager**: May view email and push provider health, the
  Notifications queue, and notification job details; may retry or cancel
  eligible notification jobs.
- **Support Agent**: May see only a safe job status projection linked to an
  authorized support ticket; no direct Phase 8 route access.

### Permission Matrix

| Capability | Proposed permission | Super Admin | Security Admin | Domain operator |
|---|---|---|---|---|
| Health overview | `system_health.read` | Allowed | Allowed | Bounded domain projection |
| API monitoring | `system_health.api.read` | Allowed | Allowed | No |
| Database monitoring | `system_health.database.read` | Allowed | Allowed | No |
| Storage monitoring | `system_health.storage.read` | Allowed | Allowed | No |
| Provider health | `system_health.providers.read` | Allowed | Allowed | Assigned providers only |
| Queue overview | `jobs.queues.read` | Allowed | Allowed | Assigned queues only |
| Job runs and details | `jobs.runs.read` | Allowed | Allowed | Assigned queues only |
| Retry eligible job | `jobs.runs.retry` | Allowed | No | Assigned queues only |
| Cancel eligible job | `jobs.runs.cancel` | Allowed | No | Assigned queues only |
| Scheduled jobs | `jobs.schedules.read` | Allowed | Allowed | Assigned schedules only |

- A missing route permission MUST show the shared access-denied state without
  protected topology, endpoint, provider, queue, job, schedule, or error fields.
- Missing action permission MUST hide the action or disable it with a clear
  reason. Direct mock mutations MUST return a safe forbidden result.
- Domain projections MUST be separate least-privilege response shapes, not full
  objects concealed only by presentation logic.
- Permission-aware UI remains a UX control; every future backend request and
  field projection MUST independently enforce authorization.

## User Scenarios and Testing

### User Story 1 — Assess Platform Health (Priority: P1)

As a Super Admin or Security Administrator, I can scan current service health,
open a degraded service, and understand its user impact without seeing secrets
or unsupported platform attribution.

**Why this priority**: Incident triage begins with a trustworthy shared picture
of affected services and stale or missing observations.

**Independent test**: Load a degraded-health scenario, identify the affected
service, inspect its current metrics and last incident, and return to the
overview with filters preserved.

**Acceptance scenarios**:

1. **Given** fresh complete observations, **When** the overview loads, **Then**
   every approved service card shows status, uptime, latency, error rate, last
   incident, and last check with units and accessible labels.
2. **Given** stale or missing observations, **When** the overview loads,
   **Then** the affected value displays Unknown or stale, includes its last
   checked time, and is never presented as zero or Operational.
3. **Given** a global database degradation, **When** the operator selects iOS
   or Android, **Then** the infrastructure state remains global while only
   attributable impact metrics change.

### User Story 2 — Diagnose API, Database, and Storage Degradation (Priority: P1)

As an authorized operator, I can review API traffic and errors, database
capacity and recovery indicators, and storage failures to narrow an incident
without receiving raw queries, payloads, paths, or customer files.

**Why this priority**: Core-service degradation can affect every downstream
workflow and must be diagnosable before provider or job-level symptoms.

**Independent test**: In a simulated partial-outage scenario, move from the
health overview to the affected monitoring page and identify the leading safe
signal and linked incident.

**Acceptance scenarios**:

1. **Given** an API latency spike, **When** API Monitoring is opened, **Then**
   request volume, error rate, latency, safe endpoint labels, and status-code
   distribution reflect the selected range.
2. **Given** a database issue, **When** Database Monitoring is opened, **Then**
   connection usage, query latency, sanitized slow-query groups, storage,
   backup, and recovery state are visible without raw query text.
3. **Given** failed uploads, **When** Storage Monitoring is opened, **Then**
   storage use, upload counts, failures, temporary-file totals, and retention
   cleanup state are visible without object names, URLs, or file contents.

### User Story 3 — Review External Provider Health (Priority: P1)

As an authorized operator, I can compare Stripe, AI, email, push, and
exchange-rate provider health and identify fallback or user-impact state
without seeing keys, tokens, raw requests, or private responses.

**Why this priority**: Provider degradation can look like an internal failure
and requires a distinct, privacy-safe operational view.

**Independent test**: Filter providers by category, open a degraded provider
summary, and identify current state, latency, error trend, last check, impact,
and fallback state.

**Acceptance scenarios**:

1. **Given** one degraded provider, **When** the provider list loads, **Then**
   the provider is distinguishable without color and its safe impact and
   fallback state are shown.
2. **Given** an AI or push observation attributed to mobile clients, **When** a
   platform filter is applied, **Then** attributable request and failure metrics
   update while the provider's global availability does not change.
3. **Given** an unavailable provider response, **When** detail cannot load,
   **Then** the page shows a safe recoverable error and does not reveal request
   payloads, credentials, internal hosts, or provider-account identifiers.

### User Story 4 — Find and Explain Queue Backlogs (Priority: P1)

As an authorized operator, I can compare queue depth and status counts, locate
a failing or delayed run, and follow its correlation ID across permitted
operational evidence.

**Why this priority**: Backlogs and repeated failures directly affect imports,
AI processing, notifications, reports, privacy requests, and reconciliation.

**Independent test**: From a queue-backlog scenario, locate the affected queue,
filter to Failed or Delayed runs, and open a job detail in under two minutes.

**Acceptance scenarios**:

1. **Given** queue data, **When** Queue Overview loads, **Then** Imports, AI
   Processing, Notifications, Reports, Data Exports, Account Deletion, and
   Subscription Reconciliation show Waiting, Active, Completed, Failed,
   Delayed, and Retried counts with snapshot or range semantics.
2. **Given** a mobile-originated queue, **When** All Platforms, iOS, or Android
   is selected, **Then** applicable volumes, failures, app-version correlation,
   import state, and notification state update without filtering global queues
   that have no platform attribution.
3. **Given** a known correlation ID, **When** the operator searches Job Runs,
   **Then** the matching authorized run can be opened without exposing an
   unauthorized run's existence.

### User Story 5 — Safely Simulate Job Recovery (Priority: P1)

As an operator with the correct queue permission, I can review a sanitized job
summary and simulate retrying a Failed job or cancelling a Waiting or Delayed
job with explicit confirmation and audit expectation.

**Why this priority**: Recovery actions are operationally important and can
duplicate processing or interrupt customer workflows if applied incorrectly.

**Independent test**: Retry an eligible fictional failure, verify a new linked
attempt appears once, then confirm a stale duplicate submission is rejected.

**Acceptance scenarios**:

1. **Given** an eligible Failed job and retry permission, **When** the operator
   confirms retry, **Then** the action locks while pending and one new linked
   fictional attempt appears with success feedback and an expected audit event.
2. **Given** a Waiting or Delayed job and cancellation permission, **When** the
   operator confirms cancellation, **Then** its consequence and scope are shown
   before one deterministic mock transition to Cancelled.
3. **Given** an Active, Completed, Cancelled, stale, or unauthorized job,
   **When** retry or cancellation is attempted, **Then** the action is absent or
   rejected with a safe explanation and refreshed current state.

### User Story 6 — Review Scheduled Processing (Priority: P2)

As an authorized operator, I can inspect scheduled job names, schedules, last
and next runs, last status, and enabled state without changing the schedule.

**Why this priority**: Schedule visibility supports incident diagnosis, while
schedule mutation is not required for this frontend phase.

**Independent test**: Find a known disabled or failed schedule and open its
last permitted run without any edit, enable, disable, or run-now control.

**Acceptance scenarios**:

1. **Given** scheduled jobs, **When** the page loads, **Then** each row shows a
   human-readable schedule, last run, next run, last status, and enabled state.
2. **Given** a schedule with no prior run or no next run, **When** it is shown,
   **Then** the absent value is labeled clearly rather than displayed as zero.
3. **Given** any role, **When** Scheduled Jobs is opened, **Then** no schedule
   editing, enablement, deletion, or run-now action is available.

## Routes

| Route | Purpose | Roles | Existing/New |
|---|---|---|---|
| `/admin/system-health` | Health overview | Super Admin, Security Administrator; bounded domain projections | Approved addition |
| `/admin/system-health/api` | API monitoring | Super Admin, Security Administrator | Approved addition |
| `/admin/system-health/database` | Database monitoring | Super Admin, Security Administrator | Approved addition |
| `/admin/system-health/storage` | Storage monitoring | Super Admin, Security Administrator | Approved addition |
| `/admin/system-health/providers` | External provider health | Super Admin, Security Administrator; assigned domain operators | Approved addition |
| `/admin/jobs/queues` | Queue overview | Super Admin, Security Administrator; assigned domain operators | Approved addition |
| `/admin/jobs/runs` | Job run explorer | Super Admin, Security Administrator; assigned domain operators | Approved addition |
| `/admin/jobs/runs/[jobRunId]` | Job run detail and eligible mock recovery | Super Admin; assigned domain operators | Approved addition |
| `/admin/jobs/scheduled` | Read-only scheduled jobs | Super Admin, Security Administrator; assigned domain operators | Approved addition |

Support-ticket and prior-module projections link to an authorized Phase 8 route
only when the current role has that route permission.

## Functional Requirements

### Shared Operational Behavior

- **FR-001**: The frontend MUST expose exactly the nine approved Phase 8 routes
  through the existing grouped Admin navigation and route permission boundary.
- **FR-002**: Every page MUST obtain data through typed services or repositories
  backed by mock HTTP contracts; pages MUST NOT import fixture arrays directly.
- **FR-003**: Every response, filter, route identifier, range, sort, search,
  pagination value, and mutation payload MUST be parsed and validated before use.
- **FR-004**: Date range, platform, service, provider, queue, job state, and
  app-version filters MUST preserve valid state in shareable normalized URLs
  and reject unsupported values safely.
- **FR-005**: Tables MUST support applicable search, filtering, sorting,
  pagination, and clear-filter behavior without mixing totals from different
  time ranges or snapshot semantics.
- **FR-006**: Status, severity, trend, staleness, and enabled state MUST use a
  text label and icon in addition to semantic color.
- **FR-007**: The UI MUST show last-observed time and source freshness for every
  health or queue snapshot and MUST distinguish zero, unavailable, partial,
  stale, and not-applicable values. The frontend MUST mark an observation stale
  when its contract-supplied `staleAt` is reached and Unknown when `observedAt`
  or `staleAt` is missing or invalid; it MUST NOT invent a local freshness threshold.
- **FR-008**: Links to incidents, audit events, providers, queues, jobs, and
  prior-module records MUST appear only when the target reference is present
  and the current role is authorized.

### Health Overview and Core Monitoring

- **FR-009**: Health Overview MUST show cards for NestJS API, Supabase Database,
  Supabase Auth, Supabase Storage, Redis, BullMQ Workers, Stripe, AI Providers,
  Email Provider, Push Providers, Exchange-Rate Provider, and Sentry.
- **FR-010**: Each health card MUST show status, uptime, latency, error rate,
  last incident, and last check with explicit units and unavailable states.
- **FR-011**: The overview MUST prioritize Critical and Major Outage states,
  then degraded or stale services, without allowing color to be the only cue.
- **FR-012**: API Monitoring MUST show request volume, error rate, latency,
  sanitized slow-endpoint groups, and status-code distribution for the selected range.
- **FR-013**: API endpoint labels MUST be normalized route patterns and MUST NOT
  contain query strings, customer identifiers, tokens, or request and response bodies.
- **FR-014**: Database Monitoring MUST show connection usage, query latency,
  sanitized slow-query groups, storage usage, backup state, and replication or
  recovery state without raw SQL, parameters, schema secrets, or connection data.
- **FR-015**: Storage Monitoring MUST show storage usage, upload count, failed
  uploads, temporary-file count, and retention-cleanup state without filenames,
  object keys, signed URLs, uploaded content, or customer identifiers.
- **FR-016**: Charts MUST provide a text summary naming selected range, unit,
  current value, notable change, and unavailable or partial series.

### External Providers

- **FR-017**: External Provider Health MUST include Stripe, configured AI
  providers, Email, Push, and Exchange Rates grouped by provider category.
- **FR-018**: Each provider summary MUST show status, latency, error rate, last
  successful operation, last check, affected capability, and fallback state
  when a fallback is contractually available.
- **FR-019**: Provider errors MUST use allowlisted safe codes and summaries;
  credentials, tokens, account identifiers, raw payloads, private AI content,
  payment data, notification bodies, and provider responses MUST be excluded.
- **FR-020**: Provider health MUST be read-only. Phase 8 MUST NOT expose API-key,
  model, fallback-priority, endpoint, webhook, or credential configuration.

### Queues and Job Runs

- **FR-021**: Queue Overview MUST include Imports, AI Processing,
  Notifications, Reports, Data Exports, Account Deletion, and Subscription
  Reconciliation.
- **FR-022**: Each queue MUST show Waiting, Active, Completed, Failed, Delayed,
  and Retried counts; counts MUST state whether they are snapshot or selected-range values.
- **FR-023**: Queue cards and tables MUST show oldest waiting age, recent
  throughput, failure rate, last processed time, and backlog or unavailable state.
- **FR-024**: Job Runs MUST show job, queue, status, attempt, start time,
  duration, safe error summary, and correlation ID with filter, sort, search,
  and pagination controls.
- **FR-025**: Job Details MUST show job name, queue, sanitized input summary,
  attempt history, timeline, safe error details, correlation ID, linked prior
  attempt, and eligible actions.
- **FR-026**: Input summaries MUST be allowlisted metadata projections and MUST
  exclude customer content, transactions, messages, files, AI prompts or
  outputs, email or push content, payment payloads, credentials, and secrets.
- **FR-027**: A retry MUST be offered only for an authorized Failed job. It MUST
  require a scope and consequence confirmation, an operator reason, current
  version, and duplicate-submission lock. It MUST preserve the original Failed
  run and create one linked Waiting run with an incremented attempt number;
  Retried MUST remain a selected-range count rather than a job state.
- **FR-028**: Cancellation MUST be offered only for an authorized Waiting or
  Delayed job. It MUST require scope and consequence confirmation, an operator
  reason, current version, and duplicate-submission lock.
- **FR-029**: Stale, conflicting, duplicate, ineligible, or already-transitioned
  mutations MUST preserve the authoritative current mock state and offer refresh.
- **FR-030**: The interface MUST describe retry duplication risk and
  cancellation impact without claiming idempotency or rollback guarantees from
  the frontend.

### Scheduled Jobs and Complete States

- **FR-031**: Scheduled Jobs MUST show job name, human-readable schedule, last
  run, next run, last status, and enabled state.
- **FR-032**: Scheduled Jobs MUST be read-only and MUST expose no create, edit,
  enable, disable, delete, or run-now action or contract.
- **FR-033**: Every route MUST implement relevant loading, empty, partial,
  stale, error, success, warning, and access-denied states.
- **FR-034**: Successful retry and cancellation outcomes MUST be announced,
  update affected job and queue views consistently, and state the expected audit event.
- **FR-035**: The existing overview attention system MUST be able to link to an
  authorized provider outage, queue backlog, failed job, or core-service issue
  without creating final cross-module notification behavior assigned to Spec 010.
- **FR-036**: Read-only operational views MUST refresh every 60 seconds while
  visible and online and MUST provide manual refresh. Automatic refresh MUST
  pause while the document is hidden, the client is offline, or a retry or
  cancellation dialog is pending, then resume with a clearly announced refresh.
- **FR-037**: Retry and cancellation reasons MUST contain 10–500 Unicode
  characters after trimming, reject control characters, and be stored,
  transmitted, audited, and rendered only as plain text.

## Platform Data Rules

- The default platform selection is **All Platforms**. **iOS** and **Android**
  apply only to observations, jobs, and failures carrying an originating-client platform.
- Mobile-attributable operational views MUST support combined volume,
  iOS-originated volume, Android-originated volume, failure rate by platform,
  app-version correlation, platform-specific import queue state, and
  platform-specific notification state.
- Infrastructure services, database health, storage capacity, Redis health,
  worker health, provider availability, queue existence, and schedules are
  global unless the contract supplies a separate attributable impact metric.
  Selecting a mobile platform MUST NOT relabel or divide global health.
- Job, request, error, and event totals may be additive only when each record has
  one originating platform. Customer-impact totals MUST use a future-backend
  deduplicated unique-customer value and MUST NOT add iOS and Android counts.
- Unknown or Unattributed may appear only when supplied by the contract. It
  remains included in All Platforms and is never assigned to iOS or Android.
- Missing platform series MUST display unavailable rather than zero. Partial
  aggregates MUST not be recomputed into a misleading combined total.
- Platform and app-version values are operational attribution, not evidence of
  unrestricted access to mobile devices, iOS notifications, SMS, or customer content.

## UX and Design Constraints

- Preserve the approved pages and Masarifi Gulf Premium Design System Version 2.1.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep Admin surfaces neutral, data-dense, professional, and operational.
- Keep financial semantic colors separate from system health and job status colors.
- Reuse existing semantic tokens, metric cards, charts, tables, drawers,
  timelines, status badges, severity badges, health indicators, queue
  indicators, and confirmation patterns before adding a missing variant.
- Health Overview MUST support rapid scanning without a decorative wall of
  cards; critical or stale conditions receive hierarchy through existing
  severity, grouping, and attention patterns.
- Durations, rates, counts, capacities, percentages, timestamps, and schedules
  MUST display explicit units and locale-aware formatting.
- Dense structured metadata MUST use the existing safe preview pattern and
  remain collapsed unless requested by an authorized operator.
- No screen may imply that mock observations or actions affect production.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, breadcrumbs, filters, cards, tables,
  drawers, dialogs, timelines, and pagination follow RTL logical order.
  Latin service names, correlation IDs, route patterns, units, and schedule
  expressions use direction isolation.
- **English LTR readiness**: Logical properties and component order mirror
  without duplicated markup or clipped operational labels.
- **1440px**: Health groups and queue summaries use a multi-column overview;
  monitoring charts, filters, and full tables remain visible.
- **1280px**: Reduce gaps and optional columns while preserving persistent
  primary filters, status context, and job actions.
- **1024px**: Collapse navigation as approved; secondary metrics move below
  primary health and queue signals; tables allow controlled horizontal scrolling.
- **768px**: Use drawer navigation, two-column or stacked summaries, a filter
  drawer, and priority table columns with detail drawers for secondary data.
- **390px**: Prioritize incidents, service status, provider outages, queue
  backlog, failed jobs, correlation ID, and eligible approval actions. Complex
  monitoring detail may show the approved desktop-required notice, but urgent
  status and permitted retry or cancellation confirmation MUST remain operable.
- No viewport may introduce page-level horizontal overflow. Wide tables may use
  a labeled internal scroll region or accessible card-list alternative.

## Accessibility

- Every route and action MUST support keyboard-only operation, visible focus,
  logical tab order, semantic headings, accessible names, and focus restoration.
- Health and job states MUST be conveyed by text and icon in addition to color,
  with WCAG-aligned contrast in light and dark themes.
- Metric groups and tables MUST expose clear headers, units, freshness, and
  snapshot or selected-range semantics to assistive technology.
- Charts MUST have an equivalent text summary and MUST not require pointer hover
  to discover values or outages.
- Retry and cancellation dialogs MUST name the job, queue, action, consequence,
  and pending state; errors and outcomes MUST be announced through accessible live feedback.
- Interactive targets MUST be at least 44px at touch viewports. Motion and
  auto-updating indicators MUST respect reduced-motion preferences and must not
  steal focus.

## Proposed API Contracts

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|---|---|---|---|---|
| GET | `/api/admin/system-health/overview` | `HealthOverviewQuery` | `HealthOverviewResponse` | Health summary |
| GET | `/api/admin/system-health/api` | `ApiMonitoringQuery` | `ApiMonitoringResponse` | API metrics |
| GET | `/api/admin/system-health/database` | `DatabaseMonitoringQuery` | `DatabaseMonitoringResponse` | Database metrics |
| GET | `/api/admin/system-health/storage` | `StorageMonitoringQuery` | `StorageMonitoringResponse` | Storage metrics |
| GET | `/api/admin/system-health/providers` | `ProviderHealthQuery` | `ProviderHealthPage` | Provider observations |
| GET | `/api/admin/jobs/queues` | `QueueOverviewQuery` | `QueueOverviewResponse` | Queue snapshots |
| GET | `/api/admin/jobs/runs` | `JobRunsQuery` | `PaginatedJobRuns` | Job history |
| GET | `/api/admin/jobs/runs/:jobRunId` | `JobRunDetailParams` | `JobRunDetail` | Job detail |
| POST | `/api/admin/jobs/runs/:jobRunId/retry` | `RetryJobRequest` | `JobMutationResult` | Authorized retry |
| POST | `/api/admin/jobs/runs/:jobRunId/cancel` | `CancelJobRequest` | `JobMutationResult` | Authorized cancellation |
| GET | `/api/admin/jobs/scheduled` | `ScheduledJobsQuery` | `ScheduledJobsPage` | Schedule visibility |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays. The paths are proposed frontend contracts;
they do not implement or prescribe production backend routes.

## Frontend Types

- **`OperationalRange`**: Approved range key, start, end, application time zone,
  and freshness cutoff.
- **`HealthStatus`**: Operational, Degraded, Partial Outage, Major Outage,
  Maintenance, or Unknown.
- **`HealthMetric`**: Label, value or unavailable state, unit, observed time,
  range or snapshot semantic, and optional safe trend.
- **`ServiceHealthSummary`**: Service key, display name, category, status,
  uptime, latency, error rate, last incident reference, last check, freshness,
  and safe impact summary.
- **`HealthOverviewResponse`**: Services, overall safe summary, range,
  freshness, partial-data indicators, and authorized attention references.
- **`ApiMonitoringResponse`**: Volume, error rate, latency series, safe endpoint
  groups, status-code distribution, range, and freshness.
- **`DatabaseMonitoringResponse`**: Connection usage, query latency, safe
  slow-query groups, storage use, backup state, recovery state, and freshness.
- **`StorageMonitoringResponse`**: Capacity, upload totals, failure totals,
  temporary-file count, cleanup state, range, and freshness.
- **`ProviderHealthSummary`**: Provider key, category, status, latency, error
  rate, last success, last check, affected capability, fallback state, and safe error code.
- **`QueueKey`**: Imports, AI Processing, Notifications, Reports, Data Exports,
  Account Deletion, or Subscription Reconciliation.
- **`QueueSnapshot`**: Queue key, job counts by state, oldest waiting age,
  throughput, failure rate, last processed time, freshness, and platform breakdown when applicable.
- **`JobRunSummary`**: Job-run ID, safe job name, queue, state, attempt, start,
  duration, safe error code and summary, correlation ID, platform, app version,
  current version, and optional `retryOfJobRunId`.
- **`JobRunDetail`**: Summary, allowlisted input metadata, attempt timeline,
  linked attempt IDs, authorized actions, and expected audit references.
- **`RetryJobRequest`**: Job-run ID, current version, bounded reason, and
  client-generated submission key.
- **`CancelJobRequest`**: Job-run ID, current version, bounded reason, and
  client-generated submission key.
- **`JobMutationResult`**: Current run, optional linked attempt, affected queue
  snapshot, safe outcome, and audit expectation.
- **`ScheduledJobSummary`**: Schedule ID, safe job name, queue, human-readable
  schedule, last run, next run, last status, enabled state, and freshness.
- **`PlatformOperationalBreakdown`**: Combined attributed total, iOS, Android,
  Unknown when supplied, metric semantic, and completeness state.
- **`OperationalApiError`**: Safe status, code, localized message, field errors,
  retryability, and correlation ID without internal details.
- Application types MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success with all services Operational and healthy queue throughput.
- Empty job history and empty scheduled-job result.
- Large paginated job history across all approved queues and states.
- Slow response with visible skeletons and no duplicate request or mutation.
- Partial response with a missing metric, platform series, provider, or queue.
- Stale health observations and Unknown status.
- API latency spike, database connection pressure, failed backup, storage
  pressure, Redis outage, and worker outage.
- Stripe, AI, Email, Push, and Exchange-Rate provider degradation with and
  without fallback availability.
- Import backlog, AI failure spike, notification delay, export failure,
  deletion blockage, and reconciliation backlog.
- Eligible retry success, eligible cancellation success, mutation failure,
  duplicate submission, stale version, ineligible state, and race conflict.
- Unauthorized, forbidden, not found, validation error, rate limited, provider
  unavailable, and safe internal error.
- iOS-only, Android-only, mixed, Unknown, global-only, and partial platform data.
- Unsafe identifiers, markup, bidirectional controls, oversized strings,
  prohibited metadata keys, secret-like values, raw payloads, and internal-path errors.

### Loading States

- Page, health-card, metric, chart, table, drawer, and dialog skeletons preserve
  layout and accessible loading announcements.
- Existing data may remain visible during a range or filter refresh with a
  clear refreshing state; stale data MUST NOT appear current.
- Retry and cancellation controls lock while pending and cannot submit twice.

### Empty States

- No job runs, no failed jobs, no scheduled jobs, no incidents for a service,
  no provider errors, and no results for current filters each provide a clear
  explanation and applicable reset action.
- Zero waiting jobs is a valid healthy value; missing queue data is unavailable,
  not an empty success state.

### Error States

- Safe recoverable states cover failed overview, monitoring, provider, queue,
  list, detail, or scheduled-job loads.
- Validation, denied, not-found, conflict, stale-version, rate-limited,
  provider-unavailable, and internal-error responses use localized safe messages
  and never expose raw exceptions or restricted record existence.
- Partial page failures preserve successful sections and label unavailable data.

### Success States

- Successful reads show freshness and selected range.
- Successful retry names the source job and new attempt without claiming
  production execution.
- Successful cancellation names the affected fictional job and updates its
  queue snapshot once.

### Warning and Confirmation States

- Stale, partial, degraded, outage, maintenance, backlog, repeated-failure, and
  fallback-active states explain their evidence and uncertainty.
- Retry confirmation states duplication and downstream-impact risk.
- Cancellation confirmation states the affected queue, job, and work that will
  not proceed in the mock scenario.

### Permission States

- Full route denial reveals no protected operational data.
- Domain operators receive only assigned provider, queue, run, schedule, and
  metadata projections.
- Action denial hides or disables the control and direct mutation returns a
  safe forbidden result.
- Session expiry clears protected query data and routes to the shared session-expired state.

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

- Read-only health, provider, queue, job, and schedule views do not require a
  per-row audit mutation but future backend access logging may apply.
- Retry expectation: `job.retry_requested`, recording operator, role, source
  job ID, queue, bounded reason, prior state, new attempt reference, result,
  timestamp, and correlation ID without payload contents.
- Cancellation expectation: `job.cancel_requested`, recording operator, role,
  job ID, queue, bounded reason, prior and resulting state, result, timestamp,
  and correlation ID without payload contents.
- Failed, forbidden, stale, and conflicting sensitive-action attempts MUST have
  an expected safe audit result.

### Privacy Rules

- Operational views MUST use aggregates and allowlisted metadata by default.
- Customer names, emails, phone numbers, financial records, transactions,
  messages, uploaded contents, AI prompts or responses, notification content,
  payment payloads, device identifiers, full IP addresses, tokens, credentials,
  provider account identifiers, internal hosts, and secrets MUST NOT appear.
- Job and provider metadata MUST use sanitized fictional values and minimum
  fields required for diagnosis. Support-ticket projections MUST not expand
  access to job input or customer data.
- URLs, screenshots, browser storage, public environment values, errors, and
  logs MUST contain no sensitive operational or customer data.

### Sensitive Actions

- Retry and cancellation require explicit permission, eligible current state,
  visible scope and consequence, a bounded reason, confirmation, pending lock,
  current-version conflict protection, safe result feedback, and an expected
  audit event.
- The mock frontend MUST NOT describe confirmations, route guards, hidden
  controls, submission keys, or client validation as sufficient production protection.

## Security Requirements

- **Untrusted inputs**: Validate and normalize route IDs, query parameters,
  ranges, filters, sorts, pagination, searches, provider and queue keys,
  correlation IDs, versions, reasons, submission keys, mock responses, and all
  operational metadata before use.
- **Safe rendering**: Render labels, safe errors, route patterns, correlation
  IDs, schedules, metadata, and provider values as plain text. Never render raw
  HTML or Markdown. Safe structured previews require allowlisted keys, bounded
  depth and length, circular-value handling, and secret-key redaction.
- **Client storage and environment**: Health observations, topology, job data,
  error details, provider metadata, customer data, credentials, tokens, secrets,
  private identifiers, and mutation reasons MUST NOT be stored in local or
  session storage, IndexedDB, URLs, public environment values, logs, or screenshots.
- **Files and links**: Phase 8 uploads and downloads no files. Storage views
  expose no object URLs or filenames. External links require allowlisted HTTPS
  destinations and, when opened in a new tab, prevention of opener access.
- **Permissions**: Navigation, route guards, response projections, visible
  controls, and mock permissions are UX controls only. Future backend operations
  require independent authorization and queue-scoped least privilege.
- **Errors and logs**: Safe errors MUST omit stack traces, internal paths, raw
  exceptions, hosts, ports, SQL, queue connection data, provider payloads,
  credentials, secrets, customer content, and unauthorized resource existence.
- **Dependencies**: No new dependency is required. Any later dependency change
  requires scoped review for necessity, maintenance, compatibility, and known vulnerabilities.
- **Security mock scenarios**: Denied, expired, invalid, unsafe-input, masked
  projection, stale, conflict, duplicate submission, ineligible transition,
  malformed metadata, secret-like value, unsafe link, and safe-error cases MUST be testable.
- **Deferred production controls**: Future NestJS, Supabase, Redis, BullMQ,
  workers, schedulers, provider integrations, and infrastructure must enforce
  authentication, authorization, telemetry integrity, secret management,
  network controls, rate limits, idempotency, cancellation semantics, safe
  retries, audit logging, alerting, retention, and incident response.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- A health observation becomes stale while open; it changes to stale or Unknown
  rather than remaining Operational.
- One service reports conflicting states from two sources; the UI shows a
  partial or Unknown state and source times instead of selecting the healthier value.
- A global provider outage has mobile-attributed failures; global availability
  remains unchanged while only the impact breakdown responds to platform filters.
- A multi-platform customer is affected through iOS and Android jobs; job counts
  may be two while the unique affected-customer total remains one.
- Platform is Unknown or absent; it remains in All Platforms and is not invented.
- A partial aggregate omits Android; the UI displays unavailable and does not
  calculate combined volume from the remaining series.
- A queue snapshot changes while a job list is open; freshness and refresh
  behavior prevent snapshot counts from being presented as exact list totals.
- A job completes while a cancellation dialog is open; the mutation returns a
  safe conflict and refreshes the terminal state.
- Two operators retry the same failed job; one linked attempt is created and
  the other submission receives current state or a safe conflict.
- A retry attempt fails immediately; it appears as a distinct linked attempt
  and does not overwrite the original failure.
- A schedule has no previous execution, an invalid next-run value, or a disabled
  state; absent or invalid values are clearly labeled and never guessed.
- A duration crosses the selected time-zone boundary or daylight change;
  absolute timestamps and durations remain internally consistent.
- A safe endpoint pattern or job name includes Arabic and Latin text;
  direction isolation prevents visual reordering.
- Metadata contains HTML, script-like text, a secret-like key, excessive depth,
  oversized content, malformed Unicode, or bidirectional controls; it is
  rejected, redacted, or omitted before display.
- The current operator loses permission while viewing detail; protected cached
  data clears and the next response shows access denied.

## Out of Scope

- Real NestJS, Supabase, database, storage, Redis, BullMQ, worker, scheduler,
  provider, Sentry, logging, monitoring, alerting, or incident integration.
- Real job execution, retry, cancellation, scheduling, enablement, deletion,
  replay, queue pause or resume, drain, purge, concurrency changes, or priority changes.
- Provider credentials, API keys, account settings, models, prompt settings,
  fallback priority, payment configuration, webhook management, or secret rotation.
- Raw SQL, query plans, request or response bodies, logs, stack traces, uploaded
  files, customer content, private AI data, payment payloads, or notification content.
- Creating or editing incidents or audit records; Spec 008 owns those views.
- Admin users, roles, permissions, system settings, maintenance mode, feature
  flags, global-search completion, and final release hardening; Spec 010 owns them.
- Production authentication, authorization, telemetry guarantees, penetration
  testing, infrastructure security, and operational service-level commitments.

## Acceptance Criteria

- **AC-001**: All nine approved routes render authorized loading, default,
  empty, partial, stale, safe-error, and access-denied states without runtime errors.
- **AC-002**: Health Overview shows all 12 approved service categories with
  status, uptime, latency, error rate, last incident, last check, freshness, and
  non-color status cues or an explicit unavailable state.
- **AC-003**: API, database, and storage monitoring expose every approved metric
  while revealing no raw query, request, response, connection, path, filename,
  object key, URL, customer value, or secret.
- **AC-004**: Provider Health covers Stripe, AI, Email, Push, and Exchange Rates
  with safe status, latency, error, freshness, impact, and fallback information.
- **AC-005**: Queue Overview covers all seven approved queues and distinguishes
  snapshot from selected-range values for all six required counters.
- **AC-006**: An authorized operator can locate a known fictional degraded
  service and its linked safe evidence in under 90 seconds.
- **AC-007**: An authorized operator can locate a known failed or delayed job by
  queue or correlation ID and open its detail in under two minutes.
- **AC-008**: Retry is available only for an authorized Failed job and creates
  exactly one linked mock attempt after confirmation; stale or duplicate
  submissions cannot create a second attempt.
- **AC-009**: Cancellation is available only for an authorized Waiting or
  Delayed job and performs exactly one confirmed mock transition to Cancelled.
- **AC-010**: Scheduled Jobs is read-only and exposes no create, edit, enable,
  disable, delete, or run-now control or contract.
- **AC-011**: All applicable operational views support All Platforms, iOS, and
  Android without dividing global infrastructure health, inventing attribution,
  or double-counting unique affected customers.
- **AC-012**: Arabic RTL and English LTR preserve logical order, readable mixed-
  direction identifiers, visible focus, keyboard completion, and 44px touch
  targets at 1440, 1280, 1024, 768, and 390 pixels.
- **AC-013**: Unsafe filters, identifiers, reasons, endpoint labels, schedules,
  metadata, and provider values are rejected, redacted, or rendered safely with
  no executable content or sensitive error detail.
- **AC-014**: Standard mock pages present usable content within 2 seconds and
  filter, sort, pagination, or range updates within 1 second at the 95th
  percentile, excluding explicitly labeled slow scenarios.
- **AC-015**: Phase 8 passes the required typecheck, lint, unit/component,
  end-to-end, production-build, responsive, accessibility, and security review
  gates without weakening prior approved behavior.

## Success Criteria

- **SC-001**: Operators identify the degraded service in under 90 seconds and
  the target failed or delayed job in under two minutes in at least 9 of 10
  verification attempts.
- **SC-002**: 100% of displayed health and queue values state their unit,
  freshness, and snapshot, selected-range, unavailable, or not-applicable semantic.
- **SC-003**: 100% of privileged mock job actions show scope, consequence,
  confirmation, pending lock, safe outcome, and audit expectation.
- **SC-004**: 100% of denied-route and denied-action scenarios return no
  protected topology, endpoint, provider, queue, job, schedule, or error data.
- **SC-005**: 100% of applicable platform totals pass event-addition and
  unique-customer-deduplication checks while global health remains unpartitioned.
- **SC-006**: 100% of automated unsafe-input and secret-like-value scenarios
  render as validation feedback, redaction, plain text, or safe unavailable
  states without executable or sensitive content.
- **SC-007**: At all five approved widths, urgent health and queue tasks remain
  operable with no page-level horizontal overflow and no state communicated by color alone.
- **SC-008**: No real telemetry source, infrastructure service, provider,
  queue, job, schedule, file, customer record, or production configuration is
  read or changed during any Phase 8 scenario.

## Verification

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Focused verification**: Run Phase 8 contract, repository, permission,
  projection, platform-attribution, freshness, metadata-safety, job-transition,
  duplicate-submission, component, route, and Playwright tests.
- **Viewport and accessibility checks**: Verify every Phase 8 route at 1440,
  1280, 1024, 768, and 390 pixels in Arabic RTL and representative English LTR;
  check keyboard operation, visible focus, focus restoration, semantic
  structure, live feedback, chart summaries, mixed-direction identifiers,
  reduced motion, 44px targets, and non-color status.
- **Security review**: Review safe operational projections, unsafe rendering,
  route and payload validation, permission denial, stale and duplicate mutation
  handling, client storage, public environment exposure, files and links, safe
  errors and logs, dependencies, fictional fixtures, privacy masking, and
  deferred backend and infrastructure protections.

Successful verification MUST NOT be claimed unless each named command was
executed successfully.
