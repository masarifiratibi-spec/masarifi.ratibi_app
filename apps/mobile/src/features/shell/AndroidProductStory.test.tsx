import { emptyTransactionFilters } from '@/domain/core-finance';
import { createNotificationPreferences, type NotificationEvent, type NotificationPreferences } from '@/domain/notifications';
import { buildFinancialReport, resolveReportPeriod } from '@/domain/reports';
import { createMockAssistantService } from '@/services/mocks/assistant-service';
import { createMockAssistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { createMockAuthService } from '@/services/mocks/auth-service';
import { createMockAutomaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { createMockFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { AutomaticTrackingRepository } from '@/storage/automatic-tracking-repository';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { FinancialPlanningRepository } from '@/storage/financial-planning-repository';
import { makeMockEvent } from '@/test-utils/automatic-tracking-fixtures';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { financialPlanningSeed, fixtureBudget, fixtureObligation } from '@/test-utils/financial-planning-fixtures';
import { frontendQualityScenarios } from '@/test-utils/frontend-quality-scenarios';

it('completes the Android automatic-capture product story without raw SMS leakage', async () => {
  const scenario = frontendQualityScenarios.find((item) => item.id === 'automatic-event');
  expect(scenario?.disposableProfileId).toBe('spec010-disposable');

  const auth = createMockAuthService({ now: () => scenario!.clock });
  const started = await auth.startPhone({ phoneValue: '+966500000000', countryCode: 'SA' });
  await expect(auth.verifyPhone({ sessionId: started.sessionId, code: '000000' })).resolves.toMatchObject({
    status: 'authenticated'
  });

  const notifications = inMemoryNotificationRepository();
  const financeRepository = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: []
  });
  const finance = createMockCoreFinanceService(financeRepository);
  const notificationService = createMockAssistantNotificationsService({
    repository: notifications,
    now: () => scenario!.clock,
    executeOwnerAction: async ({ target }) => {
      if (target.kind !== 'transaction') throw new Error('owner_action_unavailable');
      await finance.deleteTransaction(target.transactionId);
    }
  });
  const tracking = createMockAutomaticTrackingService({
    repository: new AutomaticTrackingRepository(),
    financeService: finance,
    notificationService,
    platform: 'android'
  });

  expect((await tracking.getStatus()).platform).toBe('android');
  await expect(tracking.setMode('automatic_clear')).resolves.toMatchObject({
    mode: 'automatic_clear',
    permissionStatus: 'granted'
  });

  const rawSms = 'RAW_SMS_NEVER_LEAVES_OWNER Card purchase SAR 125.00 at Market';
  const clear = await tracking.processMockEvent(makeMockEvent('android-clear', { sourceText: rawSms }));
  expect(clear.feedback).toBeTruthy();
  expect(await finance.getTransaction(clear.feedback!.transactionId)).toMatchObject({
    source: 'automatic',
    status: 'posted'
  });

  const review = await tracking.processMockEvent(makeMockEvent('android-review', {
    confidenceBasisPoints: 6_000,
    sourceText: rawSms
  }));
  expect(review.feedback).toBeNull();
  expect((await tracking.listReviewItems({ status: 'pending' })).total).toBe(1);

  const planning = createMockFinancialPlanningService(new FinancialPlanningRepository(financialPlanningSeed));
  const planningSnapshot = await planning.getReportingSnapshot(resolveReportPeriod({
    kind: 'monthly',
    anchorDate: '2026-08-08',
    timeZone: 'Asia/Riyadh'
  }));
  const transactions = (await finance.listTransactions(emptyTransactionFilters, null, 20)).items;
  const report = buildFinancialReport({
    period: resolveReportPeriod({ kind: 'monthly', anchorDate: '2026-08-08', timeZone: 'Asia/Riyadh' }),
    transactions,
    categories: fixtureCategories,
    planning: planningSnapshot,
    currencyCode: 'SAR',
    generatedAt: scenario!.clock
  });

  expect((await finance.getHomeSummary('SAR')).activeAccountCount).toBe((await finance.listAccounts()).length);
  expect(transactions).toHaveLength(1);
  expect(planningSnapshot.budgets.map((item) => item.id)).toContain(fixtureBudget.id);
  expect(planningSnapshot.obligations.map((item) => item.id)).toContain(fixtureObligation.id);
  expect(report.summary.expense.value?.minorUnits).toBe(clear.event.amountMinor);

  const notification = await notifications.getNotification(`notification-tracking:${clear.event.id}:auto-added`);
  expect(JSON.stringify(notification)).not.toContain(rawSms);
  expect(notification.target).toMatchObject({ kind: 'transaction', transactionId: clear.feedback!.transactionId });

  const assistant = createMockAssistantService();
  await assistant.setConsent(true, 1, 'android-consent');
  const explanation = await assistant.createConversation({ question: 'Why did this transaction change?' }, 'android-explain');
  const response = (await assistant.getConversation(explanation.value.id)).responses.items[0];
  expect(response.responseType).toBe('explanation');
  expect(JSON.stringify(response)).not.toContain(rawSms);

  await notificationService.executeAction(notification.id, 'undo', 'android-undo');
  expect((await finance.getTransaction(clear.feedback!.transactionId)).status).toBe('deleted');
  await expect(notificationService.executeAction(notification.id, 'undo', 'android-undo')).resolves.toMatchObject({
    value: { id: notification.id }
  });
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
