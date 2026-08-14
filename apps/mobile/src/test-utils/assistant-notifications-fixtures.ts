import { createImmutableSnapshot, type AssistantResponse } from '@/domain/assistant';
import type { NotificationEvent } from '@/domain/notifications';
import type { RepresentativeSession, SecurityEvent } from '@/domain/settings';
import type { SubscriptionOfferCatalog } from '@/domain/subscriptions';
import type { SupportArticle } from '@/domain/support';

export const assistantNotificationsFixtureNow = Date.UTC(2026, 0, 15, 12);

export const fixtureOfferCatalog: SubscriptionOfferCatalog = {
  version: '2026-01',
  offers: [
    { offerId: 'free', plan: 'free', billingPeriod: 'none', priceMinor: 0, currency: 'SAR', features: ['core_finance'], limits: { assistantQuestions: 0 }, trial: { eligible: false, durationDays: 0, trialPriceMinor: 0, postTrialPriceMinor: 0 }, renewalTermsKey: 'subscriptions.free.renewal', cancellationTermsKey: 'subscriptions.free.cancellation', catalogVersion: '2026-01', effectiveAt: assistantNotificationsFixtureNow },
    { offerId: 'basic-monthly', plan: 'basic', billingPeriod: 'monthly', priceMinor: 1900, currency: 'SAR', features: ['assistant'], limits: { assistantQuestions: 30 }, trial: { eligible: true, durationDays: 7, trialPriceMinor: 0, postTrialPriceMinor: 1900 }, renewalTermsKey: 'subscriptions.basic.renewal', cancellationTermsKey: 'subscriptions.basic.cancellation', catalogVersion: '2026-01', effectiveAt: assistantNotificationsFixtureNow },
    { offerId: 'premium-annual', plan: 'premium', billingPeriod: 'annual', priceMinor: 19000, currency: 'SAR', features: ['assistant', 'reports'], limits: { assistantQuestions: 300 }, trial: { eligible: true, durationDays: 7, trialPriceMinor: 0, postTrialPriceMinor: 19000 }, renewalTermsKey: 'subscriptions.premium.renewal', cancellationTermsKey: 'subscriptions.premium.cancellation', catalogVersion: '2026-01', effectiveAt: assistantNotificationsFixtureNow }
  ]
};

export const fixtureSupportArticles: SupportArticle[] = [
  { id: 'faq-notifications', kind: 'faq', titleKey: 'support.faq.notifications.title', bodyKey: 'support.faq.notifications.body', searchTerms: ['notifications', 'alerts'], category: 'notifications', version: '2026-01', publishedAt: assistantNotificationsFixtureNow },
  { id: 'help-assistant', kind: 'help', titleKey: 'support.help.assistant.title', bodyKey: 'support.help.assistant.body', searchTerms: ['assistant', 'privacy'], category: 'assistant', version: '2026-01', publishedAt: assistantNotificationsFixtureNow },
  { id: 'whats-new-2026-01', kind: 'whats_new', titleKey: 'support.whatsNew.january.title', bodyKey: 'support.whatsNew.january.body', searchTerms: ['new', 'updates'], category: 'product', version: '2026-01', publishedAt: assistantNotificationsFixtureNow }
];

export const fixtureSessions: RepresentativeSession[] = [
  { id: 'session-current', deviceLabel: 'Current device', platform: 'android', createdAt: assistantNotificationsFixtureNow - 86_400_000, lastActiveAt: assistantNotificationsFixtureNow, isCurrentDevice: true, status: 'active' },
  { id: 'session-web', deviceLabel: 'Web browser', platform: 'web', createdAt: assistantNotificationsFixtureNow - 172_800_000, lastActiveAt: assistantNotificationsFixtureNow - 3_600_000, isCurrentDevice: false, status: 'active' }
];

export const fixtureSecurityEvents: SecurityEvent[] = [
  { id: 'security-session-1', type: 'new_session', deviceLabel: 'Web browser', platform: 'web', occurredAt: assistantNotificationsFixtureNow, status: 'succeeded', recoveryDestination: { kind: 'settings', key: 'security' } }
];

export function makeNotificationEvent(index: number): NotificationEvent {
  return {
    id: `notification-${index}`,
    eventKey: `event-${index}`,
    category: index % 2 ? 'assistant' : 'system',
    eventType: index % 2 ? 'response_ready' : 'preference_changed',
    titleKey: 'notifications.fixture.title',
    bodyKey: 'notifications.fixture.body',
    messageValues: { position: index + 1 },
    sensitivity: 'protected',
    target: index % 2 ? { kind: 'assistant', conversationId: `conversation-${index}`, responseId: `response-${index}` } : { kind: 'settings', key: 'notifications' },
    availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: null }],
    occurredAt: assistantNotificationsFixtureNow - index * 60_000,
    readAt: null,
    deletedAt: null,
    phoneStatus: 'not_requested',
    syncStatus: 'synced',
    safeFailure: null
  };
}

export function makeAssistantContext(index: number) {
  return createImmutableSnapshot({
    sources: [{ kind: 'report', id: `report-${index}`, version: 1 }],
    values: [{ key: 'fixture.value' }],
    completeness: { confirmed: 1, reviewRequired: 0, conflicts: 0, reasons: [] },
    reportReference: `report-${index}`
  });
}

export function makeAssistantResponse(index: number): AssistantResponse {
  return {
    id: `response-${index}`,
    conversationId: `conversation-${Math.floor(index / 10)}`,
    question: 'Fixture question',
    responseType: 'direct',
    blocks: [{ label: 'fact', key: 'assistant.fixture.answer', values: {} }],
    period: null,
    dataAsOf: assistantNotificationsFixtureNow - index * 60_000,
    snapshot: makeAssistantContext(index),
    limitations: [],
    proposedActionIds: [],
    feedback: null,
    createdAt: assistantNotificationsFixtureNow - index * 60_000
  };
}

export const oneThousandNotificationEvents = Array.from({ length: 1_000 }, (_, index) =>
  makeNotificationEvent(index)
);
export const oneThousandAssistantResponses = Array.from({ length: 1_000 }, (_, index) =>
  makeAssistantResponse(index)
);
