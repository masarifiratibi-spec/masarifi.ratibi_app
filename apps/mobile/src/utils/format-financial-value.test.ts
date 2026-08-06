import {
  formatAmount,
  formatDate,
  formatEstimatedAggregateLabel
} from './format-financial-value';
import type { Locale } from '@/domain/foundation';

describe('formatAmount', () => {
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
