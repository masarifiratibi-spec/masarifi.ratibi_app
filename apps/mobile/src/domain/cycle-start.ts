import type { Locale } from './foundation';

/**
 * Supported cycle start days: 1 to 28.
 * Constrained to 28 so every calendar month (including Feb in non-leap years)
 * contains the start day.
 */
export const MIN_CYCLE_START_DAY = 1;
export const MAX_CYCLE_START_DAY = 28;

export const SUPPORTED_CYCLE_START_DAYS: readonly number[] = Array.from(
  { length: MAX_CYCLE_START_DAY - MIN_CYCLE_START_DAY + 1 },
  (_, index) => MIN_CYCLE_START_DAY + index
);

export function formatDayOrdinal(day: number, locale: Locale = 'en'): string {
  if (locale === 'ar') {
    return `${day}`;
  }
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) {
    return `${day}st`;
  }
  if (j === 2 && k !== 12) {
    return `${day}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${day}rd`;
  }
  return `${day}th`;
}

export interface CycleDateRange {
  startDate: Date;
  endDate: Date;
  formattedRange: string;
  startDayNum: number;
  endDayNum: number;
  startMonthName: string;
  endMonthName: string;
  startLabel: string;
  endLabel: string;
  compactRange: string;
}

/**
 * Calculates the cycle date range for a given start day (1-28)
 * anchored around the current reference month.
 *
 * For startDay = 1: Entire anchor month (e.g. Aug 1 - Aug 31).
 * For startDay > 1: From anchor month start day to next month (startDay - 1).
 */
export function calculateCycleDateRange(
  startDay: number,
  referenceDate: Date = new Date(),
  locale: Locale = 'en'
): CycleDateRange {
  const clampedDay = Math.max(
    MIN_CYCLE_START_DAY,
    Math.min(MAX_CYCLE_START_DAY, Math.floor(startDay) || 1)
  );

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  const startDate = new Date(year, month, clampedDay);

  let endDate: Date;
  if (clampedDay === 1) {
    // End date is last day of the current month
    endDate = new Date(year, month + 1, 0);
  } else {
    // End date is (clampedDay - 1) of the next month
    endDate = new Date(year, month + 1, clampedDay - 1);
  }

  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-US-u-nu-latn';
  const monthFormatter = new Intl.DateTimeFormat(tag, { month: 'short' });

  const startMonthName = monthFormatter.format(startDate);
  const endMonthName = monthFormatter.format(endDate);
  const startDayNum = startDate.getDate();
  const endDayNum = endDate.getDate();

  let formattedRange: string;
  let startLabel: string;
  let endLabel: string;
  let compactRange: string;

  if (locale === 'ar') {
    startLabel = `${startDayNum} ${startMonthName}`;
    endLabel = `${endDayNum} ${endMonthName}`;
    formattedRange = `${startDayNum} ${startMonthName} - ${endDayNum} ${endMonthName}`;
    compactRange =
      clampedDay === 1
        ? `${startDayNum} – ${endDayNum} ${startMonthName}`
        : `${startDayNum} ${startMonthName} – ${endDayNum} ${endMonthName}`;
  } else {
    startLabel = `${startMonthName} ${startDayNum}`;
    endLabel = `${endMonthName} ${endDayNum}`;
    formattedRange = `${startMonthName} ${startDayNum} - ${endMonthName} ${endDayNum}`;
    compactRange =
      clampedDay === 1
        ? `${startMonthName} ${startDayNum} – ${endDayNum}`
        : `${startMonthName} ${startDayNum} – ${endMonthName} ${endDayNum}`;
  }

  return {
    startDate,
    endDate,
    formattedRange,
    startDayNum,
    endDayNum,
    startMonthName,
    endMonthName,
    startLabel,
    endLabel,
    compactRange
  };
}
