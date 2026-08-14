import { buildFinancialReport, resolveReportPeriod } from '@/domain/reports';
import { completeReportFixture, reportFixtureCategories } from '@/test-utils/report-fixtures';

test('breakdown drill-down maps to transaction filters with report return context', () => {
  const period = resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    timeZone: 'Asia/Riyadh',
    now: Date.UTC(2026, 7, 9)
  });
  const report = buildFinancialReport({
    period,
    currencyCode: 'SAR',
    categories: reportFixtureCategories,
    transactions: completeReportFixture
  });
  const drillDown = report.breakdowns[0].items[0].drillDown;

  expect(drillDown.kind).toBe('transactions');
  expect(drillDown.returnContext.period.startDate).toBe('2026-08-01');
  if (drillDown.kind === 'transactions') {
    expect(drillDown.filters.categoryIds).toEqual([report.breakdowns[0].items[0].id]);
  }

  const other = report.breakdowns[0].items.find((item) => item.id === 'other');
  expect(other?.memberIds?.length).toBeGreaterThan(0);
  expect(other?.memberLabels?.length).toBe(other?.memberIds?.length);
  if (other?.drillDown.kind === 'other_categories') {
    expect(other.drillDown.filters.categoryIds).toEqual(other.memberIds);
  }
});
