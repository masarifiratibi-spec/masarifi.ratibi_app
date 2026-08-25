import {
  fixtureAccounts,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { buildNetWorthTrend } from './report-net-worth';

test('2026-08-23 net worth trend projects real account effects at each point', () => {
  const day1 = Date.UTC(2026, 7, 1, 12);
  const day2 = Date.UTC(2026, 7, 2, 12);
  const day3 = Date.UTC(2026, 7, 3, 12);
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'SAR',
    openingBalanceMinor: 1_000
  };
  const transactions = [
    makeTransaction(1, {
      accountId: account.id,
      amountMinor: 100,
      occurredAt: day2,
      type: 'expense'
    }),
    makeTransaction(2, {
      accountId: account.id,
      amountMinor: 300,
      occurredAt: day3,
      type: 'income'
    })
  ];

  expect(
    buildNetWorthTrend({
      accounts: [account],
      accountIds: [account.id],
      currencyCode: 'SAR',
      pointInstants: [day1, day2, day3],
      ratesByAccount: new Map(),
      transactions
    })
  ).toEqual([
    { at: day1, minorUnits: 1_000 },
    { at: day2, minorUnits: 900 },
    { at: day3, minorUnits: 1_200 }
  ]);
});
