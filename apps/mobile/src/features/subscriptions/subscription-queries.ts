import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { SubscriptionOperationInput } from '@/domain/subscriptions';
import { subscriptionService } from '@/services/mocks/subscription-settings-service';

export const subscriptionKeys = {
  catalog: () => ['subscriptions', 'catalog'] as const,
  state: () => ['subscriptions', 'state'] as const,
  operation: (id: string) => ['subscriptions', 'operation', id] as const
};

export function useSubscriptionCatalog() {
  return useQuery({ queryKey: subscriptionKeys.catalog(), queryFn: () => subscriptionService.getCatalog() });
}

export function useSubscriptionState() {
  return useQuery({ queryKey: subscriptionKeys.state(), queryFn: () => subscriptionService.getState() });
}

export function useSubscriptionOperation(id?: string) {
  return useQuery({ queryKey: subscriptionKeys.operation(id ?? ''), queryFn: () => subscriptionService.getOperation(id ?? ''), enabled: Boolean(id) });
}

export function useStartSubscriptionOperation() {
  return useSubscriptionMutation(({ input, expectedVersion, operationId }: { input: SubscriptionOperationInput; expectedVersion: number; operationId: string }) =>
    subscriptionService.startOperation(input, expectedVersion, operationId)
  );
}

export function useCompleteSubscriptionOperation() {
  return useSubscriptionMutation(({ operationId, outcome }: { operationId: string; outcome: 'success' | 'failure' | 'cancelled' }) =>
    subscriptionService.completeMockOperation(operationId, outcome)
  );
}

export function useExpireSubscriptionPeriod() {
  return useSubscriptionMutation(({ operationId }: { operationId: string }) =>
    subscriptionService.expireCurrentPeriod(operationId)
  );
}

function useSubscriptionMutation<TVariables, TValue>(mutationFn: (variables: TVariables) => Promise<{ value: TValue; affectedScopes: readonly string[] }>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => invalidateSubscriptionScopes(client, result.affectedScopes)
  });
}

export function subscriptionScopeToKey(scope: string): readonly unknown[] | null {
  if (scope === 'subscriptions.catalog') return subscriptionKeys.catalog();
  if (scope === 'subscriptions.state') return subscriptionKeys.state();
  if (scope.startsWith('subscriptions.operation.') && scope.length > 'subscriptions.operation.'.length)
    return subscriptionKeys.operation(scope.slice('subscriptions.operation.'.length));
  return null;
}

export async function invalidateSubscriptionScopes(client: QueryClient, scopes: readonly string[]) {
  await Promise.all(scopes.map((scope) => {
    const key = subscriptionScopeToKey(scope);
    return key ? client.invalidateQueries({ queryKey: key }) : Promise.resolve();
  }));
}
