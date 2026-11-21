import {
  deriveAccountBalances,
  type Account,
  type Transaction
} from '@/domain/core-finance';

export interface NetWorthTrendPoint {
  at: number;
  minorUnits: number;
}

export function buildNetWorthTrend(input: {
  accounts: readonly Account[];
  accountIds: readonly string[];
  currencyCode: string;
  pointInstants: readonly number[];
  ratesByAccount: ReadonlyMap<string, number>;
  transactions: readonly Transaction[];
}): NetWorthTrendPoint[] {
  const selectedAccounts = input.accounts.filter(
    (account) =>
      account.status === 'active' &&
      (!input.accountIds.length || input.accountIds.includes(account.id)) &&
      (account.currencyCode === input.currencyCode ||
        input.ratesByAccount.has(account.id))
  );

  return input.pointInstants.map((at) => {
    // Select the historical snapshot once per point, shared by every account.
    const transactionsThroughPoint = input.transactions.filter(
      (transaction) => transaction.occurredAt <= at
    );
    const balances = deriveAccountBalances(
      selectedAccounts,
      transactionsThroughPoint
    );
    return {
      at,
      minorUnits: Math.round(
        selectedAccounts.reduce((total, account) => {
          const rate =
            account.currencyCode === input.currencyCode
              ? 1
              : input.ratesByAccount.get(account.id);
          if (rate === undefined) return total;
          return total + balances.get(account.id)! * rate;
        }, 0)
      )
    };
  });
}
