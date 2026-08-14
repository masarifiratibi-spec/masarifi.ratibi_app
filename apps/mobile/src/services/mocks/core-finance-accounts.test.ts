import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './core-finance-service';

function service() {
  return createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 8)
    })
  );
}

it('creates one default account and supports archive and restore', async () => {
  const sut = service();
  const created = await sut.createAccount({
    name: 'Reserve',
    type: 'savings',
    currencyCode: 'SAR',
    openingBalanceMinor: 5000,
    isDefault: true
  });
  expect(
    (await sut.listAccounts())
      .filter((item) => item.isDefault)
      .map((item) => item.id)
  ).toEqual([created.value.id]);
  await sut.archiveAccount(created.value.id);
  expect(
    (await sut.listAccounts()).some((item) => item.id === created.value.id)
  ).toBe(false);
  await sut.restoreAccount(created.value.id);
  expect(
    (await sut.listAccounts()).some((item) => item.id === created.value.id)
  ).toBe(true);
});

it('locks currency after posted activity', async () => {
  const sut = service();
  const account = await sut.getAccount('account-bank');
  await expect(
    sut.updateAccount(account.id, { ...account, currencyCode: 'USD' })
  ).rejects.toThrow('validation');
});
