import type { Transaction } from '@/domain/core-finance';
import {
  addLocalDays,
  localDateInTimeZone,
  localDateTimeInstant
} from '@/domain/financial-period';

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
  _firstDayOfWeek: FirstDayOfWeek,
  timeZone?: string
): TransactionPeriodKey {
  return relativePeriod(timestamp, dayBoundaries(now, timeZone));
}

function dayBoundaries(
  now: number,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  const today = localDateInTimeZone(now, timeZone);
  return {
    today: localDateTimeInstant(today, timeZone),
    yesterday: localDateTimeInstant(addLocalDays(today, -1), timeZone),
    lastWeek: localDateTimeInstant(addLocalDays(today, -7), timeZone)
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
  _firstDayOfWeek: FirstDayOfWeek,
  timeZone?: string
) {
  const boundaries = dayBoundaries(now, timeZone);
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
