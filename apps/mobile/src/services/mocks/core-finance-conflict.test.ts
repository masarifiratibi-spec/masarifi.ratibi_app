import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeConflict
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

function service() {
  const repository = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions.slice(0, 3),
    conflicts: [makeConflict(fixtureTransactions[0])]
  });
  return createMockCoreFinanceService(repository);
}

it('preserves both snapshots until an explicit conflict choice is made', async () => {
  const sut = service();
  const conflict = await sut.getConflict('conflict-transaction-0');
  expect(conflict.resolution).toBeNull();
  expect(conflict.localSnapshot.title).not.toBe(conflict.laterSnapshot.title);
  const resolved = await sut.resolveConflict(conflict.id, 'keep_later');
  expect(resolved.value.title).toBe('Later title');
  expect(resolved.value.syncStatus).toBe('pending');
});
