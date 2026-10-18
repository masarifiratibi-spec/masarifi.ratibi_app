import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  financialPlanningKeys,
  invalidatePlanningScopes
} from './financial-planning-queries';

it('invalidates receipt review after linking or undoing a salary receipt', async () => {
  const client = new QueryClient();
  const key = financialPlanningKeys.salaryReview('income-id');
  client.setQueryData(key, { status: 'linked' });
  await invalidatePlanningScopes(client, ['planning.salary.overview']);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  client.clear();
});

it('replaces an initial pre-payment read instead of accepting its late result', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  let release!: (value: number) => void;
  let reads = 0;
  const key = financialPlanningKeys.obligation('o');
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () => {
      reads++;
      return reads === 1
        ? new Promise<number>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(2);
    }
  });
  const unsubscribe = observer.subscribe(() => undefined);
  try {
    await Promise.resolve();
    const invalidation = invalidatePlanningScopes(client, [
      'planning.obligation.o'
    ]);
    release(1);
    await invalidation;
    expect(client.getQueryData(key)).toBe(2);
    expect(reads).toBe(2);
  } finally {
    unsubscribe();
    client.clear();
  }
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
