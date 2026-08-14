import {
  decideAutomaticTracking,
  detectedFinancialEventSchema,
  normalizeSender,
  transitionDetectedEvent
} from './automatic-tracking';
import { makeMockEvent, trackingFixtureNow } from '@/test-utils/automatic-tracking-fixtures';

describe('automatic tracking domain', () => {
  it('enforces confidence boundaries and safety overrides', () => {
    expect(
      decideAutomaticTracking('automatic_clear', makeMockEvent('90', { confidenceBasisPoints: 9_000 })).status
    ).toBe('auto_add');
    expect(
      decideAutomaticTracking('automatic_clear', makeMockEvent('89', { confidenceBasisPoints: 8_900 })).status
    ).toBe('review');
    expect(
      decideAutomaticTracking('automatic_clear', makeMockEvent('60', { confidenceBasisPoints: 6_000 })).status
    ).toBe('review');
    expect(
      decideAutomaticTracking('automatic_clear', makeMockEvent('59', { confidenceBasisPoints: 5_900 })).status
    ).toBe('ignore');
    expect(
      decideAutomaticTracking('automatic_clear', makeMockEvent('otp', { hasOtpSignal: true })).status
    ).toBe('reject');
  });

  it('validates source expiry, transitions, and sender normalization', () => {
    expect(normalizeSender(' MASARIFI Bank ')).toBe('masarifibank');
    expect(transitionDetectedEvent('received', 'analyzing')).toBe('analyzing');
    expect(() => transitionDetectedEvent('ignored', 'auto_added')).toThrow();
    expect(
      detectedFinancialEventSchema.safeParse({
        id: 'event',
        sourceFingerprint: 'sms:event',
        sourceKind: 'sms_mock',
        eventType: 'purchase',
        decisionStatus: 'ignored',
        confidenceBasisPoints: 5_900,
        amountMinor: 100,
        currencyCode: 'SAR',
        merchant: 'Market',
        categoryId: 'food',
        accountHint: null,
        accountId: 'account-bank',
        paymentMethod: null,
        occurredAt: trackingFixtureNow,
        sourceText: 'message',
        sourceTextExpiresAt: null,
        reasonCodes: ['low_confidence'],
        priorEventId: null,
        transactionId: null,
        obligationMatchId: null,
        createdAt: trackingFixtureNow,
        updatedAt: trackingFixtureNow
      }).success
    ).toBe(false);
  });
});
