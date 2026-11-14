import {
  formatAmount,
  formatDate,
  formatMinorAmount
} from './format-financial-value';
import { formatTransactionTimestamp } from '@/features/transactions/transaction-presentation';

afterEach(() => jest.restoreAllMocks());

it('formats a transaction list without reconstructing the same date formatters per row', () => {
  const constructors = jest.spyOn(Intl, 'DateTimeFormat');
  const now = Date.parse('2026-10-18T00:30:00Z');
  for (let row = 0; row < 20; row += 1) {
    expect(formatTransactionTimestamp(now, now, 'en', 'Asia/Riyadh')).toMatch(
      /^Today, .*03:30/
    );
    expect(formatDate(now, 'en', 'Asia/Riyadh')).toBe('Oct 18, 2026');
  }
  expect(constructors.mock.calls.length).toBeLessThanOrEqual(3);
});

it('formats exact money for repeated rows without rebuilding number formatters', () => {
  const constructors = jest.spyOn(Intl, 'NumberFormat');
  for (let row = 0; row < 20; row += 1) {
    expect(formatMinorAmount(Number.MAX_SAFE_INTEGER, 'OMR', 'en')).toBe(
      '9,007,199,254,740.991\u00a0OMR'
    );
    expect(formatMinorAmount(-1, 'SAR', 'en')).toBe('-0.01\u00a0SAR');
    expect(formatAmount(12, 'JPY', 'en')).toBe('12\u00a0JPY');
  }
  expect(constructors.mock.calls.length).toBeLessThanOrEqual(2);
});
