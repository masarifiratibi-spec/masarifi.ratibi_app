# Admin Web Feature Specification: Imports, Automation, Banks, and Parser Management

**Phase / Spec**: Phase 4 / Spec 005 of 010  
**Created**: 2026-07-29  
**Status**: Draft  
**Input**: "Read the complete Admin Dashboard ten-specification plan and create Phase 4 - Spec 005: Imports, Automation, Banks, and Parser Management."

## Phase

- **Phase**: Phase 4 - Import and parser operations
- **Spec**: `005-admin-imports-and-parsers`
- **Delivery position**: Fifth of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only import and parser operations using proposed typed mock contracts and sanitized fictional data

## Goal

Enable authorized Admin operators to monitor transaction-import processing,
triage failures and uncertain results, review duplicate candidates and
unsupported formats, understand bank and sender coverage, and safely simulate
parser, merchant, and category rule management.

This phase extends the approved Admin Dashboard and completed Specs 001-004. It
does not implement real message collection, file processing, parsing,
transactions, queues, storage, bank integrations, databases, or backend jobs.

## Clarifications

### Session 2026-07-29

- Q: Which outcomes may an operator record for a low-confidence item, and who determines low confidence? -> A: The future backend supplies confidence and review eligibility; the frontend may simulate accept suggestion, correct merchant/category, defer, or mark unsupported, without creating or updating a real transaction.
- Q: Which fields may sanitized import and parser-test previews display? -> A: Session and unsupported-format previews may show source, masked bank/sender, transaction direction/type, ISO currency, coarse date, masked merchant/category, confidence, warnings, and omission labels; amounts and other value-bearing fields stay masked. Parser tests may show full normalized values only when the sample is explicitly fictional and contains no customer-derived content.
- Q: What form may a parser rule definition take in this frontend-only phase? -> A: A bounded declarative structure using allowlisted match conditions, capture fields, normalization transforms, and output mappings only; arbitrary code, dynamic expressions, recursive structures, and network-capable operations are prohibited.
- Q: What parser-version lifecycle and rollback behavior should the UI simulate? -> A: Draft -> Testing -> Active -> Retired, with one Active version per declared parser scope; activation requires every enabled required test to pass, and rollback creates a new draft from a prior version rather than mutating immutable history.
- Q: What validation and pagination bounds should Phase 4 use? -> A: Default page size 25 with 25/50/100 options and maximum 100; search and names 120 characters, reasons/notes 500, patterns 256, sanitized samples 4 KiB, rule definitions and expected outputs 8 KiB each, and at most 20 merchant aliases of 120 characters each.

## Dependencies

- **Prior phase/specs**: Specs 001, 002, 003, and 004 MUST remain complete and reusable.
- **Existing routes/components/tokens/assets**: Reuse the Admin shell,
  navigation groups, page headers, breadcrumbs, platform filters, date controls,
  tables, cards, charts, drawers, dialogs, confirmation flows, permission
  boundary, typed API client, query provider, repository pattern, mock-scenario
  controls, semantic tokens, RTL behavior, and approved visual identity.
- **Existing overview semantics**: Spec 002 import-volume and platform metrics
  remain the cross-module summary reference.
- **Existing customer privacy**: Spec 003 masking and controlled-access rules
  govern every customer-linked import record.
- **Sequence**: Spec 005 MUST NOT implement AI operations, support/content,
  notification campaigns, security center, audit explorer, infrastructure
  monitoring, admin-team governance, settings, or final hardening from Specs
  006-010.

## Assumptions

- All import, bank, sender, parser, merchant, category, and customer data is
  fictional and sanitized.
- Import counts are event counts. Combined totals may add iOS and Android
  events only when the contract confirms that the same import event is not
  represented twice.
- The default reporting period is the last 30 calendar days ending today in
  the Admin application time zone, with 7-day and 90-day options.
- Simulated mutations persist only in mock runtime state and reset on page
  reload, development-server restart, or scenario reset.
- An import session may contain multiple extracted items, failed items, and
  duplicate candidates.
- Parser test previews accept sanitized fictional text or structured examples
  only; they never process real customer messages, receipts, statements, or
  files.
- Bank coverage is an operational support catalogue, not a live bank
  connection or Open Finance integration.
- Parser version release and rollback actions are simulated decisions. No
  parser deployment, worker restart, or queue mutation occurs in this phase.
- Unsupported-format samples expose an allowlisted structural summary, never
  raw message or statement content.
- Paginated lists default to 25 items and allow 25, 50, or 100 items, with 100
  as the maximum. Search and name fields are limited to 120 Unicode characters;
  reasons and internal notes to 500; sender/rule patterns to 256; sanitized
  samples to 4 KiB UTF-8; rule definitions and expected outputs to 8 KiB UTF-8
  each; and merchant rules to 20 aliases of 120 characters each.

## Backend Alignment

### Planned Backend Modules

- `transaction-imports`
- `transaction-parsers`
- `transactions`, for normalized import outcomes only
- `files`, for future import-file metadata only
- `jobs`, for future processing status and retry handoff
- `users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `audit-logs`

The future backend remains responsible for authorization, source ingestion,
file validation, raw-content filtering, parser execution, deduplication,
transaction creation, persistence, idempotency, queues, audit logging, and
production monitoring.

### Planned Entities

- `transaction_imports`
- `imported_messages`
- `import_items`
- `duplicate_candidates`
- `parser_rules`
- `parser_versions`
- `merchant_rules`
- `merchant_aliases`
- `uploaded_files`
- `transactions`
- `categories`
- `users`
- `profiles`
- `devices`
- `audit_logs`
- `roles`
- `permissions`

Supported-bank, sender, unsupported-format, parser-test, and category-rule views
may be future backend projections over these entities or dedicated entities
approved later. Entity names are alignment references only; this phase creates
no schema, migration, query, storage object, queue, or backend endpoint.

## Roles and Permissions

### Roles

- **Super Admin**: May view all Phase 4 routes and perform every simulated
  parser/import management action.
- **Parser and Import Operator**: Primary role for import triage, bank coverage,
  sender rules, parser rules, tests, versions, merchant rules, and category
  rules.
- **Support Agent**: May view a limited, masked import status linked to a
  support case; cannot view sanitized samples or manage parser configuration.
- **Security Administrator**: May view limited failure and audit context when
  needed for investigation; cannot edit parser configuration by default.
- **Billing Operator**, **AI Operator**, and **Content Manager**: No Phase 4
  route access by default.

### Permission Matrix

| Capability | Proposed permission | Super Admin | Parser/Import Operator | Support Agent | Security Administrator |
|------------|---------------------|-------------|------------------------|---------------|------------------------|
| Import overview and sessions | `imports.read` | Allowed | Allowed | Limited status | Context only |
| Import session detail | `imports.detail.read` | Allowed | Allowed | Limited masked detail | Context only |
| Failed-import triage | `imports.failures.manage` | Allowed | Allowed | Not allowed | Context only |
| Low-confidence review | `imports.confidence.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Duplicate resolution | `imports.duplicates.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Unsupported-format triage | `imports.unsupported.manage` | Allowed | Allowed | Not allowed | Context only |
| Bank and sender coverage | `parsers.coverage.read` | Allowed | Allowed | Not allowed | Context only |
| Sender management | `parsers.senders.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Parser rules read | `parsers.rules.read` | Allowed | Allowed | Not allowed | Context only |
| Parser rules manage | `parsers.rules.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Parser tests execute in mock mode | `parsers.tests.run` | Allowed | Allowed | Not allowed | Not allowed |
| Parser versions manage | `parsers.versions.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Merchant rules manage | `parsers.merchants.manage` | Allowed | Allowed | Not allowed | Not allowed |
| Category rules manage | `parsers.categories.manage` | Allowed | Allowed | Not allowed | Not allowed |

- Missing route permission MUST render the shared access-denied state without
  protected import, customer, parser, sender, or sample values.
- Missing action permission MUST hide the action or present a disabled control
  with a clear reason. Direct mock mutation attempts MUST return a safe
  forbidden result.
- Permission-aware UI is a development-only UX simulation and MUST NOT be
  described as production authorization.

## User Scenarios and Testing

### User Story 1 - Monitor Import Operations (Priority: P1)

A Parser and Import Operator reviews import volume, success, failure, partial,
review, duplicate, unsupported-format, processing-time, source, bank, and
platform summaries, then opens filtered import sessions.

**Why this priority**: Operators need a trustworthy overview before they can
triage a specific failure or parser regression.

**Independent test**: From `/admin/imports`, an authorized operator can identify
the largest failing source and open the matching filtered sessions without
exposing customer content.

**Acceptance scenarios**:

1. **Given** the All Platforms view, **When** the overview loads, **Then** total,
   successful, failed, partial, pending-review, duplicate, unsupported-format,
   average-processing-time, bank-coverage, and parser-performance summaries
   identify their measurement units and freshness.
2. **Given** iOS or Android is selected, **When** platform-attributed metrics
   update, **Then** only applicable sources and capability context are shown.
3. **Given** an operator selects a source, bank, status, platform, parser
   version, date range, or application version, **When** sessions are filtered,
   **Then** the bounded result, active filters, sorting, and pagination remain
   visible and reversible.
4. **Given** one overview region is unavailable, **When** the remaining data
   loads, **Then** available regions remain usable and the missing region shows
   a safe partial state.

### User Story 2 - Investigate an Import Session (Priority: P1)

An authorized operator opens an import session and reviews its safe metadata,
processing timeline, item summary, parser version, duplicate summary, sanitized
extraction result, and failure context.

**Why this priority**: Session-level evidence is required to distinguish source,
parser, data-quality, and processing failures.

**Independent test**: A session detail can be opened from the list and inspected
without exposing raw imported content, private financial values, or unrestricted
customer information.

**Acceptance scenarios**:

1. **Given** a valid session identifier, **When** the detail loads, **Then**
   source, platform, status, item counts, processing timeline, parser version,
   duration, masked customer reference, duplicate summary, and safe failure
   information are visible.
2. **Given** a sanitized extraction preview, **When** it renders, **Then** only
   allowlisted field labels, masked values, classifications, and confidence
   metadata appear as plain text.
3. **Given** a missing, expired, malformed, or unauthorized session identifier,
   **When** the route resolves, **Then** a safe not-found, expired, validation,
   or access-denied state appears without protected values.
4. **Given** a retry-eligible failed session, **When** an authorized operator
   confirms a mock retry handoff, **Then** the UI records only the simulated
   outcome and planned audit reference.

### User Story 3 - Triage Exceptions and Data Quality (Priority: P1)

An authorized operator works through failed imports, low-confidence items,
duplicate candidates, and unsupported formats using sanitized evidence and
explicit resolution flows.

**Why this priority**: These queues determine whether transaction automation can
remain accurate without exposing private imported content.

**Independent test**: Each exception queue can be filtered, opened, and resolved
in mock mode with confirmation, pending lock, safe outcomes, and no real
transaction mutation.

**Acceptance scenarios**:

1. **Given** a failed import, **When** the operator selects retry handoff,
   parser-issue assignment, mark unsupported, create-rule handoff, or internal
   note, **Then** scope, consequence, permission, reason, and expected audit
   event are confirmed before the mock state changes.
2. **Given** a low-confidence item, **When** the operator records a review
   outcome, **Then** suggested merchant/category, confidence, source, masked
   content summary, and previous/current review state remain visible.
3. **Given** a duplicate candidate, **When** the operator confirms duplicate,
   rejects the match, or defers review, **Then** match score and reasons are
   preserved and no real customer transaction is created, merged, or deleted.
4. **Given** an unsupported format, **When** the operator assigns a bank/sender,
   marks unsupported, or starts a parser-rule draft, **Then** only a sanitized
   structure and safe metadata are transferred to the mock workflow.
5. **Given** stale or already-resolved data, **When** a mutation is submitted,
   **Then** a conflict state prevents false success and prompts refresh.

### User Story 4 - Manage Bank and Sender Coverage (Priority: P1)

A Parser and Import Operator reviews supported banks, source coverage, sender
patterns, active rules, success rates, bank detail tabs, and sender status.

**Why this priority**: Parser rules require a clear bank and sender context.

**Independent test**: An authorized operator can find a bank or sender, review
coverage and performance, and simulate a validated sender update.

**Acceptance scenarios**:

1. **Given** Supported Banks, **When** the list loads, **Then** bank, country,
   supported sources, sender count, active-rule count, success rate, last parser
   update, and status are shown.
2. **Given** a Bank Detail route, **When** it loads, **Then** overview, senders,
   sanitized message-template summaries, parser rules, test cases, performance,
   and versions are available according to permission.
3. **Given** Sender Management, **When** an operator filters or edits a sender,
   **Then** sender name, bank, platform, language, safe match pattern, status,
   and last seen are validated.
4. **Given** overlapping or unsafe sender patterns, **When** a simulated update
   is submitted, **Then** validation or conflict feedback prevents the change.

### User Story 5 - Manage Parser Rules, Tests, and Versions (Priority: P1)

An authorized operator reviews parser rules, edits a rule draft, runs a
sanitized test preview, reviews test cases, and simulates version release or
rollback decisions.

**Why this priority**: Parser configuration is the operational core of the
phase and requires safe validation before any future backend integration.

**Independent test**: A parser rule can be opened, edited with validated
sanitized inputs, preview-tested, confirmed, and saved to mock runtime state
without executing a real parser or deployment.

**Acceptance scenarios**:

1. **Given** Parser Rules, **When** the list loads, **Then** rule, bank, sender,
   language, priority, version, status, success rate, and last update are shown
   with filters and pagination.
2. **Given** the Rule Editor, **When** invalid name, bank, sender pattern,
   language, priority, status, rule definition, sample input, or expected output
   is entered, **Then** field-level validation prevents preview and save.
3. **Given** a valid sanitized rule draft, **When** test preview runs, **Then**
   expected and simulated actual normalized output, differences, pass/fail, and
   safe diagnostics are shown without evaluating executable code.
4. **Given** a rule save, version release, or rollback decision, **When** the
   operator confirms, **Then** before/after state, consequence, pending lock,
   mock-only notice, outcome, and planned audit reference are visible.
5. **Given** stale rule/version state or a failing required test case, **When**
   release is attempted, **Then** conflict or validation feedback blocks false
   success.

### User Story 6 - Maintain Merchant and Category Rules (Priority: P2)

An authorized operator reviews and simulates updates to canonical merchant,
alias, default-category, matching-pattern, confidence, accuracy, priority,
scope, and status rules.

**Why this priority**: Normalization and categorization depend on parser
operations but can be delivered after import and parser triage.

**Independent test**: Merchant and category rules can be searched, validated,
previewed, and changed in mock mode with safe conflicts and no customer-specific
financial content.

**Acceptance scenarios**:

1. **Given** Merchant Rules, **When** the list loads, **Then** canonical
   merchant, sanitized aliases, default category, country, priority, scope, and
   status are visible.
2. **Given** Category Rules, **When** the list loads, **Then** safe matching
   pattern, suggested category, confidence, user-override count, and accuracy
   are visible.
3. **Given** a duplicate alias, overlapping pattern, invalid confidence,
   unsupported category, or stale rule, **When** save is attempted, **Then**
   validation or conflict feedback prevents false success.
4. **Given** a valid simulated change, **When** confirmation completes, **Then**
   before/after state and planned audit reference are announced accessibly.

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| `/admin/imports` | Import overview and operational summaries | Super Admin, Parser/Import Operator, limited Support/Security context | New approved addition |
| `/admin/imports/sessions` | Searchable import-session list | Super Admin, Parser/Import Operator, limited Support/Security context | New approved addition |
| `/admin/imports/sessions/[importId]` | Privacy-safe session detail and mock retry handoff | Super Admin, Parser/Import Operator, limited Support/Security context | New approved addition |
| `/admin/imports/failed` | Failed-import triage | Super Admin, Parser/Import Operator, limited Security context | New approved addition |
| `/admin/imports/low-confidence` | Low-confidence review queue | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/imports/duplicates` | Duplicate-candidate review queue | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/imports/unsupported` | Unsupported-format triage | Super Admin, Parser/Import Operator, limited Security context | New approved addition |
| `/admin/parsers/banks` | Supported banks and source coverage | Super Admin, Parser/Import Operator, limited Security context | New approved addition |
| `/admin/parsers/banks/[bankId]` | Bank overview, senders, templates, rules, tests, performance, and versions | Super Admin, Parser/Import Operator, limited Security context | New approved addition |
| `/admin/parsers/senders` | Sender search and simulated management | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/parsers/rules` | Parser-rule list | Super Admin, Parser/Import Operator, limited Security context | New approved addition |
| `/admin/parsers/rules/[ruleId]` | Parser-rule editor and sanitized test preview | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/parsers/test-cases` | Parser test-case results | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/parsers/versions` | Parser-version history and simulated release/rollback | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/parsers/merchant-rules` | Merchant normalization rules | Super Admin, Parser/Import Operator | New approved addition |
| `/admin/parsers/category-rules` | Category suggestion rules | Super Admin, Parser/Import Operator | New approved addition |

## Functional Requirements

### Import Overview and Sessions

- **FR-001**: Import Overview MUST show total, successful, failed, partial,
  pending-review, duplicate-candidate, unsupported-format, and
  average-processing-time summaries.
- **FR-002**: The overview MUST show source distribution, source success rate,
  failure trend, processing time, bank coverage, platform distribution, parser
  performance, and freshness.
- **FR-003**: Overview and session data MUST support All Platforms, Android, and
  iOS filters where attribution is applicable.
- **FR-004**: Every metric MUST identify whether it represents sessions,
  extracted items, failures, duplicate candidates, unsupported formats, time,
  banks, or customers.
- **FR-005**: Combined import totals MAY add platform event counts only when the
  response contract confirms that events are non-duplicated; otherwise the UI
  MUST use the authoritative combined total and show the deduplication state.
- **FR-006**: Import Sessions MUST support search limited to 120 Unicode
  characters, source, platform, status, bank, parser version, date, application
  version, allowlisted sorting, and pagination with a default of 25, options of
  25/50/100, and a maximum page size of 100.
- **FR-007**: Each session row MUST show safe import ID, masked customer,
  source, platform, status, total/successful/failed item counts, parser version,
  started time, duration, and permitted actions.
- **FR-008**: Import Session Details MUST show safe metadata, processing
  timeline, item summary, duplicate summary, parser used, safe failure reason,
  sanitized extraction preview, and action eligibility.
- **FR-009**: Raw SMS, notification, receipt, screenshot, voice, CSV, PDF,
  statement, or Shortcut content MUST NOT appear in default or detail views.
  Session and unsupported-format previews MUST be limited to source, masked
  bank/sender, transaction direction/type, ISO currency, coarse date, masked
  merchant/category, confidence, warnings, and omission labels; amounts and
  other value-bearing fields remain masked.
- **FR-010**: A mock retry handoff MUST validate identifier, current state,
  eligibility, reason, permission, confirmation, and duplicate submission.

### Exception Triage

- **FR-011**: Failed Imports MUST support source, bank, platform, parser
  version, failure reason, date, application version, sorting, and pagination.
- **FR-012**: Failed-import actions MUST be limited to mock retry handoff,
  parser-issue assignment, mark unsupported, create-rule handoff, and internal
  note.
- **FR-013**: Low-Confidence Imports MUST show backend-supplied suggested
  merchant, suggested category, confidence, review eligibility, source, masked
  content summary, review state, and only these simulated outcomes: accept
  suggestion, correct merchant/category, defer, or mark unsupported. The
  frontend MUST NOT calculate the confidence threshold or create/update a real
  transaction.
- **FR-014**: Duplicate Candidates MUST show imported-item summary,
  existing-transaction metadata summary, match score, match reasons, current
  resolution, and user-decision state without full financial values.
- **FR-015**: Duplicate resolution MUST be limited to simulated confirm
  duplicate, reject match, or defer review outcomes and MUST NOT create, merge,
  update, or delete a real transaction.
- **FR-016**: Unsupported Formats MUST show sender, bank, country, platform,
  frequency, first/last detected, sanitized structure, review state, and
  create-rule eligibility.
- **FR-017**: Every triage mutation MUST include permission, reason, current
  state, confirmation, pending lock, success, failure, forbidden, rate-limit,
  and conflict behavior.

### Banks and Senders

- **FR-018**: Supported Banks MUST show bank, country, supported sources, sender
  count, active-rule count, success rate, last parser update, and status.
- **FR-019**: Bank Details MUST provide overview, senders, sanitized
  message-template summaries, parser rules, test cases, performance, and
  versions according to permission.
- **FR-020**: Sender Management MUST show sender name, bank, platform, language,
  safe match pattern, status, and last seen.
- **FR-021**: Sender changes MUST validate bank, platform, language, pattern,
  status, overlap, unsafe pattern content, permission, confirmation, and stale
  state.

### Parser Rules, Tests, and Versions

- **FR-022**: Parser Rules MUST show rule, bank, sender, language, priority,
  version, status, success rate, last update, filters, sorting, and pagination.
- **FR-023**: The Parser Rule Editor MUST include rule name, bank, sender
  pattern, language, priority, status, declarative rule definition, sanitized
  sample input, expected normalized output, and test preview.
- **FR-024**: Parser-rule forms MUST reject executable content, unsafe markup,
  oversized input, unknown fields, invalid patterns, invalid priorities, unsafe
  output fields, unsanitized samples, dynamic expressions, recursive
  structures, and network-capable operations. Rule definitions MUST use only
  allowlisted match conditions, capture fields, normalization transforms, and
  output mappings. Rule names are limited to 120 Unicode characters, patterns
  to 256, sanitized samples to 4 KiB UTF-8, and rule definitions and expected
  outputs to 8 KiB UTF-8 each.
- **FR-025**: Test preview MUST compare sanitized expected output with
  deterministic simulated actual output and show pass/fail plus safe
  diagnostics; it MUST NOT evaluate code or invoke a real parser. Full
  normalized values MAY appear only in an explicitly labelled fictional test
  sample that contains no customer-derived content.
- **FR-026**: Parser Test Cases MUST show test name, source type, sanitized
  sample summary, expected output, simulated actual output, pass/fail, and
  version.
- **FR-027**: Parser Versions MUST use Draft, Testing, Active, and Retired
  states and show declared parser scope, version, status, released by, released
  at, rule count, test pass rate, and simulated rollback eligibility. Only one
  version may be Active within a declared parser scope.
- **FR-028**: Simulated rule save, version release, and rollback MUST show
  before/after state, scope, consequence, permission, confirmation, pending
  lock, outcome, and planned audit reference.
- **FR-029**: Version activation MUST be blocked unless every enabled required
  test passes and MUST also be blocked when state is stale, the target version
  or transition is invalid, another version is already Active in the same
  scope, or permission is absent. A simulated rollback MUST create a new Draft
  based on the selected prior version and MUST NOT rewrite historical versions.

### Merchant and Category Rules

- **FR-030**: Merchant Rules MUST show canonical merchant, sanitized aliases,
  default category, country, priority, scope, status, and last update.
- **FR-031**: Merchant-rule changes MUST validate canonical name, aliases,
  category, country, priority, scope, status, duplicate aliases, overlapping
  rules, confirmation, and stale state. Canonical names and aliases are limited
  to 120 Unicode characters and each rule may contain at most 20 aliases.
- **FR-032**: Category Rules MUST show safe matching pattern, suggested
  category, confidence, user-override count, accuracy, status, and last update.
- **FR-033**: Category-rule changes MUST validate pattern, category, confidence,
  priority, status, overlap, confirmation, and stale state.

### Shared Architecture and States

- **FR-034**: Every route MUST consume data through typed hooks and
  service/repository interfaces backed by mock HTTP contracts; pages and
  presentation components MUST NOT import raw fixture arrays.
- **FR-035**: All request parameters, route identifiers, mutation payloads, and
  mock responses MUST be parsed, normalized, bounded, and validated before use.
- **FR-036**: Every major data region MUST provide relevant loading, empty,
  partial, error, success, warning, and permission states.
- **FR-037**: Sensitive actions MUST remain locked while pending and reject
  duplicate submissions.
- **FR-038**: Search, filter, sort, pagination, and selected platform state MUST
  remain visible and reversible.
- **FR-039**: Mock runtime changes MUST reset after reload, development-server
  restart, or scenario reset and MUST NOT persist to browser storage.
- **FR-040**: No application type may use `any`, and no route may expose raw
  provider, imported, parser, file, or customer payloads.

## Platform Data Requirements

### All Platforms

- Show authoritative combined import sessions, extracted items, success and
  failure rates, duplicates, low-confidence items, unsupported formats,
  processing time, bank coverage, and parser performance.
- State whether the combined figure is an event total, extracted-item count,
  unique bank count, rate, duration, or customer count.
- Do not infer a unique-customer total from iOS plus Android customer counts.

### Android

- Support Android SMS and notification imports.
- Show SMS tracking, Notification Listener, sender filtering, bank-application
  filtering, background processing, parser performance, application-version
  impact, and Android-specific unsupported formats where supplied.
- Never imply unrestricted access to a customer's SMS inbox or notifications.

### iOS

- Support Shortcut, App Intent, Share Extension, screenshot, receipt, and voice
  import attribution.
- Show parser performance, application-version impact, and iOS-specific
  unsupported formats where supplied.
- Never imply access to iOS notification or SMS content.

### Deduplication

- Each import session and event MUST have a stable fictional identifier.
- A retried, replayed, or multi-stage event MUST NOT be counted as a new
  original import unless the contract explicitly classifies it that way.
- Duplicate candidates are review records and MUST NOT be treated as confirmed
  duplicate transactions until an authoritative outcome is supplied.

## UX and Design Constraints

- Preserve the approved Masarifi Admin Dashboard and Masarifi Gulf Premium
  Design System Version 2.1.
- Keep deep teal as the primary interaction color and bronze limited to
  approximately 2%-3% of each Admin screen.
- Keep surfaces neutral, data-dense, professional, and operational.
- Reuse existing cards, tables, filters, badges, timelines, dialogs, drawers,
  charts, semantic tokens, spacing, typography, and interaction patterns.
- Keep financial semantic colors separate from parser/import operational
  statuses and confidence indicators.
- Status, severity, confidence, pass/fail, and support state MUST use text and
  iconography in addition to color.
- Sanitized extraction and parser-test previews MUST remain subordinate to
  operational summaries and MUST not resemble unrestricted raw-data consoles.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, breadcrumbs, filters, tables, pagination,
  timelines, dialogs, and action order follow RTL reading and keyboard order.
- **English LTR readiness**: Logical properties and direction-safe components
  reverse without changing meaning, truncation rules, or action priority.
- **1440px**: Full sidebar, persistent filters, multi-column overview, full
  operational tables, side detail panels where already approved.
- **1280px**: Compact sidebar option, reduced horizontal padding, responsive
  table columns, and overflow actions.
- **1024px**: Collapsible sidebar, priority columns, filter drawer as needed,
  and horizontal scrolling only inside bounded table regions.
- **768px**: Drawer navigation, two-column summary cards, card/table hybrid
  lists, and non-blocking filter drawer.
- **390px**: Prioritize import health, failures, unsupported formats, urgent
  review actions, and concise session summaries. Complex parser-rule editing,
  test comparison, version release, and bulk configuration MUST show a clear
  desktop-required notice rather than an unsafe compressed editor.

No approved viewport may hide current status, active filters, permission state,
critical warning, confirmation consequence, or the way back to the parent list.

## Accessibility

- All controls MUST be keyboard operable with logical focus order and visible
  focus.
- Tables MUST use semantic headers; responsive card alternatives MUST preserve
  equivalent labels and relationships.
- Charts MUST include concise text summaries and not rely on color.
- Dialogs and drawers MUST have accessible names, focus containment, Escape
  behavior where safe, cancel paths, and focus restoration.
- Loading and mutation states MUST be announced without repeatedly disrupting
  screen-reader users.
- Success, failure, partial, confidence, duplicate, unsupported, pass/fail, and
  permission states MUST use text beyond color.
- Touch targets MUST be at least 44px at the mobile viewport.
- Reduced-motion preferences MUST be respected.
- Mixed Arabic/English identifiers, bank names, parser versions, and code-like
  safe references MUST preserve readable bidirectional isolation.

## Proposed API Contracts

These are proposed frontend contracts only; no backend endpoint is implemented.

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|--------|-----------|--------------|---------------|----------------------------|
| GET | `/api/v1/admin/imports/overview` | `ImportOverviewQuery` | `ImportOverview` | import operational aggregates |
| GET | `/api/v1/admin/imports/sessions` | `ImportSessionsQuery` | `ImportSessionsPage` | import-session search |
| GET | `/api/v1/admin/imports/sessions/:importId` | `ImportSessionDetailRequest` | `ImportSessionDetail` | import-session detail |
| POST | `/api/v1/admin/imports/sessions/:importId/retry-handoff` | `ImportRetryHandoffRequest` | `ImportActionResult` | retry job handoff |
| GET | `/api/v1/admin/imports/failures` | `FailedImportsQuery` | `FailedImportsPage` | failure triage |
| POST | `/api/v1/admin/imports/failures/:failureId/action` | `FailedImportActionRequest` | `ImportActionResult` | failure-resolution workflow |
| GET | `/api/v1/admin/imports/low-confidence` | `LowConfidenceQuery` | `LowConfidencePage` | confidence review queue |
| POST | `/api/v1/admin/imports/low-confidence/:itemId/review` | `ConfidenceReviewRequest` | `ImportActionResult` | confidence-review outcome |
| GET | `/api/v1/admin/imports/duplicates` | `DuplicateCandidatesQuery` | `DuplicateCandidatesPage` | duplicate review queue |
| POST | `/api/v1/admin/imports/duplicates/:candidateId/resolve` | `DuplicateResolutionRequest` | `ImportActionResult` | duplicate-resolution workflow |
| GET | `/api/v1/admin/imports/unsupported-formats` | `UnsupportedFormatsQuery` | `UnsupportedFormatsPage` | unsupported-format triage |
| POST | `/api/v1/admin/imports/unsupported-formats/:formatId/action` | `UnsupportedFormatActionRequest` | `ImportActionResult` | unsupported-format workflow |
| GET | `/api/v1/admin/parsers/banks` | `BanksQuery` | `BanksPage` | supported-bank coverage |
| GET | `/api/v1/admin/parsers/banks/:bankId` | `BankDetailRequest` | `BankDetail` | bank parser coverage detail |
| GET | `/api/v1/admin/parsers/senders` | `SendersQuery` | `SendersPage` | sender search |
| POST | `/api/v1/admin/parsers/senders/:senderId/action` | `SenderActionRequest` | `ParserActionResult` | sender management |
| GET | `/api/v1/admin/parsers/rules` | `ParserRulesQuery` | `ParserRulesPage` | parser-rule search |
| GET | `/api/v1/admin/parsers/rules/:ruleId` | `ParserRuleDetailRequest` | `ParserRuleDetail` | parser-rule detail |
| POST | `/api/v1/admin/parsers/rules/:ruleId/test-preview` | `ParserTestPreviewRequest` | `ParserTestPreviewResult` | sanitized parser preview |
| POST | `/api/v1/admin/parsers/rules/:ruleId/action` | `ParserRuleActionRequest` | `ParserActionResult` | parser-rule management |
| GET | `/api/v1/admin/parsers/test-cases` | `ParserTestCasesQuery` | `ParserTestCasesPage` | parser test-case results |
| GET | `/api/v1/admin/parsers/versions` | `ParserVersionsQuery` | `ParserVersionsPage` | parser-version history |
| POST | `/api/v1/admin/parsers/versions/:versionId/action` | `ParserVersionActionRequest` | `ParserActionResult` | simulated release/rollback |
| GET | `/api/v1/admin/parsers/merchant-rules` | `MerchantRulesQuery` | `MerchantRulesPage` | merchant normalization rules |
| POST | `/api/v1/admin/parsers/merchant-rules/:ruleId/action` | `MerchantRuleActionRequest` | `ParserActionResult` | merchant-rule management |
| GET | `/api/v1/admin/parsers/category-rules` | `CategoryRulesQuery` | `CategoryRulesPage` | category suggestion rules |
| POST | `/api/v1/admin/parsers/category-rules/:ruleId/action` | `CategoryRuleActionRequest` | `ParserActionResult` | category-rule management |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays.

## Frontend Types

- **ImportPlatformFilter**: All, Android, iOS, and optional Unknown when a
  documented data-quality bucket exists.
- **ImportSource**: Android SMS, Android Notification, iOS Shortcut, App Intent,
  Share Extension, Screenshot, Receipt, CSV, PDF Statement, Voice, Manual, and
  documented future source values.
- **ImportOverviewQuery**: reporting period, platform, source, bank, parser
  version, application version, and mock scenario.
- **ImportOverview**: unit-labelled KPIs, source distribution, success/failure
  trends, processing time, bank coverage, platform distribution, parser
  performance, deduplication state, and freshness.
- **ImportSessionsQuery**: search up to 120 Unicode characters, allowlisted
  filters and sort, page, page size limited to 25/50/100 with default 25, and
  mock scenario.
- **ImportSessionListItem**: safe import ID, masked customer, source, platform,
  status, item counts, parser version, started time, duration, and permitted
  actions.
- **ImportSessionDetail**: safe metadata, timeline, item/duplicate summaries,
  parser reference, safe failure reason, sanitized extraction preview, and
  action eligibility.
- **SanitizedExtractionPreview**: source, masked bank/sender, transaction
  direction/type, ISO currency, coarse date, masked merchant/category,
  confidence, warnings, and omission labels; amounts and other value-bearing
  fields remain masked.
- **FailedImportItem**: safe failure ID, import ID, source, bank, platform,
  parser version, safe reason, date, application version, state, and actions.
- **LowConfidenceItem**: safe item ID, suggested merchant/category, confidence,
  source, masked content summary, review state, and permitted outcomes.
- **DuplicateCandidate**: safe candidate/import references, existing-transaction
  metadata summary, match score, safe match reasons, resolution, and user
  decision state.
- **UnsupportedFormatItem**: safe format ID, sender label, bank, country,
  platform, frequency, first/last detected, sanitized structure, and state.
- **BankCoverageItem**: safe bank ID, display name, country, sources, sender
  count, active-rule count, success rate, update time, and status.
- **BankDetail**: coverage summary, senders, sanitized template summaries,
  parser rules, test results, performance, and versions.
- **SenderRule**: safe sender ID/name, bank, platform, language, safe match
  pattern, status, and last seen.
- **ParserRuleDetail**: safe rule ID/name, bank, sender, language, priority,
  version, status, a bounded declarative definition composed only of
  allowlisted match/capture/normalize/map operations, performance, and update
  metadata.
- **ParserTestPreviewRequest**: sanitized sample, declarative rule draft,
  expected allowlisted normalized output, and current version.
- **ParserTestPreviewResult**: expected/actual safe output, field differences,
  pass/fail, safe diagnostics, and deterministic preview identifier.
- **ParserTestCase**: safe test ID/name, source, sanitized sample summary,
  expected/actual output, result, and version.
- **ParserVersion**: safe version ID/name, declared scope, Draft/Testing/Active/
  Retired status, releaser display reference, release time, rule count,
  required/enabled test totals, pass rate, and action eligibility.
- **MerchantRule**: canonical merchant label, sanitized aliases, category,
  country, priority, scope, status, and update metadata.
- **CategoryRule**: safe match pattern, category, confidence, override count,
  accuracy, priority, status, and update metadata.
- **ImportActionResult / ParserActionResult**: affected safe ID,
  previous/current state, outcome, timestamp, safe message, conflict metadata,
  and planned audit reference.
- **ApiError**: status, safe code, localized message, optional bounded field
  errors, and correlation ID without raw content or stack traces.
- All application types MUST be explicit and MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success across all overview, list, detail, preview, and action routes
- Empty sessions, failures, confidence reviews, duplicate candidates,
  unsupported formats, banks, senders, rules, tests, versions, merchant rules,
  and category rules
- Large paginated result sets
- Slow overview, list, detail, preview, or mutation response
- Partial overview, bank detail, or session detail with one independently
  unavailable region
- Unauthorized and forbidden route/action
- Not found, expired identifier, invalid identifier, invalid filter/sort/date,
  invalid pagination, and unsafe query input
- Validation failure for sender patterns, rule definition, sanitized sample,
  normalized output, confidence, priority, scope, status, or reason
- Conflict for stale state, duplicate alias, overlapping sender/rule pattern,
  already-resolved exception, or changed parser version
- Rate-limited sensitive mutation
- Processing/provider unavailable and safe internal error
- Unsafe markup, script-like content, bidi-control abuse, oversized input,
  unknown fields, malformed structured data, or raw-content contract violation
- Masking violation rejected by response validation
- Duplicate mutation while pending
- Android/iOS event overlap with authoritative combined total and explicit
  deduplication state
- Failed parser tests blocking simulated version release
- Mock runtime mutation reset after reload, development-server restart, or
  scenario reset

### Loading States

- Page skeletons for Import Overview and major list routes
- Table/card skeletons for every queue and management list
- Detail/drawer skeletons for session, bank, rule, and version detail
- Pending state for test preview and every sensitive action
- Updating state that retains clearly marked safe prior data during filter
  changes

### Empty States

- No import sessions or no filtered sessions
- No failed imports
- No low-confidence reviews
- No duplicate candidates
- No unsupported formats
- No supported banks or senders for the selected context
- No parser rules, tests, versions, merchant rules, or category rules
- No platform-attributed data

Each empty state MUST state the current context and provide only a safe recovery
action that the current role may use.

### Error States

- Failed overview, list, detail, preview, or action load with safe retry
- Invalid, expired, unauthorized, forbidden, not-found, conflict, rate-limited,
  unavailable, partial, and internal-error states
- Unsafe or unsanitized content rejected before rendering
- Stale parser/test data preventing a rule or version action

Errors MUST NOT expose stack traces, internal paths, raw messages,
notifications, receipts, screenshots, statements, files, parser payloads,
regular-expression internals, customer identifiers, financial values, secrets,
tokens, or infrastructure details.

### Success States

- Retry or create-rule handoff recorded in mock mode
- Failure, low-confidence, duplicate, or unsupported-format outcome recorded
- Sender, parser, merchant, or category rule change simulated
- Parser test preview completed
- Parser version release or rollback decision simulated
- Filters, sorting, pagination, platform, and reporting-period changes applied

Success MUST be announced accessibly and remain visible after the triggering
control changes or disappears.

### Warning and Confirmation States

- Retry and create-rule handoffs
- Mark unsupported or duplicate resolution
- Sender activation, deactivation, and pattern changes
- Parser-rule definition, priority, or status changes
- Parser version release or rollback
- Merchant alias/category/scope changes
- Category pattern/confidence changes
- Stale state, failed required tests, partial data, and event-deduplication
  uncertainty

Confirmations MUST identify scope, consequence, permission, planned audit event,
and the mock-only boundary. Sensitive mutations MUST lock while pending.

### Permission States

- Allowed full route and action
- Limited masked route
- Read-only context
- Hidden or disabled action with reason
- Full access-denied route
- Safe forbidden result for direct mock mutation

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

The future backend is expected to append immutable audit events for:

- Import-session detail access where policy requires it
- Retry, parser-issue, mark-unsupported, create-rule, and internal-note handoffs
- Low-confidence and duplicate resolution decisions
- Unsupported-format classification and assignment
- Bank/sender configuration changes
- Parser-rule creation, update, activation, deactivation, preview, and test
- Parser-version release and rollback
- Merchant and category rule changes
- Denied sensitive actions, stale-state conflicts, and unsafe-input rejection
  where policy requires it

Frontend mock responses MAY expose a safe audit reference. The full audit
explorer and production immutable logging remain later work.

### Privacy Rules

- Customer names, emails, user IDs, device identifiers, IP addresses, and
  imported-record identifiers MUST be masked or represented by safe fictional
  references unless an explicitly approved operational need requires more.
- Never display raw SMS, notification, receipt, screenshot, voice, CSV, PDF,
  bank-statement, Shortcut, App Intent, Share Extension, or clipboard content.
- Never display a customer-derived full transaction amount, account number,
  balance, salary, merchant history, category history, bank credential, message
  hash, sender hash, file path, storage path, token, or parser payload.
- Parser-test previews MAY show full normalized values only when every value is
  explicitly fictional, locally seeded, and unrelated to customer-derived
  content.
- Sanitized previews MUST use an allowlist and visible omission/masking labels.
- Search, filters, caches, errors, logs, screenshots, fixtures, and tests MUST
  use sanitized fictional values.
- No imported content, parser draft, customer data, financial data, tokens,
  secrets, test samples, or mutation state may be stored in local storage or
  session storage.

### Sensitive Actions

- Retry handoff, exception resolution, sender changes, parser-rule changes,
  version release/rollback, and merchant/category changes require explicit
  confirmation.
- Confirmation MUST show current/proposed state, scope, consequence,
  permission, planned audit event, mock-only notice, and cancel path.
- Actions MUST lock while pending, reject duplicate submission, and surface
  safe success, failure, forbidden, rate-limit, and conflict outcomes.

## Security Requirements

- **Untrusted inputs**: Parse, normalize, bound, and validate every route
  identifier, query/search/filter/sort value, date range, page value, bank,
  sender, pattern, language, priority, status, rule definition, sanitized
  sample, expected output, confidence, category, alias, scope, reason, mutation
  payload, and mock response.
- **Safe rendering**: Render all imported, bank, sender, parser, merchant,
  category, error, and diagnostic strings as plain text. Do not render raw HTML,
  Markdown, executable expressions, provider JSON, imported messages, or file
  contents. `dangerouslySetInnerHTML` is prohibited.
- **Declarative parser boundary**: Parser-rule definitions are data, not code.
  They use only allowlisted match conditions, capture fields, normalization
  transforms, and output mappings. Preview MUST NOT use dynamic evaluation,
  script execution, shell commands, recursive structures, executable
  regular-expression features outside the approved bounded format, or network
  calls.
- **Client storage and environment**: Do not store imported content, financial
  data, customer data, parser drafts, samples, safe-output previews, tokens,
  secrets, credentials, or mutation state in browser storage. No service key,
  storage credential, bank credential, parser secret, Supabase key, or queue
  credential may appear in browser-visible configuration.
- **Files and links**: This phase provides no real upload, download, attachment,
  or external bank link. If a future plan adds a mock file selector, it must
  validate allowlisted type, size, safe filename, invalid/malicious content,
  and preview isolation before implementation. New-tab links must prevent
  opener access.
- **Permissions**: Route guards, hidden navigation, disabled controls, and mock
  permissions are UX controls only. Every future backend read and mutation MUST
  independently authorize the actor and scope.
- **Dependencies**: Add no dependency unless required, reviewed, scoped,
  tested, and explicitly approved; this specification requires none.
- **Security mock scenarios**: Cover denied access, expired and invalid
  identifiers, unsafe content, masking failure, oversized input, malformed
  structure, overlapping patterns, duplicate aliases, stale state, duplicate
  submission, rate limiting, failed parser tests, and forbidden actions.
- **Deferred production controls**: NestJS authorization, Supabase policies,
  storage isolation, content scanning, encryption, retention deletion,
  idempotency, queue protection, worker sandboxing, parser resource limits,
  rate limiting, immutable audit storage, monitoring, and incident response
  remain future backend/infrastructure responsibilities.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- One import session contains items from multiple processing stages.
- A retry or replay resembles a new import but shares the original event
  identity.
- Platform attribution is missing or changes after processing.
- One multi-platform customer produces separate legitimate iOS and Android
  events in the same reporting period.
- Source, item, failure, and duplicate counts use different denominators.
- A session completes while the detail page is open.
- A failed import is resolved by another operator before confirmation.
- A low-confidence item has no merchant or category suggestion.
- A duplicate score is high but the customer previously rejected the match.
- An unsupported sender maps to multiple banks or countries.
- Bank names, sender labels, Arabic text, Latin text, numerals, and parser
  versions mix directionality.
- A sender or rule pattern is empty, oversized, overlapping, catastrophic, or
  contains unsafe markup.
- Parser expected and actual output contain unknown, sensitive, or excessive
  fields.
- Required parser tests fail while a release action is open.
- A rollback target is current, retired, missing, or incompatible; an eligible
  rollback creates a new Draft and leaves the selected historical version
  unchanged.
- Merchant aliases collide across global and scoped rules.
- A category is deactivated while a rule edit is open.
- Permission changes while a detail, editor, or confirmation dialog is open.
- A partial response omits only one bank, chart, timeline, or preview region.

## Out of Scope

- Real NestJS, Supabase, database, schema, migration, RLS, storage, parser,
  transaction, file, queue, worker, job, retry, bank, Open Finance, or provider
  implementation
- Real SMS or notification access, message ingestion, receipt/screenshot/voice
  processing, statement upload, OCR, parser execution, duplicate resolution, or
  transaction creation
- Real parser deployment, version release, rollback, process restart, queue
  control, or monitoring
- Raw customer financial data, bank statements, receipts, screenshots, SMS,
  notifications, voice recordings, files, account values, or transaction lists
- AI fallback, AI parsing, AI providers, prompt management, or model operations
- Support/content/notification, security/audit, system-health/jobs, data
  requests, admin-team, settings, and final-integration features from later specs
- Mobile, API, or Marketing specifications
- Redesign of approved routes, components, tokens, styles, assets, typography,
  navigation shell, or interaction language

## Acceptance Criteria

- **AC-001**: `/admin/imports` presents all required operational KPIs, trends,
  units, freshness, source distribution, platform context, bank coverage, and
  parser performance.
- **AC-002**: Import combined totals use authoritative event semantics and never
  double-count a replayed, retried, or duplicated event.
- **AC-003**: Import Sessions support the documented filters, sorting,
  pagination, masked values, and permission states.
- **AC-004**: Import Session Details present required safe metadata, timeline,
  item and duplicate summaries, parser reference, failure context, and sanitized
  extraction preview without raw content.
- **AC-005**: Failed, low-confidence, duplicate, and unsupported-format queues
  support their documented review outcomes with validation, confirmation,
  pending lock, and safe conflict behavior.
- **AC-006**: Supported Banks and Bank Details present source, sender, rule,
  test, performance, version, and status information according to permission.
- **AC-007**: Sender Management validates unsafe, overlapping, malformed, and
  stale patterns before simulated save.
- **AC-008**: Parser Rule Editor validates every required field and test preview
  uses sanitized deterministic data without executing code or a real parser.
- **AC-009**: Parser Test Cases and Versions expose pass/fail and release
  eligibility, and failed required tests block simulated release.
- **AC-010**: Merchant and Category Rules validate aliases, patterns,
  confidence, priority, scope, status, overlap, and stale-state conflict.
- **AC-011**: Every Phase 4 route demonstrates relevant loading, empty, partial,
  error, success, warning, and permission states.
- **AC-012**: Pages consume typed hooks and service/repository contracts; no
  page or presentation component imports raw fixtures.
- **AC-013**: Privacy review finds no raw imported content, unrestricted
  customer data, unsafe parser payload, secret, token, storage path, or private
  financial value in routes, fixtures, errors, logs, screenshots, or tests.
- **AC-014**: Arabic RTL and English LTR-ready behavior works at 1440px, 1280px,
  1024px, 768px, and 390px without hiding critical operational context.
- **AC-015**: Keyboard-only review can search, filter, paginate, open details,
  triage exceptions, operate confirmations, cancel, and recover focus without a
  keyboard trap.
- **AC-016**: Type checking, lint, tests, browser verification, and production
  build complete successfully before implementation is reported complete.

## Success Criteria

- **SC-001**: During verification, an authorized operator can identify the
  highest-failure import source and open the matching sessions within 90
  seconds.
- **SC-002**: 100% of seeded retry, replay, and duplicate-event examples retain
  authoritative combined totals without false additional original imports.
- **SC-003**: 100% of sensitive import and parser actions show scope,
  consequence, permission, confirmation, pending lock, and final outcome.
- **SC-004**: 100% of invalid identifiers, filters, sender patterns, parser
  definitions, samples, outputs, confidence values, aliases, and action
  payloads produce safe feedback without protected content exposure.
- **SC-005**: Privacy and security review finds zero default-view exposures of
  raw messages, notifications, receipts, screenshots, statements, voice
  content, files, private financial values, secrets, or executable parser input.
- **SC-006**: All five approved viewports complete the primary import overview,
  session review, exception triage, bank review, and parser status journeys
  without blocking overflow or hidden critical context.
- **SC-007**: Keyboard and screen-reader review finds no blocking focus,
  labeling, table, status, chart-summary, dialog, touch-target, directionality,
  or reduced-motion defect.
- **SC-008**: All required test cases prevent simulated parser-version release
  when any mandatory case fails.
- **SC-009**: 100% of seeded values at and beyond the documented page, search,
  name, note, pattern, sample, rule-definition, expected-output, and alias
  boundaries produce the specified accepted or safe validation outcome.

## Verification

Implementation verification for this future phase MUST include:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Route review**: Open all 16 Phase 4 routes in default and relevant loading,
  empty, partial, error, forbidden, detail, and mutation scenarios.
- **Platform review**: Verify All, Android, and iOS source/volume/performance
  views and confirm retry, replay, and duplicate events do not inflate
  authoritative combined totals.
- **Viewport review**: Verify 1440px, 1280px, 1024px, 768px, and 390px in Arabic
  RTL, plus English LTR readiness.
- **Accessibility review**: Verify keyboard navigation, focus restoration,
  semantic tables/forms/dialogs, chart summaries, status alternatives, touch
  targets, bidirectional text, and reduced motion.
- **Privacy/security review**: Scan changed source, fixtures, tests, logs, URLs,
  storage, environment use, errors, previews, dependencies, permissions,
  validation, pending locks, and masking for unsafe imported, parser, customer,
  financial, or secret data.

No verification result may be reported as successful unless the named command
or manual procedure was actually executed successfully.
