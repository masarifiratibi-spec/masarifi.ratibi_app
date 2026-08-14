import { buildFinancialReport, resolveReportPeriod } from '@/domain/reports';
import { reportFixtureCategories, tenThousandReportFixture } from '@/test-utils/report-fixtures';

test('10,000 records aggregate in one report pass', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9)
  });
  const started = Date.now();
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: tenThousandReportFixture
  });

  expect(report.summary.expense.value?.minorUnits).toBeGreaterThan(0);
  expect(Date.now() - started).toBeLessThan(2000);
});

test('optional chart and assistant derivations do not delay stable report summary inputs', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9)
  });
  const started = Date.now();
  const first = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: tenThousandReportFixture
  });
  const second = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: tenThousandReportFixture
  });

  expect(first.key).toBe(second.key);
  expect(second.summary.expense).toEqual(first.summary.expense);
  expect(Date.now() - started).toBeLessThan(2_000);
});
