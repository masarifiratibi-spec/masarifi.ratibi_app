import { createAppShellEvent } from './app-shell-events';
import { createAssistantNotificationsEvent } from './assistant-notifications-events';
import { sanitizeReportAnalyticsPayload } from './report-events';

const forbidden = [
  'amount',
  'balance',
  'accountId',
  'transactionText',
  'message',
  'transcript',
  'question',
  'answer',
  'supportText',
  'credential',
  'rawError'
];

test('frontend analytics constructors reject sensitive fields and freeze returned payloads', () => {
  const payload = { status: 'denied' };
  const event = createAppShellEvent('app_shell.permission', payload);
  Object.assign(payload, { status: 'granted', question: 'private question' });

  expect(event.payload).toEqual({ status: 'denied' });
  expect(() => Object.assign(event.payload, { amount: '123 SAR' })).toThrow();
  for (const key of forbidden) {
    expect(() => createAppShellEvent('app_shell.auth', { [key]: 'private' })).toThrow();
  }
});

test('assistant analytics and report analytics expose immutable allowlisted metadata only', () => {
  const assistant = createAssistantNotificationsEvent('assistant_notifications.assistant', {
    category: 'assistant',
    outcome: 'viewed'
  });
  const report = sanitizeReportAnalyticsPayload({
    period: 'monthly',
    outcome: 'sent',
    amountMinor: 100,
    accountId: 'account-private',
    rawError: 'stack'
  });

  expect(() => Object.assign(assistant.payload, { answer: 'private' })).toThrow();
  expect(report).toEqual({ period: 'monthly', outcome: 'sent' });
  expect(() => Object.assign(report, { balance: 100 })).toThrow();
});
