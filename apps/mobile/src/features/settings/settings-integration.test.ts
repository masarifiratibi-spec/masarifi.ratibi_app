import { QueryClient } from '@tanstack/react-query';

import { createNotificationPreferences, type NotificationEvent } from '@/domain/notifications';
import { decideNotificationPolicy } from '@/features/notifications/notification-policy';
import { reportKeys, useReportInput } from '@/features/reports/report-queries';
import { usePreferenceStore } from '@/state/preferences';
import { invalidateSettingsScopes } from './settings-queries';

test('report input uses protected profile timezone instead of hard-coded Riyadh', () => {
  usePreferenceStore.setState({ timeZone: 'Europe/London' } as never);

  expect(useReportInput('monthly', '2026-01-01', 'SAR')).toMatchObject({ timeZone: 'Europe/London' });
});

test('timezone and currency changes invalidate live projections only', async () => {
  const client = new QueryClient();
  const liveKey = reportKeys.live({ kind: 'monthly', anchorDate: '2026-01-01', currencyCode: 'SAR', timeZone: 'Asia/Riyadh' });
  client.setQueryData(liveKey, { total: 1 });
  client.setQueryData(reportKeys.schedule, { unchanged: true });

  await invalidateSettingsScopes(client, ['settings.profile', 'reports.live', 'assistant.context', 'notifications.policy']);

  expect(client.getQueryState(liveKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(reportKeys.schedule)?.isInvalidated).not.toBe(true);
  client.clear();
});

test('security and application settings read the same hideBalances owner used by notification policy', () => {
  usePreferenceStore.setState({ hideBalances: true } as never);

  expect(usePreferenceStore.getState().hideBalances).toBe(true);
  expect(decideNotificationPolicy({
    event: notificationEvent(),
    preferences: {
      ...createNotificationPreferences(1),
      phoneEnabled: true,
      categoryEnabled: { transaction: true },
      quietHours: { enabled: false, start: '22:00', end: '07:00', weekdays: [1], timeZone: 'Asia/Riyadh' },
      dailySummary: { enabled: false, time: '18:00' },
      weeklySummary: { enabled: false, time: '18:00', weekday: 1 },
      hideAmountsOnLockScreen: false,
      permissionState: 'granted',
      updatedAt: 1
    },
    permission: 'granted',
    now: Date.UTC(2026, 0, 1, 12),
    hideBalances: usePreferenceStore.getState().hideBalances,
    summaryWindow: 'none'
  })).toMatchObject({ outcome: 'present_local', hideSensitiveValues: true });
});

function notificationEvent(): NotificationEvent {
  return {
    id: 'notification-1',
    eventKey: 'transaction:expense:1',
    category: 'transaction',
    eventType: 'expense_recorded',
    titleKey: 'notifications.transaction.title',
    bodyKey: 'notifications.transaction.body',
    messageValues: {},
    sensitivity: 'public',
    target: null,
    availableActions: [],
    occurredAt: 1,
    readAt: null,
    deletedAt: null,
    phoneStatus: 'not_requested',
    syncStatus: 'synced',
    safeFailure: null
  };
}
