import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';

import type { LocalDate, SavingsLifecycle } from '@/domain/financial-planning';
import { financialPlanningService } from '@/services/financial-planning-service';
import { scopeToKey as coreFinanceScopeToKey } from '@/features/core-finance/core-finance-queries';
import { available } from '@/domain/financial-planning';
import { getCurrencyMinorUnitScale } from '@/domain/currencies';
import { useAppShellStore } from '@/state/app-shell';
import { assertReadActive } from '@/services/live/read-context';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { isPlanningOffline } from '@/services/live/planning-offline-read';

async function planningSnapshot(
  client: QueryClient,
  today: LocalDate,
  timeZone: string
) {
  const owner = useAppShellStore.getState().session?.userId;
  const read = financialPlanningService.getPlanningSnapshot!;
  return client.fetchQuery({
    queryKey: ['planning', 'snapshot', owner ?? null, today, timeZone],
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await read({ today, timeZone }, { signal });
      assertReadActive(signal);
      if (owner !== useAppShellStore.getState().session?.userId)
        throw new Error('Identity changed');
      return result;
    }
  });
}

export async function fetchPlanningOverview(
  client: QueryClient,
  input: { currencyCode: string; today: LocalDate; timeZone: string },
  signal?: AbortSignal
) {
  const { currencyCode, today, timeZone } = input;
  if (!financialPlanningService.getPlanningSnapshot)
    return financialPlanningService.getPlanningOverview(
      { currencyCode, today, timeZone },
      { signal }
    );
  const snapshot = await planningSnapshot(client, today, timeZone);
  assertReadActive(signal);
  return (
    snapshot.byCurrency[currencyCode] ?? {
      dataState: snapshot.dataState,
      salary: snapshot.salary,
      budget: null,
      savings: [],
      obligationsDueMinor: available({
        minorUnits: 0,
        currencyCode,
        scale: getCurrencyMinorUnitScale(currencyCode)
      })
    }
  );
}

export const financialPlanningKeys = {
  overview: (currencyCode: string, today: LocalDate, timeZone: string) =>
    ['planning', 'overview', currencyCode, today, timeZone] as const,
  salary: (today: LocalDate, timeZone: string) =>
    ['planning', 'salary', today, timeZone] as const,
  salaryProfile: () => ['planning', 'salary', 'profile'] as const,
  salaryReview: (id: string) => ['planning', 'salary', 'review', id] as const,
  budget: (periodKey: string) => ['planning', 'budget', periodKey] as const,
  budgetList: (periodKey: string) =>
    ['planning', 'budgets', periodKey] as const,
  budgetById: (id: string) => ['planning', 'budget-id', id] as const,
  obligations: (filters: unknown = {}) =>
    ['planning', 'obligations', filters] as const,
  obligation: (id: string) => ['planning', 'obligation', id] as const,
  paymentMatches: (filters: unknown = {}) =>
    ['planning', 'payment-matches', filters] as const,
  paymentMatch: (id: string) => ['planning', 'payment-match', id] as const,
  goals: (status?: string) => ['planning', 'goals', status ?? 'all'] as const,
  goal: (id: string) => ['planning', 'goal', id] as const,
  conflict: (id: string) => ['planning', 'conflict', id] as const
};

export function usePlanningOverview(
  currencyCode: string,
  today: LocalDate,
  timeZone: string
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: financialPlanningKeys.overview(currencyCode, today, timeZone),
    queryFn: ({ signal }) =>
      fetchPlanningOverview(client, { currencyCode, today, timeZone }, signal)
  });
}

function salaryOverviewOptions(
  client: QueryClient,
  today: LocalDate,
  timeZone: string
) {
  return {
    queryKey: financialPlanningKeys.salary(today, timeZone),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (
        !financialPlanningService.getPlanningSnapshot ||
        (await isPlanningOffline())
      )
        return financialPlanningService.getSalaryOverview(
          { today, timeZone },
          { signal }
        );
      const snapshot = await planningSnapshot(client, today, timeZone);
      assertReadActive(signal);
      return snapshot.salary;
    }
  };
}

export function useSalaryOverview(today: LocalDate, timeZone: string) {
  return useQuery(salaryOverviewOptions(useQueryClient(), today, timeZone));
}

export function useSalaryProfile() {
  return useQuery({
    queryKey: financialPlanningKeys.salaryProfile(),
    queryFn: ({ signal }) =>
      financialPlanningService.getSalaryProfile({ signal })
  });
}

export function useSalaryReceiptReview(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.salaryReview(id),
    queryFn: () => financialPlanningService.getSalaryReceiptReview(id),
    enabled: Boolean(id)
  });
}

export function useSalaryExpectedDates() {
  return useQuery({
    queryKey: ['planning', 'salary', 'expected-dates'],
    queryFn: () => financialPlanningService.listSalaryExpectedDates()
  });
}

export function usePaymentMatch(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.paymentMatch(id),
    queryFn: () => financialPlanningService.getPaymentMatch(id),
    enabled: Boolean(id)
  });
}

export function useBudget(periodKey: string) {
  return useQuery({
    queryKey: financialPlanningKeys.budget(periodKey),
    queryFn: () => financialPlanningService.getBudget(periodKey)
  });
}

export function useBudgets(periodKey: string) {
  return useQuery({
    queryKey: financialPlanningKeys.budgetList(periodKey),
    queryFn: () => financialPlanningService.listBudgets(periodKey),
    enabled: /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)
  });
}

export function useBudgetById(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.budgetById(id),
    queryFn: () => financialPlanningService.getBudgetById(id),
    enabled: Boolean(id)
  });
}

export function useObligations() {
  return useQuery({
    queryKey: financialPlanningKeys.obligations(),
    queryFn: ({ signal }) =>
      financialPlanningService.listObligations({}, { signal })
  });
}

function obligationsOverviewOptions() {
  return {
    queryKey: [...financialPlanningKeys.obligations(), 'overview'],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      financialPlanningService.getObligationsOverview({}, { signal })
  };
}

export function useObligationsOverview() {
  return useQuery(obligationsOverviewOptions());
}

export async function prefetchPlanningDestinations(
  client: QueryClient,
  today: LocalDate,
  timeZone: string
): Promise<void> {
  await Promise.all([
    client.prefetchQuery(salaryOverviewOptions(client, today, timeZone)),
    client.prefetchQuery(obligationsOverviewOptions())
  ]);
}

export function useObligation(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.obligation(id),
    queryFn: ({ signal }) =>
      financialPlanningService.getObligation(id, { signal }),
    enabled: Boolean(id)
  });
}

/** Header amounts are authoritative; optional history never gates the header. */
export function useObligationDetail(id: string) {
  const split = Boolean(financialPlanningService.getObligationHeader);
  const header = useQuery({
    queryKey: split
      ? [...financialPlanningKeys.obligation(id), 'header']
      : financialPlanningKeys.obligation(id),
    queryFn: ({ signal }) =>
      (
        financialPlanningService.getObligationHeader ??
        financialPlanningService.getObligation
      )(id, { signal }),
    enabled: Boolean(id)
  });
  const sectionsEnabled = split && header.data?.sectionsState === 'pending';
  const schedule = useQuery({
    queryKey: [
      ...financialPlanningKeys.obligation(id),
      'schedule',
      header.data?.obligation.version
    ],
    queryFn: ({ signal }) =>
      financialPlanningService.getObligationSchedule!(id, { signal }),
    enabled: sectionsEnabled
  });
  const history = useQuery({
    queryKey: [
      ...financialPlanningKeys.obligation(id),
      'payments',
      header.data?.obligation.currencyCode,
      header.data?.obligation.version
    ],
    queryFn: ({ signal }) =>
      financialPlanningService.getObligationPayments!(
        id,
        header.data!.obligation.currencyCode,
        { signal }
      ),
    enabled: sectionsEnabled
  });
  const protectedError = [schedule.error, history.error].find(
    (error) =>
      error &&
      'code' in error &&
      ['forbidden', 'session_expired'].includes(String(error.code))
  );
  const scheduleReady =
    sectionsEnabled && !protectedError && hasReadableSnapshot(schedule);
  const historyReady =
    sectionsEnabled && !protectedError && hasReadableSnapshot(history);
  return {
    ...header,
    isError: header.isError || Boolean(protectedError),
    error: header.error ?? protectedError,
    data:
      header.data && sectionsEnabled
        ? {
            ...header.data,
            schedule: scheduleReady ? (schedule.data ?? []) : [],
            payments: historyReady ? (history.data?.items ?? []) : [],
            paymentHistoryState: historyReady
              ? (history.data?.state ?? 'unavailable')
              : ('unavailable' as const)
          }
        : header.data,
    scheduleLoading:
      sectionsEnabled &&
      !scheduleReady &&
      (header.isFetching || schedule.isPending || schedule.isFetching),
    historyLoading:
      sectionsEnabled &&
      !historyReady &&
      (header.isFetching || history.isPending || history.isFetching),
    scheduleError: sectionsEnabled && schedule.isError,
    isRefetching:
      header.isRefetching || schedule.isRefetching || history.isRefetching,
    refetch: async () => {
      const reads = [header.refetch()];
      if (sectionsEnabled) {
        void schedule.refetch();
        void history.refetch();
      }
      return (await Promise.all(reads))[0];
    }
  };
}

export function useSavingsGoals(status?: SavingsLifecycle) {
  return useQuery({
    queryKey: financialPlanningKeys.goals(status),
    queryFn: ({ signal }) =>
      financialPlanningService.listGoals({ status }, { signal })
  });
}

export function useSavingsGoal(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.goal(id),
    queryFn: ({ signal }) => financialPlanningService.getGoal(id, { signal }),
    enabled: Boolean(id)
  });
}

export function usePlanningConflict(id: string) {
  return useQuery({
    queryKey: financialPlanningKeys.conflict(id),
    queryFn: () => financialPlanningService.getConflict(id),
    enabled: Boolean(id)
  });
}

export function usePlanningMutation<TVariables, TResult>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: () => useAppShellStore.getState().session?.userId,
    onSuccess: async (result) => {
      await invalidatePlanningScopes(client, result.affectedScopes);
    },
    onError: async (_error, _variables, owner) => {
      if (owner !== useAppShellStore.getState().session?.userId) return;
      // A failed response can follow a committed write; refresh with reads only.
      await invalidatePlanningScopes(client, [
        'planning',
        'accounts.balances',
        'transactions.list',
        'home.summary',
        'reports.live',
        'assistant.context'
      ]);
    }
  });
}

export function scopeToKey(scope: string): readonly unknown[] {
  const parts = scope.split('.');
  if (scope.startsWith('planning.salary')) {
    return ['planning', 'salary'];
  }
  if (scope.startsWith('planning.budget')) {
    return ['planning'];
  }
  if (scope.startsWith('planning.obligation') && parts[2]) {
    return financialPlanningKeys.obligation(parts[2]);
  }
  if (scope.startsWith('planning.obligations')) {
    return ['planning', 'obligations'];
  }
  if (scope.startsWith('planning.goal') && parts[2]) {
    return financialPlanningKeys.goal(parts[2]);
  }
  if (scope.startsWith('planning.goals')) {
    return ['planning', 'goals'];
  }
  if (scope.startsWith('planning.paymentMatch.')) {
    return financialPlanningKeys.paymentMatch(parts[2]);
  }
  if (scope.startsWith('planning.paymentMatches')) {
    return ['planning', 'payment-matches'];
  }
  if (scope.startsWith('planning.conflict')) {
    return ['planning', 'conflict'];
  }
  if (scope === 'reports.live') return ['reports', 'live'];
  if (scope === 'assistant.context') return ['assistant', 'context', 'current'];
  if (
    scope.startsWith('accounts') ||
    scope.startsWith('home') ||
    scope.startsWith('transactions')
  )
    return coreFinanceScopeToKey(scope);
  return ['planning'];
}

export async function invalidatePlanningScopes(
  client: QueryClient,
  scopes: readonly string[]
): Promise<void> {
  // Invalidate the shared source before any derived observer can request it.
  await client.cancelQueries({ queryKey: ['planning', 'snapshot'] });
  await client.invalidateQueries({
    queryKey: ['planning', 'snapshot'],
    refetchType: 'none'
  });
  await client.cancelQueries({ queryKey: ['reports', 'history'] });
  await client.invalidateQueries({
    queryKey: ['reports', 'history'],
    refetchType: 'none'
  });
  const keys = [
    ...new Map(
      scopes
        .flatMap((scope) =>
          scope === 'reports.live'
            ? [
                ['reports', 'live'],
                ['reports', 'net-worth'],
                ['reports', 'history']
              ]
            : [scopeToKey(scope)]
        )
        .map((key) => [JSON.stringify(key), key])
    ).values()
  ];
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })));
  await Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey }))
  );
}
