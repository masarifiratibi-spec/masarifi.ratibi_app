import {
  formatAmount,
  formatMinorAmount,
  formatDate,
  formatEstimatedAggregateLabel,
  formatFinancialDisplayValue
} from './format-financial-value';
import type { Locale } from '@/domain/foundation';

describe('formatAmount', () => {
  it('formats three-decimal minor units without a scale-two conversion', () => {
    expect(formatMinorAmount(12_345, 'OMR', 'en')).toBe('12.345\u00a0OMR');
  });

  it.each([
    [12, 'JPY', '12\u00a0JPY'],
    [12.34, 'SAR', '12.34\u00a0SAR'],
    [12.345, 'OMR', '12.345\u00a0OMR']
  ])('uses %s-owned precision for %s', (value, currencyCode, expected) => {
    expect(formatAmount(value, currencyCode, 'en')).toBe(expected);
  });

  it.each([
    ['SAR', '90,071,992,547,409.91\u00a0SAR'],
    ['OMR', '9,007,199,254,740.991\u00a0OMR']
  ])('formats every safe minor unit exactly for %s', (currencyCode, expected) => {
    expect(formatMinorAmount(Number.MAX_SAFE_INTEGER, currencyCode, 'en')).toBe(
      expected
    );
  });

  it.each([
    [1234.5, 'SAR', 'en', '1,234.50'],
    [1234.5, 'SAR', 'ar', '1,234.50'],
    [0, 'SAR', 'en', '0.00'],
    [-500, 'SAR', 'en', '-500.00'],
    [1000000, 'SAR', 'en', '1,000,000.00']
  ])(
    'renders %d %s in %s with English (Latin) numerals as "%s"',
    (value, currency, locale, expected) => {
      expect(formatAmount(value, currency, locale as Locale)).toContain(
        expected
      );
    }
  );

  it('always uses Latin numerals regardless of locale', () => {
    const arabicResult = formatAmount(1234.5, 'SAR', 'ar');
    const englishResult = formatAmount(1234.5, 'SAR', 'en');
    expect(arabicResult).toBe(englishResult);
  });

  it('keeps a supported large amount and currency on one unbreakable run', () => {
    expect(formatAmount(999_999_999.99, 'SAR', 'en')).toBe(
      '999,999,999.99\u00a0SAR'
    );
  });
});

describe('formatFinancialDisplayValue', () => {
  it.each([
    ['SAR', '\u2066+90,071,992,547,409.91\u00a0SAR\u2069'],
    ['OMR', '\u2066+9,007,199,254,740.991\u00a0OMR\u2069']
  ])(
    'preserves every safe minor unit in the %s display path',
    (currencyCode, expected) => {
      expect(
        formatFinancialDisplayValue({
          minorUnits: Number.MAX_SAFE_INTEGER,
          currencyCode,
          locale: 'en',
          sign: 'positive',
          state: 'confirmed'
        }).text
      ).toBe(expected);
    }
  );

  it('keeps sign independent from financial tone and isolates the visible run', () => {
    expect(
      formatFinancialDisplayValue({
        value: 1250,
        currencyCode: 'EGP',
        locale: 'ar',
        sign: 'negative',
        state: 'confirmed'
      }).text
    ).toBe('\u2066-1,250.00\u00a0EGP\u2069');
  });

  it('distinguishes zero, hidden, unknown, and absent without implying zero', () => {
    expect(
      formatFinancialDisplayValue({
        value: 0,
        currencyCode: 'SAR',
        locale: 'en',
        sign: 'none',
        state: 'confirmed'
      }).text
    ).toContain('0.00\u00a0SAR');
    expect(
      formatFinancialDisplayValue({
        currencyCode: 'SAR',
        locale: 'en',
        sign: 'none',
        state: 'hidden'
      }).accessibilityLabel
    ).toBe('Value hidden');
    expect(
      formatFinancialDisplayValue({
        currencyCode: 'SAR',
        locale: 'en',
        sign: 'none',
        state: 'unknown'
      }).text
    ).toBe('\u2066— SAR\u2069');
    expect(
      formatFinancialDisplayValue({
        currencyCode: 'SAR',
        locale: 'en',
        sign: 'none',
        state: 'absent'
      }).text
    ).toBe('\u2066Not available\u2069');
  });
});

describe('formatDate', () => {
  const timestamp = new Date('2026-03-15T10:00:00Z').getTime();

  it('produces a locale-appropriate date string with Latin numerals', () => {
    const formatted = formatDate(timestamp, 'en');
    // Latin numerals present; year appears.
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/[0-9]/);
  });

  it('uses Latin numerals in Arabic too', () => {
    const formatted = formatDate(timestamp, 'ar');
    expect(formatted).toMatch(/2026/);
  });

  it('uses Arabic month text while preserving Latin numerals', () => {
    const arabic = formatDate(timestamp, 'ar');
    const english = formatDate(timestamp, 'en');

    expect(arabic).not.toBe(english);
    expect(arabic).not.toMatch(/[٠-٩]/);
  });
});

describe('formatEstimatedAggregateLabel', () => {
  it('marks converted aggregate as estimated when conversion applied', () => {
    const label = formatEstimatedAggregateLabel(100, 'USD', 'SAR', true);
    expect(label.isEstimated).toBe(true);
  });

  it('does not mark as estimated when no conversion', () => {
    const label = formatEstimatedAggregateLabel(100, 'SAR', 'SAR', false);
    expect(label.isEstimated).toBe(false);
  });
});
