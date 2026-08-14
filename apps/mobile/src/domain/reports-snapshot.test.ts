import { buildFinancialReport, buildSnapshot, resolveReportPeriod } from './reports';
import { completeReportFixture, reportFixtureCategories } from '@/test-utils/report-fixtures';

test('detailed snapshots expose only the approved row fields', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: completeReportFixture
  });
  const snapshot = buildSnapshot({
    report,
    detailLevel: 'detailed',
    language: 'en',
    transactions: completeReportFixture,
    categoryLabel: () => 'Food'
  });

  expect(Object.keys(snapshot.detailedRows[0]).sort()).toEqual([
    'amount',
    'categoryLabel',
    'date',
    'maskedAccountLabel',
    'merchantLabel',
    'transactionType'
  ]);
});

test('detailed snapshots exclude eligible transactions outside the report period', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9, 12)
  });
  const inside = completeReportFixture[0];
  const outside = { ...inside, id: 'outside-period', occurredAt: Date.UTC(2026, 6, 20) };
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: [inside, outside]
  });
  const snapshot = buildSnapshot({
    report,
    detailLevel: 'detailed',
    language: 'en',
    transactions: [inside, outside],
    categoryLabel: () => 'Food'
  });

  expect(snapshot.detailedRows).toHaveLength(1);
  expect(snapshot.detailedRows[0].date).toBe('2026-08-08');
});
