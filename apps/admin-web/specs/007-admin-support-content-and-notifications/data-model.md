# Data Model: Spec 007 Support, Feedback, Content, and Notifications

This is a frontend contract/read-model design. It is not a database schema and
does not authorize backend, provider, storage, queue, or delivery work.

## Shared value objects

### SafeCommunicationId

- Maximum 48 characters.
- Allowlisted fictional prefixes:
  - `TKT-`: ticket
  - `SUPC-`: support category
  - `FDB-`: feedback
  - `ABR-`: abuse report
  - `CNT-`: content
  - `CAT-`: default financial category
  - `TPL-`: message template
  - `CMP-`: campaign
  - `DLV-`: delivery
  - `ATT-`: attachment metadata
  - `AUP-`: aggregate audience preview
  - `AUD-`: planned audit reference
- Parsed before route interpolation and URL-encoded by the repository.

### AccessLevel

- `full`: complete allowlisted fields and permitted actions.
- `aggregate`: metrics only; no item-level customer or content context.
- `linked`: minimum masked context for an authorized related record.
- `restricted`: abuse/security projection with bounded evidence.
- `denied`: safe access-denied result.

The handler chooses the projection before returning data.

### PlatformScope

- `all`
- `ios`
- `android`
- `unknown`

`unknown` is explicit missing attribution, never an inferred platform.

### LocaleScope

- `ar`
- `en`

Arabic and English variants are both required unless `singleLanguageReason`
is non-empty and `audienceLocales` contains exactly the locale of the sole
variant.

### Pagination

- `page`: positive integer.
- `pageSize`: `25 | 50 | 100`; default `25`.
- `totalItems`: non-negative integer.
- `totalPages`: zero for empty results, otherwise the authoritative page count.
- Page item count never exceeds `pageSize`.

### SafeText

- Search: at most 120 Unicode characters.
- Ticket subject: at most 160 Unicode characters.
- Customer-visible message: at most 8 KiB UTF-8.
- Internal note: at most 2 KiB UTF-8.
- Content body: at most 16 KiB UTF-8.
- Human-readable text is normalized to Unicode NFC before comparison.
- Character limits count Unicode code points, not UTF-16 code units.
- KiB limits use UTF-8 bytes.
- All text is fictional, sanitized, and rendered as plain text.
- HTML, Markdown, script-like content, bidi controls, arbitrary JSON, unknown
  placeholders, and unbounded URLs are rejected.

### AttachmentMetadata

- `id`: `ATT-` identifier.
- `safeFilename`: base filename only; no path or control characters.
- `mediaType`: `application/pdf | image/png | image/jpeg | text/plain`.
- `declaredSizeBytes`: integer from 1 through 10 MiB.
- `scanState`: authoritative `safe | rejected | unavailable`.
- `previewEligible`: authoritative boolean.
- No bytes, storage path, signed URL, hash, EXIF, or customer payload exists.

### ActionContext

- `reason`: required where specified, 1–500 Unicode characters.
- `expectedState`: current lifecycle state.
- `expectedRevision`: positive integer.
- `confirmationToken`: fixed mock-only confirmation marker.
- `visibility`: `customer | internal` only for ticket text actions.

Every mutation returns one `ActionResult` with resource ID, previous/current
state, outcome, timestamp, safe message, optional conflict metadata, and
planned audit reference.

Action request schemas are discriminated and strict: assignment requires its
owner/reviewer field, priority changes require a priority, replies and notes
require the correct visibility plus text, link actions require a target,
updates require a proposal, and scheduled operations require `scheduledAt`.

## Support domain

### SupportOverview

- Period, platform, freshness, and partial-region state.
- Counts: open, urgent, awaiting customer, awaiting agent, resolved today.
- Durations: authoritative average response and resolution times.
- Charts: type, priority, platform, trend, and SLA.
- Each rate/chart declares numerator, denominator, unit, and drill-down query.

### SupportTicketSummary

- `id`, masked user reference, sanitized subject summary.
- Type and support category.
- Priority: `low | medium | high | urgent`.
- State: `new | open | awaiting_customer | awaiting_agent | resolved | closed`.
- Exactly one `owningTeamId`.
- Zero or one `assignedAgentRef`.
- Platform, app version, OS version, feature context.
- Created/updated timestamps, authoritative SLA state.
- Revision and allowed actions.

### SupportTicketDetail

- One `SupportTicketSummary`.
- Ordered sanitized `SupportMessage[]`.
- Masked user/device summary.
- Optional safe linked import, payment, AI-report, or access-request references.
- `InternalNote[]`, `AttachmentMetadata[]`, and immutable activity entries.
- Omission labels and access level.
- `accessRequestEligible` may expose the existing Spec 003 action. The ticket
  view calls `useCreateAccessRequest`; Phase 6 has no access-request mutation.

### SupportMessage

- Safe message ID, author kind, visibility, language, bounded plain text, time.
- `authorKind`: `customer | support_agent | system`.
- Customer and agent identifiers are masked display references.
- Existing messages are immutable in the mock history.

### Ticket ownership invariant

- One owning team is mandatory.
- Assigned agent is optional and belongs to the owning team in seeded data.
- Reassignment atomically replaces team/agent, increments revision, and appends
  history.
- A stale revision or duplicate pending assignment is rejected.

### Ticket state transitions

| Current | Allowed next states |
|---|---|
| New | Open, Awaiting Customer, Awaiting Agent, Resolved, Closed |
| Open | Awaiting Customer, Awaiting Agent, Resolved, Closed |
| Awaiting Customer | Open, Awaiting Agent, Resolved, Closed |
| Awaiting Agent | Open, Awaiting Customer, Resolved, Closed |
| Resolved | Open, Closed |
| Closed | Open only through explicit confirmed reopen |

- A customer-visible reply to Resolved atomically appends the message and moves
  the ticket to Open.
- Closed rejects reply until a separate reopen succeeds.
- Internal notes do not change ticket state.

### SupportCategory

- ID, stable key, Arabic/English labels, order, active state, usage count,
  allowed ticket types, revision, and action eligibility.
- Stable keys are unique.
- An in-use category cannot retire without an eligible replacement.

## Feedback and abuse domain

### FeedbackItem

- ID, masked user reference, type, optional rating, bounded message.
- Type: `general | bug | feature_request | ai | import`.
- Platform, app/OS version, bounded device context, created/updated time.
- State: `new | under_review | planned | linked | resolved | dismissed | closed`.
- Safe attachments, internal notes, optional linked ticket/content reference.
- Revision, actions, omissions, access level.
- A link target is unique; repeated linking is idempotently rejected.

### AbuseReport

- ID, restricted masked reporter/target references.
- Type, authoritative severity, bounded sanitized evidence summary.
- State: `new | investigating | escalated | resolved | dismissed`.
- Reviewer reference, created/updated time, safe attachments, omissions.
- Revision and allowed actions.
- Only Super Admin and Security Administrator receive the restricted projection.

### Abuse transitions

| Current | Allowed next states |
|---|---|
| New | Investigating, Escalated, Resolved, Dismissed |
| Investigating | Escalated, Resolved, Dismissed |
| Escalated | Investigating, Resolved, Dismissed |
| Resolved | Investigating |
| Dismissed | Investigating |

## Content domain

### ContentCollection

- `default_categories`
- `financial_tips`
- `faqs`
- `onboarding`
- `help_center`
- `announcements`

### LocalizedVariant

- Locale, bounded title/question/name, bounded body/answer/message.
- Allowlisted placeholders only where the collection permits them.
- Plain text; no HTML or Markdown.
- Preview direction derives from locale.

### ContentItem

- ID, collection, stable key, Arabic/English variants.
- Optional explicit single-language audience and reason.
- Bounded `audienceKey` and platform scope.
- Category/parent, `income | expense | transfer` transaction type, approved
  icon/color token, order, announcement priority, and start/end schedule where
  the collection requires them.
- Lifecycle: `draft | published | retired`.
- Usage count, updated time, revision, eligibility, actions, omissions.

### Content invariants

- Stable key is unique within collection.
- Default-category parent graph is acyclic.
- Sibling sort order is unique when the collection requires ordering.
- Published content has every required variant and valid platform/audience.
- `startAt < endAt` for bounded announcements.
- Active-use retirement requires an eligible replacement.
- Publication and retirement increment revision; stale writes conflict.

## Template domain

### NotificationTemplate

- ID, stable key, channel, trigger, platform, lifecycle, revision.
- `channel`: `email | push | in_app`.
- Localized structured variants.
- Allowlisted placeholder names supplied by the authoritative trigger schema.
- Lifecycle: `draft | active | retired`.
- No HTML, arbitrary JSON, provider payload, recipient address, or unsafe URL.

### Template invariants

- Active template key is unique for `(trigger, channel, platform, locale)`.
- All placeholders used by content exist in the trigger allowlist.
- All required trigger placeholders appear in each required locale variant.
- A template referenced by a Draft/Scheduled campaign cannot retire without an
  eligible replacement or campaign update.

## Notification domain

### AudiencePreview

- `previewId`: `AUP-` identifier and positive version.
- Bounded criteria: one All/iOS/Android/Unknown platform scope, one or more
  locales and plans, plus
  `all | active | inactive` activity.
- Authoritative aggregate counts: targeted unique, eligible, excluded, opted
  out, invalid tokens, iOS, Android, multi-platform, and Unknown.
- Contains no recipient identifiers or rows.
- Campaign create/action requests carry preview ID/version so stale or
  mismatched audience decisions are rejected.
- `targetedUnique` is authoritative. iOS and Android audience counts may
  overlap by `multiPlatform`; they are never added client-side.

### NotificationOverview

- Period, platform, channel, freshness, and partial-region state.
- Authoritative counts: targeted unique audience, eligible, excluded,
  attempted, delivered, failed, opened, opted out, token failures.
- Rates:
  - delivery = delivered / attempted
  - failure = failed / attempted
  - open = opened / delivered, only for supported channels
  - token failure = token failures / push attempts
  - opt-out = opted-out unique customers / targeted unique audience
- Unsupported/unavailable rates are absent with an explicit reason, never zero.

### Campaign

- ID, name, one channel, audience summary, template ID.
- Platform/language scope.
- Schedule mode: `send_now | scheduled`.
- Future scheduled timestamp only when mode is `scheduled`.
- State: `draft | scheduled | sending | paused | completed | cancelled | failed`.
- Authoritative eligible/excluded counts and delivery metrics.
- Revision, allowed actions, last updated time, planned audit reference.

### Campaign invariants

- Exactly one channel.
- Send Now or one future time; no recurrence.
- Review snapshot includes audience version and template revision.
- Schedule/send rejects zero eligible audience, stale audience/template,
  inactive template, missing variant, opt-out conflict, past time, duplicate
  pending action, or stale campaign revision.
- Multi-channel communication uses separate campaigns.

### Campaign transitions

| Current | Allowed next states |
|---|---|
| Draft | Scheduled, Sending, Cancelled |
| Scheduled | Sending, Cancelled |
| Sending | Paused, Completed, Failed |
| Paused | Sending, Cancelled |
| Completed | none |
| Cancelled | none |
| Failed | Sending, Cancelled |

All transitions are mock-only; no provider is called.

### DeliveryLogRecord

- ID, masked user reference, channel, template/campaign references, platform.
- State: `queued | attempted | delivered | opened | failed | excluded`.
- Sent/delivered/opened timestamps when applicable.
- Safe failure class/code and correlation reference.
- No email, phone, push token, payload, body, provider request/response, or
  storage path.

### Delivery ordering

- `openedAt` requires `deliveredAt`.
- `deliveredAt` requires `attemptedAt`.
- Failed/excluded records cannot have delivered/opened timestamps.
- Timestamp order is monotonic.

## Relationships

- A Ticket belongs to one SupportCategory and may reference safe records from
  Specs 003–006.
- A Ticket has messages, notes, attachments, activity, one owning team, and an
  optional agent.
- Feedback may link to one ticket and/or one content item.
- Abuse reports remain separate from general feedback projection.
- Content items belong to one ContentCollection; categories may form an acyclic
  parent hierarchy.
- A Template may be referenced by many Campaigns.
- A Campaign references one Template and has many DeliveryLogRecords.
- A multi-channel communication is represented by separate Campaigns; there is
  no orchestration entity in this phase.

## Deterministic mock reset

- Fixtures are immutable inputs.
- Runtime state owns mutable copies and monotonically increasing revisions.
- Time-sensitive transitions accept the fixed Phase 6 application clock
  (`2026-07-29T12:00:00+03:00` by default in mocks/tests); handlers and state do
  not call `Date.now()`.
- Reset restores the initial snapshot/clock and clears pending locks/audit
  counters.
- No browser storage, filesystem, database, network, or provider persistence is
  used.
