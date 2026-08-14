import { transactionEffectForAccount } from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

it('applies transfer effects atomically and blocks same-account transfers', async () => {
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 1)
    })
  );
  await expect(
    service.createTransaction({
      type: 'transfer',
      amountMinor: 100,
      currencyCode: 'SAR',
      accountId: 'account-bank',
      destinationAccountId: 'account-bank',
      categoryId: null,
      title: 'Move',
      occurredAt: 1
    })
  ).rejects.toThrow();
  const transfer = (
    await service.createTransaction({
      type: 'transfer',
      amountMinor: 100,
      currencyCode: 'SAR',
      accountId: 'account-bank',
      destinationAccountId: 'account-wallet',
      feeMinor: 5,
      categoryId: null,
      title: 'Move',
      occurredAt: 1
    })
  ).value;
  expect(transactionEffectForAccount(transfer, 'account-bank')).toBe(-105);
  expect(transactionEffectForAccount(transfer, 'account-wallet')).toBe(100);
});

it('keeps refunds linked to the original transaction and distinct from income', async () => {
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 2)
    })
  );
  const refund = await service.createTransaction({
    type: 'refund',
    amountMinor: 50,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food',
    title: 'Refund',
    occurredAt: 2,
    originalTransactionId: 'transaction-1'
  });
  expect(refund.value.originalTransactionId).toBe('transaction-1');
  expect(refund.value.type).toBe('refund');
});
