import type { SubscriptionState } from '@/domain/subscriptions';

export function resolvePaidContentAccess(state: SubscriptionState, { existingPaidContent }: { existingPaidContent: boolean }) {
  const active = ['trialing', 'active', 'cancellation_scheduled'].includes(state.status) && state.paidContentAccess === 'editable';
  return {
    access: active || !existingPaidContent ? state.paidContentAccess : 'read_only',
    deleteScopes: []
  };
}
