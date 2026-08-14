import type {
  MockFinancialEventInput,
  SenderRule
} from '@/domain/automatic-tracking';

export const trackingFixtureNow = Date.UTC(2026, 7, 8, 12);

export function makeMockEvent(
  id: string,
  overrides: Partial<MockFinancialEventInput> = {}
): MockFinancialEventInput {
  return {
    id,
    sourceFingerprint: `sms:${id}`,
    sourceKind: 'sms_mock',
    eventType: 'purchase',
    confidenceBasisPoints: 9_400,
    amountMinor: 12_500,
    currencyCode: 'SAR',
    merchant: 'Market',
    categoryId: 'food',
    accountId: 'account-bank',
    occurredAt: trackingFixtureNow,
    sourceText: 'Card purchase SAR 125.00 at Market',
    ...overrides
  };
}

export const automaticTrackingScenarios = [
  makeMockEvent('clear-90', { confidenceBasisPoints: 9_000 }),
  makeMockEvent('review-89', { confidenceBasisPoints: 8_900 }),
  makeMockEvent('review-60', { confidenceBasisPoints: 6_000 }),
  makeMockEvent('ignore-59', { confidenceBasisPoints: 5_900 }),
  makeMockEvent('failed', {
    eventType: 'failed',
    confidenceBasisPoints: 9_900
  }),
  makeMockEvent('otp', {
    hasOtpSignal: true,
    sourceText: 'Your OTP is 123456'
  }),
  makeMockEvent('duplicate', {
    duplicateTransactionId: 'transaction-7'
  }),
  makeMockEvent('obligation-review', {
    eventType: 'installment',
    obligationCandidateCount: 2
  })
];

export function makeSenderRule(
  id: string,
  overrides: Partial<SenderRule> = {}
): SenderRule {
  return {
    id,
    normalizedSender: id,
    displayLabel: id.toUpperCase(),
    institutionKey: null,
    origin: 'recognized',
    enabled: true,
    trusted: false,
    recentUseCount: 0,
    lastUsedAt: null,
    createdAt: trackingFixtureNow,
    updatedAt: trackingFixtureNow,
    ...overrides
  };
}

export const defaultSenderRules = [
  makeSenderRule('masarifi-bank', {
    displayLabel: 'Masarifi Bank',
    institutionKey: 'masarifi'
  }),
  makeSenderRule('wallet-pay', {
    displayLabel: 'Wallet Pay',
    institutionKey: 'wallet'
  })
];
