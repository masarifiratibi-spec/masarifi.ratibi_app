import { fetchFinancialResetState } from '@/services/financial-reset';

export function financialResetStateQuery(ownerId: string) {
  return {
    queryKey: ['settings', 'financial-reset-state', { ownerId }] as const,
    queryFn: () => fetchFinancialResetState(ownerId),
    staleTime: 10_000,
    retry: false
  };
}
