# Research: Reports and Automatic Email Delivery

## Decision 1: Extend the current mobile stack without a dependency

**Decision**: Reuse Expo Router, Expo SQLite, TanStack Query, Zustand, Zod, i18next, native
`Date`/`Intl`, React Native SVG, the existing finance/planning services, report components,
formatters, masking provider, and Jest/React Native Testing Library. Add no report, chart, date,
email, scheduler, file, share, PDF, or test package.

**Rationale**: Every required frontend capability already exists. Email, output, and scheduling
are simulated, and installed SVG primitives can render the approved small chart set.

**Alternatives considered**: A chart library, date library, PDF generator, share package,
background-task package, and email SDK add production behavior or a second implementation path
outside the approved scope.

## Decision 2: Use explicit local-date periods in a captured IANA timezone

**Decision**: Represent monthly, three-month, half-year, and annual periods with inclusive
`YYYY-MM-DD` start/end dates plus a captured IANA timezone. Monthly covers one selected calendar
month; three-month and half-year cover three and six consecutive calendar months ending at the
selected anchor month; annual covers one selected calendar year. Resolve timestamps at the
period boundary in that timezone and query internally with half-open `[start, endExclusive)`
instants. Capture the device-resolved timezone until the profile owner in SPEC-009 supplies one,
and persist it on schedules and snapshots.

**Rationale**: Calendar reports and recurrence cannot safely use UTC month boundaries or an
unstored device offset. The captured timezone makes later timezone changes reviewable.

**Alternatives considered**: UTC periods, fixed numeric offsets, and implicit current-device
timezone were rejected because they move transactions or scheduled dates around DST and travel.

## Decision 3: Compare incomplete periods by matching elapsed portions

**Decision**: Completed reports compare with the immediately preceding equal-length calendar
period. An in-progress report compares only through the corresponding elapsed local date in the
previous period. A full previous-period total may appear only as separately labeled context.

**Rationale**: Comparing a partial period with a completed period produces a mathematically valid
but misleading trend.

**Alternatives considered**: Full-period comparison and forecasted completion were rejected as
misleading or speculative.

## Decision 4: Count only canonical confirmed effects once

**Decision**: Include posted or otherwise user-confirmed transactions, including confirmed local
records pending/failed synchronization. Exclude failed financial events, deleted records,
review-required detections, and unresolved conflict candidates. Count the last trustworthy
pre-conflict version once when available and mark the report incomplete; otherwise count nothing
until resolution. A resolved conflict replaces its prior version. Archived accounts/categories
retain historical activity.

Use these ledger rules:

```text
income = confirmed income - income reversals
expense = confirmed expense + obligation/recurring payments - linked refunds/reversals
netCashFlow = income - expense
savingsRate = netCashFlow / income, only when income > 0 and data is complete
```

Transfers between the user's own accounts affect neither income nor expense, while an explicit
transfer fee remains expense. Balance adjustments remain account activity but are excluded from
income/expense. An obligation payment appears in expense and obligation sections but affects net
cash flow once. A goal-linked internal transfer updates savings progress without becoming
spending.

**Rationale**: Reports must interpret the existing ledger, not introduce a second financial
source of truth or plausible double-counted totals.

**Alternatives considered**: Counting review items, ignoring pending local confirmations,
netting transfers, treating refunds as income, and summing obligation records separately were
rejected.

## Decision 5: Use safe integer money and explicit unavailable values

**Decision**: Reuse `MoneyValue` safe integer minor units. Capture one rate map per report
generation and use it for current/comparison totals, cards, charts, and output rows. Round each
conversion once into report-currency minor units using its explicit rate and timestamp. Preserve
original amounts and rate evidence. If any otherwise eligible value lacks a rate, retain known
components but mark the affected total, comparison, rate, breakdown, and potential largest-value
winner incomplete. A real zero remains distinct from unavailable.

**Rationale**: Integer arithmetic prevents drift; explicit incompleteness prevents understated
totals from looking authoritative.

**Alternatives considered**: Floating-point totals, silently excluded currencies, and a global
average rate without source timestamps were rejected.

## Decision 6: Make comparison meaning metric-aware

**Decision**: Each comparison retains current value, previous value, absolute change, optional
percentage, exact ranges, metric kind, and interpretation. Higher income/savings may be favorable;
higher expense/debt/overdue amount may be unfavorable. Percentage is unavailable for zero prior
value, no prior data, incomplete inputs, or a newly observed metric.

**Rationale**: Higher/lower alone is not financial guidance, and division by zero must not produce
an invented percentage.

**Alternatives considered**: One universal green-up/red-down rule and coerced 100-percent changes
were rejected.

## Decision 7: Aggregate once and preserve drill-down identities

**Decision**: Perform one O(n) pass over up to 10,000 contributing records, building summary and
category, account, merchant, obligation, savings, budget, salary, and profile-timezone month
indexes together. Each result retains contributing record IDs and existing transaction filters.
Show the four largest category segments plus a localized Other group that retains every grouped
category and transaction identity. Use only comparable completed month buckets for average
monthly spending, volatility, budget consistency, savings consistency, high/low month, debt
reduction, and subscription-impact claims; an incomplete current bucket may affect the report
summary but not masquerade as a completed low-spending month. A trend that needs comparison uses
at least two complete buckets and a meaningful denominator.

**Rationale**: A single pass meets the two-second target and ensures displayed totals and
drill-down use the same membership.

**Alternatives considered**: Per-card scans, row-local calculations, fixed top labels that discard
IDs, and an aggregate database/cache before measurement were rejected.

## Decision 8: Add one narrow planning reporting projection

**Decision**: Core Finance supplies paged transactions plus account/category labels through its
existing service. Extend Financial Planning with one read-only reporting snapshot for the period,
containing salary receipts, monthly budgets, obligation schedules/payments, savings goals/
movements, and completeness evidence. The reports service composes those typed results; screens
never read storage or calculate finance rules.

**Rationale**: One projection is smaller and safer than direct cross-feature storage access or
many per-obligation/per-goal requests, while preserving canonical ownership.

**Alternatives considered**: A second reporting ledger, direct SQLite in Reports, duplicating all
planning entities, and N+1 service calls were rejected.

## Decision 9: Persist only schedule state and immutable output attempts

**Decision**: Advance SQLite schema v5 to v6 with `report_schedules` and
`report_output_attempts`. Reuse the existing durable planning-draft table with a
`report_schedule` kind. Live reports are derived and not persisted. Each sent, test, scheduled,
retry, simulated download, or simulated share attempt embeds its self-contained immutable report
snapshot. A previous snapshot is read through its attempt.

**Rationale**: Two small report-owned tables cover offline schedule/status and historical output
trust without duplicating live aggregates or adding cache invalidation.

**Alternatives considered**: Report cache, separate snapshot table, report draft table, and
persisted breakdown aggregates were rejected until measured need exists.

## Decision 10: Keep one verified recipient and one predictable recurrence

**Decision**: Core V1 owns one schedule and one normalized recipient. Verification is bound to the
exact email; changing it returns the schedule to verification-required. Frequencies are monthly,
three-month, half-year, and annual. Delivery day is 1-28 in the captured timezone, default day 1,
at the deterministic 09:00 local mock time. The first occurrence is the next selected local
day/time after activation; later occurrences add cadence months to the prior scheduled occurrence,
not the actual completion time. An occurrence covers the immediately preceding complete cadence
period. A schedule created or resumed after its due time projects the next recurrence and never
silently backfills. A changed timezone requires review before the next projection is accepted.

**Rationale**: This matches the clarified scope while avoiding invalid dates, hidden sends, and
multi-recipient privacy complexity.

**Alternatives considered**: Day 29-31 fallback, automatic catch-up, multiple schedules/
recipients, and unreviewed timezone migration were rejected.

## Decision 11: Make every external output idempotent and simulated

**Decision**: Preview is side-effect free. Send test, send now, scheduled mock, retry, simulated
download, and simulated share require stable operation IDs. Retrying creates one attempt linked to
the failed attempt; repeating an operation ID returns the original result. A late result remains
attached to its attempt and cannot reactivate a paused schedule. No device-closed background run,
real email, file path, share sheet, or notification is claimed.

**Rationale**: Idempotency prevents duplicate delivery, while explicit simulation preserves
platform honesty.

**Alternatives considered**: Screen-level timers as a scheduler, automatic mutation retry,
provider SDKs, and fake file/share success were rejected.

## Decision 12: Use an allowlist for detailed output

**Decision**: Summary-only is the default. Detailed rows contain only date, transaction type,
category, optional merchant, amount/currency, and a masked account label. Notes, tags, full
account identifiers, source text, confidence, attachments, and internal IDs are absent from the
DTO, not merely hidden by the screen. Recipient email and report content never enter analytics,
logs, raw errors, notifications, app-switcher titles, or hidden-value accessibility labels.

**Rationale**: A structural allowlist is safer and simpler than redacting an unrestricted
transaction object at every output surface.

**Alternatives considered**: Serializing full transactions and UI-only hiding were rejected.

## Decision 13: Keep report state ownership narrow

**Decision**: TanStack Query owns live reports, breakdowns, schedule, draft, previews, attempts,
and attempt detail. Zustand holds only selected period, anchor date, and drill-down return context.
Finance/planning mutations invalidate live report queries; report schedule/output mutations
invalidate only mutable report-owned queries. Immutable attempts are never recomputed.

**Rationale**: This follows current state boundaries and avoids stale reports under the project's
infinite query stale time.

**Alternatives considered**: Report entities in Zustand, global invalidation, and immutable-
snapshot refresh were rejected.

## Decision 14: Reuse and harden existing report UI

**Decision**: Keep the Reports tab and existing transaction/obligation destinations. Harden
ReportMetricCard, ComparisonIndicator, AccessibleChartFrame, LineChart, DonutChart, and chart-data
for semantic metric meaning, actual geometry, localized Other, retained IDs, masking, text
summaries, RTL, grayscale, and 200-percent text. Reuse current forms, state views, banners,
overlays, and local state plus Zod/durable drafts.

**Rationale**: Existing components are the right boundaries but their current fixed graphics,
expense-only meaning, and hard-coded Other cannot truthfully render report data.

**Alternatives considered**: A second report UI kit, chart package, new form pattern, and a new
primary tab were rejected.

## Decision 15: Prove pure calculations before device behavior

**Decision**: Use pure unit checks for dates, eligibility, formulas, currency, comparison,
aggregation, recurrence, and sanitization; repository/service checks for migration, drafts,
versions, attempts, idempotency, immutable snapshots, and scopes; component/route checks for
journeys, privacy, localization, and access; and native builds only for platform lifecycle,
layout, offline behavior, TalkBack/VoiceOver, and simulated output presentation. Include one
10,000-record performance fixture.

**Rationale**: Deterministic tests prove financial behavior quickly; native checks prove only
what the operating system controls.

**Alternatives considered**: Device-only proof, snapshot tests as the primary oracle, and a new
end-to-end framework were rejected.

## Resolved Unknowns

- No planning ambiguity remains unresolved.
- The reports service captures the device-resolved IANA timezone until SPEC-009 supplies the
  profile timezone owner; schedules/snapshots retain the captured value.
- Live report caching is omitted because canonical records are local and the clarified scale is
  10,000 records. Add a cache only if measured derivation misses the two-second gate.
- Output history retention and production provider policy remain production concerns; the
  frontend keeps deterministic fixture history without promising server retention.
