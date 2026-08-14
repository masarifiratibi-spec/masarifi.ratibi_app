import { buildSchedule, projectNextDelivery, verifyRecipient } from './reports';

test('schedule requires verified normalized email and days 1 through 28', () => {
  expect(verifyRecipient('USER@Example.COM').normalizedEmail).toBe('user@example.com');
  expect(() =>
    buildSchedule({
      recipientEmail: 'user@example.com',
      frequency: 'monthly',
      language: 'en',
      currencyCode: 'SAR',
      deliveryDay: 29,
      timeZone: 'Asia/Riyadh',
      includeAssistantSummary: false,
      detailLevel: 'summary'
    }, null)
  ).toThrow('validation');
});

test('a schedule stays verification-required until its exact recipient is verified', () => {
  const input = {
    recipientEmail: 'user@example.com',
    frequency: 'monthly' as const,
    language: 'en' as const,
    currencyCode: 'SAR',
    deliveryDay: 1,
    timeZone: 'Asia/Riyadh',
    includeAssistantSummary: false,
    detailLevel: 'summary' as const
  };

  expect(buildSchedule(input, null, 1).status).toBe('verification_required');
  expect(buildSchedule(input, null, 1, verifyRecipient(input.recipientEmail, 1)).status).toBe('active');
});

test('next delivery is projected at the next eligible 09:00 occurrence', () => {
  expect(new Date(projectNextDelivery(
    { deliveryDay: 1, frequency: 'monthly', timeZone: 'Asia/Riyadh' },
    Date.UTC(2026, 0, 1, 10)
  )).toISOString()).toBe('2026-02-01T06:00:00.000Z');
});
