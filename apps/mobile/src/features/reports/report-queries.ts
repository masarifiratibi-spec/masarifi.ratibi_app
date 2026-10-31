import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';

import type { ReportPeriodKind } from '@/domain/reports';
import type { LocalDate } from '@/domain/financial-planning';
import { addLocalDays, buildFinancialPeriod } from '@/domain/financial-period';
import {
  emptyTransactionFilters,
  type Transaction
} from '@/domain/core-finance';
import type {
  ReportOutputPreviewInput,
  ReportQuery
} from '@/services/contracts/reports-service';
import { reportsService } from '@/services/reports-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { buildNetWorthTrend } from './report-net-worth';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { useAppShellStore } from '@/state/app-shell';
import { assertReadActive } from '@/services/live/read-context';

export type ReportTimeframe = 'week' | 'month' | 'quarter' | 'year' | 'all';

export const reportKeys = {
  live: (
    input: ReportQuery,
    owner = useAppShellStore.getState().session?.userId
  ) => ['reports', 'live', owner ?? null, input] as const,
  breakdown: (input: ReportQuery, dimension: string) =>
    ['reports', 'breakdown', input, dimension] as const,
  schedule: ['reports', 'schedule'] as const,
  draft: ['reports', 'schedule-draft'] as const,
  preview: (input: ReportOutputPreviewInput) =>
    ['reports', 'preview', input] as const,
  attempt: (id: string, owner = useAppShellStore.getState().session?.userId) =>
    ['reports', 'attempt', owner ?? null, id] as const,
  netWorth: (
    anchorDate: LocalDate,
    currencyCode: string,
    accountIds: readonly string[],
    timeframe: ReportTimeframe,
    timeZone: string,
    monthStartDay = 1
  ) =>
    [
      'reports',
      'net-worth',
      anchorDate,
      currencyCode,
      accountIds,
      timeframe,
      timeZone,
      monthStartDay
    ] as const
};

export function useReport(input: ReportQuery) {
  const owner = useAppShellStore((state) => state.session?.userId);
  return useQuery({
    queryKey: reportKeys.live(input, owner),
    queryFn: ({ signal }) => reportsService.getReport(input, { signal }),
    // Read-only recovery replaces the local projection; it never submits or resumes mutations.
    refetchInterval: (query) =>
      query.state.data?.dataState === 'offline'
        ? query.state.error
          ? 30_000
          : 10_000
        : false,
    refetchIntervalInBackground: false
  });
}

export function useReportInput(
  kind: ReportPeriodKind,
  anchorDate: LocalDate,
  currencyCode: string,
  accountIds?: string[]
): ReportQuery {
  return {
    kind,
    anchorDate,
    currencyCode,
    timeZone: usePreferenceStore((state) => state.timeZone),
    monthStartDay: usePreferenceStore((state) => state.monthStartDay),
    ...(accountIds?.length ? { accountIds } : {})
  };
}

export function useNetWorthTrend({
  accountIds,
  anchorDate,
  currencyCode,
  timeframe
}: {
  accountIds: string[];
  anchorDate: LocalDate;
  currencyCode: string;
  timeframe: ReportTimeframe;
}) {
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const monthStartDay = usePreferenceStore((state) => state.monthStartDay);
  const client = useQueryClient();
  return useQuery({
    queryKey: reportKeys.netWorth(
      anchorDate,
      currencyCode,
      accountIds,
      timeframe,
      timeZone,
      monthStartDay
    ),
    queryFn: async ({ signal }) => {
      const filters = { ...emptyTransactionFilters, accountIds };
      const owner = useAppShellStore.getState().session?.userId;
      const [accounts, home, transactions] = await Promise.all([
        client.fetchQuery({
          queryKey: coreFinanceKeys.accounts(false),
          staleTime: Infinity,
          queryFn: ({ signal: active }) =>
            coreFinanceService.listAccounts(false, { signal: active })
        }),
        client.fetchQuery({
          queryKey: coreFinanceKeys.home(currencyCode, filters),
          staleTime: Infinity,
          queryFn: ({ signal: active }) =>
            coreFinanceService.getHomeSummary(currencyCode, filters, {
              signal: active
            })
        }),
        client.fetchQuery({
          queryKey: ['reports', 'history', owner ?? null],
          staleTime: Infinity,
          queryFn: ({ signal: active }) => allTransactions(active)
        })
      ]);
      assertReadActive(signal);
      if (owner !== useAppShellStore.getState().session?.userId)
        throw new Error('Identity changed');
      const pointInstants = trendPointInstants(
        timeframe,
        anchorDate,
        timeZone,
        accounts.map((account) => account.createdAt),
        transactions.map((transaction) => transaction.occurredAt),
        monthStartDay
      );
      return buildNetWorthTrend({
        accounts,
        accountIds,
        currencyCode,
        pointInstants,
        ratesByAccount: new Map(
          home.components.map((component) => [
            component.accountId,
            component.rate
          ])
        ),
        transactions
      });
    }
  });
}

export function useReportSchedule() {
  return useQuery({
    queryKey: reportKeys.schedule,
    queryFn: ({ signal }) => reportsService.getSchedule({ signal })
  });
}

export function useReportPreview(input: ReportOutputPreviewInput) {
  return useQuery({
    queryKey: reportKeys.preview(input),
    queryFn: ({ signal }) => reportsService.previewOutput(input, { signal })
  });
}

export function useReportAttempt(id?: string) {
  const owner = useAppShellStore((state) => state.session?.userId);
  return useQuery({
    queryKey: reportKeys.attempt(id ?? '', owner),
    enabled: Boolean(id),
    queryFn: ({ signal }) => reportsService.getAttempt(id!, { signal }),
    refetchInterval: (query) =>
      query.state.data &&
      ['scheduled', 'sending'].includes(query.state.data.status)
        ? 5000
        : false
  });
}

export function useReportMutation<TVariables, TResult>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) =>
      invalidateReportScopes(client, result.affectedScopes)
  });
}

export async function invalidateReportScopes(
  client: QueryClient,
  scopes: readonly string[]
) {
  await Promise.all(
    scopes.map((scope) => {
      if (scope.startsWith('reports.attempt.')) {
        return client.invalidateQueries({
          queryKey: reportKeys.attempt(scope.split('.')[2])
        });
      }
      if (scope.startsWith('reports.attempts')) {
        return client.invalidateQueries({ queryKey: ['reports', 'attempt'] });
      }
      if (scope.startsWith('reports.schedule')) {
        return client.invalidateQueries({ queryKey: reportKeys.schedule });
      }
      if (scope.startsWith('reports.live')) {
        return client.invalidateQueries({ queryKey: ['reports', 'live'] });
      }
      return client.invalidateQueries({ queryKey: ['reports'] });
    })
  );
}

async function allTransactions(signal?: AbortSignal) {
  const owner = useAppShellStore.getState().session?.userId;
  const transactions: Transaction[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page = await coreFinanceService.listTransactions(
      emptyTransactionFilters,
      cursor,
      100,
      signal
    );
    assertReadActive(signal);
    if (owner !== useAppShellStore.getState().session?.userId)
      throw new Error('Identity changed');
    transactions.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor))
      throw new Error('Invalid transaction cursor');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return transactions;
}

function trendPointInstants(
  timeframe: ReportTimeframe,
  anchorDate: LocalDate,
  timeZone: string,
  accountDates: readonly number[],
  transactionDates: readonly number[],
  monthStartDay = 1
): number[] {
  const end = buildFinancialPeriod({
    anchorDate,
    monthStartDay: 1,
    preset: 'today',
    timeZone
  }).endInstant;
  const preset =
    timeframe === 'month'
      ? 'current_cycle'
      : timeframe === 'quarter'
        ? 'three_months'
        : timeframe === 'year'
          ? 'twelve_months'
          : null;
  const start =
    timeframe === 'all'
      ? Math.min(end, ...accountDates, ...transactionDates)
      : buildFinancialPeriod({
          anchorDate:
            timeframe === 'week' ? addLocalDays(anchorDate, -6) : anchorDate,
          monthStartDay,
          preset: timeframe === 'week' ? 'today' : preset!,
          timeZone
        }).startInstant;
  const count = timeframe === 'week' ? 7 : 10;
  return Array.from({ length: count }, (_, index) =>
    Math.round(start + ((end - start) * index) / (count - 1))
  );
}
