import ar from './messages/ar';
import en from './messages/en';

const arMessages = ar as Record<string, string>;
const enMessages = en as Record<string, string>;

const requiredKeys = [
  'assistantNotifications.notification.loading',
  'assistantNotifications.notification.empty',
  'assistantNotifications.notification.offline',
  'assistantNotifications.notification.permission',
  'assistantNotifications.notification.deletedTarget',
  'assistantNotifications.assistant.stale',
  'assistantNotifications.assistant.actionExpired',
  'assistantNotifications.subscription.limit',
  'assistantNotifications.settings.disabled',
  'assistantNotifications.support.failed',
  'assistantNotifications.recovery.retry',
  'assistantNotifications.privacy.hidden',
  'assistantNotifications.mixedDirection.example'
] as const;

test('SPEC-009 assistant notification messages have Arabic and English parity with genuine localized values', () => {
  expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());

  for (const key of requiredKeys) {
    expect(enMessages[key]).toEqual(expect.any(String));
    expect(arMessages[key]).toEqual(expect.any(String));
    expect(arMessages[key]).toMatch(/[\u0600-\u06FF]/);
    expect(enMessages[key]).not.toMatch(/[\u0600-\u06FF]/);
  }
});

test('SPEC-009 messages keep English numerals and isolate mixed-direction examples', () => {
  expect(enMessages['assistantNotifications.subscription.limit']).toMatch(/[0-9]/);
  expect(arMessages['assistantNotifications.subscription.limit']).toMatch(/[0-9]/);
  expect(enMessages['assistantNotifications.mixedDirection.example']).toContain('\u2068');
  expect(arMessages['assistantNotifications.mixedDirection.example']).toContain('\u2068');
});
