import { emptyTransactionFilters } from '@/domain/core-finance';
import { createNotificationPreferences, type NotificationEvent, type NotificationPreferences } from '@/domain/notifications';
import { proposalToTransactionInput } from '@/domain/voice-capture';
import { createMockAssistantService } from '@/services/mocks/assistant-service';
import { createMockAssistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { createMockAuthService } from '@/services/mocks/auth-service';
import { createMockAutomaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { createMockVoiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { resolveTrackingRouteCapability } from '@/features/tracking/tracking-route-guard';

it('uses iOS manual and voice alternatives with downstream notification, assistant, and correction outcomes', async () => {
  const auth = createMockAuthService({ now: () => Date.UTC(2026, 7, 8, 12) });
  await expect(auth.signInWithGoogle()).resolves.toMatchObject({ status: 'authenticated' });

  const tracking = createMockAutomaticTrackingService({ platform: 'ios' });
  expect(await tracking.getStatus()).toMatchObject({
    platform: 'ios',
    serviceState: 'unavailable',
    permissionStatus: null
  });
  expect(resolveTrackingRouteCapability('ios')).toEqual({
    platform: 'ios',
    canUseAndroidTracking: false,
    fallbackRoute: '/(onboarding)/ios-capture-options'
  });

  const finance = createMockCoreFinanceService(new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: []
  }));
  const manual = await finance.createTransaction({
    type: 'expense',
    amountMinor: 5_500,
    currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id,
    destinationAccountId: null,
    feeMinor: 0,
    categoryId: fixtureCategories[0].id,
    title: 'Manual coffee',
    merchant: 'Manual Cafe',
    occurredAt: Date.UTC(2026, 7, 8, 12),
    notes: null
  }, 'ios-manual', 'manual');

  const voice = createMockVoiceAnalyzerService();
  const group = fixtureProposalGroup({
    scenario: 'clear_en',
    sessionId: 'ios-voice',
    recordedAt: Date.UTC(2026, 7, 8, 12),
    timezoneOffsetMinutes: 0
  });
  const analyzed = await voice.analyze({
    transcript: await voice.transcribe('private://ios-voice', 'clear_en'),
    scenario: 'clear_en',
    sessionId: 'ios-voice',
    recordedAt: Date.UTC(2026, 7, 8, 12),
    timezoneOffsetMinutes: 0
  });
  expect(analyzed.proposals).toHaveLength(group.proposals.length);
  const voiceSave = await finance.createTransactionsAtomically(
    analyzed.proposals.map(proposalToTransactionInput),
    analyzed.id,
    'voice'
  );

  const notificationService = createMockAssistantNotificationsService({ repository: inMemoryNotificationRepository() });
  const notification = await notificationService.createFromSource({
    eventKey: `ios:voice:${voiceSave.value[0].id}`,
    category: 'transaction',
    eventType: 'ios.voice.saved',
    titleKey: 'notifications.voice.saved.title',
    bodyKey: 'notifications.voice.saved.body',
    messageValues: { outcome: 'saved' },
    sensitivity: 'protected',
    target: { kind: 'transaction', transactionId: voiceSave.value[0].id },
    availableActions: [{ kind: 'view', expiresAt: null, sourceVersion: 1 }],
    occurredAt: Date.UTC(2026, 7, 8, 12)
  });

  const assistant = createMockAssistantService();
  await assistant.setConsent(true, 1, 'ios-consent');
  const explanation = await assistant.createConversation({ question: 'Why did this change?' }, 'ios-explain');

  expect((await finance.listTransactions(emptyTransactionFilters, null, 20)).items.map((item) => item.source).sort()).toEqual([
    'manual',
    'voice'
  ]);
  expect(notification.target).toMatchObject({ kind: 'transaction', transactionId: voiceSave.value[0].id });
  expect((await assistant.getConversation(explanation.value.id)).responses.items[0].responseType).toBe('explanation');

  await finance.deleteTransaction(manual.value.id);
  await finance.undoDelete(manual.value.id);
  expect((await finance.getTransaction(manual.value.id)).status).toBe('posted');

  const serialized = JSON.stringify({ notification, explanation });
  expect(serialized).not.toMatch(/sms|android sms|direct-sms/i);
});

function inMemoryNotificationRepository() {
  let preferences: NotificationPreferences | null = createNotificationPreferences(1);
  const notifications = new Map<string, NotificationEvent>();
  return {
    async getNotification(id: string) {
      const item = notifications.get(id);
      if (!item) throw new Error('not_found');
      return item;
    },
    async getNotificationPreferences() {
      if (!preferences) throw new Error('not_found');
      return preferences;
    },
    async listNotifications() {
      return { items: [...notifications.values()], nextCursor: null, total: notifications.size };
    },
    async markAllNotificationsRead() {
      return 0;
    },
    async markNotificationRead(id: string, readAt: number | null) {
      const item = await this.getNotification(id);
      const next = { ...item, readAt };
      notifications.set(id, next);
      return next;
    },
    async saveNotification(event: NotificationEvent) {
      const existing = [...notifications.values()].find((item) => item.eventKey === event.eventKey);
      if (existing) return existing;
      notifications.set(event.id, event);
      return event;
    },
    async saveNotificationPreferences(value: NotificationPreferences) {
      preferences = value;
      return value;
    },
    async tombstoneNotification(id: string, deletedAt: number) {
      const item = await this.getNotification(id);
      const next = { ...item, deletedAt };
      notifications.set(id, next);
      return next;
    },
    async updateNotificationPhoneStatus(id: string, patch: Partial<NotificationEvent>) {
      const item = await this.getNotification(id);
      const next = { ...item, ...patch };
      notifications.set(id, next);
      return next;
    },
    async upsertNotification(event: NotificationEvent) {
      notifications.set(event.id, event);
      return event;
    }
  };
}
