import {
  emptyTransactionFilters,
  isConfirmedTransaction,
  type Transaction
} from '@/domain/core-finance';
import {
  buildFinancialReport,
  resolveReportPeriod,
  unavailable
} from '@/domain/reports';
import type { CoreFinanceService } from '@/services/contracts/core-finance-service';
import type { ReportQuery } from '@/services/contracts/reports-service';
import { assertReadActive } from '@/services/live/read-context';

export type LocalReportFinance = Pick<
  CoreFinanceService,
  'listAccounts' | 'listCategories' | 'listTransactions'
>;
const failure = (code: string) => Object.assign(new Error(code), { code });

/** Read-only projection of the existing owner-local ledger using the shared report calculations. */
export async function readLocalFinancialReport(
  input: ReportQuery,
  finance: LocalReportFinance,
  owner: { userId: string; assertCurrent: () => Promise<void> },
  signal?: AbortSignal
) {
  await owner.assertCurrent();
  assertReadActive(signal);
  const [accounts, categories] = await Promise.all([
    finance.listAccounts(true),
    finance.listCategories(true)
  ]);
  await owner.assertCurrent();
  const owned = new Set(accounts.map((account) => account.id));
  if (input.accountIds?.some((id) => !owned.has(id)))
    throw failure('report_account_scope_unavailable');
  const byId = new Map<string, Transaction>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    assertReadActive(signal);
    const page = await finance.listTransactions(
      emptyTransactionFilters,
      cursor,
      100
    );
    await owner.assertCurrent();
    for (const transaction of page.items) {
      if (
        !owned.has(transaction.accountId) ||
        (transaction.type === 'transfer' &&
          transaction.destinationAccountId &&
          !owned.has(transaction.destinationAccountId))
      )
        throw failure('report_local_owner_mismatch');
      const previous = byId.get(transaction.id);
      if (!previous || transaction.version > previous.version)
        byId.set(transaction.id, transaction);
      else if (
        previous.version === transaction.version &&
        JSON.stringify(previous) !== JSON.stringify(transaction)
      )
        throw failure('report_local_conflict');
    }
    cursor = page.nextCursor;
    if (cursor) {
      if (seenCursors.has(cursor) || seenCursors.size >= 1000)
        throw failure('report_local_history_limit');
      seenCursors.add(cursor);
    }
  } while (cursor);
  assertReadActive(signal);
  await owner.assertCurrent();
  // Income, expenditure and transfer fees belong to the source account; incoming transfers are not income.
  const transactions = [...byId.values()].filter(
    (transaction) =>
      !input.accountIds?.length ||
      input.accountIds.includes(transaction.accountId)
  );
  const period = resolveReportPeriod({ ...input, now: Date.now() });
  const report = buildFinancialReport({
    period,
    transactions,
    categories,
    currencyCode: input.currencyCode
  });
  const inPeriod = transactions.filter(
    (transaction) =>
      transaction.occurredAt >= period.startInstant &&
      transaction.occurredAt < period.endExclusiveInstant
  );
  const eligible = inPeriod.filter(isConfirmedTransaction);
  if (report.completenessReasons.includes('missing_rate')) {
    report.summary.income = unavailable('missing_rate');
    report.summary.expense = unavailable('missing_rate');
    report.summary.netCashFlow = unavailable('missing_rate');
    report.summary.savingsRateBasisPoints = unavailable('missing_rate');
  }
  // Local ledger data cannot establish planning budgets, salaries or goal progress.
  report.insights = report.insights.filter((insight) =>
    [
      'month_comparison',
      'average_monthly_expense',
      'spending_volatility',
      'recurring_payments',
      'category_movement',
      'highest_spending_month',
      'lowest_spending_month'
    ].includes(insight.kind)
  );
  return {
    ...report,
    key: `${report.key}:${input.monthStartDay ?? 1}:${[...(input.accountIds ?? [])].sort().join(',') || 'all'}`,
    dataState: 'offline' as const,
    localData: {
      pendingSyncCount: eligible.filter(
        (transaction) => transaction.syncStatus !== 'synced'
      ).length,
      excludedCount: inPeriod.length - eligible.length,
      empty: inPeriod.length === 0
    }
  };
}
