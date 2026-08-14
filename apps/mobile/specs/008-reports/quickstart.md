# Quickstart: Validate Reports and Automatic Email Delivery

## Purpose

Run the smallest automated and native checks that prove SPEC-008 report periods, calculations,
drill-down, schedules, immutable output snapshots, privacy, offline behavior, localization,
accessibility, and performance. This guide assumes implementation tasks are complete and uses
synthetic fixtures only.

## Prerequisites

- Node.js and npm versions supported by the existing mobile workspace.
- Dependencies installed from the committed lockfile; SPEC-008 adds no runtime dependency.
- Android development build or emulator for lifecycle, offline, TalkBack, and layout checks.
- macOS/Xcode and an iOS development build for final VoiceOver and iOS checks.
- No real email address, account, transaction, salary, obligation, merchant, provider, report,
  conversion rate, file, or assistant content in fixtures.
- Email, background scheduling, download, sharing, notifications, and assistant output are
  explicitly deterministic simulations.

## Static and Automated Validation

From `apps/mobile`:

```powershell
npm run typecheck
npm run lint
npm run check:foundation
npm run check:design-system
npm run check:app-shell
npm run check:core-finance
npm run check:voice-capture
npm run check:financial-planning
npm run check:reports
npm test -- --runInBand
```

`check:reports` is added during implementation with the report boundary script.

Expected outcome:

- Every command exits successfully.
- Boundary checks report no route-to-database access, provider/file/share/background-scheduler
  imports, raw feature colors or strings, sensitive logs/analytics, report entities in Zustand,
  mutable output snapshots, false external-success claims, or iOS SMS behavior.
- Tests prove period/timezone math, eligibility, exact-once financial effects, conversions,
  comparisons, grouping, recurrence, verification, drafts, versions, idempotency, snapshots,
  query invalidation, masking, localization, charts, accessibility, and the acceptance-scale
  performance fixture.

## Development Build

Start the existing development client:

```powershell
npm run start -- --localhost
npm run android
```

On macOS/Xcode:

```bash
npm run ios
```

## Scenario 1: Required Periods and Summary

1. Open Reports with complete synthetic data and verify it remains the fourth permanent tab.
2. Select monthly, three-month, half-year, and annual reports and inspect the exact inclusive
   local dates, currency, generated time, data time, and previous range.
3. Exercise year boundaries, February 29, DST entry/exit, and a changed IANA timezone.
4. Open an in-progress period and confirm only matching elapsed local days are compared.
5. Verify income, expense, net cash flow, savings rate, obligation payments, largest category,
   largest transaction, and metric-aware comparison language.
6. Exercise zero income, zero prior value, negative net cash flow, tied largest values, no prior
   history, and insufficient completed-month history.

Expected outcome: all ranges and formulas are explicit; partial periods never compare as though
complete; zero/undefined denominators produce named unavailable/newly-observed states; favorable
and unfavorable wording follows metric meaning.

## Scenario 2: Eligibility, Currency, and Refresh

1. Load expenses, income, recurring and obligation payments, transfers with fees, adjustments,
   refunds, reversals, deleted/failed transactions, and goal-linked transfers.
2. Add confirmed local pending/failed-sync records, review-required detections, and unresolved
   conflict candidates with a last trustworthy version.
3. Confirm each economic effect contributes once and excluded candidates make the affected
   report incomplete.
4. Add several currencies with one captured current/stale mock rate set and one missing rate.
5. Verify original amounts and rate times, labeled estimates, known subtotal, incomplete totals,
   and unavailable potential winners.
6. Correct, reclassify, refund, reverse, delete, restore, and resolve a contributing record.
7. Return to Reports and verify live values refresh while an earlier output snapshot does not.

Expected outcome: no transfer principal, refund, reversal, obligation record, goal movement, or
conflict is double-counted; missing data is never silently omitted; current data refresh and
immutable historical output remain distinct.

## Scenario 3: Report Types, Charts, and Drill-Down

1. Verify monthly budget/category/obligation/savings/month-over-month content.
2. Verify three-month trend, comparable average spending, category movement, recurring payments,
   volatility, and savings consistency.
3. Verify half-year month trend, high/low completed months, debt reduction, budget consistency,
   savings progression, and subscription impact.
4. Verify annual totals, distribution, salary/obligation overview, debt/savings achievements,
   monthly comparison, and labeled mock summary.
5. Inspect card, chart, and text-summary values for the same result.
6. Load more than four categories and verify localized Other retains member names, IDs, and
   transactions.
7. Drill into category, account, merchant, month, Other, and obligation results, verify visible
   filters/history, then return to the unchanged report period and scroll context.

Expected outcome: every visual answers a named question, matches the text equivalent, retains
traceable membership, uses non-color cues, and opens canonical transaction or obligation data
without a second ledger.

## Scenario 4: Schedule, Verification, and Draft Recovery

1. Open schedule settings with no saved schedule and verify summary-only, day 1, current locale,
   base currency, and captured timezone defaults.
2. Enter an invalid email, then a valid unverified email; verify the schedule cannot become
   active until deterministic verification succeeds.
3. Change the verified address and confirm prior verification is invalidated without deleting
   attempt history.
4. Configure all four frequencies and days 1 and 28. Inspect the 09:00 local projected occurrence
   and the complete period it covers.
5. Create/resume after the due time and verify the next recurrence is selected with no silent
   catch-up.
6. Change timezone and review the new future instant while old attempts retain the original zone.
7. Pause, resume, and disable; verify last status/history remains and only future projection
   changes.
8. Edit fields, trigger validation, navigate away, restart, go offline, and force a recoverable
   save/version conflict; restore or explicitly discard the draft.

Expected outcome: one trusted versioned schedule exists, exact-address verification gates active
delivery, recurrence does not drift or backfill, and meaningful edits are not lost.

## Scenario 5: Preview, Output, Failure, and Retry

1. Preview summary-only content and inspect period/ranges, data time, language, currency,
   included sections, estimates/incompleteness, recipient, mock warning, and privacy warning.
2. Enable detailed output and verify rows contain only date, type, category, permitted merchant,
   amount/currency, and masked account label.
3. Confirm notes, tags, full identifiers, raw source text, confidence, attachments, raw
   transactions, and internal IDs are absent from the DTO and screen-reader tree.
4. Exercise Send test, Send now, and one deterministic scheduled attempt through ready, sending,
   sent, temporary failure, recipient failure, and offline states.
5. Tap actions repeatedly and replay the same operation ID.
6. Retry a failure, attempt a concurrent/second successful retry, and inspect the retry link and
   reused immutable snapshot.
7. Pause the schedule during an in-flight attempt and deliver a late result.
8. Simulate download and share; verify no file path, share sheet, or real-success claim exists.
9. Change source data/rates after every outcome and compare the frozen snapshot with the refreshed
   live report by generation time.

Expected outcome: each operation applies once; retry cannot create duplicate success; failed
attempts do not move last-success status; late results do not reactivate schedules; every
external outcome is explicitly simulated and historically immutable.

## Scenario 6: Loading, Empty, Partial, Stale, and Offline

1. Exercise initial, loading, refreshing, complete, empty, insufficient-data, partial, estimated,
   stale, error, offline, and sync-failed report states.
2. Distinguish no activity from insufficient comparable history.
3. Go offline with canonical local records and verify the report remains readable with its data
   time; inspect a prior attempt snapshot if current calculation is unavailable.
4. Exercise verification-required, active, paused, disabled, scheduled, sending, sent, failed,
   retrying, and simulated output states.
5. Verify every failure offers a user action and exposes no raw provider/storage detail.

Expected outcome: no unavailable value is fabricated, the latest trustworthy local information
is clearly dated, and recovery preserves schedule/report trust.

## Scenario 7: Privacy, Language, Theme, and Access

Repeat Scenarios 1-6 across this minimum matrix:

| Dimension | Required values |
|---|---|
| Language | Arabic RTL, English LTR |
| Theme | Light, dark |
| Device | 320x568 logical phone, large phone, adaptive tablet |
| Text | Default, 200% |
| Screen reader | TalkBack; VoiceOver on macOS/iOS |
| Motion | Standard, reduced |
| Visual meaning | Full color and grayscale |
| Sensitive values | Visible and globally hidden |

Inspect tabs, period selector, cards, charts, text summaries, Other, drill-down/back context,
assistant entries, schedule form, verification, preview, attempts, errors, keyboard-open layout,
external titles, and app-switcher behavior.

Expected outcome: no amount, date, range, status, comparison, warning, verification, validation,
or primary action is hidden; mixed-direction content reads naturally; focus is logical; touch
targets pass; hidden values are not announced; color, motion, chart geometry, icon, and haptic
feedback are never required for meaning.

## Performance Fixture

Use 10,000 confirmed contributing records spanning the selected and comparison ranges, plus
accounts, categories, merchants, salary, budgets, obligations/payments, goals/movements, several
currencies, and Other-group membership.

Expected outcome:

- After warm-up, at least 95% of supported-device period selections show summary and first useful
  content within 2,000 ms.
- Aggregation is O(n) with no per-card source scan or per-row recalculation.
- Drill-down lists are virtualized and do not render all 10,000 rows before useful report content.
- Totals and membership exactly match the smaller oracle fixture; performance optimization does
  not omit or duplicate records.

## Report Invariants

- Displayed inclusive local dates map to half-open timestamp query boundaries in the captured
  timezone.
- In-progress comparisons include matching local calendar days only.
- Confirmed local records count once; unresolved candidate snapshots do not.
- Transfer principal and balance adjustments are not income/expense; transfer fee is expense.
- Refunds/reversals offset linked original effects; obligation totals reuse the linked expense;
  goal movements add no second ledger effect.
- One FX-rate map serves a generated report and remains frozen in its output snapshot.
- Missing rates/history produce incomplete/unavailable values, not silent zero.
- Partial months do not enter insights that claim comparable completed months.
- Cards, charts, text summaries, Other, and drill-down share one membership result.
- A changed recipient requires verification; delivery day stays within 1-28; missed occurrences
  are not backfilled silently.
- Operation replay is idempotent; one retry chain cannot create duplicate success.
- Detailed rows contain allowlisted fields only; hidden financial content is never announced.
- Live reports refresh; output snapshots never change.

## Evidence to Retain

- Automated output for all static, boundary, and test commands.
- Schema v5-to-v6 migration, version, operation uniqueness, retry, and immutable-snapshot results.
- Period/timezone/leap/DST, exact-once, missing-rate, and 10,000-record measurements.
- Android device/emulator matrix with versions, offline behavior, and TalkBack notes.
- iOS/VoiceOver evidence from macOS/Xcode; record as blocked rather than passed when unavailable.
- Arabic/English light/dark screenshots or UI trees for critical report, chart, schedule, preview,
  output, and failure states.
- Proof that no production email, background job, file, share, notification, assistant, provider,
  or secret was introduced.

## Stop Conditions

Do not mark SPEC-008 complete if any check shows:

- a wrong period/timezone boundary or partial-to-full comparison;
- a fabricated, silently incomplete, rounded inconsistently, or double-counted financial value;
- card/chart/text/drill-down membership disagreement or inaccessible chart meaning;
- a stale live report after source correction or a rewritten prior output snapshot;
- an unverified recipient shown active, invalid recurrence, hidden catch-up, duplicate send, or
  retry/late-result schedule corruption;
- a detailed output field outside the allowlist or sensitive content in analytics, logs, errors,
  notifications, app previews, external titles, or hidden-value accessibility output;
- a claim of real email, background delivery, file, sharing, notification, or assistant content;
- Arabic/English, 200% text, screen-reader, grayscale, keyboard, reduced-motion, small-phone, or
  platform-honesty failure;
- the 10,000-record/two-second gate missed without a measured follow-up task and evidence.
