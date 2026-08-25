import type { LocalDate } from './financial-planning';

export type FinancialPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'calendar_month'
  | 'three_months'
  | 'six_months'
  | 'twelve_months'
  | 'current_cycle';

export interface FinancialPeriodContext {
  timeZone: string;
  monthStartDay: number;
}

export interface FinancialPeriodBoundary {
  startDate: LocalDate;
  endDate: LocalDate;
  startInstant: number;
  endInstant: number;
}

const calendarMonthSpans: Partial<Record<FinancialPeriodPreset, number>> = {
  calendar_month: 1,
  three_months: 3,
  six_months: 6,
  twelve_months: 12
};

export function buildFinancialPeriod(
  input: FinancialPeriodContext & {
    preset: FinancialPeriodPreset;
    anchorDate: LocalDate;
  }
): FinancialPeriodBoundary {
  const [startDate, endDate] = periodDates(input);
  return {
    startDate,
    endDate,
    startInstant: localDateTimeInstant(startDate, input.timeZone),
    endInstant:
      localDateTimeInstant(addLocalDays(endDate, 1), input.timeZone) - 1
  };
}

function periodDates(
  input: FinancialPeriodContext & {
    preset: FinancialPeriodPreset;
    anchorDate: LocalDate;
  }
): [LocalDate, LocalDate] {
  const monthSpan = calendarMonthSpans[input.preset];
  if (monthSpan) return calendarMonths(input.anchorDate, monthSpan);
  if (input.preset === 'current_cycle') {
    return currentCycle(input.anchorDate, input.monthStartDay);
  }
  if (input.preset === 'yesterday') {
    const yesterday = addLocalDays(input.anchorDate, -1);
    return [yesterday, yesterday];
  }
  if (input.preset === 'this_week') return currentWeek(input.anchorDate);
  if (input.preset === 'last_week') return previousWeek(input.anchorDate);
  if (input.preset === 'this_month') {
    return [monthDate(input.anchorDate, 0, 1), input.anchorDate];
  }
  if (input.preset === 'last_month')
    return calendarMonths(input.anchorDate, 1, -1);
  return [input.anchorDate, input.anchorDate];
}

function calendarMonths(
  anchorDate: LocalDate,
  monthSpan: number,
  endMonthOffset = 0
): [LocalDate, LocalDate] {
  const start = monthDate(anchorDate, endMonthOffset - monthSpan + 1, 1);
  const afterEnd = monthDate(anchorDate, endMonthOffset + 1, 1);
  return [start, addLocalDays(afterEnd, -1)];
}

function currentCycle(
  anchorDate: LocalDate,
  monthStartDay: number
): [LocalDate, LocalDate] {
  if (monthStartDay < 1 || monthStartDay > 28) {
    throw new RangeError('monthStartDay must be between 1 and 28');
  }
  const monthOffset = Number(anchorDate.slice(8, 10)) < monthStartDay ? -1 : 0;
  const start = monthDate(anchorDate, monthOffset, monthStartDay);
  return [
    start,
    addLocalDays(monthDate(anchorDate, monthOffset + 1, monthStartDay), -1)
  ];
}

function currentWeek(anchorDate: LocalDate): [LocalDate, LocalDate] {
  const dayOfWeek = utcProxy(anchorDate).getUTCDay();
  return [addLocalDays(anchorDate, -((dayOfWeek + 6) % 7)), anchorDate];
}

function previousWeek(anchorDate: LocalDate): [LocalDate, LocalDate] {
  const [currentStart] = currentWeek(anchorDate);
  return [addLocalDays(currentStart, -7), addLocalDays(currentStart, -1)];
}

function monthDate(
  anchorDate: LocalDate,
  monthOffset: number,
  day: number
): LocalDate {
  const anchor = utcProxy(anchorDate);
  return utcLocalDate(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + monthOffset,
    day
  );
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const shifted = utcProxy(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10) as LocalDate;
}

export function localDateInTimeZone(
  timestamp: number,
  timeZone: string
): LocalDate {
  const parts = zonedDateParts(timestamp, timeZone);
  return utcLocalDate(parts.year, parts.month - 1, parts.day);
}

export function localDateTimeInstant(
  date: LocalDate,
  timeZone: string,
  hour = 0
): number {
  const [year, month, day] = date.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedDateParts(candidate, timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    candidate = desired - (represented - candidate);
  }
  return candidate;
}

function zonedDateParts(timestamp: number, timeZone: string) {
  let formatter = zonedDateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    zonedDateFormatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(timestamp)
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

const zonedDateFormatters = new Map<string, Intl.DateTimeFormat>();

function utcProxy(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function utcLocalDate(year: number, month: number, day: number): LocalDate {
  return new Date(Date.UTC(year, month, day))
    .toISOString()
    .slice(0, 10) as LocalDate;
}
