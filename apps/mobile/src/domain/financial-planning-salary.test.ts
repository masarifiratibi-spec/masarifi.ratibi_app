import {
  deriveSalaryCycle,
  expectedDateForMonth,
  localDateFromTimestamp,
  type SalaryProfile,
  type SalaryReceiptLink
} from './financial-planning';
import type { Transaction } from './core-finance';
import {
  fixtureSalaryProfile,
  fixtureSalaryReceipt,
  fixtureSalaryTransaction,
  planningToday
} from '@/test-utils/financial-planning-fixtures';

function createMockTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    ...fixtureSalaryTransaction,
    id: `tx-${Math.random().toString(36).slice(2, 9)}`,
    ...overrides
  };
}

describe('Salary Cycle domain calculations', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: Date.UTC(2026, 0, 15, 12, 0, 0) });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Salary Receipt States', () => {
    it('detects salary received on time when receivedDate matches expectedOccurrenceDate', () => {
      const receipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        receivedDate: '2026-01-31',
        expectedOccurrenceDate: '2026-01-31'
      };
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [receipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-01-31'
      });
      expect(cycle.salaryState).toBe('on_time');
    });

    it('detects salary received early when receivedDate is before expectedOccurrenceDate', () => {
      const receipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        receivedDate: '2026-01-25',
        expectedOccurrenceDate: '2026-01-31'
      };
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [receipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-01-26'
      });
      expect(cycle.salaryState).toBe('early');
    });

    it('detects salary received late when receivedDate is after expectedOccurrenceDate', () => {
      const receipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        receivedDate: '2026-02-02',
        expectedOccurrenceDate: '2026-01-31'
      };
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [receipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-02-03'
      });
      expect(cycle.salaryState).toBe('late');
    });

    it('returns empty and late state when profile exists but has no receipts', () => {
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [],
        transactions: [],
        today: planningToday
      });
      expect(cycle.dataState).toBe('empty');
      expect(cycle.salaryState).toBe('late');
      expect(cycle.profileId).toBe(fixtureSalaryProfile.id);
      expect(cycle.projectedNextSalaryDate).toBe(
        fixtureSalaryProfile.nextExpectedDate
      );
      expect(cycle.income.status).toBe('unavailable');
    });

    it('returns unconfigured state when profile is null or archived', () => {
      const cycleNull = deriveSalaryCycle({
        profile: null,
        receipts: [],
        transactions: [],
        today: planningToday
      });
      expect(cycleNull.salaryState).toBe('unconfigured');
      expect(cycleNull.dataState).toBe('empty');

      const archivedProfile: SalaryProfile = {
        ...fixtureSalaryProfile,
        status: 'archived'
      };
      const cycleArchived = deriveSalaryCycle({
        profile: archivedProfile,
        receipts: [fixtureSalaryReceipt],
        transactions: [fixtureSalaryTransaction],
        today: planningToday
      });
      expect(cycleArchived.salaryState).toBe('unconfigured');
      expect(cycleArchived.dataState).toBe('empty');
    });
  });

  describe('Cycle Date Boundaries & Transitions', () => {
    it('projects next date in the same month if salary day has not passed', () => {
      const receipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        receivedDate: '2026-01-10'
      };
      const profile: SalaryProfile = {
        ...fixtureSalaryProfile,
        salaryDay: 25
      };
      const cycle = deriveSalaryCycle({
        profile,
        receipts: [receipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-01-12'
      });
      expect(cycle.projectedNextSalaryDate).toBe('2026-01-25');
      expect(cycle.daysRemaining).toBe(13);
    });

    it('handles year transition across December to January', () => {
      const receipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        receivedDate: '2025-12-25',
        expectedOccurrenceDate: '2025-12-25'
      };
      const profile: SalaryProfile = {
        ...fixtureSalaryProfile,
        salaryDay: 1
      };
      const cycle = deriveSalaryCycle({
        profile,
        receipts: [receipt],
        transactions: [fixtureSalaryTransaction],
        today: '2025-12-26'
      });
      expect(cycle.projectedNextSalaryDate).toBe('2026-01-01');
      expect(cycle.daysRemaining).toBe(6);
    });

    it('correctly clamps salary day 31 across various month lengths', () => {
      // 31 day month: January
      expect(expectedDateForMonth(2026, 1, 31)).toBe('2026-01-31');
      // 30 day month: April
      expect(expectedDateForMonth(2026, 4, 31)).toBe('2026-04-30');
      // 28 day month: Feb 2025 (non-leap)
      expect(expectedDateForMonth(2025, 2, 31)).toBe('2025-02-28');
      // 29 day month: Feb 2024 (leap year)
      expect(expectedDateForMonth(2024, 2, 31)).toBe('2024-02-29');
    });

    it('ignores undone receipts and picks latest linked receipt', () => {
      const olderReceipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        id: 'receipt-older',
        receivedDate: '2025-12-01',
        status: 'linked'
      };
      const latestReceipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        id: 'receipt-latest',
        receivedDate: '2026-01-01',
        status: 'linked'
      };
      const undoneReceipt: SalaryReceiptLink = {
        ...fixtureSalaryReceipt,
        id: 'receipt-undone',
        receivedDate: '2026-01-15',
        status: 'undone'
      };

      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [olderReceipt, undoneReceipt, latestReceipt],
        transactions: [fixtureSalaryTransaction],
        today: planningToday
      });

      expect(cycle.startReceiptId).toBe('receipt-latest');
      expect(cycle.startDate).toBe('2026-01-01');
      // With >1 linked receipts, comparison is available
      expect(cycle.previousCycleComparison.status).toBe('available');
    });
  });

  describe('Financial Totals & Calculations', () => {
    it('aggregates income and expenses accurately within cycle boundaries', () => {
      const expenses = [
        createMockTransaction({
          type: 'expense',
          amountMinor: 2_000_00,
          occurredAt: Date.UTC(2026, 0, 5)
        }),
        createMockTransaction({
          type: 'obligation_payment',
          amountMinor: 1_000_00,
          occurredAt: Date.UTC(2026, 0, 10)
        }),
        // Out of cycle (before start)
        createMockTransaction({
          type: 'expense',
          amountMinor: 500_00,
          occurredAt: Date.UTC(2025, 11, 20)
        }),
        // Out of cycle (after nextDate)
        createMockTransaction({
          type: 'expense',
          amountMinor: 900_00,
          occurredAt: Date.UTC(2026, 1, 5)
        })
      ];

      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [fixtureSalaryReceipt],
        transactions: [fixtureSalaryTransaction, ...expenses],
        obligationsReservedMinor: 1_500_00,
        today: planningToday
      });

      expect(cycle.income).toEqual({
        status: 'available',
        value: { minorUnits: 12_000_00, currencyCode: 'SAR', scale: 2 },
        estimated: false,
        asOf: null
      });
      expect(cycle.expenses).toEqual({
        status: 'available',
        value: { minorUnits: 3_000_00, currencyCode: 'SAR', scale: 2 },
        estimated: false,
        asOf: null
      });
      expect(cycle.reservedObligations).toEqual({
        status: 'available',
        value: { minorUnits: 1_500_00, currencyCode: 'SAR', scale: 2 },
        estimated: false,
        asOf: null
      });
      // 12000 - 3000 - 1500 = 7500
      expect(cycle.remaining).toEqual({
        status: 'available',
        value: { minorUnits: 7_500_00, currencyCode: 'SAR', scale: 2 },
        estimated: false,
        asOf: null
      });
    });

    it('calculates suggested daily amount when remaining is positive and days remain', () => {
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [fixtureSalaryReceipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-01-15'
      });
      // 16 days remaining (Jan 15 to Jan 31), 12000 SAR remaining => 1200000 / 16 = 75000 minor
      expect(cycle.daysRemaining).toBe(16);
      expect(cycle.suggestedDaily).toEqual({
        status: 'available',
        value: { minorUnits: 750_00, currencyCode: 'SAR', scale: 2 },
        estimated: false,
        asOf: null
      });
    });

    it('returns balance_negative reason when remaining is less than 0', () => {
      const heavyExpense = createMockTransaction({
        type: 'expense',
        amountMinor: 15_000_00,
        occurredAt: Date.UTC(2026, 0, 5)
      });
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [fixtureSalaryReceipt],
        transactions: [fixtureSalaryTransaction, heavyExpense],
        today: '2026-01-15'
      });
      expect(cycle.remaining).toMatchObject({
        status: 'available',
        value: { minorUnits: -3_000_00 }
      });
      expect(cycle.suggestedDaily).toEqual({
        status: 'unavailable',
        reason: 'balance_negative'
      });
    });

    it('returns cycle_elapsed reason when today is at or past projected next salary date', () => {
      const cycle = deriveSalaryCycle({
        profile: fixtureSalaryProfile,
        receipts: [fixtureSalaryReceipt],
        transactions: [fixtureSalaryTransaction],
        today: '2026-01-31'
      });
      expect(cycle.daysRemaining).toBe(0);
      expect(cycle.suggestedDaily).toEqual({
        status: 'unavailable',
        reason: 'cycle_elapsed'
      });
    });
  });

  describe('localDateFromTimestamp timezone', () => {
    it('returns correct year-month-day string', () => {
      const ts = new Date(2026, 0, 15, 12, 0, 0).getTime();
      expect(localDateFromTimestamp(ts)).toBe('2026-01-15');
    });
  });

  it('uses the configured timezone for salary-cycle membership', () => {
    const receipt = {
      ...fixtureSalaryReceipt,
      receivedDate: '2026-01-05' as const,
      expectedOccurrenceDate: '2026-01-05' as const
    };
    const outside = {
      ...fixtureSalaryTransaction,
      id: 'outside-local-cycle',
      type: 'expense' as const,
      amountMinor: 100,
      occurredAt: Date.parse('2026-01-05T04:30:00.000Z')
    };
    const inside = {
      ...outside,
      id: 'inside-local-cycle',
      amountMinor: 200,
      occurredAt: Date.parse('2026-01-05T05:30:00.000Z')
    };

    const cycle = deriveSalaryCycle({
      profile: fixtureSalaryProfile,
      receipts: [receipt],
      transactions: [outside, inside],
      today: '2026-01-15',
      timeZone: 'America/New_York'
    });

    expect(cycle.expenses).toMatchObject({
      status: 'available',
      value: { minorUnits: 200 }
    });
  });
});
