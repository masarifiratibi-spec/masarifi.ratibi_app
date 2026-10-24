import { getDateFormatter, getNumberFormatter } from './intl-formatters';
import { formatDate, formatMinorAmount } from './format-financial-value';
import { formatTransactionTimestamp } from '@/features/transactions/transaction-presentation';

afterEach(() => jest.restoreAllMocks());

it('separates locale, precision, and timezone configurations', () => {
  expect(formatMinorAmount(12_345, 'OMR', 'ar')).toBe('12.345\u00a0OMR');
  expect(formatMinorAmount(12_345, 'JPY', 'en')).toBe('12,345\u00a0JPY');
  expect(formatMinorAmount(-Number.MAX_SAFE_INTEGER, 'SAR', 'ar')).toBe(
    '\u200e-90,071,992,547,409.91\u00a0SAR'
  );
  const timestamp = Date.parse('2026-10-17T22:30:00Z');
  expect(formatDate(timestamp, 'en', 'UTC')).toBe('Oct 17, 2026');
  expect(formatDate(timestamp, 'en', 'Asia/Riyadh')).toBe('Oct 18, 2026');
  expect(formatDate(timestamp, 'ar', 'Asia/Riyadh')).toContain('أكتوبر');
  expect(formatDate(timestamp, 'ar', 'Asia/Riyadh')).not.toMatch(/[٠-٩]/);
});

it('updates relative labels across midnight and daylight-saving boundaries', () => {
  const transaction = Date.parse('2026-11-01T05:30:00Z');
  expect(
    formatTransactionTimestamp(
      transaction,
      transaction,
      'en',
      'America/New_York'
    )
  ).toMatch(/^Today, .*01:30/);
  expect(
    formatTransactionTimestamp(
      transaction,
      Date.parse('2026-11-02T06:00:00Z'),
      'en',
      'America/New_York'
    )
  ).toMatch(/^Yesterday, .*01:30/);
  expect(
    formatTransactionTimestamp(
      transaction,
      Date.parse('2026-11-03T06:00:00Z'),
      'en',
      'America/New_York'
    )
  ).toBe('Nov 1, 2026');
});

it('reuses equivalent options regardless of property order', () => {
  const constructors = jest.spyOn(Intl, 'DateTimeFormat');
  expect(
    getDateFormatter('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(0)
  ).toBe('January 1970');
  expect(
    getDateFormatter('en-GB', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long'
    }).format(0)
  ).toBe('January 1970');
  expect(constructors).toHaveBeenCalledTimes(1);
});

it('does not retain implicit device timezone formatters', () => {
  const constructors = jest.spyOn(Intl, 'DateTimeFormat');
  const first = getDateFormatter('en-US', { year: 'numeric' });
  const second = getDateFormatter('en-US', { year: 'numeric' });
  expect(first.format(Date.UTC(2026, 5, 15, 12))).toBe('2026');
  expect(second.format(Date.UTC(2026, 5, 15, 12))).toBe('2026');
  expect(constructors).toHaveBeenCalledTimes(2);
});

it('evicts old configurations while retaining recently created formatters', () => {
  const first = getNumberFormatter('en-US-x-old');
  for (let index = 0; index < 100; index += 1) {
    expect(getNumberFormatter(`en-US-x-${index}`).format(1234)).toBe('1,234');
    expect(
      getDateFormatter(`en-US-x-${index}`, {
        year: 'numeric',
        timeZone: 'UTC'
      }).format(0)
    ).toBe('1970');
  }
  const constructors = jest.spyOn(Intl, 'NumberFormat');
  expect(getNumberFormatter('en-US-x-99').format(5)).toBe('5');
  expect(constructors).not.toHaveBeenCalled();
  expect(getNumberFormatter('en-US-x-old').format(1)).toBe(first.format(1));
  expect(constructors).toHaveBeenCalledTimes(1);
  const dates = jest.spyOn(Intl, 'DateTimeFormat');
  expect(
    getDateFormatter('en-US-x-0', { year: 'numeric', timeZone: 'UTC' }).format(
      0
    )
  ).toBe('1970');
  expect(dates).toHaveBeenCalledTimes(1);
});
