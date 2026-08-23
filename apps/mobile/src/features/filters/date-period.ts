import type { TransactionFilterSet } from '@/domain/core-finance';
import { emptyTransactionFilters } from '@/domain/core-finance';
import type { LocalDate } from '@/domain/financial-planning';
import {
  buildFinancialPeriod,
  localDateInTimeZone,
  type FinancialPeriodBoundary,
  type FinancialPeriodContext,
  type FinancialPeriodPreset
} from '@/domain/financial-period';

export interface DatePeriod {
  kind: 'month' | 'custom';
  periodStart: number;
  periodEnd: number;
}

const utcContext: FinancialPeriodContext = {
  timeZone: 'UTC',
  monthStartDay: 1
};

export function monthPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('calendar_month', timestamp, context, 'month');
}

export function currentFinancialCyclePeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('current_cycle', timestamp, context, 'month');
}

export function customPeriod(
  start: number,
  end: number,
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  const boundary = boundaryFromDates(
    localDateInTimeZone(start, context.timeZone),
    localDateInTimeZone(end, context.timeZone),
    context
  );
  return toDatePeriod(boundary, 'custom');
}

export function customPeriodFromDates(
  startDate: LocalDate,
  endDate: LocalDate,
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return toDatePeriod(boundaryFromDates(startDate, endDate, context), 'custom');
}

export function periodFromRange(
  start: number | null,
  end: number | null,
  fallback = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  if (start === null && end === null) return monthPeriod(fallback, context);
  const resolvedStart = start ?? end!;
  const resolvedEnd = end ?? start!;
  const month = monthPeriod(resolvedStart, context);
  return resolvedStart === month.periodStart && resolvedEnd === month.periodEnd
    ? month
    : { kind: 'custom', periodStart: resolvedStart, periodEnd: resolvedEnd };
}

export function periodFilters(period: DatePeriod): TransactionFilterSet {
  return {
    ...emptyTransactionFilters,
    accountIds: [],
    categoryIds: [],
    types: [],
    sources: [],
    statuses: [],
    syncStatuses: [],
    periodStart: period.periodStart,
    periodEnd: period.periodEnd
  };
}

export function formatPeriodLabel(
  period: DatePeriod,
  locale: string,
  timeZone = 'UTC'
): string {
  if (period.kind === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone
    }).format(period.periodStart);
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone
  });
  return `${formatter.format(period.periodStart)} – ${formatter.format(period.periodEnd)}`;
}

export function todayPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('today', timestamp, context);
}

export function yesterdayPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('yesterday', timestamp, context);
}

export function thisWeekPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('this_week', timestamp, context);
}

export function lastWeekPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('last_week', timestamp, context);
}

export function thisMonthPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('this_month', timestamp, context);
}

export function lastMonthPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('last_month', timestamp, context);
}

export function last3MonthsPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('three_months', timestamp, context);
}

export function last6MonthsPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('six_months', timestamp, context);
}

export function lastYearPeriod(
  timestamp = Date.now(),
  context: FinancialPeriodContext = utcContext
): DatePeriod {
  return presetPeriod('twelve_months', timestamp, context);
}

function presetPeriod(
  preset: FinancialPeriodPreset,
  timestamp: number,
  context: FinancialPeriodContext,
  kind: DatePeriod['kind'] = 'custom'
): DatePeriod {
  const boundary = buildFinancialPeriod({
    ...context,
    preset,
    anchorDate: localDateInTimeZone(timestamp, context.timeZone)
  });
  return toDatePeriod(boundary, kind);
}

function boundaryFromDates(
  startDate: LocalDate,
  endDate: LocalDate,
  context: FinancialPeriodContext
): FinancialPeriodBoundary {
  const start = buildFinancialPeriod({
    ...context,
    preset: 'today',
    anchorDate: startDate
  });
  const end = buildFinancialPeriod({
    ...context,
    preset: 'today',
    anchorDate: endDate
  });
  return { ...start, endDate: end.endDate, endInstant: end.endInstant };
}

function toDatePeriod(
  boundary: FinancialPeriodBoundary,
  kind: DatePeriod['kind']
): DatePeriod {
  return {
    kind,
    periodStart: boundary.startInstant,
    periodEnd: boundary.endInstant
  };
}

export function formatDaySpan(
  start: number,
  end: number,
  locale: string,
  timeZone = 'UTC'
): string {
  const startDate = localDateInTimeZone(start, timeZone);
  const endDate = localDateInTimeZone(end, timeZone);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const endMonthName = monthName(end, locale, timeZone);
  if (startMonth === endMonth && startYear === endYear) {
    return startDay === endDay
      ? `${startDay} ${endMonthName} ${endYear}`
      : `${startDay} – ${endDay} ${endMonthName} ${endYear}`;
  }
  const startMonthName = monthName(start, locale, timeZone);
  return startYear === endYear
    ? `${startDay} ${startMonthName} – ${endDay} ${endMonthName} ${endYear}`
    : `${startDay} ${startMonthName} ${startYear} – ${endDay} ${endMonthName} ${endYear}`;
}

export function formatMonthSpan(
  start: number,
  end: number,
  locale: string,
  timeZone = 'UTC'
): string {
  const startYear = Number(localDateInTimeZone(start, timeZone).slice(0, 4));
  const endYear = Number(localDateInTimeZone(end, timeZone).slice(0, 4));
  const startMonth = monthName(start, locale, timeZone);
  const endMonth = monthName(end, locale, timeZone);
  return startYear === endYear
    ? `${startMonth} - ${endMonth} ${endYear}`
    : `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

function monthName(
  timestamp: number,
  locale: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone }).format(
    timestamp
  );
}
