import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { summarizeHomeBalances } from './home-balance';

const accounts = [
  {
    ...fixtureAccounts[0],
    id: 'cash',
    currencyCode: 'SAR',
    status: 'active' as const
  },
  {
    ...fixtureAccounts[0],
    id: 'card',
    currencyCode: 'SAR',
    type: 'credit_card' as const,
    status: 'active' as const
  },
  {
    ...fixtureAccounts[0],
    id: 'foreign',
    currencyCode: 'USD',
    status: 'active' as const
  },
  {
    ...fixtureAccounts[0],
    id: 'archived',
    currencyCode: 'SAR',
    status: 'archived' as const
  }
];
const balances = [
  { accountId: 'cash', currencyCode: 'SAR', balanceMinor: 10000, asOf: 1 },
  { accountId: 'card', currencyCode: 'SAR', balanceMinor: -3000, asOf: 1 },
  { accountId: 'foreign', currencyCode: 'USD', balanceMinor: 200, asOf: 1 },
  { accountId: 'archived', currencyCode: 'SAR', balanceMinor: 1000000, asOf: 1 }
];

it('preserves signed balances and excludes archived and unconverted foreign balances', () => {
  expect(summarizeHomeBalances(accounts, balances, 'SAR', null)).toMatchObject({
    totalBalanceMinor: 7000,
    activeAccountCount: 3,
    isEstimated: true,
    excludedAccountIds: ['foreign'],
    dataState: 'partial'
  });
});

it('scopes the signed card balance without including other accounts', () => {
  const value = summarizeHomeBalances(accounts, balances, 'SAR', 'card');
  expect(value).toMatchObject({
    totalBalanceMinor: -3000,
    activeAccountCount: 1,
    isEstimated: false,
    components: [
      {
        accountId: 'card',
        originalMinor: -3000,
        convertedMinor: -3000,
        rate: 1
      }
    ]
  });
});

it('marks unreconciled balances as estimated', () => {
  expect(
    summarizeHomeBalances(
      accounts,
      balances.map((balance) => ({ ...balance, asOf: null })),
      'SAR',
      'cash'
    ).isEstimated
  ).toBe(true);
});

it.each([
  { values: [] },
  { values: [{ ...balances[0], currencyCode: 'USD' }] }
])(
  'rejects incomplete or mismatched balances instead of inventing zero',
  ({ values }) => {
    expect(() =>
      summarizeHomeBalances(accounts, values, 'SAR', 'cash')
    ).toThrow('Account balance unavailable');
  }
);

it('rejects totals outside the supported integer range', () => {
  expect(() =>
    summarizeHomeBalances(
      accounts,
      [
        { ...balances[0], balanceMinor: Number.MAX_SAFE_INTEGER },
        { ...balances[1], balanceMinor: 1 },
        balances[2]
      ],
      'SAR',
      null
    )
  ).toThrow('outside supported range');
});

it('allows a genuinely empty account list without financial history reads', () => {
  expect(summarizeHomeBalances([], [], 'SAR', null)).toMatchObject({
    totalBalanceMinor: 0,
    activeAccountCount: 0,
    dataState: 'empty'
  });
});
