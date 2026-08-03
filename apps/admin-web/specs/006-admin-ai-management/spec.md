# Admin Web Feature Specification: AI Management and Automation Intelligence

**Phase / Spec**: Phase 5 / Spec 006 of 010  
**Created**: 2026-07-29  
**Status**: Draft  
**Input**: "Read the complete masarifi-admin-dashboard-full-frontend-specification-v3-10-specs.md and create Phase 5 - Spec 006: AI Management and Automation Intelligence."

## Phase

- **Phase**: Phase 5 - AI operations and automation intelligence
- **Spec**: `006-admin-ai-management`
- **Delivery position**: Sixth of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only AI operations using proposed typed mock contracts and sanitized fictional data

## Goal

Enable authorized Admin operators to monitor AI request volume, reliability,
latency, estimated cost, provider fallback, model and prompt assignments,
failures, user-reported responses, and safety-rule activity without exposing
private customer conversations, raw financial data, provider secrets, or real
AI operations.

This phase extends the approved Admin Dashboard and completed Specs 001-005. It
does not call an AI provider, execute a prompt, change production routing,
process customer content, manage real credentials, or implement backend jobs.

## Clarifications

### Session 2026-07-29

- Q: What AI response content may reach the Admin frontend for a user report? -> A: Only a future-backend-sanitized, allowlisted excerpt of at most 280 Unicode characters; raw prompts, conversations, and responses never reach the frontend.
- Q: At what scope is provider fallback configured? -> A: Per AI feature and locale, independent of mobile platform, with at least one eligible terminal provider/model route.
- Q: Which layer determines provider health, report severity, user impact, action eligibility, and normalized cost? -> A: The future backend returns authoritative classifications and values; the frontend validates and presents them without deriving production thresholds.
- Q: What responsiveness target applies to standard mock scenarios? -> A: 95% of overview/detail loads show usable content within 2 seconds and 95% of filter, sort, or pagination updates complete within 1 second; labeled slow scenarios are excluded.

## Dependencies

- **Prior phase/specs**: Specs 001-005 MUST remain complete and reusable.
- **Existing routes/components/tokens/assets**: Reuse the Admin shell,
  navigation, page headers, breadcrumbs, platform and date filters, metric
  cards, charts, tables, drawers, dialogs, confirmations, permission boundary,
  masked fields, typed API client, query provider, repository pattern,
  mock-scenario controls, semantic tokens, RTL behavior, and approved identity.
- **Cross-module summaries**: Spec 002 AI usage and provider-health summaries
  remain the overview reference; Spec 004 plan context supplies AI allowance
  labels; Spec 005 receipt, screenshot, voice, and categorization sources
  supply sanitized feature attribution only.
- **Sequence**: Spec 006 MUST NOT implement support/content/notifications,
  security/audit exploration, system-health/jobs, data requests, admin-team
  governance, settings, or final hardening from Specs 007-010.

## Assumptions

- All providers, models, prompts, users, usage records, failures, reports,
  safety events, and costs are fictional and sanitized.
- The default reporting period is the last 30 calendar days in the Admin
  application time zone, with 7-day and 90-day options.
- Usage lists default to 25 rows and allow 25, 50, or 100, with 100 maximum.
- Search and display-name inputs are limited to 120 Unicode characters;
  reviewer notes and change reasons to 500; sanitized prompt previews to 4 KiB;
  sanitized response previews to 2 KiB; and declarative safety-rule definitions
  to 8 KiB.
- Request counts represent unique AI processing requests. A retry attempt is
  shown separately and MUST NOT inflate the authoritative request total.
- All-platform request totals may add iOS and Android counts only when every
  request has one originating-platform attribution. Unknown attribution remains
  a visible data-quality category and is included only in the authoritative
  total returned by the contract.
- Cost is an estimate, identified by currency and freshness. Values in
  different currencies are not added unless the contract supplies an
  authoritative normalized total and rate timestamp.
- Provider health, report severity, failure impact, action eligibility, and
  normalized cost are authoritative future-backend values. Mock fixtures
  simulate them; the frontend does not derive production classifications from
  local thresholds.
- Prompt lifecycle is Draft, Testing, Active, and Retired. One prompt version
  may be Active per feature/locale scope. Rollback creates a new Draft from a
  historical version rather than mutating history.
- Provider fallback, model assignment, prompt activation/rollback, report
  review, and safety-rule changes are mock-only decisions that reset with the
  mock scenario or development runtime.
- Provider fallback chains are scoped by AI feature and locale, not iOS or
  Android, and require at least one eligible terminal provider/model route.
- Prompt and safety previews are bounded declarative data, never executable
  code or a mechanism for sending a real provider request.
- User-report excerpts are sanitized by the future backend using an allowlist,
  limited to 280 Unicode characters, and rejected by frontend contract
  validation if the boundary is violated.
- Standard mock scenarios target usable overview/detail content within 2
  seconds and filter, sort, or pagination updates within 1 second at the 95th
  percentile. Explicitly labeled slow-response scenarios are excluded.

## Backend Alignment

### Planned Backend Modules

- `ai-gateway`
- `ai-providers`
- `ai-models`
- `ai-prompts`
- `ai-usage`
- `ai-processing-jobs`
- `ai-safety`
- `users`
- `profiles`
- `devices`
- `subscriptions`
- `roles`
- `permissions`
- `audit-logs`

The future backend remains responsible for authorization, provider credentials,
prompt storage, model routing, rate limits, request execution, usage metering,
cost calculation, retries, fallback, safety enforcement, retention, immutable
auditing, and production monitoring.

### Planned Entities

- `ai_providers`
- `ai_models`
- `ai_prompt_versions`
- `ai_feature_assignments`
- `ai_usage_records`
- `ai_processing_jobs`
- `ai_failures`
- `ai_response_reports`
- `ai_safety_rules`
- `ai_safety_events`
- `users`
- `profiles`
- `devices`
- `subscriptions`
- `roles`
- `permissions`
- `audit_logs`

Names are alignment references only. This phase creates no schema, migration,
provider account, credential, queue, job, database query, or backend endpoint.

## Roles and Permissions

### Roles

- **Super Admin**: May view all routes and perform every simulated AI
  management action.
- **AI Operator**: Primary role for monitoring, provider/model/prompt
  operations, failure triage, response-report review, and safety-rule review.
- **Support Agent**: May view a limited, masked response report linked to a
  support case; cannot view prompt text, usage detail, or configuration.
- **Security Administrator**: May view safety incidents and severe reports in
  masked form; may not alter provider, model, or prompt configuration by
  default.
- **Billing Operator**: May view aggregate estimated cost by plan and period;
  cannot view user-level AI content or configuration.
- **Parser and Import Operator**: May view aggregate AI fallback attribution
  for import features only; cannot access AI management routes by default.
- **Content Manager**: No Phase 5 access by default.

### Permission Matrix

| Capability | Proposed permission | Super Admin | AI Operator | Support Agent | Security Admin | Billing Operator |
|------------|---------------------|-------------|-------------|---------------|----------------|------------------|
| AI overview | `ai.overview.read` | Allowed | Allowed | No | Safety summary | Cost summary |
| Provider details | `ai.providers.read` | Allowed | Allowed | No | Health only | Cost only |
| Provider fallback changes | `ai.providers.manage` | Allowed | Allowed | No | No | No |
| Model inventory | `ai.models.read` | Allowed | Allowed | No | No | Cost only |
| Model assignment/status changes | `ai.models.manage` | Allowed | Allowed | No | No | No |
| Prompt versions and detail | `ai.prompts.read` | Allowed | Allowed | No | No | No |
| Prompt lifecycle changes | `ai.prompts.manage` | Allowed | Allowed | No | No | No |
| Usage detail | `ai.usage.read` | Allowed | Allowed | No | Aggregate only | Aggregate only |
| Failure triage | `ai.failures.manage` | Allowed | Allowed | No | Severe only | No |
| Response-report review | `ai.reports.manage` | Allowed | Allowed | Linked masked report | Severe only | No |
| Safety-rule review | `ai.safety.read` | Allowed | Allowed | No | Allowed | No |
| Safety-rule changes | `ai.safety.manage` | Allowed | Allowed | No | Review only | No |

- Missing route permission MUST render the shared access-denied state without
  provider, prompt, customer, usage, cost, failure, report, or safety details.
- Missing action permission MUST hide the action or disable it with a clear
  reason. Direct mock mutation attempts MUST return a safe forbidden result.
- Permission-aware UI is development-only UX simulation, not production
  authorization.

## User Scenarios and Testing

### User Story 1 - Monitor AI Operations (Priority: P1)

An AI Operator reviews request volume, success, failure, estimated cost,
latency, units, reports, fallback usage, feature distribution, platform
distribution, and freshness, then opens the relevant operational queue.

**Why this priority**: Operators need one trustworthy view of reliability,
cost, and customer impact before changing configuration.

**Independent test**: From `/admin/ai`, an authorized operator can identify the
highest-impact feature or provider and open the matching filtered records in
under 90 seconds without viewing private content.

**Acceptance scenarios**:

1. **Given** All Platforms and a reporting period, **When** the overview loads,
   **Then** total, successful, failed, estimated-cost, average-response-time,
   average-unit, report, and fallback metrics show units and freshness.
2. **Given** iOS or Android is selected, **When** attributed metrics update,
   **Then** feature usage, cost, failures, response time, and reports reflect
   that origin and retain the active period.
3. **Given** a retry or fallback attempt, **When** totals are displayed,
   **Then** the original request is counted once and attempts are labeled
   separately.
4. **Given** one overview region is unavailable, **When** other data succeeds,
   **Then** available regions remain usable and the failed region shows a safe
   partial state.

### User Story 2 - Review Providers and Models (Priority: P1)

An AI Operator compares provider health, latency, failure rate, cost, supported
features, models, rate-limit state, and fallback order, then safely simulates an
eligible provider or model configuration change.

**Why this priority**: Provider reliability and routing determine service
continuity, customer impact, and cost.

**Independent test**: An operator can open a provider, understand its model and
fallback coverage, and confirm a mock configuration change without exposing a
credential or making a real provider call.

**Acceptance scenarios**:

1. **Given** the provider list, **When** it loads, **Then** provider, status,
   default model, features, latency, failure rate, cost estimate, and fallback
   priority are visible with freshness.
2. **Given** a provider detail, **When** the operator opens it, **Then** models,
   supported features, safe rate-limit summary, health, latency, error trend,
   cost trend, and fallback configuration appear without keys or raw payloads.
3. **Given** an invalid fallback chain with no eligible terminal provider, a
   duplicate priority, a cycle, or an unsupported feature/model assignment,
   **When** save is attempted, **Then** validation blocks the mock change.
4. **Given** a valid, permitted change, **When** the operator confirms it,
   **Then** the UI shows scope, consequence, previous/proposed state, mock-only
   boundary, pending lock, result, and planned audit reference.

### User Story 3 - Govern Prompt Versions (Priority: P1)

An AI Operator reviews prompt versions, sanitized prompt detail, variables,
output schema, validation rules, history, test cases, and success metric, then
simulates activation, retirement, or rollback.

**Why this priority**: Prompt changes can alter financial guidance quality and
must remain reviewable, reversible, and privacy-safe.

**Independent test**: A prompt version can be evaluated and moved through the
mock lifecycle only when required tests and scope rules pass.

**Acceptance scenarios**:

1. **Given** prompt versions, **When** the list is filtered by feature, locale,
   status, or author, **Then** name, feature, version, status, creator, update
   time, success metric, and action eligibility are visible.
2. **Given** prompt detail, **When** it renders, **Then** only the sanitized
   system-prompt preview, allowlisted variables, output schema summary,
   validation rules, version history, and fictional test cases appear.
3. **Given** missing required variables, invalid schema, failing required
   tests, unsafe markup, private sample data, or a stale version, **When**
   activation is attempted, **Then** the action is blocked with safe guidance.
4. **Given** an eligible historical version, **When** rollback is confirmed,
   **Then** a new Draft is simulated and historical versions remain unchanged.

### User Story 4 - Analyze Usage, Cost, and Failures (Priority: P1)

An AI Operator filters usage by feature, provider, model, plan, platform, date,
and status, then investigates failures and fallback impact using safe metadata.

**Why this priority**: Operational decisions require traceable denominators and
cost/reliability context without exposing request content.

**Independent test**: Usage and failure records can be filtered, sorted,
paginated, and opened while all customer references and content remain masked.

**Acceptance scenarios**:

1. **Given** usage records, **When** filters change, **Then** masked user,
   feature, provider, model, input/output units, estimated cost, currency,
   status, platform, and time update with reversible active filters.
2. **Given** multiple currencies, **When** cost totals are shown, **Then** they
   remain separate unless an authoritative normalized total and rate timestamp
   are supplied.
3. **Given** a failure, **When** detail opens, **Then** feature, provider,
   model, safe error classification, attempts, fallback result, user-impact
   class, resolution state, and correlation reference are visible.
4. **Given** stale, already-resolved, forbidden, or duplicate triage, **When**
   an action is submitted, **Then** no false success is shown and refresh or
   permission guidance is provided.

### User Story 5 - Review Reports and Safety Rules (Priority: P1)

An AI Operator reviews user-reported AI responses and safety-rule activity,
records a disposition, and simulates safe rule-state changes.

**Why this priority**: User harm and financial-guidance risk require prompt,
masked, and auditable review.

**Independent test**: A seeded severe report can be reviewed and linked to the
responsible feature/model/prompt version without exposing the raw conversation.

**Acceptance scenarios**:

1. **Given** response reports, **When** the queue loads, **Then** report ID,
   masked user, feature, reason, severity, sanitized excerpt, model, prompt
   version, platform, status, and reviewer are visible.
2. **Given** a report, **When** an operator records confirmed issue, no issue,
   escalation, or duplicate, **Then** a reason and confirmation are required
   and the previous/current states remain visible.
3. **Given** safety rules, **When** the list loads, **Then** rule, feature,
   severity, status, trigger count, last trigger, and freshness are visible.
4. **Given** a rule change that would leave a protected feature without a
   required active rule, contains an unsupported operation, or is stale,
   **When** save is attempted, **Then** the mock action is blocked.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/admin/ai` | AI overview | Super Admin, AI Operator; limited summaries by permission | Approved addition |
| `/admin/ai/providers` | Provider comparison | Super Admin, AI Operator | Approved addition |
| `/admin/ai/providers/[providerId]` | Provider detail and fallback configuration | Super Admin, AI Operator | Approved addition |
| `/admin/ai/models` | Model inventory and feature assignments | Super Admin, AI Operator | Approved addition |
| `/admin/ai/prompts` | Prompt version list | Super Admin, AI Operator | Approved addition |
| `/admin/ai/prompts/[promptId]` | Prompt detail, tests, history, and lifecycle | Super Admin, AI Operator | Approved addition |
| `/admin/ai/usage` | Usage and estimated-cost explorer | Super Admin, AI Operator; aggregate views by permission | Approved addition |
| `/admin/ai/failures` | Failure and fallback triage | Super Admin, AI Operator; severe context by permission | Approved addition |
| `/admin/ai/reports` | User-reported response review | Super Admin, AI Operator; linked masked report by permission | Approved addition |
| `/admin/ai/safety-rules` | Safety rule status and simulated management | Super Admin, AI Operator; Security Administrator read | Approved addition |

## Functional Requirements

### Shared Behavior

- **FR-001**: Every Phase 5 route MUST use the approved Admin shell, navigation,
  Arabic RTL defaults, semantic tokens, shared states, and existing interaction
  patterns without redesigning approved pages.
- **FR-002**: Pages MUST obtain data through typed hooks and service/repository
  contracts and MUST NOT import raw fixture arrays.
- **FR-003**: Every list MUST support applicable search, filters, sorting,
  pagination, URL-safe state, reset, and active-filter visibility.
- **FR-004**: Route identifiers, filters, sort keys, dates, pagination,
  mutation payloads, and mock responses MUST be bounded and validated before
  use.
- **FR-005**: Metrics MUST state denominator, unit, reporting period, currency
  where applicable, attribution, and freshness.
- **FR-005a**: Provider health, report severity, failure impact, action
  eligibility, and normalized cost MUST be validated contract values and MUST
  NOT be inferred from frontend-only thresholds.
- **FR-006**: The UI MUST distinguish original requests, attempts, retries,
  fallbacks, failures, reports, and users; labels MUST not imply they share a
  denominator.
- **FR-007**: Every sensitive mutation MUST show scope, consequence,
  previous/proposed state, required permission, mock-only notice, expected
  audit event, confirmation, pending lock, and safe outcome.

### AI Overview

- **FR-008**: AI Overview MUST show total requests, successful requests, failed
  requests, estimated cost, average response time, average input/output units,
  user reports, and fallback usage.
- **FR-009**: AI Overview MUST show feature distribution for receipt analysis,
  screenshot analysis, voice parsing, categorization, financial assistant,
  spending insights, budget suggestions, behavior analysis, and report
  explanation.
- **FR-010**: Overview trends MUST support feature, provider, plan, platform,
  and reporting-period context where attribution exists.
- **FR-011**: A partial overview response MUST preserve usable regions and
  identify unavailable regions without fabricating zero values.

### Providers and Models

- **FR-012**: Providers MUST show provider, operational status, default model,
  supported features, latency, failure rate, estimated cost, fallback priority,
  and freshness.
- **FR-013**: Provider Details MUST show models, supported features, safe
  rate-limit state, health, latency/error/cost trends, and fallback
  configuration without credentials or raw provider responses.
- **FR-014**: Fallback editing MUST reject cycles, duplicate priorities,
  unavailable or incompatible assignments, empty required chains, and stale
  state.
- **FR-014a**: Each fallback chain MUST be identified by AI feature and locale,
  MUST remain independent of originating mobile platform, and MUST retain at
  least one eligible terminal provider/model route.
- **FR-015**: Models MUST show model, provider, feature assignment, input limit,
  cost estimate, status, version, and assignment eligibility.
- **FR-016**: Model changes MUST not be presented as deployed or production
  effective; they are simulated configuration decisions only.

### Prompt Management

- **FR-017**: Prompt Versions MUST show prompt name, feature, locale/scope,
  version, status, creator, updated time, success metric, and eligible actions.
- **FR-018**: Prompt Detail MUST show a sanitized system-prompt preview,
  allowlisted variables, output-schema summary, validation rules, immutable
  version history, and fictional test cases.
- **FR-019**: Prompt content, variables, schemas, and examples MUST render as
  plain text or safe structured fields, never executable or raw HTML.
- **FR-020**: Prompt activation MUST require the allowed lifecycle transition,
  valid scope, valid variables/schema, and all required tests passing.
- **FR-021**: Prompt rollback MUST create a new Draft from a selected historical
  version and MUST NOT alter immutable history.

### Usage, Failures, Reports, and Safety

- **FR-022**: AI Usage MUST filter by feature, provider, model, plan, platform,
  date, and status.
- **FR-023**: Usage rows MUST show a masked user reference, feature, provider,
  model, input/output units, estimated cost and currency, status, platform, and
  time without request or response content.
- **FR-024**: Cost totals MUST not combine currencies without an authoritative
  normalized amount and conversion timestamp.
- **FR-025**: AI Failures MUST show feature, provider, model, safe error class,
  attempt count, fallback result, user-impact class, resolution state, time,
  and safe correlation reference.
- **FR-026**: Failure triage MUST support simulated acknowledge, assign,
  resolve, reopen, and escalate outcomes according to permission.
- **FR-027**: Response Reports MUST show report ID, masked user, feature,
  reason, severity, sanitized excerpt, model, prompt version, platform, status,
  reviewer, and time.
- **FR-027a**: The sanitized excerpt MUST be supplied by the future backend,
  contain at most 280 Unicode characters, pass the allowlisted response
  contract, and never be derived from raw prompt, conversation, or response
  content in the frontend.
- **FR-028**: Response-report review MUST support confirmed issue, no issue,
  escalate, duplicate, and reopen outcomes with reason and stale-state checks.
- **FR-029**: Safety Rules MUST show rule, feature, severity, status, trigger
  count, last-trigger time, version, and action eligibility.
- **FR-030**: Safety-rule definitions MUST allow only documented declarative
  conditions and outcomes; scripts, dynamic evaluation, network actions, and
  arbitrary code are prohibited.
- **FR-031**: Safety-rule changes MUST reject unsupported operations, invalid
  severity/status, conflicting scope, unsafe gaps in required coverage, and
  stale state.
- **FR-032**: No default view, filter, URL, error, fixture, log, screenshot, or
  test MUST expose a raw AI conversation, user prompt, full response, private
  financial value, provider payload, API key, token, or credential.

## Platform Data Rules

- All relevant routes MUST default to **All Platforms** and offer **iOS** and
  **Android** when originating-client attribution exists.
- Overview, usage, failure, report, feature, cost, and response-time views MUST
  show combined, iOS, and Android values where supported.
- A request generated by backend-only automation without a client origin MUST
  be labeled `Unknown` or `Unattributed`; it MUST not be guessed as iOS or
  Android.
- The authoritative All Platforms total MUST be returned by the contract.
  Frontend code MUST not infer it by adding displayed platform rows when
  unknown attribution, replay, retry, or duplicate records may exist.
- Request counts are event counts. Customer counts, when shown, MUST be
  deduplicated across iOS and Android and MUST not equal the sum of platform
  customer counts.
- One request with several provider attempts counts once as a request; attempts
  and fallback usage use separate metrics.
- Cost by platform is request-origin attribution, not device billing, and MUST
  not duplicate one request across platforms.
- Platform attribution is reporting context only and MUST NOT create separate
  provider fallback chains for iOS and Android.
- Platform filters MUST preserve feature, provider, model, plan, status, date,
  sorting, and pagination context where valid.

## UX and Design Constraints

- Preserve Masarifi Gulf Premium Design System Version 2.1 and all approved
  pages.
- Keep deep teal primary, bronze limited to approximately 2%-3%, and Admin
  surfaces neutral, data-dense, professional, and operational.
- Separate financial cost semantics, provider health, safety severity, report
  status, and model/prompt lifecycle semantics.
- Reuse existing metric, chart, table, badge, filter, drawer, dialog, timeline,
  JSON preview, masked-field, and confirmation patterns before adding variants.
- Never represent a provider status, safety severity, failure impact, report
  state, or prompt lifecycle by color alone.
- Show prominent `Mock data` and `No real provider action` context on
  configuration confirmations, not on every passive table cell.
- Prompt and response previews MUST use restrained plain-text presentation,
  visible truncation/omission labels, and no conversation-style transcript.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, breadcrumbs, filters, tables, drawers,
  dialogs, charts, timelines, pagination, and focus order follow RTL; provider
  identifiers, model names, version strings, units, currency codes, and
  correlation references use isolated direction-safe spans.
- **English LTR readiness**: Logical layout properties and mirrored directional
  controls work without separate page structures.
- **1440px**: Full sidebar, multi-column overview, persistent filter bars, full
  tables, side drawers, and comparison charts.
- **1280px**: Compact sidebar option, reduced gaps, prioritized table columns,
  and overflow actions.
- **1024px**: Collapsible sidebar, wrapped filters, selectively hidden
  secondary columns with accessible detail access, and scroll-safe tables.
- **768px**: Drawer navigation, two-column metrics, filter drawer, card/detail
  alternatives for dense rows, and full-screen configuration dialogs where
  needed.
- **390px**: Prioritize overview incidents, provider outage/fallback state,
  severe failures/reports, and approval outcomes. Provider/model/prompt/safety
  configuration MUST show a desktop-required notice instead of an unsafe
  compressed editor.

## Accessibility

- All routes MUST support keyboard navigation, visible focus, logical tab
  order, focus restoration, semantic landmarks, headings, tables, forms, and
  dialogs.
- All controls MUST have accessible names and validation relationships; pointer
  targets MUST be at least 44px where touch interaction applies.
- Metric and chart regions MUST provide text summaries including period,
  denominator, platform, unit, trend, and freshness.
- Status, severity, fallback, lifecycle, and pass/fail information MUST include
  text and icon/shape cues in addition to color.
- Dialogs and drawers MUST trap focus only while open, support Escape where
  safe, restore focus on close, and announce pending/success/error states.
- Truncated prompt/response content MUST expose a safe accessible summary, not
  hidden raw content.
- Motion MUST respect reduced-motion preferences.

## Proposed API Contracts

All paths are proposed frontend contracts; no backend is implemented.

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|--------|-----------|--------------|---------------|----------------------------|
| GET | `/api/admin/ai/overview` | `AiOverviewQuery` | `AiOverview` | AI usage aggregation |
| GET | `/api/admin/ai/providers` | `AiProviderListQuery` | `PaginatedResponse<AiProviderSummary>` | Provider catalogue |
| GET | `/api/admin/ai/providers/:providerId` | `AiProviderDetailQuery` | `AiProviderDetail` | Provider health/configuration |
| POST | `/api/admin/ai/providers/:providerId/actions` | `AiProviderActionRequest` | `AiActionResult` | Provider/fallback decision |
| GET | `/api/admin/ai/models` | `AiModelListQuery` | `PaginatedResponse<AiModelSummary>` | Model catalogue/assignment |
| POST | `/api/admin/ai/models/:modelId/actions` | `AiModelActionRequest` | `AiActionResult` | Model assignment/status decision |
| GET | `/api/admin/ai/prompts` | `AiPromptListQuery` | `PaginatedResponse<AiPromptVersionSummary>` | Prompt version catalogue |
| GET | `/api/admin/ai/prompts/:promptId` | `AiPromptDetailQuery` | `AiPromptVersionDetail` | Sanitized prompt/version detail |
| POST | `/api/admin/ai/prompts/:promptId/actions` | `AiPromptActionRequest` | `AiPromptActionResult` | Prompt lifecycle decision |
| GET | `/api/admin/ai/usage` | `AiUsageListQuery` | `PaginatedResponse<AiUsageRecord>` | Usage and cost metering |
| GET | `/api/admin/ai/failures` | `AiFailureListQuery` | `PaginatedResponse<AiFailureRecord>` | Failure/fallback monitoring |
| POST | `/api/admin/ai/failures/:failureId/actions` | `AiFailureActionRequest` | `AiActionResult` | Failure triage |
| GET | `/api/admin/ai/reports` | `AiReportListQuery` | `PaginatedResponse<AiResponseReport>` | Report review |
| POST | `/api/admin/ai/reports/:reportId/actions` | `AiReportActionRequest` | `AiActionResult` | Report disposition |
| GET | `/api/admin/ai/safety-rules` | `AiSafetyRuleListQuery` | `PaginatedResponse<AiSafetyRule>` | Safety policy catalogue |
| POST | `/api/admin/ai/safety-rules/:ruleId/actions` | `AiSafetyRuleActionRequest` | `AiActionResult` | Safety-rule decision |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays.

## Frontend Types

- **AiFeature**: receipt analysis, screenshot analysis, voice parsing,
  categorization, financial assistant, spending insights, budget suggestions,
  behavior analysis, or report explanation.
- **AiOverviewQuery**: bounded period, platform, feature, provider, model, plan,
  status, and scenario.
- **AiOverview**: request/success/failure/report/fallback totals, estimated cost
  with currency, input/output units, latency, feature/platform/provider trends,
  authoritative classifications, denominators, attribution, and freshness.
- **AiProviderSummary**: safe provider ID/name, status, default model, features,
  latency, failure rate, cost estimate/currency, fallback priority, and
  freshness.
- **AiProviderDetail**: summary, models, feature coverage, safe rate-limit
  state, health/latency/error/cost trends, fallback entries, eligibility, and
  version; each fallback entry identifies feature, locale, priority, provider,
  model, terminal eligibility, and status.
- **AiProviderActionRequest**: allowed action, reason, expected version/state,
  and proposed bounded fallback configuration.
- **AiModelSummary**: safe model ID/name, provider, feature assignments, input
  limit, cost estimate/currency, status, version, and eligibility.
- **AiModelActionRequest**: allowed assignment/status action, feature scope,
  reason, and expected version/state.
- **AiPromptVersionSummary**: safe prompt/version ID, name, feature, locale,
  scope, lifecycle status, creator display reference, updated time, success
  metric, required-test result, and action eligibility.
- **AiPromptVersionDetail**: summary, sanitized prompt preview, allowlisted
  variables, safe output-schema summary, validation rules, immutable history,
  fictional tests, omissions, and version.
- **AiPromptActionRequest**: activate, retire, or rollback action; reason;
  expected version/state; and selected historical version when applicable.
- **AiUsageRecord**: safe usage ID, masked user reference, feature, provider,
  model, platform, plan, input/output units, estimated cost/currency, request
  status, original request reference, attempt count, and time.
- **AiFailureRecord**: safe failure ID, feature, provider, model, platform,
  safe error class/code, attempts, fallback outcome, impact class, resolution
  state, safe correlation reference, time, version, and authoritative impact
  classification.
- **AiResponseReport**: safe report ID, masked user reference, feature, reason,
  severity, future-backend-sanitized allowlisted excerpt of at most 280 Unicode
  characters, omission labels, model, prompt version, platform, status,
  reviewer display reference, time, version, and authoritative severity.
- **AiSafetyRule**: safe rule ID/name, feature/scope, severity, status,
  declarative condition/outcome summary, trigger count, last trigger, required
  coverage flag, action eligibility, and version.
- **AiActionResult / AiPromptActionResult**: affected safe ID, previous/current
  state, outcome, time, safe message, conflict metadata, and planned audit
  reference.
- **ApiError**: status, safe code, localized message, optional bounded field
  errors, and correlation ID without raw content, provider payloads, or stacks.
- Application types MUST be explicit and MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success for every overview, list, detail, and action contract
- Empty providers, models, prompts, usage, failures, reports, and safety rules
- Large paginated result sets
- Slow overview, list, detail, and mutation responses
- Partial overview/provider detail with one unavailable region
- Unauthorized, forbidden, not found, expired identifier, invalid identifier,
  invalid filter/sort/date/pagination, and unsafe query input
- Validation error, stale-state conflict, duplicate submission, rate limit,
  provider unavailable, and safe internal error
- Provider outage with successful fallback, failed fallback, cycle, duplicate
  priority, incompatible model, and no eligible terminal provider
- Prompt tests passing, failing, stale, missing required variables, invalid
  schema, unsafe preview, and rollback to an unavailable version
- Multiple currencies with and without an authoritative normalized total
- Retry/fallback attempts that retain one authoritative request total
- Unknown platform attribution and multi-platform customer examples
- Unsafe markup, Markdown, script-like content, bidi-control abuse, oversized
  input, unknown fields, malformed structured data, and masking violation
- Severe, duplicate, resolved, escalated, and reopened response reports
- Required safety coverage gap, conflicting rule scope, unsupported operation,
  and stale safety rule
- Mock mutation reset after reload, scenario reset, or development restart

### Loading States

- Page skeletons for overview and major lists
- Chart/table skeletons that preserve labels and layout
- Provider and prompt detail skeletons
- Pending states for every sensitive action
- Clearly marked safe prior data during filter refresh

### Empty States

- No AI requests in the selected context
- No providers or models
- No prompt versions or test cases
- No usage records, failures, response reports, or safety triggers
- No iOS, Android, or platform-attributed data

Each empty state MUST state the active context and offer only an authorized,
safe recovery action.

### Error States

- Safe retry for overview, list, and detail failures
- Invalid, expired, unauthorized, forbidden, not-found, conflict, rate-limit,
  unavailable, partial, and internal-error states
- Unsafe or unsanitized content rejected before rendering
- Stale configuration preventing a mutation

Errors MUST NOT expose raw prompts, responses, conversations, provider payloads,
credentials, private customer or financial data, stack traces, internal paths,
infrastructure details, or provider-secret identifiers.

### Success States

- Filters, sorting, pagination, platform, and period applied
- Provider fallback or model assignment decision simulated
- Prompt activation, retirement, or rollback draft simulated
- Failure/report disposition recorded
- Safety-rule decision simulated

Success MUST be announced accessibly and remain visible after the triggering
control changes or disappears.

### Warning and Confirmation States

- Provider/fallback and model assignment changes
- Prompt activation, retirement, and rollback
- Failure resolution/reopen/escalation
- Response-report disposition
- Safety-rule activation, deactivation, or scope change
- Partial data, stale state, failed tests, required-coverage gap, cost currency
  mismatch, and uncertain platform attribution

### Permission States

- Allowed full route and action
- Limited aggregate or masked route
- Read-only context
- Hidden or disabled action with reason
- Full access-denied route
- Safe forbidden response for direct mock mutation

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

The future backend is expected to append immutable audit events for:

- Provider fallback priority and status decisions
- Model feature assignment and status decisions
- Prompt activation, retirement, rollback, and sensitive detail access
- Failure assignment, resolution, reopen, and escalation
- Response-report access and disposition
- Safety-rule creation, update, activation, deactivation, and scope change
- Denied sensitive actions, stale conflicts, unsafe-input rejection, and
  masking violations where policy requires it

Mock responses MAY expose a safe audit reference. The full audit explorer and
production immutable logging remain later work.

### Privacy Rules

- Customer names, emails, user IDs, device identifiers, IP addresses,
  subscription identifiers, and request identifiers MUST be masked or replaced
  by safe fictional references.
- Raw user prompts, conversations, assistant responses, receipt/screenshot/
  voice content, financial values, budgets, transactions, account values,
  behavioral histories, and report content MUST NOT be displayed.
- A response report MAY show only a bounded, sanitized, allowlisted excerpt
  supplied by the future backend and necessary to understand the report
  category. It MUST contain at most 280 Unicode characters; omission and
  masking MUST be visible; raw prompt, conversation, and response content MUST
  never reach the frontend.
- Prompt previews and tests MUST contain only fictional, non-customer data and
  MUST omit internal secrets, credentials, operational instructions, and
  private production configuration.
- Provider keys, tokens, credentials, raw payloads, headers, limits tied to
  secret account identifiers, and full error responses MUST never appear.
- Search, filters, URLs, browser storage, caches, errors, logs, screenshots,
  fixtures, and tests MUST use sanitized fictional values.
- No prompt, response, conversation, customer/financial data, provider
  payload, credential, token, mutation draft, or reviewer note may be stored in
  local storage or session storage.

### Sensitive Actions

- Provider/model configuration, prompt lifecycle, failure/report disposition,
  and safety-rule changes require explicit confirmation.
- Confirmation MUST show previous/proposed state, scope, consequence,
  permission, planned audit event, mock-only notice, and cancel path.
- Actions MUST lock while pending, reject duplicate submission, and surface
  safe success, failure, forbidden, rate-limit, and conflict outcomes.

## Security Requirements

- **Untrusted inputs**: Parse, normalize, bound, and validate all route IDs,
  searches, filters, sort keys, dates, pagination, provider/model/prompt/feature
  values, fallback priorities, statuses, versions, notes, reasons, declarative
  safety rules, action payloads, and mock responses.
- **Safe rendering**: Render prompt, response, report, provider, model, failure,
  error, schema, and safety content as plain text or allowlisted structured
  fields. Never render raw HTML, Markdown, provider JSON, conversation content,
  or executable expressions. `dangerouslySetInnerHTML` is prohibited.
- **Declarative boundaries**: Prompt variables, output schemas, tests, and
  safety rules are data, not code. They MUST NOT trigger dynamic evaluation,
  script execution, shell commands, network calls, recursive execution, or a
  real AI request.
- **Client storage and environment**: Do not store sensitive AI/customer data
  or mutation drafts in browser storage. No provider key, token, credential,
  service-role key, database secret, or private endpoint may appear in source,
  fixtures, logs, documentation, or browser-visible environment variables.
- **Files and links**: This phase adds no real upload, download, attachment, or
  provider-console link. Any later addition requires allowlisted type, size,
  safe filename, isolated preview, safe redirect, and opener protection.
- **Permissions**: Route guards, hidden navigation, disabled controls, and mock
  roles are UX controls only. Every future backend read and mutation MUST
  independently authorize actor, resource, scope, and action.
- **Dependencies**: This specification requires no new dependency. Any later
  dependency must be required, reviewed, scoped, tested, and approved.
- **Security mock scenarios**: Cover denied/expired access, invalid IDs,
  unsafe rendering input, masking failure, oversized fields, malformed
  structures, fallback cycles, invalid prompt schemas, stale state, duplicate
  submission, unsafe safety rules, rate limits, and forbidden actions.
- **Deferred production controls**: Provider secret management, backend
  authorization, prompt encryption and retention, model routing, provider
  allowlists, network egress, rate limiting, spend controls, idempotency,
  content moderation, safety enforcement, queue isolation, audit immutability,
  monitoring, and incident response remain backend/infrastructure duties.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- One original request has multiple failed attempts before fallback succeeds.
- A provider changes status while its detail page or confirmation is open.
- A model supports a feature but not its required input size or output schema.
- Removing a model assignment leaves a feature without an eligible route.
- A fallback chain contains a cycle, duplicate priority, unavailable provider,
  or incompatible model.
- Platform attribution is missing, delayed, or conflicts with device context.
- A multi-platform customer generates separate legitimate requests on both
  platforms.
- Usage, request, attempt, failure, report, user, and safety-trigger counts use
  different denominators.
- Cost records use different currencies or lack a fresh conversion reference.
- A prompt version becomes active while another operator reviews an older
  draft.
- A prompt test passes but required validation metadata is missing.
- Arabic and English prompt variables, model names, numbers, versions, and
  currency codes mix directionality.
- A sanitized prompt or response excerpt is empty after private fields are
  removed.
- A report is resolved or linked as duplicate before confirmation completes.
- A safety rule is required for several features but a change covers only one.
- A partial response omits one chart, provider trend, prompt test, or report
  region without making the whole route unusable.
- Permission changes while a detail page, drawer, or confirmation is open.

## Out of Scope

- Real AI provider, model, gateway, prompt execution, embeddings, OCR, speech,
  categorization, financial assistant, insight, suggestion, analysis, or report
  generation
- Real provider credentials, console integration, network requests, streaming,
  rate limits, spend controls, failover, retries, queues, workers, or jobs
- Real customer conversations, prompts, responses, receipts, screenshots,
  recordings, transactions, budgets, reports, or financial values
- Backend, NestJS, Supabase, database, schema, migration, storage, audit,
  authentication, authorization, or production safety enforcement
- Plan-limit editing, provider-priority settings, global AI settings, feature
  flags, and final governance assigned to Spec 010
- Support/content/notifications, security/audit, system-health/jobs, data
  requests, admin-team, or final-integration work from Specs 007-010
- Mobile, API, or Marketing specifications
- Redesign of approved routes, components, tokens, styles, assets, typography,
  navigation shell, or interaction language

## Acceptance Criteria

- **AC-001**: `/admin/ai` presents all required request, success, failure,
  estimated-cost, response-time, unit, report, fallback, feature, platform, and
  freshness information.
- **AC-002**: All seeded retry and fallback examples retain one authoritative
  original-request total while attempts and fallback usage remain explicit.
- **AC-003**: Provider and Provider Detail views expose all required safe
  health, latency, failure, cost, model, feature, rate-limit, and fallback data
  without credentials or raw payloads.
- **AC-004**: Invalid fallback cycles, priorities, eligibility, compatibility,
  or stale state block simulated changes.
- **AC-005**: Models show required assignment, limit, cost, status, and version
  data and reject unsupported or coverage-breaking changes.
- **AC-006**: Prompt lists/details present required sanitized preview,
  variables, schema, validation, history, tests, metrics, and lifecycle state.
- **AC-007**: Prompt activation is blocked when required tests or validation
  fail, and rollback creates a new Draft without mutating history.
- **AC-008**: Usage supports all documented filters, sorting, pagination,
  platform context, masked values, currencies, denominators, and permission
  states.
- **AC-009**: Failure triage presents required attempts, fallback, impact, safe
  error, resolution, and conflict behavior without request content.
- **AC-010**: Response Reports expose only the required bounded sanitized data
  and support every documented disposition with reason and confirmation.
- **AC-011**: Safety Rules show required scope, severity, status, triggers, and
  eligibility and reject unsafe, invalid, stale, or coverage-breaking changes.
- **AC-012**: Every Phase 5 route demonstrates relevant loading, empty,
  partial, error, success, warning, and permission states.
- **AC-013**: Pages consume typed hooks and repository/service contracts; no
  page or presentation component imports raw fixtures.
- **AC-014**: Privacy review finds no raw conversation, prompt, response,
  customer financial content, provider payload, key, token, secret, or private
  identifier in UI, URLs, storage, fixtures, errors, logs, screenshots, or
  tests.
- **AC-015**: Arabic RTL and English LTR-ready behavior works at 1440px,
  1280px, 1024px, 768px, and 390px without hiding critical operational
  context.
- **AC-016**: Keyboard-only review can filter, sort, paginate, open details,
  inspect safe previews, operate confirmations, cancel, and recover focus
  without a trap.
- **AC-017**: Type checking, lint, tests, browser verification, and production
  build complete successfully before implementation is reported complete.
- **AC-018**: Standard mock performance checks meet the documented 2-second
  overview/detail and 1-second filter/sort/pagination targets; labeled slow
  scenarios remain understandable and recoverable.

## Success Criteria

- **SC-001**: In a seeded operational review, an authorized operator identifies
  the highest-impact provider, feature, or failure and opens matching records
  within 90 seconds.
- **SC-002**: 100% of seeded retry and fallback cases preserve one original
  request count and display each attempt/fallback separately.
- **SC-003**: 100% of seeded platform-attributed metrics show correct All, iOS,
  Android, and Unknown semantics without inferred or duplicated totals.
- **SC-004**: 100% of sensitive configuration and review actions show scope,
  consequence, previous/proposed state, permission, confirmation, pending lock,
  final outcome, and mock-only notice.
- **SC-005**: 100% of invalid IDs, filters, fallback chains, model assignments,
  prompt schemas/tests, review payloads, and safety rules produce safe feedback
  without protected content exposure.
- **SC-006**: Privacy and security review finds zero raw conversations, prompts,
  responses, private financial values, provider payloads, credentials, keys,
  tokens, or executable AI/safety input.
- **SC-007**: All five approved viewports complete the primary overview,
  provider review, usage/failure investigation, and report/safety review
  journeys without blocking overflow or hidden critical context.
- **SC-008**: Keyboard and screen-reader review finds no blocking focus,
  labeling, table, chart-summary, status, dialog, touch-target, bidirectional
  text, or reduced-motion defect.
- **SC-009**: 100% of seeded mixed-currency examples remain separated unless an
  authoritative normalized total and conversion timestamp are present.
- **SC-010**: At least 95% of standard mock overview/detail loads show usable
  content within 2 seconds, and at least 95% of standard filter, sort, or
  pagination updates complete within 1 second; explicitly labeled slow
  scenarios are measured separately.

## Verification

Implementation verification for this future phase MUST include:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Route review**: Open all 10 Phase 5 routes in default and relevant loading,
  empty, partial, error, forbidden, detail, and mutation scenarios.
- **Platform review**: Verify All, iOS, Android, and Unknown request, usage,
  cost, latency, failure, and report semantics; confirm retries/fallbacks do not
  inflate original-request totals.
- **Viewport review**: Verify 1440px, 1280px, 1024px, 768px, and 390px in
  Arabic RTL, plus English LTR readiness.
- **Accessibility review**: Verify keyboard navigation, focus restoration,
  semantic tables/forms/dialogs, chart summaries, status alternatives, touch
  targets, bidirectional text, and reduced motion.
- **Privacy/security review**: Scan changed source, fixtures, tests, logs, URLs,
  browser storage, environment use, errors, previews, dependencies,
  permissions, validation, pending locks, and masking for unsafe AI, provider,
  customer, financial, credential, or secret data.

No verification result may be reported as successful unless the named command
or manual procedure was actually executed successfully.
