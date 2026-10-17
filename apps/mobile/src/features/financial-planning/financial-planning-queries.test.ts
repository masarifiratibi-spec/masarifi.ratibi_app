import { QueryClient } from '@tanstack/react-query';
import { financialPlanningKeys, invalidatePlanningScopes } from './financial-planning-queries';

it('invalidates receipt review after linking or undoing a salary receipt', async () => {
  const client = new QueryClient();
  const key = financialPlanningKeys.salaryReview('income-id');
  client.setQueryData(key, { status: 'linked' });
  await invalidatePlanningScopes(client, ['planning.salary.overview']);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});

it('refreshes the cached account balance and original transaction after payment Undo', async () => {
  const client = new QueryClient();
  const balanceKey = ['core-finance', 'account-balances', false];
  const transactionKey = ['core-finance', 'transaction', 'original-expense'];
  client.setQueryData(balanceKey, { balanceMinor: 163600 });
  client.setQueryData(transactionKey, { status: 'confirmed' });
  try {
    await invalidatePlanningScopes(client, [
      'accounts.balances',
      'transactions.detail.original-expense'
    ]);
    expect(client.getQueryState(balanceKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(transactionKey)?.isInvalidated).toBe(true);
  } finally {
    client.clear();
  }
});
