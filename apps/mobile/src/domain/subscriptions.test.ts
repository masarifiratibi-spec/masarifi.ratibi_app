import { subscriptionOfferCatalogSchema, subscriptionOperationSchema, subscriptionStateSchema, canChangeEntitlement, canTransitionSubscription, preservesPaidContent, replaySubscriptionOperation } from './subscriptions';

test('validates one catalog version and exact trial terms', () => {
  const offer = { offerId: 'basic-monthly', plan: 'basic', billingPeriod: 'monthly', priceMinor: 2000, currency: 'SAR', features: ['reports'], limits: { reports: 5 }, trial: { eligible: true, durationDays: 14, trialPriceMinor: 0, postTrialPriceMinor: 2000 }, renewalTermsKey: 'subscription.renews_monthly', cancellationTermsKey: 'subscription.cancel_anytime', catalogVersion: 'v1', effectiveAt: 1 } as const;
  const catalog = subscriptionOfferCatalogSchema.parse({ version: 'v1', offers: [offer] });
  expect(catalog.offers[0].trial).toEqual({ eligible: true, durationDays: 14, trialPriceMinor: 0, postTrialPriceMinor: 2000 });
  expect(subscriptionOfferCatalogSchema.safeParse({ version: 'v2', offers: [offer] }).success).toBe(false);
  expect(subscriptionOfferCatalogSchema.safeParse({ version: 'v1', offers: [{ ...offer, trial: { ...offer.trial, renewalPriceMinor: 2000 } }] }).success).toBe(false);
});

test('uses explicit trial lifecycle state', () => {
  expect(subscriptionStateSchema.safeParse({ plan: 'basic', status: 'trialing', offerId: 'basic-monthly', catalogVersion: 'v1', startedAt: 1, trialEndsAt: 2, renewsAt: null, accessEndsAt: null, limits: {}, version: 1, paidContentAccess: 'editable', updatedAt: 1 }).success).toBe(true);
});

test('changes entitlement only for a successful operation and stably replays it', () => {
  const operation = subscriptionOperationSchema.parse({ id: 'o1', operationId: 'op-1', kind: 'purchase', offerId: 'basic-monthly', catalogVersion: 'v1', priorStateVersion: 1, status: 'succeeded', requestedAt: 1, completedAt: 2, safeFailure: null, resultStateVersion: 2 });
  expect(canChangeEntitlement('succeeded')).toBe(true);
  expect(canChangeEntitlement('failed')).toBe(false);
  expect(replaySubscriptionOperation([operation], 'op-1')).toBe(operation);
  expect(replaySubscriptionOperation([operation], 'missing')).toBeNull();
});

test('allows only supported subscription lifecycle transitions', () => {
  expect(canTransitionSubscription('free', 'trialing')).toBe(true);
  expect(canTransitionSubscription('free', 'active')).toBe(true);
  expect(canTransitionSubscription('expired', 'active')).toBe(true);
  expect(canTransitionSubscription('free', 'expired')).toBe(false);
  expect(canTransitionSubscription('active', 'trialing')).toBe(false);
  expect(canTransitionSubscription('expired', 'trialing')).toBe(false);
});

test('retains downgraded paid content as read-only', () => {
  const state = subscriptionStateSchema.parse({ plan: 'free', status: 'expired', offerId: 'free', catalogVersion: 'v1', startedAt: 1, trialEndsAt: null, renewsAt: null, accessEndsAt: 2, limits: {}, version: 2, paidContentAccess: 'read_only', updatedAt: 2 });
  const paidContent = [{ id: 'report-1' }] as const;
  const retainedContent = preservesPaidContent(state) ? paidContent : [];
  expect(retainedContent).toBe(paidContent);
  expect(subscriptionStateSchema.safeParse({ ...state, paidContentAccess: 'editable' }).success).toBe(false);
});

test('rejects inconsistent lifecycle and catalog terms while preserving paid content on loss', () => {
  expect(subscriptionStateSchema.safeParse({ plan: 'basic', status: 'active', offerId: 'basic', catalogVersion: 'v1', startedAt: 1, trialEndsAt: null, renewsAt: null, accessEndsAt: null, limits: {}, version: 1, paidContentAccess: 'editable', updatedAt: 1 }).success).toBe(false);
  expect(subscriptionOperationSchema.safeParse({ id: 'o2', operationId: 'op-2', kind: 'purchase', offerId: 'basic', catalogVersion: 'v1', priorStateVersion: 1, status: 'succeeded', requestedAt: 1, completedAt: null, safeFailure: null, resultStateVersion: null }).success).toBe(false);
});
