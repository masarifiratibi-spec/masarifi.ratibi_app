import { sanitizeReportAnalyticsPayload } from './report-events';

test('report analytics reject sensitive financial payload fields', () => {
  expect(
    sanitizeReportAnalyticsPayload({
      period: 'monthly',
      amountMinor: 100,
      recipientEmail: 'x@example.com',
      outcome: 'sent'
    })
  ).toEqual({ period: 'monthly', outcome: 'sent' });
});
