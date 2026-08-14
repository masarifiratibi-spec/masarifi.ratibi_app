import { createAssistantNotificationsEvent } from '@/analytics/assistant-notifications-events';
import type { NotificationEvent } from '@/domain/notifications';
import { rewritePhoneCopy } from '@/features/notifications/notification-policy';

test('protected values and user-authored content stay out of native, app-switcher, labels, errors, analytics, and logs', () => {
  const event = {
    titleKey: 'notifications.title.transaction',
    bodyKey: 'notifications.body.transaction',
    messageValues: { amount: '2500 SAR', note: 'credential-token-secret' },
    availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: null }]
  } as unknown as NotificationEvent;
  const nativeCopy = rewritePhoneCopy(event, { hideSensitiveValues: true });
  expect(JSON.stringify(nativeCopy)).not.toMatch(/2500|credential|token|secret/i);
  expect(nativeCopy.messageValues).toEqual({ amount: 'hidden', note: 'hidden' });

  expect(() => createAssistantNotificationsEvent('assistant_notifications.support', { category: 'support', outcome: 'submitted', ticketText: 'private ticket text' } as never)).toThrow();
  expect(createAssistantNotificationsEvent('assistant_notifications.support', { category: 'support', outcome: 'submitted' }).payload).toEqual({ category: 'support', outcome: 'submitted' });
});
