# Admin Web Feature Specification: Platform Overview and Cross-Platform Customer Analytics

**Phase / Spec**: Phase 1 / Spec 002 of 010  
**Created**: 2026-07-27  
**Status**: Draft  
**Input**: "Read the complete Admin Dashboard ten-specification plan and create Phase 1 — Spec 002: Platform Overview and Cross-Platform Customer Analytics."

## Phase

- **Phase**: Phase 1 — Overview Dashboard
- **Spec**: `002-admin-overview-and-platform-analytics`
- **Sequence**: Second of ten Admin Web specifications

## Goal

Complete the existing main Admin Overview so authorized operators can
understand platform-wide performance, compare iOS and Android customer
behavior, identify urgent operational conditions, and distinguish unique
customers from devices and events without exposing private financial records.

This specification is frontend-only and backend-aligned. It extends the
approved `/admin` experience in place and does not authorize backend,
authentication, database, provider, queue, or infrastructure implementation.

## Clarifications

### Session 2026-07-27

- Q: How is an active customer counted across the selected period and platforms? → A: Active during the selected reporting period; iOS and Android active audiences may overlap, while the combined active-customer total is authoritative and deduplicated.
- Q: What qualifies as customer activity for the active-customer metric? → A: A customer-initiated authenticated app session or feature-use event; background jobs, push delivery, provider callbacks, and Admin actions are excluded.
- Q: What event qualifies a customer as new? → A: Completion of customer registration during the selected reporting period; each customer is counted once.
- Q: How is a new customer attributed to a mobile platform? → A: To the platform where registration was completed; iOS and Android counts are mutually exclusive and the combined count remains deduplicated.
- Q: In what deterministic order are attention items displayed? → A: Severity descending, then newest timestamp first within the same severity.

## Dependencies

- **Prior phase/spec**: Phase 0 / Spec 001 — Admin Foundation and Design
  Preservation MUST be complete.
- **Existing route**: `/admin` remains the main Admin landing page; no
  replacement or parallel Overview route is created.
- **Existing components**: Admin shell, page header, platform filter, date
  range controls, metric cards, chart cards, status and severity badges,
  attention panel, activity list, loading/error/empty patterns, and accessible
  chart summaries MUST be reused.
- **Existing tokens and assets**: Current semantic colors, typography, spacing,
  Arabic RTL behavior, English LTR readiness, logo, light theme, and dark-theme
  compatibility MUST be preserved.
- **Existing contracts**: Phase 0 API error, pagination, platform filter,
  permissions, session, attention, and query-state contracts remain the shared
  foundation.

## Assumptions

- Phase 0 is complete and its Admin shell, typed boundaries, state patterns,
  permissions, mocks, and verification foundation remain available.
- The existing `/admin` route is the approved visual baseline.
- The current seven-role `admin.overview.read` permission remains unchanged.
- The default reporting period remains 30 days, with the approved 7-day and
  90-day options available.
- All values are realistic fictional mock data; no result represents current
  production performance.
- Currency totals are authoritative normalized aggregates supplied by the
  future backend. The browser does not convert or add incompatible currencies.
- Platform attribution appears only when the planned contract can support it.
- Later-phase detail routes remain inactive until their owning specification.

## Related Backend Modules

- **Planned backend modules**: admin, users, profiles, devices, subscriptions,
  payments, transaction-imports, AI, support, notifications, jobs, audit-logs,
  and system health capabilities.
- **Backend expectations**: The future backend owns authorization,
  aggregation, deduplication, reporting windows, financial calculations,
  platform attribution, persistence, audit records, and operational truth.
- **Boundary**: Proposed contracts and fictional mock HTTP behavior only. The
  Admin Web MUST NOT query a database, calculate production financial totals,
  invoke providers, control jobs, or simulate backend authority.

## Related Database Entities

- `auth.users`
- `profiles`
- `devices`
- `subscription_plans`
- `subscriptions`
- `payment_events`
- `transaction_imports`
- `import_items`
- `ai_usage`
- `ai_processing_jobs`
- `support_tickets`
- `notifications`
- `audit_logs`
- `job_runs`

These entity names are alignment references only and do not authorize schema,
query, migration, policy, or database implementation.

## Roles

- **Roles**: Super Admin, Support Agent, Billing Operator, Parser and Import
  Operator, AI Operator, Content Manager, and Security Administrator.

## Permissions

- **Base permission**: `admin.overview.read` is required to view `/admin`.
- **Attention permission**: `attention.read` is required for the attention
  panel. Each item's destination remains independently permission-aware.
- **Visible behavior**: All seven Phase 0 roles may view the privacy-safe
  Overview summaries currently allowed by the role map.
- **Hidden behavior**: Attention items, activity targets, or drill-down actions
  outside the simulated role's permissions are hidden or presented without an
  active destination.
- **Denied behavior**: Direct access without `admin.overview.read` presents the
  shared access-denied state and no protected metrics.
- **Later-module behavior**: Subscriptions, payments, support, AI, imports,
  jobs, audit, and system-health details remain summaries only unless an
  existing approved route and permission already supports navigation.

Permission-aware UI is development-only UX simulation and MUST NOT be
described as backend authorization.

## User Stories

### User Story 1 — Understand the Combined Platform (Priority: P1)

An authorized Admin opens the Arabic RTL Overview and immediately understands
the combined customer, revenue, adoption, and operational position for the
selected reporting period.

**Why this priority**: The combined operational view is the primary landing
experience and establishes the authoritative platform-wide totals.

**Independent test**: Open `/admin` with the default All Platforms filter and
verify that unique customers, active and new customers, paid/free customers,
revenue, imports, AI usage, support volume, incidents, and failed jobs show
their metric kind, reporting period, and safe update state.

**Acceptance scenarios**:

1. **Given** the default successful mock scenario, **When** an authorized Admin
   opens `/admin`, **Then** All Platforms is selected and the combined
   operational Overview is visible without requiring another action.
2. **Given** customers use both mobile platforms, **When** the combined
   customer total is shown, **Then** it uses the supplied deduplicated unique
   count and not the sum of iOS and Android customer counts.
3. **Given** a metric represents devices or exclusively attributed events,
   **When** its breakdown is shown, **Then** its unit is explicit and its total
   may equal the valid platform sum.
4. **Given** a combined total cannot be reconciled with its declared metric
   semantics, **When** the response is validated, **Then** the affected region
   shows a safe data-quality error instead of a fabricated total.

### User Story 2 — Compare iOS and Android Customers (Priority: P1)

An authorized Admin switches between All Platforms, iOS, and Android to
compare customer growth, activity, devices, app-version adoption, import
performance, and support demand.

**Why this priority**: Cross-platform comparison is the defining outcome of
Spec 002 and prevents combined data from hiding platform-specific problems.

**Independent test**: Switch through all three platform modes and verify that
every attributable KPI, chart, label, summary, and empty state uses the same
selected platform while global infrastructure metrics remain clearly global.

**Acceptance scenarios**:

1. **Given** All Platforms is selected, **When** the Admin selects iOS,
   **Then** customer, device, adoption, import, and support regions show iOS
   values and label their platform context.
2. **Given** iOS is selected, **When** the Admin selects Android, **Then** the
   same attributable regions show Android values without retaining stale iOS
   labels or values.
3. **Given** an operational metric has no mobile-platform attribution,
   **When** a platform filter changes, **Then** it remains labeled Global and
   is not incorrectly divided into iOS and Android.
4. **Given** multi-platform customers are included in both platform audiences,
   **When** comparison values are shown, **Then** the interface warns that the
   platform audiences overlap and MUST NOT be summed into unique customers.

### User Story 3 — Review Platform Adoption (Priority: P1)

An authorized Admin reviews platform-specific product adoption and version
distribution to identify outdated clients or underused capture capabilities.

**Why this priority**: App-version and capability adoption explain changes in
imports, support issues, and customer activity without exposing individual
customer data.

**Independent test**: Verify iOS and Android adoption summaries using
fictional distributions, including current/older app versions and the
platform-specific capabilities approved by the parent specification.

**Acceptance scenarios**:

1. **Given** iOS data is available, **When** the iOS Overview is shown,
   **Then** it includes unique, active, and new iOS customers, iOS devices,
   current app-version distribution, Shortcut adoption, Share Extension
   adoption, import volume/success, and support issues.
2. **Given** Android data is available, **When** the Android Overview is shown,
   **Then** it includes unique, active, and new Android customers, Android
   devices, current app-version distribution, SMS tracking adoption,
   Notification Listener adoption, import volume/success, and support issues.
3. **Given** an iOS data set, **When** capability adoption is described,
   **Then** the interface never implies unrestricted iOS SMS or notification
   access.
4. **Given** an unattributed or unknown app version, **When** it appears in a
   distribution, **Then** it is labeled as a data-quality category rather than
   silently merged with a known version.

### User Story 4 — Prioritize Operational Attention (Priority: P1)

An authorized Admin identifies urgent incidents, failed payments, import
spikes, AI outages, queue backlogs, security alerts, deletion failures, and
high-priority support conditions from a privacy-safe attention panel.

**Why this priority**: The Overview must support operational decisions, not
only passive reporting.

**Independent test**: Load the attention and operational regions for each
simulated role and verify severity, safe summaries, timestamps, platform
context, permission filtering, and valid destinations.

**Acceptance scenarios**:

1. **Given** multiple attention items, **When** the panel loads, **Then**
   critical and high-severity items are prioritized using label, icon, text,
   and color.
2. **Given** an item belongs to a later specification, **When** no approved
   detail route exists, **Then** it remains a summary without a broken or
   misleading link.
3. **Given** one attention or operational request fails, **When** other
   Overview regions succeed, **Then** available regions remain usable and the
   failed region provides a safe retry.
4. **Given** an item contains a private provider payload or customer detail,
   **When** it is normalized for display, **Then** only a sanitized summary and
   fictional identifier are presented.

### User Story 5 — Review Recent Platform Activity (Priority: P2)

An authorized Admin reviews recent privacy-safe platform events to understand
what changed without treating the feed as a production audit log.

**Why this priority**: Recent activity adds useful operational context but
does not replace the core metrics, attention panel, or future immutable audit
experience.

**Independent test**: Verify that the recent activity feed supports reporting
period, platform, pagination, empty, partial, and permission states using
sanitized fictional summaries.

**Acceptance scenarios**:

1. **Given** recent activity exists, **When** the Overview loads, **Then** each
   entry identifies a safe event type, masked or fictional target, timestamp,
   platform relevance, and permitted destination where available.
2. **Given** no activity matches the selected platform and period, **When**
   results load, **Then** a contextual empty state explains the active filters.
3. **Given** more entries exist than the initial limit, **When** the Admin
   requests more, **Then** the shared pagination contract is used rather than
   rendering an unbounded list.
4. **Given** the activity feed is mocked, **When** it is displayed, **Then** it
   is labeled operational activity and not immutable production audit history.

## Routes

| Route | Purpose | Roles | Existing/New |
|---|---|---|---|
| `/admin` | Combined, iOS, and Android platform Overview | Seven Phase 0 Admin roles with `admin.overview.read` | Existing; extended in place |

No new detail route is approved by Spec 002. Existing `/admin/imports`,
`/admin/users`, and `/admin/system-health` destinations may be used only where
the current permission map permits them. Later-module destinations remain
inactive until their owning specification.

## Functional Requirements

- **FR-001**: `/admin` MUST remain the main landing route and preserve its
  approved visual identity and working behavior.
- **FR-002**: All Platforms MUST be the default platform selection.
- **FR-003**: The Overview MUST support `all`, `ios`, and `android` as stable
  filter values with localized presentation labels.
- **FR-004**: Platform and reporting-period filters MUST apply consistently to
  every attributable metric, chart, attention item, and activity entry.
- **FR-005**: Each metric MUST declare whether it represents unique customers,
  devices, events, imports, requests, payments, tickets, or currency.
- **FR-006**: `uniqueCustomersTotal` MUST be supplied as an authoritative
  deduplicated count and MUST NOT be calculated by adding platform audiences.
- **FR-007**: The customer breakdown MUST distinguish iOS-only,
  Android-only, and multi-platform customers.
- **FR-008**: iOS and Android customer counts MAY overlap through
  multi-platform customers and MUST include a visible non-additive explanation.
- **FR-009**: Device totals MAY be additive only when every device is
  exclusively attributed to one platform.
- **FR-010**: Event totals MAY be additive only when the contract declares
  exclusive event attribution and no duplicate event is counted twice.
- **FR-011**: The combined Overview MUST include unique, active, new, paid, and
  free customer summaries.
- **FR-012**: The combined Overview MUST include subscription and recurring
  revenue summaries without exposing customer-level payment or transaction
  details.
- **FR-013**: The combined Overview MUST include import volume, AI usage,
  support volume, critical incidents, and failed-job summaries.
- **FR-014**: Customer, subscription, and revenue summaries MUST use
  authoritative combined totals rather than deriving production financial
  values in the browser.
- **FR-015**: The iOS Overview MUST include customer, device, app-version,
  Shortcut, Share Extension, import success, and support summaries.
- **FR-016**: The Android Overview MUST include customer, device, app-version,
  SMS tracking, Notification Listener, import success, and support summaries.
- **FR-017**: The iOS experience MUST NOT claim access to unrestricted SMS or
  notification data.
- **FR-018**: Version adoption MUST distinguish current, supported older,
  unsupported, and unknown/unattributed categories where present.
- **FR-019**: Platform comparison trends MUST use the same reporting window,
  unit, and aggregation semantics for every compared series.
- **FR-020**: Global infrastructure health MUST remain labeled Global and MUST
  not change with a mobile platform filter unless the metric has documented
  client attribution.
- **FR-021**: The attention panel MUST order items by severity descending and
  then by newest timestamp first within the same severity, without relying on
  color alone.
- **FR-022**: Attention items MUST include a safe summary, severity, timestamp,
  platform relevance, required permission, and optional approved destination.
- **FR-023**: Attention and activity destinations MUST be permission-filtered
  and MUST NOT expose inactive later-phase routes.
- **FR-024**: Recent activity MUST use sanitized fictional summaries and MUST
  not be represented as immutable production audit history.
- **FR-025**: The activity feed MUST support a bounded initial result and the
  shared pagination model.
- **FR-026**: Each independently loaded Overview region MUST expose relevant
  loading, success, empty, partial, error, warning, and permission behavior.
- **FR-027**: A regional failure MUST NOT blank unrelated successful Overview
  content.
- **FR-028**: Stale or partially available values MUST show freshness and
  availability warnings.
- **FR-029**: Invalid platform values, reporting periods, identifiers, mock
  responses, and pagination values MUST be rejected or normalized before use.
- **FR-030**: User-facing errors MUST use safe stable messages and MUST not
  expose raw exceptions, private payloads, provider details, or infrastructure
  paths.
- **FR-031**: Pages and presentation components MUST consume typed hooks and
  repositories and MUST NOT import raw mock fixtures.
- **FR-032**: Overview mock behavior MUST use replaceable frontend contracts
  aligned to future backend aggregation capabilities.
- **FR-033**: All displayed customer and financial information MUST remain
  aggregated; full emails, phone numbers, account identifiers, transaction
  content, provider payloads, and device identifiers are prohibited.
- **FR-034**: The Overview MUST support Arabic RTL by default and preserve
  English LTR readiness.
- **FR-035**: The Overview MUST remain usable at 1440px, 1280px, 1024px, 768px,
  and 390px without page-level horizontal overflow.
- **FR-036**: Every chart MUST provide a textual summary or equivalent
  accessible representation.
- **FR-037**: Keyboard, focus, screen-reader, contrast, touch-target, and
  reduced-motion requirements MUST apply to all new or changed interactions.
- **FR-038**: Application code introduced or modified for Spec 002 MUST use
  strict types, contain no `any`, and use semantic design tokens.
- **FR-039**: The UI MUST continue to state that role and permission
  simulation is development-only and future backend authorization is required.
- **FR-040**: Spec 002 MUST NOT implement or initialize backend modules,
  databases, real authentication, providers, queues, or infrastructure
  monitoring.
- **FR-041**: Customer and revenue analytics MUST include user growth, daily
  active users, monthly active users, subscription distribution, and revenue
  trend for the selected reporting period.
- **FR-042**: Operational and adoption analytics MUST include import volume,
  AI usage, mobile-platform distribution, app-version adoption, device
  distribution, platform-comparison trends, and error-rate trend.
- **FR-043**: The operational summary MUST represent API, database, cache,
  worker, storage, payment-webhook, AI-provider, and push-notification health
  as fictional aggregated status only.
- **FR-044**: Recent activity mocks MUST cover new-customer registration,
  subscription upgrade, failed webhook, parser-rule update, Admin-role change,
  support-access approval, and completed account deletion without activating
  later-phase workflows.
- **FR-045**: Attention mocks MUST cover critical incidents, failed-payment
  spikes, import spikes, AI-provider outages, queue backlogs, security alerts,
  account-deletion failures, and high-priority support tickets.
- **FR-046**: An active customer MUST have at least one customer-initiated
  authenticated app session or feature-use event within the selected reporting
  period. Background jobs, push delivery, provider callbacks, and Admin actions
  MUST NOT qualify. iOS and Android active audiences MAY overlap, while the
  combined active-customer total MUST be supplied as an authoritative
  deduplicated count.
- **FR-047**: A new customer MUST be counted once when customer registration is
  completed within the selected reporting period. Incomplete registrations,
  later onboarding completion, and first activity MUST NOT create an additional
  new-customer count. The customer MUST be attributed to the platform where
  registration was completed; iOS and Android new-customer counts MUST be
  mutually exclusive, and the combined total MUST remain deduplicated.

## Platform Data Requirements

- `all`, `ios`, and `android` are the stable platform-filter values.
- `all` is the default and represents authoritative combined values.
- `uniqueCustomersTotal` is deduplicated across customer accounts.
- `iosCustomers` and `androidCustomers` identify customers with at least one
  relevant device and may overlap.
- Active-customer metrics use the selected reporting period. Qualifying activity
  is limited to customer-initiated authenticated app sessions or feature-use
  events. Background jobs, push delivery, provider callbacks, and Admin actions
  are excluded. Platform-active audiences use the originating customer platform
  and may overlap; the combined active-customer total remains authoritative and
  deduplicated.
- New-customer metrics use registration completion within the selected reporting
  period as the qualifying event and count each customer once. Platform
  attribution uses the platform where registration was completed, so iOS and
  Android new-customer counts are mutually exclusive and their combined count
  remains deduplicated.
- `multiPlatformCustomers` is the overlap between iOS and Android audiences.
- `iosOnlyCustomers + androidOnlyCustomers + multiPlatformCustomers` MUST
  equal the authoritative unique-customer total for the same reporting scope.
- `iosCustomers + androidCustomers - multiPlatformCustomers` MAY be used only
  as a validation invariant, never as the browser's source of production truth.
- Device counts may be added when a device has exactly one platform.
- Import, AI, support, payment, and activity events may be added only when
  each event has one exclusive origin and deduplication is already resolved.
- Revenue and subscription totals belong to customer accounts. Platform
  attribution is usage context and MUST NOT duplicate multi-platform customer
  revenue.
- Unknown or unattributed platform/version data requires a visible
  data-quality state and MUST not be silently reassigned.
- Global service health remains global unless the future backend contract
  provides valid platform attribution.

## UX and Design Requirements

- Preserve the approved `/admin` layout and Masarifi Gulf Premium Design
  System Version 2.1.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep the page neutral, data-dense, professional, and operational.
- Reuse current metric, chart, attention, health, activity, filter, badge, and
  feedback patterns before introducing a missing state.
- Preserve the current content hierarchy: page context and filters, priority
  metrics, customer trend/attention, analytical comparisons, operational
  health, and recent activity.
- Financial semantic colors MUST remain separate from system status and
  severity colors.
- Platform identity MUST use text labels and accessible summaries, not
  platform-colored decoration alone.
- Avoid decorative dashboard cards, gradients, marketing imagery, excessive
  bronze, flags used as platform meaning, and generic analytics-template
  styling.
- Every metric and chart MUST show enough context to understand platform,
  period, unit, and freshness.

## Responsive Requirements

- **Arabic RTL default**: Filters, comparison order, legends, tooltips,
  attention metadata, activity chronology, and directional icons follow
  logical RTL order.
- **English LTR readiness**: Direction changes without reversing numeric
  meaning, chart chronology, platform semantics, or status hierarchy.
- **1440px**: Full sidebar and topbar, persistent platform/date controls,
  multi-column KPI groups, side-by-side customer comparisons, full charts, and
  complete attention/activity panels.
- **1280px**: Approved compact sidebar behavior, reduced gaps, retained
  platform/date controls, and all primary KPI/context labels visible.
- **1024px**: Prioritized summary cards and charts with compact controls,
  wrapped legends, and no page-level horizontal clipping.
- **768px**: Drawer navigation, two-column or single-column analytical
  sections, collapsible secondary detail, and touch-accessible filters.
- **390px**: Simplified monitoring view prioritizing critical attention,
  combined customer state, platform switch, key adoption warnings, health, and
  recent urgent activity. Dense comparisons become stacked summaries rather
  than unusable tables.

## Accessibility Requirements

- Platform and reporting-period controls MUST have accessible names, selected
  states, logical keyboard order, and visible focus.
- KPI changes MUST include text or symbols with accessible meaning and MUST
  not communicate direction by color alone.
- Charts MUST include an accessible title, unit, platform/reporting context,
  and non-empty textual summary.
- Comparison legends MUST remain understandable without color.
- Attention and activity lists MUST use semantic structure, readable
  timestamps, and descriptive destination names.
- Regional loading and status changes MUST use appropriate busy, status, or
  alert semantics without excessive announcements.
- Empty, error, partial, stale, denied, and data-quality states MUST be
  screen-reader understandable.
- Interactive touch targets MUST be at least 44px at touch viewports.
- Dialogs or drawers reused by the Overview MUST trap and restore focus.
- Reduced motion MUST remove nonessential chart and state transitions without
  hiding the resulting values.
- Text and meaningful controls MUST meet approved WCAG-aligned contrast in
  light and dark themes.

## Proposed API Contracts

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|---|---|---|---|---|
| `GET` | `/api/v1/admin/overview` | `OverviewQuery` | `OverviewSummaryResponse` | admin aggregation across users, subscriptions, payments, imports, AI, support, jobs, and health |
| `GET` | `/api/v1/admin/overview/platform-analytics` | `PlatformAnalyticsQuery` | `PlatformAnalyticsResponse` | users, profiles, devices, imports, subscriptions, support, and reporting aggregation |
| `GET` | `/api/v1/admin/overview/activity` | `OverviewActivityQuery` | `PaginatedResponse<OverviewActivityItem>` | audit-aligned operational activity projection |
| `GET` | `/api/v1/admin/attention` | `AttentionQuery` | `PaginatedResponse<AttentionItem>` | permission-filtered incidents, payments, imports, AI, security, support, deletion, and job signals |

Pages MUST consume these contracts through typed hooks and repositories and
MUST NOT import raw mock arrays. Proposed paths describe replaceable frontend
contracts only and do not create a real API.

## Frontend Types

- **`OverviewQuery`**: Platform, supported reporting period, locale, and
  optional mock-scenario identifier.
- **`MetricKind`**: `unique-customers | devices | events | imports | requests |
  payments | tickets | currency`.
- **`OverviewMetric`**: Stable identifier, localized label, formatted value,
  numeric source value, metric kind, platform scope, reporting period,
  freshness, change, and semantic tone.
- **`CustomerPlatformBreakdown`**: Authoritative unique total, iOS customers,
  Android customers, multi-platform customers, iOS-only customers, and
  Android-only customers.
- **`PlatformAnalyticsResponse`**: Customer breakdown, activity, devices,
  version distribution, capability adoption, imports, support, and comparison
  trends for the requested platform and period.
- **`AppVersionDistributionItem`**: Platform, version, support state,
  customer/device count, share, and unknown/unattributed flag.
- **`CapabilityAdoptionMetric`**: Platform capability, eligible population,
  enabled population, rate, reporting period, and safe caveat.
- **`PlatformOperationalMetric`**: Metric identifier, platform attribution,
  metric kind, total, success/failure values, rate, and freshness.
- **`OverviewSummaryResponse`**: Combined KPIs, revenue/subscription summary,
  import/AI/support/job summary, service health, region availability, and data
  freshness.
- **`OverviewActivityItem`**: Fictional identifier, safe event type, sanitized
  summary, timestamp, platform relevance, permission, and optional approved
  destination.
- **`OverviewRegionState`**: Available, empty, stale, partial, unavailable, or
  forbidden with safe contextual detail.
- Existing `ApiError`, `PaginatedResponse<T>`, `AttentionItem`,
  `PlatformFilter`, `AdminRole`, and `PermissionKey` types remain shared.
- Application types MUST NOT use `any`.

## Mock Scenarios

- **Default success**: Complete combined, iOS, and Android data with valid
  deduplication invariants.
- **iOS-only**: iOS customer/device/adoption values, zero Android audience, and
  no unsupported iOS SMS/notification claims.
- **Android-only**: Android customer/device/adoption values and zero iOS
  audience.
- **Multi-platform**: Overlapping iOS/Android audiences with an authoritative
  deduplicated total.
- **Multi-device**: One fictional customer represented by multiple devices
  without duplicating the unique-customer total.
- **Empty**: No data for the selected period/platform with contextual filter
  recovery.
- **Large result set**: Paginated recent activity and attention data.
- **Slow**: Stable skeletons preserve the approved layout and announce busy
  state.
- **Partial**: One analytical region is unavailable while other regions remain
  usable.
- **Stale**: Values remain visible with last-updated and stale-data warning.
- **Invalid input/response**: Unsupported platform/period, impossible
  customer breakdown, invalid rate, unsafe text, or malformed pagination.
- **Unauthorized/forbidden**: Protected Overview content is removed.
- **Rate limited/provider unavailable/internal error**: Safe regional or page
  errors with appropriate retry.
- **Unknown attribution**: Unknown platform or app version is visible as a
  data-quality category.
- **Version fragmentation**: A material supported/unsupported version split
  produces an adoption warning.

## Loading States

Page and regional skeletons preserve KPI, chart, attention, health, and
activity layout. Platform/date controls prevent misleading overlapping
requests while required data is refreshing.

## Empty States

The page distinguishes a genuinely empty platform/period from a failed
request. Empty regions name the active filters and provide a safe reset to All
Platforms or the default period.

## Error States

Safe localized errors distinguish invalid input, forbidden access, rate
limiting, unavailable data, and internal failure. Regional retry does not
clear unrelated successful regions.

## Success States

Loaded values show platform, period, unit, and freshness. A manual refresh
updates the visible freshness state without claiming a production data sync.

## Warning and Confirmation States

Warnings cover stale or partial data, overlapping platform audiences,
unsupported app versions, unknown attribution, degraded service, and
development-only mock behavior.

**Permission state**:

Denied Overview access removes protected content. Permission-filtered
attention/activity destinations do not render an unauthorized link.

## Audit Expectations

- Spec 002 is read-only and introduces no destructive or privacy-sensitive
  mutation.
- Platform/date filter changes and local refresh do not fabricate production
  audit events.
- The future backend may audit Overview access, exports, or protected
  drill-downs; Spec 002 does not create immutable audit records.
- If a future revision adds export or mutation behavior, it requires a
  separate approved scope with permission, confirmation, consequence,
  duplicate-submission lock, outcome states, and expected audit event.

## Privacy Rules

- Customer counts, adoption, revenue, imports, support, AI, and operational
  values are aggregated.
- No full customer email, phone number, account number, transaction content,
  device identifier, IP address, imported message, provider payload, AI
  conversation, or payment payload is displayed.
- Activity and attention use sanitized fictional identifiers and summaries.
- User-facing errors and development logs exclude secrets, private payloads,
  internal paths, stack traces, and raw exceptions.

## Security Requirements

- **Untrusted inputs**: Platform values, reporting periods, pagination,
  identifiers, query parameters, mock scenarios, response values, labels,
  timestamps, rates, version strings, destinations, and metric kinds require
  normalization and validation before use.
- **Safe rendering**: Summaries, attention text, activity text, version labels,
  error detail, and all response content render as escaped text or constrained
  structured values. Raw HTML and `dangerouslySetInnerHTML` are prohibited.
- **Client storage and environment**: Customer, financial, device, attention,
  activity, filter-result, and temporary-access data MUST NOT be persisted in
  client storage. No secret or private configuration may use a browser-exposed
  environment variable.
- **Files and links**: Spec 002 introduces no upload or preview. External
  new-tab links are not required. Internal destinations are fixed approved
  routes and remain permission-filtered.
- **Permissions**: Client navigation and conditional presentation are UX
  controls only. Every future backend endpoint independently authorizes the
  request and filters the returned data.
- **Dependencies**: No new dependency is expected. Any exception requires an
  approved-stack gap, security/maintenance review, scoped documentation, and
  complete verification.
- **Security mock scenarios**: Invalid filter, malformed response, impossible
  customer count, unsafe summary text, masked-data regression, unauthorized,
  forbidden, expired session, unapproved destination, stale response, and
  regional failure.
- **Deferred production controls**: Real authentication and authorization,
  reporting views, database policies, encryption, rate limiting, audit
  persistence, provider-secret handling, operational monitoring, and
  penetration testing remain future backend/infrastructure responsibilities.

Security controls follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- iOS and Android customer counts both exceed the unique total because the
  audience overlaps; the authoritative unique total remains unchanged.
- The sum of iOS-only, Android-only, and multi-platform customers does not
  equal the unique total; the customer region fails safely as inconsistent.
- A customer owns multiple iOS or Android devices; device totals increase
  without increasing unique customers.
- An event appears from both an import and retry stream; the mock contract
  provides a deduplicated event total rather than asking the UI to guess.
- A revenue attribution is available for both platforms for a multi-platform
  customer; the UI does not sum the two attributions into combined revenue.
- One platform has zero values while the other has data; the zero platform
  shows a valid empty state and the combined view remains usable.
- A metric lacks platform attribution; it remains Global during platform
  filtering.
- A metric has a different unit or reporting window than its comparison; the
  comparison is rejected or separated instead of charted together.
- An app version is missing, unknown, malformed, or unsupported; it appears in
  a visible quality/adoption state.
- The selected period changes during an outstanding request; stale results do
  not overwrite the latest selection.
- A regional retry succeeds after a partial failure; only that region updates.
- A long Arabic/English label, 200% text scaling, or narrow viewport pressures
  a chart legend; content wraps or exposes an accessible full label without
  overlap.
- A mocked attention destination points to a later-phase route; the destination
  is removed while the safe summary may remain.
- A response contains raw private customer/provider content; validation rejects
  it and the safe error model is shown.

## Out of Scope

- New Overview routes or redesign of `/admin`.
- User lists/profiles/devices/sessions and controlled support access owned by
  Spec 003.
- Subscription, payment, revenue-management, or reconciliation workflows
  owned by Spec 004.
- Import/parser detail and mutation workflows owned by Spec 005.
- AI, support/content/notification, security/audit/privacy, health/jobs, and
  governance/settings detail workflows owned by Specs 006–010.
- Exporting Overview data, saved dashboards, custom widgets, custom reports,
  forecasting, anomaly configuration, or real-time streaming.
- Customer-level financial values, transaction lists, raw imports, private AI
  conversations, provider payloads, and unrestricted device data.
- Production authentication, authorization, databases, reporting views,
  providers, queues, jobs, monitoring, audit persistence, or real data.
- Dependency upgrades, framework changes, route migration, visual redesign, or
  unrelated refactoring.
- Mobile, API, or Marketing specifications.

## Acceptance Criteria

- **AC-001**: `/admin` retains its approved hierarchy and visual identity in
  Arabic RTL and English LTR, light and dark themes, at all five approved
  viewports.
- **AC-002**: All Platforms is the default and all attributable Overview
  regions switch consistently among All Platforms, iOS, and Android.
- **AC-003**: Every displayed metric identifies its platform, reporting
  period, unit/metric kind, and freshness.
- **AC-004**: Every mock scenario containing multi-platform customers uses
  authoritative deduplicated unique and active combined totals, and 100% of
  counting-invariant checks pass. Fixtures containing only background jobs, push
  delivery, provider callbacks, or Admin actions do not increase active-customer
  counts. Each completed registration increases the applicable new-customer
  count at most once; incomplete registration, onboarding completion, and first
  activity do not increase it. Each new customer appears in exactly one of the
  iOS or Android new-customer counts according to registration origin.
- **AC-005**: iOS and Android Overview data include every platform-specific
  customer, device, adoption, import, and support measure required by the
  parent ten-specification plan.
- **AC-006**: Global infrastructure metrics remain visibly global and do not
  change incorrectly when the mobile platform filter changes.
- **AC-007**: Combined revenue, subscriptions, and customer values are not
  produced by summing overlapping platform attribution in the browser.
- **AC-008**: Attention items are ordered by severity descending and newest
  timestamp first within the same severity. Critical and high items use text,
  label, icon, and color; destinations are permission-filtered and never point
  to an inactive route.
- **AC-009**: Loading, empty, partial, stale, invalid, rate-limited,
  unavailable, internal-error, warning, and permission states are
  independently demonstrable without blanking unrelated successful regions.
- **AC-010**: Every Overview chart has an accessible summary and every status,
  trend, platform, and severity remains understandable without color.
- **AC-011**: Keyboard-only operation can use platform/date filters, refresh,
  attention, activity pagination, retries, and any reused drawer/dialog with
  visible focus and correct focus restoration.
- **AC-012**: Security review finds no private customer/financial payload,
  unsafe rendering, unvalidated input, insecure storage, public secret,
  unapproved destination, unsafe error/log detail, or unreviewed dependency.
- **AC-013**: All `/admin` data reaches presentation through typed hooks and
  repositories with zero page or presentation-component raw fixture imports.
- **AC-014**: Application code added or changed for Spec 002 contains no
  `any`, uses semantic tokens, and preserves the fixed approved stack.
- **AC-015**: Under the documented reference conditions, primary Overview
  content becomes visible within 2.5 seconds and each tested local filter,
  refresh, retry, or expansion action acknowledges input within 200
  milliseconds.
- **AC-016**: Typecheck, zero-warning lint, unit/component tests, browser
  journeys, security review, accessibility review, design-preservation review,
  and production build all pass before implementation is reported complete.
- **AC-017**: No backend, database, real authentication, payment provider, AI
  provider, queue, infrastructure monitor, or later-phase workflow is added.

## Success Criteria

- **SC-001**: 100% of the required combined, iOS, and Android measures from the
  parent plan are represented by a testable requirement and mock scenario.
- **SC-002**: 100% of customer-count fixtures satisfy the unique-customer,
  active-customer, new-customer, qualifying-activity exclusion, iOS-only,
  Android-only, and multi-platform invariants.
- **SC-003**: Reviewers can identify whether every visible Overview value is a
  unique-customer, device, event, import, request, payment, ticket, or currency
  measure without inspecting implementation code.
- **SC-004**: All three platform modes update every attributable Overview
  region consistently, with zero stale-platform labels in tested journeys.
- **SC-005**: All global metrics remain correctly labeled and unchanged by
  irrelevant platform filtering in tested journeys.
- **SC-006**: 100% of reviewed Overview customer and financial information is
  aggregated, masked, fictional, or omitted.
- **SC-007**: All seven simulated roles can evaluate their allowed Overview and
  attention states without real authentication or a false claim of backend
  authorization.
- **SC-008**: The complete route/theme/direction/viewport matrix reports zero
  unapproved design regression, page-level overflow, or new console error.
- **SC-009**: Accessibility review reports zero blocking keyboard, focus,
  naming, contrast, color-only, chart-summary, touch-target, or reduced-motion
  defect.
- **SC-010**: 100% of sampled default Overview loads and local interactions
  meet the 2.5-second visibility and 200-millisecond acknowledgement gates
  under documented reference conditions.
- **SC-011**: Every required automated completion command exits successfully
  before Spec 002 is reported implemented.

## Verification

The commands and reviews below are required for future Spec 002 implementation.
Their presence is not a claim that they have been executed for this draft:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests (Vitest)**: `npm run test`
- **End-to-end tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Fixture-boundary scan**:
  `rg -n "@/mocks/fixtures|@/data|data/admin" src/app src/components`
- **Strict-type scan**:
  `rg -n "\bany\b" src --glob "*.ts" --glob "*.tsx"`
- **Viewport and accessibility review**: Verify `/admin` at 1440px, 1280px,
  1024px, 768px, and 390px in Arabic RTL and English LTR, light and dark
  themes, followed by keyboard, focus, semantic, contrast, screen-reader,
  chart-summary, touch-target, and reduced-motion review.
- **Platform-data review**: Verify combined, iOS, Android, iOS-only,
  Android-only, multi-platform, multi-device, unknown-attribution, and
  deduplication scenarios for every applicable metric kind.
- **Security review**: Review sensitive data, validation, rendering,
  permissions, storage, environment exposure, links, destinations, errors,
  logs, dependencies, privacy masking, and deferred backend protections.
- **Design-preservation review**: Compare the completed Overview with the
  approved pre-Spec 002 route at all required themes, directions, and
  viewports.
- **Performance review**: Record the reference environment and verify the
  2.5-second primary-content and 200-millisecond local-acknowledgement outcomes.

Successful verification MUST NOT be claimed unless each named command and
review was actually executed successfully.
