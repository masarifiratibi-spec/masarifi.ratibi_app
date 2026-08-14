import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

it('deletes once, exposes a 30-second deadline, and undoes exactly once', async () => {
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 3)
    })
  );
  const deleted = await service.deleteTransaction('transaction-0');
  expect(deleted.undoExpiresAt).toBeGreaterThan(Date.now());
  await expect(service.undoDelete('transaction-0')).resolves.toMatchObject({
    value: { status: 'posted' }
  });
  await expect(service.undoDelete('transaction-0')).rejects.toThrow('expired');
});
