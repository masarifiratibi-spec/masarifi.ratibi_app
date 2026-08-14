import {
  createNotificationPreferences,
  notificationPolicyResultSchema,
  type NotificationEvent
} from '@/domain/notifications';

import { decideNotificationPolicy, rewritePhoneCopy } from './notification-policy';

const basePreferences = {
  ...createNotificationPreferences(Date.UTC(2026, 0, 1)),
  phoneEnabled: true,
  permissionState: 'granted' as const
};

function event(patch: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'notification-1',
    eventKey: 'event-1',
    category: 'transaction',
    eventType: 'automatic_expense',
    titleKey: 'notifications.transaction.recorded.title',
    bodyKey: 'notifications.transaction.recorded.body',
    messageValues: { amount: '١٢٥٫٠٠ ر.س', merchant: 'Market' },
    sensitivity: 'protected',
    target: { kind: 'transaction', transactionId: 'transaction-1' },
    availableActions: [
      { kind: 'view', expiresAt: null, sourceVersion: 1 },
      { kind: 'undo', expiresAt: Date.UTC(2026, 0, 2), sourceVersion: 1 }
    ],
    occurredAt: Date.UTC(2026, 0, 1, 20),
    readAt: null,
    deletedAt: null,
    phoneStatus: 'not_requested',
    syncStatus: 'synced',
    safeFailure: null,
    ...patch
  };
}

it('keeps in-app history while suppressing disabled categories, phone delivery, and denied permission states', () => {
  expect(decideNotificationPolicy({ event: event({ category: 'income' }), preferences: { ...basePreferences, categoryEnabled: { ...basePreferences.categoryEnabled, income: false } }, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false }).outcome).toBe('suppress_category');
  expect(decideNotificationPolicy({ event: event(), preferences: { ...basePreferences, phoneEnabled: false }, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false }).outcome).toBe('suppress_phone_disabled');
  for (const permission of ['not_requested', 'denied', 'permanently_denied', 'unavailable'] as const) {
    expect(decideNotificationPolicy({ event: event(), preferences: basePreferences, permission, now: Date.UTC(2026, 0, 1), hideBalances: false })).toMatchObject({ inApp: true, outcome: 'suppress_permission' });
  }
});

it('defers quiet-hour events across midnight, except the three critical access events', () => {
  const preferences = {
    ...basePreferences,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
      weekdays: [4],
      timeZone: 'Asia/Riyadh'
    }
  };
  const now = Date.UTC(2026, 0, 1, 20, 30);
  const afterMidnight = Date.UTC(2026, 0, 1, 22, 30);

  expect(decideNotificationPolicy({ event: event(), preferences, permission: 'granted', now, hideBalances: false }).outcome).toBe('defer_quiet_hours');
  expect(decideNotificationPolicy({ event: event(), preferences, permission: 'granted', now: afterMidnight, hideBalances: false }).outcome).toBe('defer_quiet_hours');
  expect(decideNotificationPolicy({ event: event(), preferences: { ...preferences, quietHours: { ...preferences.quietHours, weekdays: [5] } }, permission: 'granted', now: afterMidnight, hideBalances: false }).outcome).toBe('present_local');
  for (const eventType of ['new_session', 'session_revoked', 'access_protection_changed']) {
    expect(decideNotificationPolicy({ event: event({ category: 'security', eventType }), preferences, permission: 'granted', now, hideBalances: false }).outcome).toBe('present_local');
  }
  expect(decideNotificationPolicy({ event: event({ category: 'security', eventType: 'permission_changed' }), preferences, permission: 'granted', now, hideBalances: false }).outcome).toBe('defer_quiet_hours');
});

it('deduplicates summary items and applies global masking before native copy and accessibility text', () => {
  const preferences = {
    ...basePreferences,
    hideAmountsOnLockScreen: false,
    dailySummary: { enabled: true, time: '09:00' }
  };

  expect(decideNotificationPolicy({ event: event(), preferences, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false, summaryWindow: 'daily' }).outcome).toBe('include_daily_summary');
  expect(decideNotificationPolicy({ event: event(), preferences: { ...preferences, weeklySummary: { enabled: true, weekday: 4, time: '09:00' } }, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false, summaryWindow: 'weekly' }).outcome).toBe('include_weekly_summary');
  expect(decideNotificationPolicy({ event: event(), preferences, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false, summaryWindow: 'daily', summarizedEventKeys: ['event-1'] })).toMatchObject({ outcome: 'include_daily_summary', deduplicated: true });
  expect(() => notificationPolicyResultSchema.parse(decideNotificationPolicy({ event: event(), preferences, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false }))).not.toThrow();
  expect(decideNotificationPolicy({ event: event({ sensitivity: 'public' }), preferences, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: true })).toMatchObject({ outcome: 'present_local', hideSensitiveValues: true });
  expect(decideNotificationPolicy({ event: event(), preferences: { ...preferences, hideAmountsOnLockScreen: true }, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false, summaryWindow: 'weekly' })).toMatchObject({ outcome: 'present_local', hideSensitiveValues: true });
  expect(decideNotificationPolicy({ event: event({ sensitivity: 'security_sensitive' }), preferences, permission: 'granted', now: Date.UTC(2026, 0, 1), hideBalances: false })).toMatchObject({ outcome: 'suppress_private', hideSensitiveValues: true });

  const copy = rewritePhoneCopy(event(), { hideSensitiveValues: true });
  expect(JSON.stringify(copy)).not.toContain('١٢٥');
  expect(copy.titleKey).toBe('notifications.transaction.recorded.title');
  expect(copy.bodyKey).toBe('notifications.transaction.recorded.body');
  expect(copy.accessibilityLabelKey).toBe('notifications.transaction.recorded.body');
  expect(copy.actionLabelKeys).toEqual(['notifications.actions.view', 'notifications.actions.undo']);
});
