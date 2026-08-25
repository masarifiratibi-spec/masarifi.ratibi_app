import type { Transaction } from '@/domain/core-finance';

export type TransactionPeriodKey =
  | 'today'
  | 'yesterday'
  | 'lastWeek'
  | 'earlier';

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
  const today = startOfDay(now);
  const transactionDay = startOfDay(timestamp);
  if (transactionDay >= today) return 'today';
  const yesterday = shiftDays(today, -1);
  if (transactionDay >= yesterday) return 'yesterday';
  if (transactionDay >= shiftDays(today, -7)) return 'lastWeek';
  return 'earlier';
}

export function buildTransactionSections(
  transactions: Transaction[],
  now: number,
  firstDayOfWeek: FirstDayOfWeek
) {
  const groups = new Map<TransactionPeriodKey, Transaction[]>();
  transactions.forEach((transaction) => {
    const key = transactionPeriodKey(
      transaction.occurredAt,
      now,
      firstDayOfWeek
    );
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });
  return periodOrder.flatMap((key) => {
    const items = groups.get(key) ?? [];
    if (!items.length) return [];
    return [{ key, items: withGroupedPositions(items) }];
  });
}

function withGroupedPositions(items: Transaction[]) {
  return items.map((item, index) => ({
    item,
    groupedPosition: (
      items.length === 1
        ? 'only'
        : index === 0
          ? 'first'
          : index === items.length - 1
            ? 'last'
            : 'middle'
    ) as TransactionGroupedPosition
  }));
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
