import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';
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

test('reports use every page of the shared ledger instead of report fixtures', async () => {
  const finance = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: Array.from({ length: 501 }, (_, index) =>
        makeTransaction(index + 1, {
          amountMinor: 1,
          categoryId: 'food',
          occurredAt: Date.UTC(2026, 7, 8),
          reviewStatus: 'none',
          type: 'expense'
        })
      )
    })
  );
  const service = createMockReportsService(undefined, {}, finance);

  const report = await service.getReport({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    currencyCode: 'SAR',
    timeZone: 'Asia/Riyadh'
  });

  expect(report.summary.expense.value?.minorUnits).toBe(501);
});

test('2026-08-23 report account scope includes only the selected account', async () => {
  const finance = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts.slice(0, 2),
      categories: fixtureCategories,
      transactions: [
        makeTransaction(1, {
          accountId: 'account-bank',
          amountMinor: 100,
          occurredAt: Date.UTC(2026, 7, 8),
          reviewStatus: 'none',
          type: 'expense'
        }),
        makeTransaction(2, {
          accountId: 'account-wallet',
          amountMinor: 200,
          occurredAt: Date.UTC(2026, 7, 8),
          reviewStatus: 'none',
          type: 'expense'
        })
      ]
    })
  );
  const service = createMockReportsService(undefined, {}, finance);

  const report = await service.getReport({
    kind: 'monthly',
    anchorDate: '2026-08-09',
    currencyCode: 'SAR',
    timeZone: 'Asia/Riyadh',
    accountIds: ['account-bank']
  });

  expect(report.summary.expense.value?.minorUnits).toBe(100);
});
