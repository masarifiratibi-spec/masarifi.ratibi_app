import { emptyTransactionFilters } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

it('creates expense, income, and obligation-payment records idempotently as pending sync', async () => {
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: []
    })
  );
  for (const type of ['expense', 'income', 'obligation_payment'] as const) {
    const result = await service.createTransaction(
      {
        type,
        amountMinor: 100,
        currencyCode: 'SAR',
        accountId: 'account-bank',
        categoryId: type === 'income' ? 'salary' : 'food',
        title: type,
        occurredAt: 1
      },
      `op-${type}`
    );
    expect(result.value.syncStatus).toBe('pending');
    expect((await service.createTransaction(result.value, `op-${type}`)).value.id)
      .toBe(result.value.id);
  }
  expect((await service.listTransactions(emptyTransactionFilters)).total).toBe(3);
});
