import {
  emptyTransactionFilters,
  matchesFilters,
  type Transaction,
  type TransactionFilterSet
} from '@/domain/core-finance';
import {
  CoreFinanceError,
  type CoreFinanceService,
  type HomeTodayActivity
} from './contracts/core-finance-service';

export async function readHomeTodayActivity({
  filters,
  listTransactions,
  readSignedEffect,
  signal
}: {
  filters: TransactionFilterSet;
  listTransactions: CoreFinanceService['listTransactions'];
  readSignedEffect: (transaction: Transaction) => Promise<number | null>;
  signal?: AbortSignal;
}): Promise<HomeTodayActivity[]> {
  if (
    filters.periodStart === null ||
    filters.periodEnd === null ||
    filters.periodStart > filters.periodEnd
  )
    throw new CoreFinanceError('validation');
  const dayFilters: TransactionFilterSet = {
    ...emptyTransactionFilters,
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
    accountIds: filters.accountIds,
    sort: 'newest'
  };
  const records = new Map<string, Transaction>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    if (signal?.aborted) throw new CoreFinanceError('offline');
    const page = await listTransactions(dayFilters, cursor, 100, signal);
    for (const transaction of page.items) {
      const previous = records.get(transaction.id);
      if (!previous || transaction.version > previous.version)
        records.set(transaction.id, transaction);
    }
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new CoreFinanceError('unknown');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  const activity: HomeTodayActivity[] = [];
  for (const transaction of [...records.values()].sort(
    (left, right) => right.occurredAt - left.occurredAt
  )) {
    if (signal?.aborted) throw new CoreFinanceError('offline');
    if (
      !matchesFilters(transaction, dayFilters) ||
      !['posted', 'refunded', 'reversed'].includes(transaction.status) ||
      transaction.deletedAt !== null ||
      transaction.syncStatus !== 'synced' ||
      transaction.reviewStatus === 'required' ||
      transaction.type === 'transfer'
    )
      continue;
    const signed =
      transaction.type === 'income'
        ? transaction.amountMinor
        : ['expense', 'recurring_payment', 'obligation_payment'].includes(
              transaction.type
            )
          ? -transaction.amountMinor
          : await readSignedEffect(transaction);
    if (signed === null || signed === 0) continue;
    if (
      !Number.isSafeInteger(signed) ||
      Math.abs(signed) !== transaction.amountMinor
    )
      throw new CoreFinanceError('unknown');
    activity.push({
      transaction,
      group: signed < 0 ? 'expense' : 'income',
      sign: signed < 0 ? 'negative' : 'positive'
    });
  }
  return activity;
}
