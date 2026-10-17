import { QueryClient } from '@tanstack/react-query';
import { invalidatePlanningScopes } from './financial-planning-queries';

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
