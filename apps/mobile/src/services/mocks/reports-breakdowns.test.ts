import { createMockReportsService } from './reports-service';

test('getBreakdown returns inspectable category membership', async () => {
  const service = createMockReportsService();
  const breakdown = await service.getBreakdown({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    currencyCode: 'SAR',
    timeZone: 'Asia/Riyadh',
    dimension: 'category'
  });

  expect(breakdown.items[0].transactionIds.length).toBeGreaterThan(0);
});
