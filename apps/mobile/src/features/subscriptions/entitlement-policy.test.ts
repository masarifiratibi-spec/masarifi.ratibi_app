import { subscriptionStateSchema } from '@/domain/subscriptions';
import { resolvePaidContentAccess } from './entitlement-policy';

test('keeps existing paid content read-only after downgrade or expiry without deleting owned data', () => {
  expect(resolvePaidContentAccess(state('active'), { existingPaidContent: true })).toEqual({
    access: 'editable',
    deleteScopes: []
  });
  expect(resolvePaidContentAccess(state('expired'), { existingPaidContent: true })).toEqual({
    access: 'read_only',
    deleteScopes: []
  });
  expect(resolvePaidContentAccess(state('representative_payment_failed'), { existingPaidContent: true })).toEqual({
    access: 'read_only',
    deleteScopes: []
  });
  expect(resolvePaidContentAccess(state('free'), { existingPaidContent: true })).toEqual({
    access: 'read_only',
    deleteScopes: []
  });
});

function state(status: 'free' | 'active' | 'expired' | 'representative_payment_failed') {
  return subscriptionStateSchema.parse({
    plan: status === 'active' ? 'premium' : 'free',
    status,
    offerId: status === 'active' ? 'premium-annual' : 'free',
    catalogVersion: '2026-01',
    startedAt: status === 'active' ? 1 : null,
    trialEndsAt: null,
    renewsAt: status === 'active' ? 2 : null,
    accessEndsAt: status === 'expired' ? 2 : null,
    limits: {},
    version: 1,
    paidContentAccess: ['expired', 'representative_payment_failed'].includes(status) ? 'read_only' : 'editable',
    updatedAt: 1
  });
}
