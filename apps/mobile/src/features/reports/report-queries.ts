import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';

import type { ReportPeriodKind } from '@/domain/reports';
import type { LocalDate } from '@/domain/financial-planning';
import type {
  ReportOutputPreviewInput,
  ReportQuery
} from '@/services/contracts/reports-service';
import { reportsService } from '@/services/mocks/reports-service';
import { usePreferenceStore } from '@/state/preferences';

export const reportKeys = {
  live: (input: ReportQuery) => ['reports', 'live', input] as const,
  breakdown: (input: ReportQuery, dimension: string) =>
    ['reports', 'breakdown', input, dimension] as const,
  schedule: ['reports', 'schedule'] as const,
  draft: ['reports', 'schedule-draft'] as const,
  preview: (input: ReportOutputPreviewInput) => ['reports', 'preview', input] as const,
  attempts: (filters: unknown = {}) => ['reports', 'attempts', filters] as const,
  attempt: (id: string) => ['reports', 'attempt', id] as const
};

export function useReport(input: ReportQuery) {
  return useQuery({
    queryKey: reportKeys.live(input),
    queryFn: () => reportsService.getReport(input)
  });
}

export function useReportInput(kind: ReportPeriodKind, anchorDate: LocalDate, currencyCode: string): ReportQuery {
  return { kind, anchorDate, currencyCode, timeZone: usePreferenceStore.getState().timeZone };
}

export function useReportSchedule() {
  return useQuery({
    queryKey: reportKeys.schedule,
    queryFn: () => reportsService.getSchedule()
  });
}

export function useReportPreview(input: ReportOutputPreviewInput) {
  return useQuery({
    queryKey: reportKeys.preview(input),
    queryFn: () => reportsService.previewOutput(input)
  });
}

export function useReportAttempts() {
  return useQuery({
    queryKey: reportKeys.attempts(),
    queryFn: () => reportsService.listAttempts()
  });
}

export function useReportMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => invalidateReportScopes(client, result.affectedScopes)
  });
}

export async function invalidateReportScopes(client: QueryClient, scopes: readonly string[]) {
  await Promise.all(
    scopes.map((scope) => {
      if (scope.startsWith('reports.attempt.')) {
        return client.invalidateQueries({ queryKey: reportKeys.attempt(scope.split('.')[2]) });
      }
      if (scope.startsWith('reports.attempts')) {
        return client.invalidateQueries({ queryKey: ['reports', 'attempts'] });
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
