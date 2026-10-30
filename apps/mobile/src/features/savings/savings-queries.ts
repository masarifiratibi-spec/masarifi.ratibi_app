import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { SavingsGoal, SavingsProgress } from '@/domain/financial-planning';
import { localDateInTimeZone } from '@/domain/financial-period';
import {
  financialPlanningKeys,
  fetchPlanningOverview
} from '@/features/financial-planning/financial-planning-queries';
import { usePreferenceStore } from '@/state/preferences';

export {
  usePlanningMutation,
  useSavingsGoal,
  useSavingsGoals
} from '@/features/financial-planning/financial-planning-queries';

export function useSavingsListProgress(goals: SavingsGoal[]) {
  const client = useQueryClient();
  const timeZone = usePreferenceStore((s) => s.timeZone);
  const today = localDateInTimeZone(Date.now(), timeZone);
  const currencies = [...new Set(goals.map((goal) => goal.currencyCode))];
  const queries = useQueries({
    queries: currencies.map((currencyCode) => ({
      queryKey: financialPlanningKeys.overview(currencyCode, today, timeZone),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchPlanningOverview(client, { currencyCode, today, timeZone }, signal)
    }))
  });
  const progress = new Map<string, SavingsProgress>();
  queries.forEach((query, index) => {
    if (!query.data) return;
    const ids = new Set(
      goals
        .filter((goal) => goal.currencyCode === currencies[index])
        .map((goal) => goal.id)
    );
    query.data.savings.forEach((item) => {
      if (ids.has(item.goalId)) progress.set(item.goalId, item);
    });
  });
  return {
    progress,
    isError: queries.some((query) => query.isError),
    retry: () => Promise.all(queries.map((query) => query.refetch()))
  };
}
