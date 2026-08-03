# Admin Web Feature Specification: Support, Feedback, Content, and Notifications

**Phase / Spec**: Phase 6 / Spec 007 of 010  
**Created**: 2026-07-29  
**Status**: Draft  
**Input**: "Read the complete masarifi-admin-dashboard-full-frontend-specification-v3-10-specs.md and create Phase 6 — Spec 007: Support, Feedback, Content, and Notifications."

## Phase

- **Phase**: Phase 6 — Content and support
- **Spec**: `007-admin-support-content-and-notifications`
- **Delivery position**: Seventh of the approved ten sequential Admin Web specifications
- **Boundary**: Frontend-only support and communication operations using typed mock contracts and sanitized fictional data

## Goal

Enable authorized Admin operators to triage support tickets and feedback,
review abuse reports, maintain bilingual customer-help content, manage
announcement and message templates, and simulate notification campaigns and
delivery monitoring without exposing unnecessary customer data or sending any
real communication.

This phase extends the approved Admin Dashboard and Specs 001–006. It does not
deliver email, push, or in-app messages; contact a provider; grant support
access; inspect private financial records; or implement backend persistence.

## Clarifications

### Session 2026-07-29

- Q: Does one notification campaign use one channel or several channels? → A: Exactly one channel per campaign; a multi-channel communication uses separately reviewed campaigns.
- Q: How many teams and agents may own one support ticket? → A: One owning team and at most one assigned agent; reassignment atomically replaces the current owner.
- Q: What happens when an agent replies to a Resolved or Closed ticket? → A: A reply to Resolved atomically reopens it to Open; Closed must be explicitly reopened before any reply.
- Q: Which denominators govern notification delivery, failure, open, token-failure, and opt-out rates? → A: Delivered/attempted, failed/attempted, opened/delivered, token failures/push attempts, and opted out/targeted unique audience.
- Q: Which campaign scheduling modes are in scope? → A: One-time Send Now or one future scheduled time; both require review and confirmation, and recurring campaigns are excluded.

## Dependencies

- **Prior phase/specs**: Specs 001–006 MUST remain reusable and visually
  unchanged.
- **Existing foundation**: Reuse the Admin shell, grouped navigation,
  breadcrumbs, page headers, date/platform filters, metric and chart cards,
  tables/cards, drawers, dialogs, confirmations, timeline, internal notes,
  attachment presentation, masked fields, permission boundary, query provider,
  typed repository pattern, mock scenario controls, semantic tokens, and RTL/
  LTR behavior.
- **Cross-module references**: Spec 003 supplies masked customer, device,
  temporary-access-request, and support-workspace references; Specs 004–006
  supply safe linked payment/import/AI references without embedding their
  protected details.
- **Sequence**: This spec MUST NOT implement security/audit exploration,
  system-health/jobs, privacy requests, admin-team governance, global settings,
  or final cross-module hardening assigned to Specs 008–010.

## Assumptions

- All customers, agents, tickets, messages, feedback, abuse reports, files,
  content, campaigns, templates, and delivery records are fictional and
  sanitized.
- Lists default to 25 rows and allow 25, 50, or 100 rows, with 100 maximum.
- Operational dashboards default to the last 30 calendar days in the Admin
  application time zone.
- Search text is limited to 120 Unicode characters; ticket subjects to 160;
  customer-visible messages to 8 KiB; internal notes to 2 KiB; and content
  bodies to 16 KiB.
- Ticket priorities are Low, Medium, High, and Urgent. Ticket states are New,
  Open, Awaiting Customer, Awaiting Agent, Resolved, and Closed.
- Feedback states are New, Under Review, Planned, Linked, Resolved, Dismissed,
  and Closed. Abuse-report states are New, Investigating, Escalated, Resolved,
  and Dismissed.
- Campaign states are Draft, Scheduled, Sending, Paused, Completed, Cancelled,
  and Failed. “Sending” and delivery outcomes are mock state only.
- A campaign supports one-time Send Now or one future scheduled time in the
  Admin application time zone. Both require review and confirmation. A future
  time must be later than the current application time; recurring schedules are
  excluded.
- Audience size, SLA state, severity, delivery eligibility, opt-out exclusion,
  open rate, and failure classification are authoritative future-backend
  values; the frontend does not derive production policy.
- Customer-visible content requires Arabic and English variants unless its
  approved audience is explicitly single-language.
- Attachments are metadata-only fictional records. A simulated attachment may
  use PDF, PNG, JPEG, or plain-text types, a safe filename, and a maximum
  declared size of 10 MiB; no real file upload or download occurs.
- Email, push, and in-app templates use allowlisted placeholders and structured
  plain text. Arbitrary HTML, Markdown, scripts, URLs, and provider payloads are
  not accepted.
- Standard mock pages target usable content within 2 seconds and filter, sort,
  or pagination updates within 1 second at the 95th percentile. Labeled slow
  scenarios are excluded.

## Backend Alignment

### Planned Backend Modules

- `support`
- `feedback`
- `notifications`
- `content`
- `files`
- `users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `audit-logs`

The future backend remains responsible for authorization, persistence, message
delivery, provider credentials, audience resolution, consent and opt-out
enforcement, rate limits, suppression, attachment scanning/storage, content
publishing, immutable auditing, retention, and production monitoring.

### Planned Entities

- `support_tickets`
- `support_messages`
- `support_assignments`
- `support_categories`
- `support_internal_notes`
- `feedback_items`
- `abuse_reports`
- `attachments`
- `default_categories`
- `financial_tips`
- `faq_entries`
- `onboarding_content`
- `help_center_articles`
- `announcement_banners`
- `notification_templates`
- `notification_campaigns`
- `notification_deliveries`
- `notification_preferences`
- `users`
- `profiles`
- `devices`
- `roles`
- `permissions`
- `audit_logs`

Names are alignment references only. This phase creates no schema, migration,
provider account, storage bucket, queue, job, database query, or backend route.

## Roles and Permissions

### Roles

- **Super Admin**: May view every Phase 6 route and perform all simulated
  support, content, template, campaign, and review actions.
- **Support Agent**: May manage tickets, assignments, support categories,
  customer-visible replies, internal notes, and linked feedback. Customer
  context remains masked and scoped to the support purpose.
- **Content Manager**: May manage default categories, financial tips, FAQs,
  onboarding/help content, announcements, templates, and mock campaigns. May
  view aggregate feedback on its authorized feedback route, but has no direct
  support route.
- **Security Administrator**: May review and disposition abuse reports and see
  severe support/feedback references only inside the authorized abuse context;
  no direct support/general-feedback route, ticket conversation, or
  campaign-management access.
- **Billing Operator**, **Parser and Import Operator**, and **AI Operator**:
  May see only a safe linked ticket summary when a record belongs to their
  domain; no general Phase 6 route access by default.

### Permission Matrix

| Capability | Proposed permission | Super Admin | Support Agent | Content Manager | Security Admin |
|---|---|---|---|---|---|
| Support dashboard/list/detail | `support.tickets.read` | Allowed | Allowed | No direct route | Linked severe reference only |
| Reply, note, assignment, status | `support.tickets.manage` | Allowed | Allowed | No | No |
| Support categories | `support.categories.manage` | Allowed | Allowed | Read | No |
| Feedback overview/list/detail | `feedback.read` | Allowed | Allowed | Aggregate/read | Linked severe reference only |
| Feedback disposition/link | `feedback.manage` | Allowed | Allowed | Content-related only | No |
| Abuse reports | `feedback.abuse.manage` | Allowed | No | No | Allowed |
| Default financial categories | `content.categories.manage` | Allowed | No | Allowed | No |
| Tips, FAQs, onboarding, help | `content.manage` | Allowed | Read | Allowed | No |
| Announcements/templates | `communications.templates.manage` | Allowed | Read | Allowed | No |
| Notification overview/logs | `notifications.read` | Allowed | Linked record only; no direct logs route | Allowed | Linked security failure only; no direct logs route |
| Campaign create/manage | `notifications.campaigns.manage` | Allowed | No | Allowed | No |

- A missing route permission MUST show the shared access-denied state without
  protected message, attachment, audience, delivery, or customer fields.
- Missing action permission MUST hide the action or disable it with a clear
  reason. Direct mock mutations MUST return a safe forbidden result.
- Limited views MUST be structural projections, not full objects hidden by CSS.
- “Linked” access is returned only inside an already authorized ticket, abuse,
  or domain record; it does not grant the role permission to open the target
  Phase 6 route directly.
- Permission-aware UI remains a development-only UX simulation and is not
  production authorization.

## User Scenarios and Testing

### User Story 1 — Triage and Resolve Support Tickets (Priority: P1)

A Support Agent reviews workload and SLA risk, filters tickets, opens a ticket,
reviews sanitized conversation and linked operational context, assigns it,
adds an internal note or customer-visible reply, and updates its state.

**Why this priority**: Timely, privacy-safe ticket resolution is the core
purpose of the workspace.

**Independent test**: An authorized agent can identify an urgent at-risk
ticket, assign it, record a response, and move it to an allowed state in under
three minutes without exposing unrelated customer or financial data.

**Acceptance scenarios**:

1. **Given** the support dashboard, **When** the period or platform changes,
   **Then** open, urgent, waiting, resolved, response-time, resolution-time,
   type, priority, trend, and SLA summaries update with freshness and units.
2. **Given** the ticket list, **When** an agent searches, filters, sorts, or
   paginates, **Then** the URL-safe state and result count remain visible and
   invalid values are rejected safely.
3. **Given** a ticket detail, **When** it loads, **Then** only the sanitized
   conversation, masked user summary, platform/app version, safe linked
   records, notes, attachment metadata, activity, and SLA state appear.
4. **Given** an allowed assignment, reply, note, or state transition, **When**
   the agent confirms where required, **Then** the mock state changes once,
   focus is restored, success is announced, and a planned audit reference is
   shown.
5. **Given** a stale ticket, closed ticket, missing permission, expired support
   context, or duplicate submission, **When** an action is attempted, **Then**
   it is blocked without losing entered text or exposing protected content.

### User Story 2 — Review Feedback and Abuse Reports (Priority: P1)

An authorized operator reviews feedback trends and individual reports, links
valid feedback to a ticket or content item, records a disposition, and routes
abuse reports to the Security Administrator.

**Why this priority**: Feedback and abuse need distinct privacy and escalation
paths even when they originate from the same mobile applications.

**Independent test**: Feedback can be classified and linked while an abuse
report remains restricted to its authorized reviewer and exposes only bounded,
sanitized evidence.

**Acceptance scenarios**:

1. **Given** feedback data, **When** filters change, **Then** new feedback, bug
   reports, feature requests, ratings, AI/import feedback, platform, version,
   and status update without inferring missing classifications.
2. **Given** feedback detail, **When** it renders, **Then** message, masked user
   and device context, safe attachments, notes, linked ticket, and resolution
   state are presented as plain text and bounded metadata.
3. **Given** a link or disposition action, **When** it is confirmed, **Then**
   expected state/version is enforced and duplicate links are not created.
4. **Given** an abuse report, **When** an unauthorized role opens or mutates it,
   **Then** no reporter, target, evidence, or reviewer detail is returned.
5. **Given** unsafe markup, bidi controls, oversized content, or an invalid
   attachment record, **When** validation occurs, **Then** the content is
   rejected before rendering.

### User Story 3 — Govern Bilingual Content (Priority: P1)

A Content Manager maintains default financial categories, tips, FAQs,
onboarding steps, and help-center articles with Arabic/English completeness,
platform scope, ordering, preview, and lifecycle controls.

**Why this priority**: Customer-facing guidance must remain accurate,
consistent, bilingual, and safely publishable.

**Independent test**: A content item can move from Draft to Published only
when required translations, scope, ordering, and safe structured content pass.

**Acceptance scenarios**:

1. **Given** a content collection, **When** it is filtered by type, language,
   platform, category, or status, **Then** safe summaries, ownership, updated
   time, and publication eligibility are visible.
2. **Given** a default category, **When** it is edited, **Then** Arabic/English
   names, stable key, parent, transaction type, allowlisted icon/color token,
   sort order, status, and usage count are validated.
3. **Given** a tip, FAQ, onboarding step, or help article, **When** previewed,
   **Then** Arabic RTL and English LTR variants use plain text and approved
   assets without executing markup or external content.
4. **Given** missing translation, duplicate key/order, cyclic category parent,
   invalid platform scope, unsafe placeholder, or stale version, **When**
   publication is attempted, **Then** it is blocked with specific safe errors.
5. **Given** an item in active use, **When** retirement is requested, **Then**
   the impact and replacement requirement are shown before confirmation.

### User Story 4 — Manage Announcements and Message Templates (Priority: P1)

A Content Manager creates or revises announcement banners and structured email
and push templates, verifies audience/language/platform compatibility, previews
them, and simulates activation.

**Why this priority**: Campaigns and transactional communication depend on
safe, approved, reusable content.

**Independent test**: A template or announcement can be activated only when
its variants, placeholders, audience, schedule, and platform constraints pass.

**Acceptance scenarios**:

1. **Given** an announcement, **When** it is edited, **Then** title, message,
   audience, platform, start/end, priority, status, and both-direction previews
   are available.
2. **Given** an email or push template, **When** it is reviewed, **Then**
   trigger, language, subject/title, body, platform, allowlisted placeholders,
   status, and safe preview are visible.
3. **Given** an unknown placeholder, arbitrary data payload, unsafe URL,
   missing translation, expired schedule, or platform-incompatible template,
   **When** activation is attempted, **Then** it is rejected.
4. **Given** a permitted activation or retirement, **When** confirmed, **Then**
   the UI shows scope, consequence, previous/proposed state, pending lock,
   mock-only notice, result, and planned audit reference.

### User Story 5 — Simulate Notification Campaigns and Monitor Delivery (Priority: P1)

A Content Manager reviews delivery health, builds a mock campaign through
audience, channel, content, schedule, and review steps, then monitors campaign,
transactional-template, and delivery-log outcomes by platform.

**Why this priority**: Operators need to validate communication setup and
delivery visibility before real provider integration exists.

**Independent test**: An authorized manager can complete a valid mock campaign
and investigate a failed delivery without contacting any provider or exposing
a device token.

**Acceptance scenarios**:

1. **Given** notification metrics, **When** period/platform/channel changes,
   **Then** sent, delivered, opened, failed, opt-out, token-failure, and
   freshness values update with explicit denominators.
2. **Given** the campaign wizard, **When** each step is completed, **Then**
   validated audience, channel, content, schedule, and review state persist in
   the mock draft without browser storage.
3. **Given** zero eligible recipients, unresolved opt-outs, missing content
   variants, invalid schedule, stale audience estimate, or duplicate submit,
   **When** scheduling is attempted, **Then** it is blocked safely.
4. **Given** a valid permitted campaign, **When** scheduling is confirmed,
   **Then** one mock transition occurs and the result includes authoritative
   eligible/excluded counts and a planned audit reference.
5. **Given** delivery logs, **When** filtered or opened, **Then** masked user,
   channel, template, platform, status, timestamps, and safe failure class are
   visible without tokens, provider payloads, addresses, or message bodies.

## Routes

| Route | Purpose | Roles | Existing/New |
|---|---|---|---|
| `/admin/support` | Support dashboard | Super Admin, Support Agent | Approved addition |
| `/admin/support/tickets` | Ticket list | Super Admin, Support Agent | Approved addition |
| `/admin/support/tickets/[ticketId]` | Ticket detail and actions | Super Admin, Support Agent | Approved addition |
| `/admin/support/categories` | Support category management | Super Admin, Support Agent | Approved addition |
| `/admin/feedback` | Feedback overview and list | Super Admin, Support Agent, Content Manager | Approved addition |
| `/admin/feedback/[feedbackId]` | Feedback detail and disposition | Super Admin, Support Agent, limited Content Manager | Approved addition |
| `/admin/feedback/abuse` | Restricted abuse-report review | Super Admin, Security Administrator | Approved addition |
| `/admin/content/categories` | Default financial categories | Super Admin, Content Manager | Approved addition |
| `/admin/content/categories/[categoryId]` | Category editor | Super Admin, Content Manager | Approved addition |
| `/admin/content/tips` | Financial tips | Super Admin, Content Manager | Approved addition |
| `/admin/content/faqs` | FAQ management | Super Admin, Content Manager | Approved addition |
| `/admin/content/onboarding` | Onboarding content | Super Admin, Content Manager | Approved addition |
| `/admin/content/help-center` | Help-center content | Super Admin, Content Manager | Approved addition |
| `/admin/content/announcements` | Announcement banners | Super Admin, Content Manager | Approved addition |
| `/admin/content/email-templates` | Email templates | Super Admin, Content Manager | Approved addition |
| `/admin/content/push-templates` | Push templates | Super Admin, Content Manager | Approved addition |
| `/admin/notifications` | Notification overview | Super Admin, Content Manager | Approved addition |
| `/admin/notifications/campaigns` | Campaign list | Super Admin, Content Manager | Approved addition |
| `/admin/notifications/campaigns/new` | Campaign wizard | Super Admin, Content Manager | Approved addition |
| `/admin/notifications/campaigns/[campaignId]` | Campaign detail | Super Admin, Content Manager | Approved addition |
| `/admin/notifications/transactional` | Transactional notification templates | Super Admin, Content Manager | Approved addition |
| `/admin/notifications/delivery-logs` | Privacy-safe delivery logs | Super Admin, Content Manager; limited linked Support/Security views | Approved addition |

All identifiers MUST be validated before use. Invalid, expired, missing,
unauthorized, and forbidden identifiers MUST show safe shared states.

## Functional Requirements

- **FR-001**: The support dashboard MUST provide every KPI and chart defined in
  the parent specification with period, platform, freshness, units, and
  drill-down behavior.
- **FR-002**: Ticket lists MUST support bounded search, documented filters,
  sorting, pagination, result counts, and reversible URL-safe state.
- **FR-003**: Ticket detail MUST present sanitized conversation, masked user
  context, platform/version, safe linked records, notes, attachment metadata,
  activity, access-request action, assignment, priority, status, and SLA.
  The access-request action MUST reuse the existing Spec 003 controlled-access
  contract and state; the communications boundary stores only its returned safe
  reference and MUST NOT create a second access-request operation.
- **FR-004**: Ticket transitions MUST follow an explicit allowed-transition
  model and require expected state/version; close/reopen and customer-visible
  replies require confirmation. A customer-visible reply to Resolved MUST
  atomically transition it to Open; Closed MUST reject replies until a separate
  confirmed reopen succeeds.
- **FR-005**: Customer-visible replies and internal notes MUST be clearly
  separated and MUST never change visibility implicitly.
- **FR-006**: Support categories MUST support the parent category set, stable
  keys, localized labels, ordering, active state, and usage-aware retirement.
- **FR-007**: Feedback MUST support overview metrics, filtering, detail,
  content-safe review, ticket/content linking, disposition, and resolution.
- **FR-008**: Abuse reports MUST use a separate restricted projection,
  lifecycle, reviewer assignment, and escalation path.
- **FR-009**: Default financial categories MUST support bilingual names,
  hierarchy, transaction type, approved icon/color token, order, status, and
  usage count without altering customer transactions.
- **FR-010**: Tips, FAQs, onboarding, and help articles MUST support bilingual
  structured content, audience/platform scope, ordering/schedule, preview,
  Draft/Published/Retired lifecycle, and revision conflicts.
- **FR-011**: Announcements MUST support bilingual title/message, audience,
  platform, period, priority, status, preview, overlap warning, and lifecycle.
- **FR-012**: Email and push templates MUST support documented trigger,
  language, platform where relevant, bounded subject/title/body, allowlisted
  placeholders, safe preview, status, and version.
- **FR-013**: Notification overview MUST provide sent, delivered, opened,
  failed, opt-out, and token-failure metrics with platform/channel breakdown,
  denominator, and freshness. Delivery rate MUST use delivered/attempted;
  failure rate failed/attempted; open rate opened/delivered for channels that
  support open tracking; token-failure rate token failures/push attempts; and
  opt-out rate opted-out unique customers/targeted unique audience.
- **FR-014**: Campaign creation MUST validate the five approved steps:
  audience, channel, content, schedule, and review. Each campaign MUST select
  exactly one channel; a multi-channel communication MUST use separate
  campaigns with independent eligibility, scheduling, and delivery metrics.
  Schedule MUST be either one-time Send Now or one future time; both paths MUST
  complete review and confirmation before a mock transition.
- **FR-015**: Audience previews MUST show authoritative eligible, excluded,
  opted-out, invalid-token, unknown, iOS, Android, and total counts without
  exposing recipient lists.
- **FR-016**: Campaign actions MUST enforce lifecycle, expected state/version,
  permission, reason, confirmation, pending lock, duplicate prevention, and
  safe conflict recovery.
- **FR-017**: Transactional notification management MUST cover detected
  transaction, budget warning, installment reminder, salary detected, payment
  failure, subscription renewal, and security alert templates.
- **FR-018**: Delivery logs MUST support channel, template, campaign, platform,
  status, date, and safe failure filters while omitting addresses, device
  tokens, payloads, and message bodies.
- **FR-019**: Every page MUST expose relevant loading, empty, partial, error,
  success, warning, permission, stale, and conflict states.
- **FR-020**: Every page MUST consume typed repository/service contracts and
  MUST NOT import raw fixtures.
- **FR-021**: All counts, SLA classifications, ratings, audience eligibility,
  consent exclusions, delivery outcomes, and rates MUST be authoritative
  contract values with explicit denominators.
- **FR-022**: Sensitive actions MUST show scope, consequence, previous/proposed
  state, reason, permission, planned audit event, mock-only notice, and cancel.
- **FR-023**: Search, filters, IDs, form values, structured content, attachment
  metadata, placeholders, schedules, and mock responses MUST reject unknown or
  malformed fields before display or mutation.
- **FR-024**: The feature MUST NOT send a real notification, expose a provider
  credential, resolve a real audience, upload a real file, or modify production
  content.
- **FR-025**: A ticket MUST have exactly one owning team and zero or one
  assigned agent. A reassignment MUST atomically replace the current owner,
  retain assignment history, and reject stale or duplicate assignments.

## Platform Data Rules

- Support, feedback, campaigns, and delivery metrics MUST support All
  Platforms, iOS, Android, and documented Unknown attribution.
- Ticket/feedback platform context MUST include app and OS version and the
  relevant feature context: iOS Shortcut/Share Extension or Android SMS/
  Notification Listener where applicable.
- Combined ticket, feedback, sent, delivered, opened, and failure values are
  event counts and may be additive only when each event has one attribution.
- Unique customer or recipient totals MUST be authoritative deduplicated counts
  and MUST NOT be calculated by adding iOS and Android customers.
- Multi-platform customers MUST not receive duplicate campaign counts unless
  the contract explicitly represents multiple channel deliveries.
- Notification rates MUST name numerator and denominator. Unknown or delayed
  attribution MUST remain visible and MUST NOT be guessed. Unsupported or
  unavailable rate data MUST display as unavailable, never as zero.
- Content and templates MAY be platform-specific, shared, or single-language
  only when that scope is explicit and eligible.

## UX and Design Constraints

- Preserve the approved Masarifi Gulf Premium Design System Version 2.1 and all
  existing approved pages.
- Keep deep teal primary, bronze limited to approximately 2%–3%, and Admin
  surfaces neutral, compact, and operational.
- Use existing semantic tokens; financial category colors MUST not be reused as
  ticket priority, abuse severity, or delivery status semantics.
- Use tables for dense desktop operations, cards for mobile summaries, a
  conversation timeline for tickets, and a five-step progress indicator for
  campaign creation.
- Distinguish customer-visible replies, internal notes, feedback content, abuse
  evidence, and template previews with labels and structure, not color alone.
- Show source, language, platform, status, version, freshness, and omissions
  wherever they affect operator decisions.
- Preview content in Arabic RTL and English LTR without imitating the customer
  mobile product or adding decorative marketing visuals.

## Responsive and Directional Behavior

- **Arabic RTL default**: Navigation, filters, timelines, wizard steps,
  pagination, drawers, dialogs, and action order MUST follow logical RTL order.
  IDs, versions, email-like fictional references, dates, and correlation
  references MUST remain directionally isolated.
- **English LTR readiness**: Logical properties and mirrored placement MUST
  work without duplicating layouts or changing information hierarchy.
- **1440px**: Full sidebar, persistent filters, multi-column dashboards, full
  tables, ticket detail/context split, and campaign review side panel.
- **1280px**: Compact sidebar, reduced gaps, selective low-priority columns,
  and retained primary actions.
- **1024px**: Collapsible sidebar, horizontally scrollable or prioritized
  tables, stacked details, and filter drawer where needed.
- **768px**: Drawer navigation, two-column then single-column cards, card/table
  alternatives, full-screen detail drawers/dialogs, and usable wizard steps.
- **390px**: Prioritize urgent ticket summaries, abuse alerts, notification
  health, campaign status, and safe approval/cancel actions. Complex content,
  category, template, or campaign configuration MUST show a desktop-required
  notice while preserving monitoring and existing drafts.

## Accessibility

- Every route MUST have one descriptive level-one heading and landmark
  structure.
- Tables MUST have programmatic headers; mobile cards MUST preserve equivalent
  labels, status, and actions.
- Conversation messages, internal notes, delivery statuses, priorities,
  severities, SLA states, and campaign progress MUST be understandable without
  color.
- Filters, editors, previews, wizard steps, attachment metadata, dialogs, and
  confirmations MUST be keyboard operable with visible focus and logical order.
- Validation MUST associate messages with fields, focus the first error, and
  provide a summary for multi-step forms.
- Dialogs MUST trap focus while open, close by an accessible cancel action,
  restore focus safely, and announce pending/success/error results.
- Touch targets MUST be at least 44px. Reduced motion MUST disable nonessential
  transitions without removing status feedback.
- Charts MUST have accessible summaries including value, unit, period,
  platform, denominator, and freshness.

## Proposed API Contracts

All paths are proposed frontend mock contracts under `/api/v1/admin`.

| Method | Mock path | Request type | Response type | Planned capability |
|---|---|---|---|---|
| GET | `/support/overview` | `SupportOverviewQuery` | `SupportOverview` | Support analytics |
| GET | `/support/tickets` | `SupportTicketQuery` | `TicketPage` | Ticket search |
| GET | `/support/tickets/{ticketId}` | none | `TicketDetail` | Ticket review |
| POST | `/support/tickets/{ticketId}/actions` | `TicketActionRequest` | `ActionResult` | Ticket workflow |
| GET | `/support/categories` | `ContentListQuery` | `SupportCategoryPage` | Support taxonomy |
| POST | `/support/categories` | `SupportCategorySaveRequest` | `ActionResult` | Create support category |
| POST | `/support/categories/{categoryId}/actions` | `SupportCategoryActionRequest` | `ActionResult` | Support taxonomy decisions |
| GET | `/feedback` | `FeedbackQuery` | `FeedbackPage` | Feedback analytics/list |
| GET | `/feedback/{feedbackId}` | none | `FeedbackDetail` | Feedback review |
| POST | `/feedback/{feedbackId}/actions` | `FeedbackActionRequest` | `ActionResult` | Feedback workflow |
| GET | `/feedback/abuse-reports` | `AbuseReportQuery` | `AbuseReportPage` | Restricted abuse review |
| POST | `/feedback/abuse-reports/{reportId}/actions` | `AbuseActionRequest` | `ActionResult` | Abuse workflow |
| GET | `/content/{collection}` | `ContentListQuery` | `ContentPage` | Content collection |
| POST | `/content/{collection}` | `ContentSaveRequest` | `ActionResult` | Create content draft |
| GET | `/content/{collection}/{itemId}` | none | `ContentItem` | Content detail |
| POST | `/content/{collection}/{itemId}/actions` | `ContentActionRequest` | `ActionResult` | Content lifecycle |
| GET | `/communications/templates` | `TemplateQuery` | `TemplatePage` | Message templates |
| POST | `/communications/templates` | `TemplateSaveRequest` | `ActionResult` | Create template draft |
| POST | `/communications/templates/{templateId}/actions` | `TemplateActionRequest` | `ActionResult` | Template lifecycle |
| GET | `/notifications/overview` | `NotificationOverviewQuery` | `NotificationOverview` | Delivery analytics |
| POST | `/notifications/audience-preview` | `AudiencePreviewRequest` | `AudienceSummary` | Aggregate audience eligibility preview |
| GET | `/notifications/campaigns` | `CampaignQuery` | `CampaignPage` | Campaign list |
| GET | `/notifications/campaigns/{campaignId}` | none | `Campaign` | Campaign detail |
| POST | `/notifications/campaigns` | `CampaignDraftRequest` | `ActionResult` | Draft creation |
| POST | `/notifications/campaigns/{campaignId}/actions` | `CampaignActionRequest` | `ActionResult` | Campaign lifecycle |
| GET | `/notifications/transactional` | `TemplateQuery` | `TemplatePage` | Transactional templates |
| GET | `/notifications/delivery-logs` | `DeliveryLogQuery` | `DeliveryLogPage` | Delivery diagnostics |

Pages MUST consume these contracts through typed repositories or services and
MUST NOT import raw mock arrays.

## Frontend Types

- **PlatformContext**: All, iOS, Android, or Unknown with authoritative counts
  and attribution quality.
- **SupportOverview**: KPIs, chart summaries, period/platform, denominators,
  freshness, partial regions, and safe drill-down filters.
- **SupportTicketSummary**: safe ticket/user references, subject summary, type,
  priority, state, one owning team, optional assigned agent, platform/version,
  timestamps, SLA, and version.
- **SupportTicketDetail**: summary, sanitized conversation, masked user/device
  context, safe linked references, internal notes, attachment metadata,
  activity, access-request eligibility, allowed actions, and omissions.
- **SupportTicketActionRequest**: allowed action, reason, expected state/
  version, assignment or bounded message/note fields, and visibility.
- **FeedbackSummary / FeedbackDetail**: safe ID, masked user, type, rating,
  bounded message, platform/version, state, safe attachments, notes, links,
  eligibility, omissions, and version.
- **AbuseReport**: restricted reporter/target references, type, authoritative
  severity, bounded sanitized evidence summary, state, reviewer, time, allowed
  actions, omissions, and version.
- **ContentItem**: collection, stable key, Arabic/English variants, platform/
  audience scope, ordering/schedule, status, approved asset/token references,
  usage, eligibility, and version.
- **NotificationTemplate**: safe template ID, trigger, channel, language,
  platform, bounded structured content, allowlisted placeholders, status,
  preview data, eligibility, and version.
- **NotificationCampaign**: safe ID/name, audience summary, channel, template,
  schedule, authoritative recipient counts, lifecycle, delivery metrics,
  allowed actions, and version.
- **AudiencePreview**: safe preview ID/version, bounded platform/language/plan/
  activity criteria, and authoritative targeted, eligible, excluded, opted-out,
  invalid-token, iOS, Android, multi-platform, and Unknown counts without
  recipient rows.
- **DeliveryLogRecord**: safe delivery ID, masked user reference, channel,
  template/campaign, platform, status, safe timestamps, failure class/code, and
  correlation reference without token or payload.
- **ActionResult**: resource ID, previous/current state, outcome, safe message,
  time, conflict metadata, and planned audit reference.
- **ApiError**: status, safe code, localized message, optional bounded field
  errors, and correlation ID without private content or stack details.
- Application types MUST be explicit and MUST NOT use `any`.

## Mock Scenarios and UI States

### Mock Scenarios

- Default success, empty, large paginated, slow, and partial results for every
  dashboard, list, detail, and action family
- Unauthorized, forbidden, not found, expired ID, invalid ID/filter/sort/date/
  pagination, validation error, conflict, rate limited, unavailable, and safe
  internal error
- Urgent/SLA-breached, unassigned, awaiting-customer, awaiting-agent, resolved,
  closed, stale, concurrently assigned, and duplicate ticket actions
- iOS Shortcut/Share Extension and Android SMS/Notification Listener issues,
  multi-platform users, and Unknown attribution
- Empty-after-sanitization, unsafe markup, bidi controls, oversized text,
  unknown fields, malformed attachment metadata, and masking violations
- Feedback of every type/rating/state, duplicate link, severe abuse, restricted
  evidence, escalation, resolution, and reopen
- Missing translations, duplicate/cyclic categories, invalid ordering,
  unsupported assets/tokens, schedule overlap, expired announcement, and stale
  content versions
- Valid/invalid placeholders, platform mismatch, unsafe URL/data payload,
  missing variant, and inactive template
- Zero/large/stale audience, opt-out exclusions, invalid tokens, duplicate
  recipient deduplication, past schedule, conflict, duplicate scheduling, and
  simulated delivery failures
- Mock mutations reset after scenario reset or development restart

### Loading States

- Dashboard, chart, table/card, conversation, editor, preview, campaign wizard,
  and delivery-log skeletons that preserve labels and layout
- Pending locks for every sensitive action
- Safe prior results may remain visible during filter refresh when labeled

### Empty States

- No tickets, urgent tickets, feedback, abuse reports, content, templates,
  campaigns, transactional records, or delivery logs
- No iOS, Android, Unknown, or selected-period results
- Zero eligible campaign recipients

Each empty state MUST state active context and offer only an authorized,
non-destructive recovery action.

### Error States

- Safe retry for dashboard, list, detail, preview, and delivery-log failures
- Field-level recovery for invalid editors and campaign steps
- Stale/conflict recovery preserving safe unsaved text
- Partial regions remain usable without fabricating zero values
- Errors MUST NOT expose conversations, feedback, evidence, addresses, tokens,
  payloads, provider details, attachment content, stacks, or internal paths

### Success States

- Ticket assignment/reply/note/status updated
- Feedback linked/dispositioned; abuse report assigned/escalated/resolved
- Content/template/announcement draft or lifecycle decision saved
- Campaign draft created or mock lifecycle decision recorded
- Filters, sorting, pagination, platform, period, and wizard steps applied

Success MUST be announced accessibly and remain understandable if the
triggering control disappears.

### Warning and Confirmation States

- Customer-visible reply versus internal note
- Ticket close/reopen, abuse escalation/disposition, content/template
  activation/retirement, announcement scheduling, and campaign scheduling/
  pause/cancel
- SLA breach, stale state, partial data, missing translation, active-use
  retirement, audience uncertainty, opt-out exclusions, and delivery failure

### Permission States

- Full route/action access
- Aggregate or linked masked projection
- Read-only projection
- Hidden or disabled action with reason
- Full access denied
- Safe forbidden response for direct mock mutation

## Audit, Privacy, and Sensitive Actions

### Audit Expectations

The future backend is expected to append immutable audit events for ticket
access, assignment, customer reply, internal note, state/priority change,
access-request creation, feedback links/dispositions, abuse evidence access and
decisions, content/template publication, announcement/campaign lifecycle
changes, delivery-log access, denied actions, conflicts, unsafe-input rejection,
and masking violations where policy requires.

Mock results MAY expose a safe audit reference. The audit explorer remains Spec
008 work.

### Privacy Rules

- Customer/admin names, emails, addresses, phone numbers, user/device/session/
  subscription/payment/import/AI IDs, IP addresses, push tokens, provider IDs,
  and attachment storage paths MUST be masked, omitted, or replaced by safe
  fictional references unless the minimum approved support context requires a
  bounded reference.
- Ticket conversations, feedback, abuse evidence, notes, and template previews
  MUST use sanitized fictional content and plain-text rendering.
- Full financial records, transactions, provider payloads, imported messages,
  AI prompts/responses, authentication data, and unrestricted customer profiles
  MUST NOT enter Phase 6 contracts.
- Delivery logs MUST omit recipient addresses, device tokens, provider
  requests/responses, message bodies, and private failure payloads.
- Campaign previews MUST use aggregate audience counts and fictional examples,
  never recipient lists.
- Sensitive content, drafts, notes, evidence, attachments, tokens, audience
  membership, and delivery payloads MUST NOT be stored in browser storage,
  URLs, logs, screenshots, or browser-visible environment values.

### Sensitive Actions

- Customer replies, ticket close/reopen, abuse decisions, content/template
  publication/retirement, announcements, and campaign lifecycle changes require
  explicit confirmation appropriate to consequence.
- Confirmation MUST show scope, audience/customer visibility, previous/
  proposed state, reason, permission, planned audit event, mock-only notice,
  and cancel path.
- Mutations MUST lock while pending and safely handle forbidden, duplicate,
  conflict, rate-limit, validation, unavailable, and internal-error outcomes.

## Security Requirements

- **Untrusted inputs**: Parse, normalize, bound, and validate all route IDs,
  queries, filters, dates, sort/pagination, messages, notes, evidence,
  translations, stable keys, placeholders, schedules, audience definitions,
  attachment metadata, action bodies, and mock responses.
- **Text measurement**: Normalize human-readable text to Unicode NFC before
  comparison, reject bidi/control abuse, count character limits by Unicode code
  point, and enforce KiB limits by UTF-8 byte length. OpenAPI `maxLength`
  annotations do not replace these frontend contract checks.
- **Safe rendering**: Render customer/content/template text as plain text or
  allowlisted structured fields. Raw HTML, Markdown, JSON payloads, scripts,
  embedded media, executable placeholders, and `dangerouslySetInnerHTML` are
  prohibited.
- **Client storage and environment**: Do not persist support or communication
  content, drafts, customer data, tokens, credentials, or provider data in
  browser storage. No secret or private endpoint may be browser-exposed.
- **Files and links**: Validate allowlisted type, declared size, safe filename,
  invalid/malicious metadata, and preview eligibility. This phase performs no
  real upload/download. Any approved external link opened in a new tab MUST use
  an allowlisted destination and prevent opener access.
- **Permissions**: Navigation and mock guards are UX controls only. Every future
  read/mutation MUST independently authorize actor, resource, scope, content
  visibility, audience, and action.
- **Dependencies**: No new dependency is required. A later dependency requires
  scoped need, security review, approval, and verification.
- **Security mock scenarios**: Cover denied/expired access, limited projection,
  unsafe text/markup, masking failure, malicious attachment metadata, unknown
  placeholder, arbitrary payload, unsafe link, stale state, duplicate submit,
  opt-out conflict, audience mismatch, and forbidden direct mutation.
- **Deferred production controls**: Backend authorization, consent and
  suppression enforcement, provider secrets, delivery signing, rate limits,
  idempotency, audience queries, queues, attachment malware scanning/storage,
  content sanitization service, retention, immutable audit, monitoring, bounce/
  complaint handling, and incident response remain future backend/infrastructure
  duties.

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- A multi-platform customer has two devices but represents one campaign
  recipient and more than one channel delivery.
- A multi-channel communication contains independently scheduled campaigns,
  and failure or cancellation of one channel MUST NOT change another.
- A ticket changes assignee/state while another agent composes a reply.
- A closed ticket receives a new customer message before the UI refreshes; the
  stale operator reply remains blocked until the ticket is explicitly reopened
  or the updated state is reviewed.
- Sanitization removes all meaningful ticket, feedback, or evidence text.
- A reply is accidentally prepared as an internal note or vice versa.
- An attachment has a safe extension but conflicting declared media type/size.
- A feedback item is already linked to the proposed ticket/content item.
- An abuse report references a deleted or inaccessible target.
- A category parent creates a cycle or an active child blocks retirement.
- Arabic exists while English is missing, or placeholders differ by language.
- An onboarding item applies to iOS but references an Android-only capability.
- Announcements overlap at the same priority and audience.
- A template is retired while a Draft/Scheduled campaign references it.
- Audience eligibility changes after review but before mock scheduling.
- A future campaign time becomes past while its confirmation is open.
- Opt-out, invalid-token, and deduplication counts overlap or do not reconcile.
- Delivery is marked opened before delivered, or timestamps arrive out of order.
- Platform attribution is unknown, delayed, or conflicts with device context.
- Permission changes while a detail, editor, preview, or confirmation is open.

## Out of Scope

- Real support email/chat, telephony, CRM, provider, mailbox, or external help
  desk integration
- Real email, push, in-app delivery, device-token operations, audience
  resolution, consent enforcement, unsubscribe, bounce, complaint, or provider
  webhook processing
- Recurring, event-stream, or automated multi-step campaign orchestration
- Real uploads/downloads, attachment storage, malware scanning, image/PDF
  rendering, or customer files
- Real customer conversations, feedback, abuse evidence, contact details,
  financial data, notification payloads, or recipient lists
- Backend, NestJS, Supabase, database, storage, queue, job, authentication,
  authorization, immutable audit, or provider-secret implementation
- Temporary-access approval/workspace from Spec 003; security/audit/data
  privacy from Spec 008; health/jobs from Spec 009; settings, feature flags,
  global attention completion, and governance from Spec 010
- Mobile, API, Marketing, or customer-facing content implementation
- Redesign of approved routes, components, tokens, styles, assets, typography,
  shell, or interaction language

## Acceptance Criteria

- **AC-001**: The support dashboard and ticket routes expose every documented
  metric, filter, field, state, platform context, and safe action.
- **AC-002**: An authorized agent completes the seeded urgent-ticket journey
  within three minutes while stale, forbidden, closed, and duplicate actions
  fail safely.
- **AC-003**: Customer-visible replies and internal notes are always explicitly
  labeled and never cross visibility boundaries.
- **AC-004**: Feedback and abuse routes expose only their role-appropriate
  structural projections and support every documented state/action.
- **AC-005**: Default categories, tips, FAQs, onboarding, and help-center
  content validate bilingual, hierarchy, scope, schedule/order, safe preview,
  lifecycle, and revision requirements.
- **AC-006**: Announcements, email templates, and push templates reject unsafe
  content, unknown placeholders, missing variants, invalid schedules, and
  incompatible platform scope.
- **AC-007**: Campaign creation validates all five steps and blocks zero/stale
  audiences, opt-out conflicts, missing content, invalid schedules, stale
  versions, and duplicate scheduling.
- **AC-008**: Delivery metrics/logs show documented platform/channel outcomes
  and rates without addresses, tokens, payloads, message bodies, or provider
  secrets.
- **AC-009**: Every Phase 6 route demonstrates relevant loading, empty,
  partial, error, success, warning, conflict, and permission states.
- **AC-010**: All pages use typed repositories/services and no presentation
  page imports raw fixtures.
- **AC-011**: All documented inputs and mock responses reject malformed,
  oversized, unknown, unsafe, or unauthorized data before rendering/mutation.
- **AC-012**: Arabic RTL and English LTR-ready behavior works at 1440px,
  1280px, 1024px, 768px, and 390px without losing urgent monitoring context.
- **AC-013**: Keyboard-only operation supports filters, lists, ticket/feedback
  review, editors, previews, wizard steps, confirmations, cancel, and focus
  recovery without a trap.
- **AC-014**: Privacy/security review finds zero raw financial/import/AI
  content, unrestricted customer data, real attachment content, recipient
  lists, addresses, device tokens, provider payloads, credentials, or secrets.
- **AC-015**: No real notification, external support action, file transfer,
  provider call, backend operation, or persistent production change occurs.
- **AC-016**: Typecheck, lint, tests, browser verification, and production build
  complete successfully before implementation is reported complete.

## Success Criteria

- **SC-001**: In seeded tests, an authorized agent identifies and updates the
  highest-priority SLA-risk ticket in under three minutes.
- **SC-002**: 100% of customer-visible replies, internal notes, abuse evidence,
  and attachment metadata retain the correct visibility and role projection.
- **SC-003**: 100% of seeded platform metrics show correct All, iOS, Android,
  and Unknown semantics without duplicate unique-customer/recipient totals.
- **SC-004**: 100% of seeded content and template activation attempts reject
  missing translations, invalid scope/schedule, unsafe content, and unknown
  placeholders.
- **SC-005**: 100% of seeded campaign scheduling attempts show authoritative
  eligible/excluded counts and block zero, stale, conflicting, or duplicate
  submissions.
- **SC-006**: 100% of sensitive actions show scope, consequence, previous/
  proposed state, permission, reason, confirmation, pending lock, final result,
  planned audit reference, and mock-only notice.
- **SC-007**: Privacy/security review finds zero prohibited customer,
  financial, attachment, recipient, token, payload, credential, or secret
  exposure.
- **SC-008**: All five approved viewports complete primary ticket, feedback,
  content preview, campaign, and delivery-log journeys without blocking
  overflow or hidden urgent context.
- **SC-009**: Keyboard and screen-reader review finds no blocking heading,
  landmark, table/card, form, dialog, focus, live-feedback, touch-target,
  directionality, status, or reduced-motion defect.
- **SC-010**: At least 95% of standard mock page/detail loads show usable
  content within two seconds and at least 95% of filter, sort, or pagination
  updates complete within one second; labeled slow scenarios are measured
  separately.

## Verification

Implementation verification for this future phase MUST include:

- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Unit/component tests**: `npm run test`
- **End-to-end tests**: `npm run test:e2e`
- **Production build**: `npm run build`
- **Route review**: Open all 22 Phase 6 routes in default and relevant loading,
  empty, partial, error, forbidden, detail, editor, wizard, and mutation states.
- **Platform review**: Verify All, iOS, Android, Unknown, multi-platform
  deduplication, feature context, app/OS version, delivery denominators, and
  customer/recipient semantics.
- **Viewport review**: Verify 1440px, 1280px, 1024px, 768px, and 390px in
  Arabic RTL, plus English LTR readiness.
- **Accessibility review**: Verify keyboard navigation, focus restoration,
  semantic tables/cards/forms/dialogs/wizard, chart summaries, live feedback,
  status alternatives, touch targets, bidirectional content, and reduced motion.
- **Privacy/security review**: Review changed source, fixtures, tests, logs,
  URLs, browser storage, environment use, errors, previews, dependencies,
  permissions, validation, pending locks, attachments, safe rendering, and
  masking for prohibited support, customer, financial, recipient, token,
  provider, or secret data.

No verification result may be reported as successful unless the named command
or manual procedure was actually executed successfully.
