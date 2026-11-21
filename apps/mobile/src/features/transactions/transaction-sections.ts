import type { Transaction } from '@/domain/core-finance';

export type TransactionPeriodKey =
  'today' | 'yesterday' | 'lastWeek' | 'earlier';

export type TransactionGroupedPosition = 'first' | 'middle' | 'last' | 'only';
export type FirstDayOfWeek = 'saturday' | 'sunday' | 'monday';

const periodOrder: TransactionPeriodKey[] = [
  'today',
  'yesterday',
  'lastWeek',
  'earlier'
];

export function transactionPeriodKey(
  timestamp: number,
  now: number,
  _firstDayOfWeek: FirstDayOfWeek
): TransactionPeriodKey {
  return relativePeriod(timestamp, dayBoundaries(now));
}

function dayBoundaries(now: number) {
  const today = startOfDay(now);
  return {
    today: today.getTime(),
    yesterday: shiftDays(today, -1).getTime(),
    lastWeek: shiftDays(today, -7).getTime()
  };
}

function relativePeriod(
  timestamp: number,
  boundaries: ReturnType<typeof dayBoundaries>
): TransactionPeriodKey {
  if (timestamp >= boundaries.today) return 'today';
  if (timestamp >= boundaries.yesterday) return 'yesterday';
  if (timestamp >= boundaries.lastWeek) return 'lastWeek';
  return 'earlier';
}

export function buildTransactionSections(
  transactions: Transaction[],
  now: number,
  _firstDayOfWeek: FirstDayOfWeek
) {
  const boundaries = dayBoundaries(now);
  const groups: Record<TransactionPeriodKey, Transaction[]> = {
    today: [],
    yesterday: [],
    lastWeek: [],
    earlier: []
  };
  for (const transaction of transactions) {
    groups[relativePeriod(transaction.occurredAt, boundaries)].push(
      transaction
    );
  }
  return periodOrder.flatMap((key) => {
    const items = groups[key];
    if (!items.length) return [];
    return [{ key, items: withGroupedPositions(items) }];
  });
}

function withGroupedPositions(items: Transaction[]) {
  return items.map((item, index) => ({
    item,
    groupedPosition: (items.length === 1
      ? 'only'
      : index === 0
        ? 'first'
        : index === items.length - 1
          ? 'last'
          : 'middle') as TransactionGroupedPosition
  }));
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
