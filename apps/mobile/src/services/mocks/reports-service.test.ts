import { createMockReportsService } from './reports-service';

test('getReport returns deterministic report summaries', async () => {
  const service = createMockReportsService();
  const report = await service.getReport({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    currencyCode: 'SAR',
    timeZone: 'Asia/Riyadh'
  });

  expect(report.key).toContain('monthly');
  expect(report.summary.expense.value?.minorUnits).toBeGreaterThan(0);
});
