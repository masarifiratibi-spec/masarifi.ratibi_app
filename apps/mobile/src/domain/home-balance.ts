import { safeMinorSum, type Account, type AccountBalanceProjection, type HomeSummary } from './core-finance';

export type HomeBalanceSummary = Pick<
  HomeSummary,
  | 'totalBalanceMinor'
  | 'currencyCode'
  | 'isEstimated'
  | 'components'
  | 'excludedAccountIds'
  | 'activeAccountCount'
  | 'dataState'
> & { recentTransactions?: HomeSummary['recentTransactions'] };

export function summarizeHomeBalances(
  accounts: readonly Account[],
  balances: readonly AccountBalanceProjection[],
  currencyCode: string,
  selectedAccountId: string | null
): HomeBalanceSummary {
  const selected = accounts.filter(
    (account) =>
      account.status === 'active' &&
      (!selectedAccountId || account.id === selectedAccountId)
  );
  const byAccount = new Map(
    balances.map((balance) => [balance.accountId, balance])
  );
  const components: HomeSummary['components'] = [];
  const excludedAccountIds: string[] = [];
  let totalBalanceMinor = 0;
  let isEstimated = false;
  for (const account of selected) {
    const balance = byAccount.get(account.id);
    if (!balance || balance.currencyCode !== account.currencyCode)
      throw new Error('Account balance unavailable');
    if (balance.asOf === null) isEstimated = true;
    if (account.currencyCode !== currencyCode) {
      excludedAccountIds.push(account.id);
      isEstimated = true;
      continue;
    }
    const total = safeMinorSum(totalBalanceMinor, balance.balanceMinor);
    if (total === null)
      throw new Error('Account balance outside supported range');
    totalBalanceMinor = total;
    components.push({
      accountId: account.id,
      originalMinor: balance.balanceMinor,
      currencyCode: account.currencyCode,
      convertedMinor: balance.balanceMinor,
      rate: 1,
      asOf: balance.asOf ?? account.updatedAt
    });
  }
  return {
    totalBalanceMinor,
    currencyCode,
    isEstimated,
    components,
    excludedAccountIds,
    activeAccountCount: selected.length,
    dataState:
      selected.length === 0
        ? 'empty'
        : excludedAccountIds.length
          ? 'partial'
          : 'ready'
  };
}
