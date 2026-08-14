import {
  createNotificationPreferences,
  notificationEventSchema,
  notificationTargetSchema,
  tombstoneNotification,
  isDuplicateEventKey,
  notificationActionResolutionSchema,
  notificationPolicyInputSchema,
  notificationPolicyResultSchema
} from './notifications';

const target = { kind: 'transaction', transactionId: 'tx-1' } as const;

test('accepts unique event keys and typed safe targets only', () => {
  expect(notificationTargetSchema.safeParse(target).success).toBe(true);
  expect(notificationTargetSchema.safeParse({ kind: 'transaction', href: '/transactions?amount=1' }).success).toBe(false);
  expect(notificationEventSchema.safeParse({ id: 'n-1', eventKey: 'tx:1', category: 'transaction', eventType: 'created', titleKey: 'n.title', bodyKey: 'n.body', messageValues: {}, sensitivity: 'protected', target, availableActions: [], occurredAt: 1, readAt: null, deletedAt: null, phoneStatus: 'not_requested', syncStatus: 'synced', safeFailure: null }).success).toBe(true);
});

test('uses delete-only tombstones, action expiry/version, safe failures, and private defaults', () => {
  const preferences = createNotificationPreferences(1);
  expect(preferences.hideAmountsOnLockScreen).toBe(true);
  expect(preferences.phoneEnabled).toBe(false);
  expect(notificationEventSchema.safeParse({ id: 'n-2', eventKey: 'tx:2', category: 'transaction', eventType: 'created', titleKey: 'n.title', bodyKey: 'n.body', messageValues: {}, sensitivity: 'public', target: null, availableActions: [{ kind: 'undo', expiresAt: 2, sourceVersion: 1 }], occurredAt: 1, readAt: null, deletedAt: 2, phoneStatus: 'failed_mock', syncStatus: 'failed', safeFailure: 'offline' }).success).toBe(true);
});

test('rejects undo without expiry and source version, deduplicates keys, and never deletes a source', () => {
  expect(notificationEventSchema.safeParse({ id: 'n-3', eventKey: 'tx:3', category: 'transaction', eventType: 'created', titleKey: 'n.title', bodyKey: 'n.body', messageValues: {}, sensitivity: 'public', target, availableActions: [{ kind: 'undo', expiresAt: null, sourceVersion: null }], occurredAt: 1, readAt: null, deletedAt: null, phoneStatus: 'not_requested', syncStatus: 'synced', safeFailure: null }).success).toBe(false);
  expect(isDuplicateEventKey([{ eventKey: 'tx:1' }], 'tx:1')).toBe(true);
  const source = { id: 'tx-3' };
  const notification = notificationEventSchema.parse({ id: 'n-4', eventKey: 'tx:4', category: 'transaction', eventType: 'created', titleKey: 'n.title', bodyKey: 'n.body', messageValues: {}, sensitivity: 'public', target, availableActions: [], occurredAt: 1, readAt: null, deletedAt: null, phoneStatus: 'not_requested', syncStatus: 'synced', safeFailure: null });
  const tombstone = tombstoneNotification(notification, source, 2);
  expect(notificationEventSchema.safeParse(tombstone.notification).success).toBe(true);
  expect(tombstone.notification).toMatchObject({ deletedAt: 2, syncStatus: 'pending' });
  expect(tombstone.source).toBe(source);
});

test('validates policy and action resolutions without arbitrary routes', () => {
  expect(notificationActionResolutionSchema.safeParse({ status: 'available', target, action: 'view' }).success).toBe(true);
  expect(notificationPolicyInputSchema.safeParse({ category: 'transaction', eventType: 'created', sensitivity: 'protected', preferences: createNotificationPreferences(1), permission: 'granted', profileTimeZone: 'Asia/Riyadh', now: 1, hideBalances: true, summaryWindow: 'none' }).success).toBe(true);
  expect(notificationPolicyResultSchema.safeParse({ outcome: 'suppress_private' }).success).toBe(true);
});
