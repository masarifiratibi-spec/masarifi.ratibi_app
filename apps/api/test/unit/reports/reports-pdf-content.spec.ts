import {
  buildReportPdfSections,
  formatReportMoney,
} from '../../../src/reports/reports.pdf-content';
import { REPORT_TYPES, type ReportSnapshot } from '../../../src/reports/reports.schemas';

const snapshot: ReportSnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-10-20T00:00:00.000Z',
  ledgerVersion: 7,
  reportType: 'financial_summary',
  period: {
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    timezone: 'Asia/Riyadh',
    kind: 'monthly',
  },
  format: 'pdf',
  delivery: 'download',
  currencyCode: 'SAR',
  dataState: 'complete',
  evidence: [],
  summary: {
    currencyMinorUnits: { SAR: 2 },
    summaries: [
      {
        income: { amountMinor: 10000, currency: 'SAR' },
        expense: { amountMinor: 1234, currency: 'SAR' },
        netCashFlow: { amountMinor: 8766, currency: 'SAR' },
        transactionCount: 1,
      },
    ],
    planning: {
      budgets: [{ currency: 'SAR', budgetMinor: 2000, spentMinor: 1234 }],
      obligations: [{ currency: 'SAR', paidMinor: 1000, remainingMinor: 5000, overdueMinor: 0 }],
      savingsGoals: [{ currency: 'SAR', targetMinor: 10000, trackedMinor: 2500 }],
    },
  },
  breakdowns: [
    {
      categoryId: 'internal-category-id',
      labelAr: 'طعام Food',
      expenseMinor: 1234,
      currencyCode: 'SAR',
      transactionCount: 1,
    },
  ],
  detailedRows: [
    {
      occurredAt: '2026-10-19T23:00:00.000Z',
      kind: 'expense',
      amountMinor: 1234,
      currencyCode: 'SAR',
      categoryLabel: 'طعام Food',
    },
  ],
};

describe('customer PDF report content', () => {
  it.each([
    [1234, 0, '1,234 SAR'],
    [1234, 1, '123.4 SAR'],
    [1234, 2, '12.34 SAR'],
    [1234, 3, '1.234 SAR'],
    [1234, 4, '0.1234 SAR'],
    [-1, 2, '-0.01 SAR'],
    [Number.MAX_SAFE_INTEGER, 2, '90,071,992,547,409.91 SAR'],
    [-Number.MAX_SAFE_INTEGER, 3, '-9,007,199,254,740.991 SAR'],
  ])(
    'formats %s minor units with recorded scale %s without losing precision',
    (amount, scale, expected) => {
      expect(formatReportMoney(amount, 'SAR', { SAR: scale })).toBe(expected);
    },
  );

  it('labels legacy minor units explicitly and rejects corrupted recorded scales instead of guessing', () => {
    expect(formatReportMoney(1234, 'KWD')).toBe('1,234 KWD (وحدة صغرى)');
    expect(() => formatReportMoney(1234, 'KWD', { KWD: 5 })).toThrow(
      'REPORT_PDF_CURRENCY_SCALE_INVALID',
    );
    expect(() => formatReportMoney(1.2, 'SAR', { SAR: 2 })).toThrow('REPORT_PDF_AMOUNT_INVALID');
  });

  it.each(REPORT_TYPES)(
    'presents %s with readable labels, exact currency values and no internal category identifiers',
    (reportType) => {
      const sections = buildReportPdfSections({ ...snapshot, reportType });
      const displayed = sections
        .flatMap((section) => [section.title, ...section.columns, ...section.rows.flat()])
        .join('\n');
      expect(displayed).not.toMatch(
        /amountMinor|incomeMinor|currencyMinorUnits|ledgerVersion|internal-category-id|\{"/,
      );
      if (reportType === 'budget_performance') expect(displayed).toContain('20.00 SAR');
      else if (reportType === 'obligation_progress') expect(displayed).toContain('50.00 SAR');
      else if (reportType === 'savings_progress') expect(displayed).toContain('25.00 SAR');
      else expect(displayed).toContain('12.34 SAR');
      if (reportType === 'account_activity') expect(displayed).toContain('20/10/2026');
    },
  );

  it('preserves unrecognized legacy summary data as labeled fields without inventing zero totals', () => {
    const sections = buildReportPdfSections({
      ...snapshot,
      summary: { reviewedCount: 17 },
      breakdowns: [],
      detailedRows: [],
    });
    expect(sections.flatMap((section) => section.rows.flat())).toContain('17');
    expect(sections.flatMap((section) => section.rows.flat())).not.toContain('0.00 SAR');
  });
});
