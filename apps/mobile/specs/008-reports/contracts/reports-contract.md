# Contract: Reports and Automatic Email Delivery

This contract defines user-visible routes and typed boundaries between Reports, Core Finance,
Financial Planning, deterministic output simulation, and local storage. It is not an HTTP API
and does not define production reporting, email, background scheduling, file generation,
sharing, notifications, assistant generation, retention, or provider behavior.

## 1. Route Contract

| Route | Responsibility |
|---|---|
| `/(tabs)/reports` | Permanent Reports tab, period selection, exact ranges, summary, report-type insights, states, assistant entry points, and email-settings entry |
| `/reports/drill-down` | Report-owned dimension detail and return context; transaction destinations use existing filters and obligation destinations use existing detail routes |
| `/reports/preview` | Live preview or immutable prior output snapshot, included sections, detail level, privacy/estimate notices, and output actions/status |
| `/reports/schedule` | Recipient verification, frequency, language, currency, day, timezone review, content choices, last/next status, attempts, pause/resume/disable, and draft recovery |

Route files remain thin and never access SQLite, calculate report totals, invoke a provider, or
claim a real file/share/email outcome. Home, Transactions, Add, Reports, and More remain the five
primary tabs.

## 2. Typed Reports Service Boundary

The implementation provides one replaceable contract equivalent to:

```ts
interface ReportsService {
  getReport(input: ReportQuery): Promise<FinancialReport>;
  getBreakdown(input: ReportBreakdownQuery): Promise<ReportBreakdown>;

  getSchedule(): Promise<ReportSchedule | null>;
  verifyRecipient(
    email: string,
    operationId: string
  ): Promise<MutationResult<RecipientVerification>>;
  saveSchedule(
    input: ReportScheduleInput,
    expectedVersion: number | null,
    operationId: string
  ): Promise<MutationResult<ReportSchedule>>;
  setScheduleStatus(
    status: 'active' | 'paused' | 'disabled',
    expectedVersion: number,
    operationId: string
  ): Promise<MutationResult<ReportSchedule>>;

  saveScheduleDraft(input: ReportScheduleDraft): Promise<ReportScheduleDraft>;
  loadScheduleDraft(): Promise<ReportScheduleDraft | null>;
  discardScheduleDraft(): Promise<void>;

  previewOutput(input: ReportOutputPreviewInput): Promise<ReportPreview>;
  requestOutput(
    input:
      | {
          kind: 'send_test' | 'send_now' | 'download' | 'share';
          previewId: string;
        }
      | { kind: 'scheduled'; scheduleId: string; scheduledFor: number }
      | { kind: 'retry'; previousAttemptId: string },
    operationId: string
  ): Promise<MutationResult<ReportOutputAttempt>>;
  listAttempts(input?: AttemptQuery): Promise<AttemptPage>;
  getAttempt(id: string): Promise<ReportOutputAttempt>;
}
```

`MutationResult` reuses the existing affected-scope contract. Mock scenario selection helpers
remain private to fixtures/tests and do not enlarge this service.

## 3. Canonical Source Boundary

- Core Finance remains the source of accounts, categories, confirmed transactions, correction,
  review/conflict evidence, and currency estimates.
- Financial Planning adds one read-only `getReportingSnapshot(period)` method returning salary,
  budget, obligation/payment, savings, and completeness inputs for the exact period and
  comparison range.
- Reports may request one page containing the acceptance-scale transaction set, then aggregates
  it once. It must not request records per card or per rendered row.
- No report operation can create, update, reverse, delete, or resolve a financial record.
- Finance and planning mutation results add the `reports.live` affected scope when their
  canonical values can change a report.

## 4. Report Query and Period Contract

```ts
type ReportPeriodKind =
  | 'monthly'
  | 'three_months'
  | 'half_year'
  | 'annual';

interface ReportQuery {
  kind: ReportPeriodKind;
  anchorDate: LocalDate;
  currencyCode: string;
  timeZone: string;
}

interface ReportPeriod {
  kind: ReportPeriodKind;
  anchorDate: LocalDate;
  startDate: LocalDate;
  endDate: LocalDate;
  startInstant: number;
  endExclusiveInstant: number;
  timeZone: string;
  inProgress: boolean;
  comparisonStartDate: LocalDate;
  comparisonEndDate: LocalDate;
  comparisonStartInstant: number;
  comparisonEndExclusiveInstant: number;
}
```

- Displayed local dates are inclusive; internal timestamp queries use half-open
  `[startInstant, endExclusiveInstant)` ranges.
- Completed periods compare with the immediately preceding same-kind calendar period.
- In-progress periods compare only the same number of included local calendar days; calendar-day
  addition handles DST and leap years.
- The device-resolved IANA timezone is the temporary profile-timezone source until SPEC-009 owns
  profile settings. Schedules/snapshots preserve the captured timezone and require review when it
  changes.

## 5. Report Value and Calculation Contract

```ts
type ReportValue<T> =
  | { status: 'available'; value: T }
  | {
      status: 'estimated';
      value: T;
      asOf: number;
      originalValues: MoneyValue[];
    }
  | {
      status: 'incomplete';
      value: T | null;
      reasons: CompletenessReason[];
    }
  | { status: 'unavailable'; value: null; reason: UnavailableReason };
```

- Reuse safe integer `MoneyValue`; no floating-point money totals.
- A report captures one FX-rate map and uses it for the current range, comparison range, cards,
  charts, and output rows. Original money and rate times remain available.
- Missing rates retain only a labeled known subtotal and make affected totals, comparisons,
  trends, and potential winners incomplete.
- Include confirmed local pending/failed-sync records once. Exclude review-required and
  unresolved candidate snapshots; count a last trustworthy pre-conflict value once when
  available and label the report incomplete.
- Transfers are neutral except for an explicit transfer fee. Adjustments remain account activity
  but are not income/expense. Refunds/reversals offset their linked original effect and never
  become income.
- Obligation payments appear in expense and obligation sections but affect net cash flow once.
  Goal-linked internal transfers contribute to savings progress without becoming expense.
- Savings rate requires complete inputs and positive income. Comparison percentage requires
  complete values and a positive previous denominator.
- A comparison carries current/previous values, absolute change, optional percentage, both
  ranges, metric kind, direction, and `favorable | unfavorable | neutral | not_applicable`
  interpretation.
- Longer-period averages, volatility, budget consistency, savings consistency, high/low months,
  and similar claims use comparable completed month buckets. Partial months may contribute to
  the summary but not masquerade as completed low-spending months.
- No route or component reimplements these rules.

## 6. Breakdown, Chart, and Drill-Down Contract

- All cards, charts, text summaries, and drill-downs consume one aggregation result.
- Each breakdown item retains its dimension ID, semantic metric kind, exact value, comparison,
  contributing record IDs, and a typed drill-down descriptor.
- Category charts show four named categories plus localized Other when needed. Other retains all
  member category and transaction IDs.
- Stable ID tie-breaking makes sorting deterministic. A tied largest transaction/category is
  represented as tied and remains inspectable rather than selected arbitrarily.
- Month buckets contain zero only when a completed month has confirmed zero activity; missing or
  partial history is not converted to zero.
- Transaction drill-down maps to the existing `TransactionFilterSet`, with report period and
  dimension filters visible. Obligation drill-down opens the existing obligation detail/history.
- The reports view store retains only period/anchor and return context. It contains no report,
  transaction, schedule, or attempt entity.
- Every chart has a named question, exact labels/values, equivalent localized text summary,
  non-color cues, and the same drill-down membership.

## 7. Schedule and Verification Contract

- Core V1 has at most one schedule and one recipient.
- Email is normalized and validated. Verification belongs to that exact address; a changed
  address moves the schedule to `verification_required` without deleting history.
- Schedule input supports the four report frequencies, Arabic/English, report currency, delivery
  day 1-28, captured timezone, optional deterministic assistant summary, and summary/detailed
  content. Defaults are day 1 and summary-only.
- The projected occurrence is 09:00 local time on the selected day. Later occurrences add
  1/3/6/12 calendar months to the scheduled occurrence, not the completion time.
- An occurrence covers the immediately preceding complete cadence period. Creation or resume
  after the selected occurrence skips to the next; Send now is the only catch-up path.
- A timezone change must be previewed before future instants change. Prior attempts retain their
  original timezone.
- `expectedVersion` prevents silent concurrent overwrite. Validation/conflict failures preserve
  the durable draft and trusted schedule.
- Pausing/disabling removes future projection but preserves attempts. A result already in flight
  updates only that attempt and never reactivates the schedule.

## 8. Draft and Preview Contract

- `ReportScheduleDraft` reuses the existing PlanningDraft persistence with
  `kind: 'report_schedule'`.
- Meaningful schedule edits autosave and survive validation, accidental navigation, restart,
  offline state, and recoverable failure until save or explicit discard.
- `previewOutput` is side-effect free and returns a preview ID, exact period/ranges, data time,
  language, currency, included sections, detail level, completeness/estimate labels, recipient
  context, privacy warning, and sanitized rows.
- Saving a schedule or requesting output revalidates current versions, recipient verification,
  preview input, and operation ID.

## 9. Output and Snapshot Contract

- `send_test`, `send_now`, `scheduled`, `retry`, `download`, and `share` are deterministic
  frontend outcomes. No real provider, file, share sheet, or background run is claimed.
- Each output attempt embeds the exact immutable snapshot used for that outcome. Current reports
  recalculate after source changes; earlier snapshots never change.
- Every command has a stable unique operation ID. Replaying it returns the original result.
- A retry creates one new attempt linked to the failed attempt, reuses its immutable snapshot,
  and is rejected when that chain already has an active or successful retry. It cannot create a
  second successful delivery for the same requested outcome.
- A failed attempt does not change the last-successful date. A late result remains labeled with
  the schedule status at completion.
- Download/share attempts end as `simulated`, never as a real external file/share success.

Detailed rows use a structural allowlist:

```ts
interface DetailedReportRow {
  date: LocalDate;
  transactionType: TransactionType;
  categoryLabel: string;
  merchantLabel: string | null;
  amount: MoneyValue;
  maskedAccountLabel: string;
}
```

The type has no notes, tags, full account identifiers, source text, confidence, attachments, raw
transaction object, or internal references.

## 10. Query Ownership and Invalidation

TanStack Query owns:

- `reports.live(query)`
- `reports.breakdown(reportKey, dimension)`
- `reports.schedule`
- `reports.scheduleDraft`
- `reports.preview(input)`
- `reports.attempts(query)`
- `reports.attempt(id)`

Finance/planning mutations invalidate `reports.live` and relevant breakdowns. Report schedule and
output mutations invalidate schedule/draft/attempt keys only. Preview, cancel, and failed
validation invalidate nothing. Immutable attempts/snapshots are read by ID and never refreshed
from current source data.

## 11. State and Error Contract

Keep independent state dimensions:

- Query: `initial | loading | error | refreshing`.
- Report data: `complete | empty | insufficient_data | partial | estimated | stale | offline`.
- Schedule: `verification_required | active | paused | disabled`.
- Output: `ready | scheduled | sending | sent | failed | retrying | simulated`.

```ts
type ReportsErrorCode =
  | 'validation'
  | 'not_found'
  | 'unverified_recipient'
  | 'offline_unavailable'
  | 'conflict'
  | 'duplicate_request'
  | 'stale_preview'
  | 'unknown';
```

Missing data/history/rates are report values, not thrown errors. Safe output failure categories
are `temporary | recipient | configuration | unknown`; raw provider/storage errors are never
shown.

## 12. Privacy, Localization, Accessibility, and Boundary Rules

- Recipient email, financial amounts, merchants, accounts, report rows, snapshots, and source
  IDs never enter analytics, logs, raw errors, external titles, notifications, app-switcher
  previews, or hidden-value accessibility labels.
- Hidden values remain masked visually and for screen readers. Email content remains an explicit
  external choice because it leaves the app conceptually even in mock mode.
- Every label/state is localized in Arabic RTL and English LTR. English numerals and locale-aware
  financial/date formatting are required; mixed-direction email, account, merchant, and currency
  content is intentional.
- Charts and comparisons remain understandable at 200% text, in grayscale, with reduced motion,
  and through equivalent screen-reader summaries. Touch targets are at least 44 by 44.
- Existing semantic tokens/components are mandatory. No hard-coded feature string, brand value,
  raw SVG report color, provider/secret import, direct SQLite outside storage, or unsupported iOS
  SMS behavior is permitted.
- A report boundary script rejects direct storage/provider/file/share access from features,
  sensitive logging/analytics, raw colors/strings, report entities in Zustand, mutable snapshots,
  and claims of real external output.

## 13. Performance Contract

- Aggregate the selected and comparison ranges in O(n), with no per-card rescan or row-local
  report calculation.
- For up to 10,000 confirmed contributing records, at least 95% of supported-device report
  selections show summary and first useful content within 2,000 ms after warm-up.
- Drill-down lists are virtualized; the report screen never renders 10,000 rows before first
  useful content.
- If this measured gate fails, optimize the canonical read/index before adding a live aggregate
  cache or another dependency.
