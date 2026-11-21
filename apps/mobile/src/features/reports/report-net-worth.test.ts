import {
  fixtureAccounts,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { buildNetWorthTrend } from './report-net-worth';
import { deriveAccountBalance } from '@/domain/core-finance';

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

test('signed card liability reduces net worth and payoff reduces both account balances equally', () => {
  const at = Date.UTC(2026, 7, 9, 12);
  const bank = {
    ...fixtureAccounts[0],
    id: 'bank',
    currencyCode: 'SAR',
    openingBalanceMinor: 100_000
  };
  const card = {
    ...fixtureAccounts[0],
    id: 'card',
    type: 'credit_card' as const,
    currencyCode: 'SAR',
    openingBalanceMinor: -32_000
  };
  const payoff = makeTransaction(20, {
    type: 'transfer',
    transferPurpose: 'card_payoff',
    accountId: bank.id,
    destinationAccountId: card.id,
    categoryId: null,
    amountMinor: 20_000,
    occurredAt: at
  });

  expect(
    buildNetWorthTrend({
      accounts: [bank, card],
      accountIds: [],
      currencyCode: 'SAR',
      pointInstants: [at],
      ratesByAccount: new Map(),
      transactions: [payoff]
    })
  ).toEqual([{ at, minorUnits: 68_000 }]);
});

test('positive credit-card value remains an asset instead of being inferred as debt', () => {
  const at = Date.UTC(2026, 7, 9, 12);
  const card = {
    ...fixtureAccounts[0],
    id: 'card-credit',
    type: 'credit_card' as const,
    currencyCode: 'SAR',
    openingBalanceMinor: 5_000
  };

  expect(
    buildNetWorthTrend({
      accounts: [card],
      accountIds: [],
      currencyCode: 'SAR',
      pointInstants: [at],
      ratesByAccount: new Map(),
      transactions: []
    })
  ).toEqual([{ at, minorUnits: 5_000 }]);
});

test('net worth keeps linked refund and reversal effects, account scope and exchange rates at each historical point', () => {
  const accounts = ['bank', 'card', 'wallet'].map((id, index) => ({
    ...fixtureAccounts[0],
    id,
    currencyCode: index === 2 ? 'USD' : 'SAR',
    openingBalanceMinor: index === 1 ? -2_000 : 10_000
  }));
  const expense = makeTransaction(100, {
    id: 'expense',
    accountId: 'bank',
    amountMinor: 1_000,
    occurredAt: 10,
    type: 'expense'
  });
  const transfer = makeTransaction(101, {
    id: 'transfer',
    accountId: 'bank',
    destinationAccountId: 'card',
    amountMinor: 500,
    feeMinor: 20,
    occurredAt: 20,
    type: 'transfer'
  });
  const transactions = [
    expense,
    transfer,
    makeTransaction(102, {
      id: 'refund',
      accountId: 'bank',
      originalTransactionId: expense.id,
      amountMinor: 200,
      occurredAt: 30,
      type: 'refund'
    }),
    makeTransaction(103, {
      id: 'reverse',
      accountId: 'bank',
      originalTransactionId: transfer.id,
      amountMinor: 500,
      occurredAt: 40,
      type: 'reversal'
    }),
    makeTransaction(104, {
      id: 'duplicate-reverse',
      accountId: 'bank',
      originalTransactionId: transfer.id,
      amountMinor: 500,
      occurredAt: 50,
      type: 'reversal'
    }),
    makeTransaction(105, {
      accountId: 'wallet',
      currencyCode: 'USD',
      amountMinor: 100,
      occurredAt: 60,
      type: 'income'
    }),
    makeTransaction(106, {
      accountId: 'bank',
      amountMinor: 300,
      occurredAt: 70,
      type: 'income',
      status: 'pending'
    })
  ];
  const pointInstants = [80, 0, 25, 35, 45, 65, 45];
  for (const accountIds of [[], ['card', 'wallet']]) {
    const trend = buildNetWorthTrend({
      accounts,
      accountIds,
      currencyCode: 'SAR',
      pointInstants,
      ratesByAccount: new Map([['wallet', 3.75]]),
      transactions
    });
    expect(trend).toEqual(
      pointInstants.map((at) => ({
        at,
        minorUnits: Math.round(
          accounts
            .filter((a) => !accountIds.length || accountIds.includes(a.id))
            .reduce(
              (total, account) =>
                total +
                deriveAccountBalance(
                  account,
                  transactions.filter((t) => t.occurredAt <= at)
                ) *
                  (account.currencyCode === 'SAR' ? 1 : 3.75),
              0
            )
        )
      }))
    );
  }
});

test('10,000 transactions across 50 accounts build a ten-point trend within the CPU budget', () => {
  const accounts = Array.from({ length: 50 }, (_, index) => ({
    ...fixtureAccounts[0],
    id: `large-${index}`,
    currencyCode: 'SAR',
    openingBalanceMinor: 1_000_000
  }));
  const transactions = Array.from({ length: 10_000 }, (_, index) =>
    makeTransaction(index, {
      accountId: accounts[index % accounts.length].id,
      type: 'expense',
      amountMinor: 1,
      occurredAt: index,
      reviewStatus: 'none',
      syncStatus: 'synced'
    })
  );
  const started = performance.now();
  const trend = buildNetWorthTrend({
    accounts,
    accountIds: [],
    currencyCode: 'SAR',
    pointInstants: Array.from(
      { length: 10 },
      (_, index) => (index + 1) * 1_000
    ),
    ratesByAccount: new Map(),
    transactions
  });
  const elapsed = performance.now() - started;
  expect(trend.at(-1)).toEqual({ at: 10_000, minorUnits: 49_990_000 });
  expect(elapsed).toBeLessThan(1_000);
});

test('an excluded currency cannot overflow a trend without an available conversion rate', () => {
  const account = {
    ...fixtureAccounts[0],
    currencyCode: 'USD',
    openingBalanceMinor: Number.MAX_SAFE_INTEGER
  };
  expect(
    buildNetWorthTrend({
      accounts: [account],
      accountIds: [],
      currencyCode: 'SAR',
      pointInstants: [1],
      ratesByAccount: new Map(),
      transactions: [
        makeTransaction(1, {
          accountId: account.id,
          type: 'income',
          amountMinor: 1,
          occurredAt: 1
        })
      ]
    })
  ).toEqual([{ at: 1, minorUnits: 0 }]);
});
