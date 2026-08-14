import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';

import {
  emptyTransactionFilters,
  type TransactionFilterSet
} from '@/domain/core-finance';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

export const coreFinanceKeys = {
  home: (currency: string) => ['core-finance', 'home', currency] as const,
  accounts: (archived = false) =>
    ['core-finance', 'accounts', archived] as const,
  account: (id: string) => ['core-finance', 'account', id] as const,
  transactions: (filters: TransactionFilterSet = emptyTransactionFilters) =>
    ['core-finance', 'transactions', filters] as const,
  transaction: (id: string) => ['core-finance', 'transaction', id] as const,
  categories: (archived = false) =>
    ['core-finance', 'categories', archived] as const,
  conflict: (id: string) => ['core-finance', 'conflict', id] as const
};

export function useHomeSummary(currency: string) {
  return useQuery({
    queryKey: coreFinanceKeys.home(currency),
    queryFn: () => coreFinanceService.getHomeSummary(currency)
  });
}

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: coreFinanceKeys.accounts(includeArchived),
    queryFn: () => coreFinanceService.listAccounts(includeArchived)
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: coreFinanceKeys.account(id),
    queryFn: () => coreFinanceService.getAccount(id),
    enabled: Boolean(id)
  });
}

export function useTransactions(
  filters: TransactionFilterSet = emptyTransactionFilters
) {
  return useQuery({
    queryKey: coreFinanceKeys.transactions(filters),
    queryFn: () => coreFinanceService.listTransactions(filters)
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: coreFinanceKeys.transaction(id),
    queryFn: () => coreFinanceService.getTransaction(id),
    enabled: Boolean(id)
  });
}

export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: coreFinanceKeys.categories(includeArchived),
    queryFn: () => coreFinanceService.listCategories(includeArchived)
  });
}

export function useCoreFinanceMutation<TVariables, TResult>(
  mutationFn: (
    variables: TVariables
  ) => Promise<{ value: TResult; affectedScopes: readonly string[] }>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await invalidateCoreFinanceScopes(client, result.affectedScopes);
    }
  });
}

export function scopeToKey(scope: string): readonly unknown[] {
  const [root, kind, id] = scope.split('.');
  if (root === 'home') return ['core-finance', 'home'];
  if (root === 'accounts' && kind === 'detail' && id)
    return ['core-finance', 'account', id];
  if (root === 'accounts') return ['core-finance', 'accounts'];
  if (root === 'transactions' && kind === 'detail' && id)
    return ['core-finance', 'transaction', id];
  if (root === 'transactions') return ['core-finance', 'transactions'];
  if (root === 'categories') return ['core-finance', 'categories'];
  if (scope === 'reports.live') return ['reports', 'live'];
  if (scope === 'assistant.context') return ['assistant', 'context', 'current'];
  return ['core-finance'];
}

export async function invalidateCoreFinanceScopes(
  client: QueryClient,
  scopes: readonly string[]
): Promise<void> {
  await Promise.all(
    scopes.map((scope) =>
      client.invalidateQueries({ queryKey: scopeToKey(scope) })
    )
  );
}
