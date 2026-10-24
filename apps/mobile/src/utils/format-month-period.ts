import type { Locale } from '@/domain/foundation';

/** Stored budget keys remain calendar months, independent of the current salary cycle. */
export function formatMonthPeriod(
  key: string | null | undefined,
  locale: Locale
): string {
  if (!key || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return '—';
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${key}-01T12:00:00Z`));
}
