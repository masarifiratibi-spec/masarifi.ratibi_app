import {
  deriveAccountBalance,
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
      (!input.accountIds.length || input.accountIds.includes(account.id))
  );

  return input.pointInstants.map((at) => ({
    at,
    minorUnits: Math.round(
      selectedAccounts.reduce((total, account) => {
        const rate =
          account.currencyCode === input.currencyCode
            ? 1
            : input.ratesByAccount.get(account.id);
        if (rate === undefined) return total;
        const transactionsThroughPoint = input.transactions.filter(
          (transaction) => transaction.occurredAt <= at
        );
        return (
          total + deriveAccountBalance(account, transactionsThroughPoint) * rate
        );
      }, 0)
    )
  }));
}
