import { emptyTransactionFilters } from '@/domain/core-finance';
import { todayPeriod } from '@/features/filters/date-period';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import {
  fixtureAccounts,
  fixtureCategories,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { createMockCoreFinanceService } from './mocks/core-finance-service';

const now = Date.parse('2026-10-08T20:59:00Z');
const day = todayPeriod(now, { timeZone: 'Asia/Riyadh', monthStartDay: 1 });
const filters = {
  ...emptyTransactionFilters,
  periodStart: day.periodStart,
  periodEnd: day.periodEnd
};

it.each([
  [
    'Asia/Riyadh',
    '2026-10-08T21:30:00Z',
    '2026-10-08T21:00:00Z',
    '2026-10-09T20:59:59.999Z'
  ],
  [
    'America/New_York',
    '2026-03-08T15:00:00Z',
    '2026-03-08T05:00:00Z',
    '2026-03-09T03:59:59.999Z'
  ],
  [
    'America/New_York',
    '2026-11-01T15:00:00Z',
    '2026-11-01T04:00:00Z',
    '2026-11-02T04:59:59.999Z'
  ]
])(
  'uses occurredAt at %s midnight/DST boundaries, independent of delivery time',
  async (timeZone, anchor, start, end) => {
    const period = todayPeriod(Date.parse(anchor), {
      timeZone,
      monthStartDay: 1
    });
    expect(period.periodStart).toBe(Date.parse(start));
    expect(period.periodEnd).toBe(Date.parse(end));
    const transactions = [-1, 0, 1, 2].map((offset, index) =>
      makeTransaction(index + 1, {
        type: 'expense',
        occurredAt:
          offset < 1
            ? Date.parse(start) + offset
            : Date.parse(end) + offset - 1,
        createdAt: Date.parse(anchor),
        status: 'posted',
        reviewStatus: 'none',
        syncStatus: 'synced'
      })
    );
    const service = createMockCoreFinanceService(
      new CoreFinanceRepository({
        accounts: fixtureAccounts,
        categories: fixtureCategories,
        transactions
      })
    );
    const activity = await service.getHomeTodayActivity({
      ...emptyTransactionFilters,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd
    });
    expect(activity.map(({ transaction }) => transaction.id)).toEqual([
      'transaction-3',
      'transaction-2'
    ]);
  }
);

it('returns all committed daily income and expenses across sources without leaking older or pending records', async () => {
  const sources = [
    'manual',
    'voice',
    'automatic',
    'platform_assisted'
  ] as const;
  const transactions = sources.flatMap((source, index) => [
    makeTransaction(index + 1, {
      source,
      type: 'expense',
      occurredAt: now - index,
      status: 'posted',
      reviewStatus: 'none',
      syncStatus: 'synced'
    }),
    makeTransaction(index + 11, {
      source,
      type: 'income',
      occurredAt: now - index,
      status: 'posted',
      reviewStatus: 'none',
      syncStatus: 'synced'
    })
  ]);
  transactions.push(
    makeTransaction(30, { occurredAt: day.periodStart - 1, createdAt: now }),
    makeTransaction(31, { occurredAt: day.periodEnd + 1 }),
    makeTransaction(32, { occurredAt: now, status: 'pending' }),
    makeTransaction(33, { occurredAt: now, status: 'failed' }),
    makeTransaction(34, { occurredAt: now, status: 'deleted' }),
    makeTransaction(35, {
      occurredAt: now,
      type: 'transfer',
      destinationAccountId: 'account-wallet'
    })
  );
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions
    })
  );
  const activity = await service.getHomeTodayActivity(filters);
  expect(activity).toHaveLength(8);
  expect(activity.filter(({ group }) => group === 'expense')).toHaveLength(4);
  expect(activity.filter(({ group }) => group === 'income')).toHaveLength(4);
  expect(new Set(activity.map(({ transaction }) => transaction.id)).size).toBe(
    8
  );
  expect(activity.map(({ transaction }) => transaction.source)).toEqual(
    expect.arrayContaining(sources)
  );
});

it('reads beyond a hundred daily transactions and preserves distinct repeated statements', async () => {
  const transactions = Array.from({ length: 123 }, (_, index) =>
    makeTransaction(index + 1, {
      title: 'Same statement',
      type: index % 2 ? 'income' : 'expense',
      occurredAt: now - index,
      status: 'posted',
      syncStatus: 'synced',
      reviewStatus: 'none'
    })
  );
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions
    })
  );
  const activity = await service.getHomeTodayActivity(filters);
  expect(activity).toHaveLength(123);
  expect(activity[0].transaction.id).toBe('transaction-1');
  expect(activity[122].transaction.id).toBe('transaction-123');
});

it('classifies refunds and reversals from their financial effect without adding the older original to today', async () => {
  const original = makeTransaction(1, {
    type: 'income',
    occurredAt: day.periodStart - 1,
    status: 'posted',
    reviewStatus: 'none',
    syncStatus: 'synced'
  });
  const reversal = makeTransaction(2, {
    type: 'reversal',
    amountMinor: original.amountMinor,
    originalTransactionId: original.id,
    occurredAt: now,
    status: 'posted',
    reviewStatus: 'none',
    syncStatus: 'synced'
  });
  const expense = makeTransaction(3, {
    type: 'expense',
    occurredAt: day.periodStart - 2,
    status: 'posted',
    reviewStatus: 'none',
    syncStatus: 'synced'
  });
  const refund = makeTransaction(4, {
    type: 'refund',
    amountMinor: 100,
    originalTransactionId: expense.id,
    occurredAt: now,
    status: 'posted',
    reviewStatus: 'none',
    syncStatus: 'synced'
  });
  const service = createMockCoreFinanceService(
    new CoreFinanceRepository({
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: [original, reversal, expense, refund]
    })
  );
  const activity = await service.getHomeTodayActivity(filters);
  expect(activity).toHaveLength(2);
  expect(
    activity.find(({ transaction }) => transaction.id === reversal.id)
  ).toMatchObject({ group: 'expense', sign: 'negative' });
  expect(
    activity.find(({ transaction }) => transaction.id === refund.id)
  ).toMatchObject({ group: 'income', sign: 'positive' });
});
