import { emptyTransactionFilters } from '@/domain/core-finance';
import { createMockCoreFinanceService } from '@/services/mocks/core-finance-service';
import { createMockFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { createMockAssistantNotificationsService } from '@/services/mocks/assistant-notifications-service';
import { ReportsRepository } from '@/storage/reports-repository';
import { resolveReportPeriod } from '@/domain/reports';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { FinancialPlanningRepository } from '@/storage/financial-planning-repository';
import { createNotificationPreferences, type NotificationEvent, type NotificationPreferences } from '@/domain/notifications';
import {
  fixtureAccounts,
  fixtureCategories,
  makeConflict,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import {
  financialPlanningSeed,
  fixtureBudget,
  fixtureObligation
} from '@/test-utils/financial-planning-fixtures';

it('keeps representative finance, planning, assistant, reports, undo, and conflict projections aligned', async () => {
  const financeRepository = new CoreFinanceRepository({
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: [makeTransaction(2)]
  });
  const planningRepository = new FinancialPlanningRepository(financialPlanningSeed);
  const finance = createMockCoreFinanceService(financeRepository);
  const planning = createMockFinancialPlanningService(planningRepository);
  const assistant = createMockAssistantNotificationsService({
    repository: inMemoryNotificationRepository()
  });
  const reports = new ReportsRepository();

  const manual = await finance.createTransaction(toInput(makeTransaction(44)), 'op-manual');
  const manualReplay = await finance.createTransaction(toInput(makeTransaction(44)), 'op-manual');
  expect(manualReplay.value).toEqual(manual.value);

  const paymentPreview = await planning.previewObligationPayment({
    obligationId: fixtureObligation.id,
    amountMinor: 2_000_00,
    currencyCode: 'SAR',
    paidDate: '2026-01-25',
    source: 'manual',
    transaction: { kind: 'link', transactionId: manual.value.id }
  });
  const payment = await planning.confirmObligationPayment(
    paymentPreview.previewId,
    { allocations: paymentPreview.allocations, intent: 'current' },
    'op-payment'
  );
  expect(payment.value.payment.transactionId).toBe(manual.value.id);

  const notification = await assistant.createFromSource({
    eventKey: `manual:${manual.value.id}`,
    eventType: 'created',
    category: 'transaction',
    titleKey: 'notifications.manual.saved.title',
    bodyKey: 'notifications.manual.saved.body',
    messageValues: { outcome: 'saved' },
    sensitivity: 'protected',
    target: { kind: 'transaction', transactionId: manual.value.id },
    availableActions: [],
    occurredAt: 1
  });
  expect(notification.target).toMatchObject({ transactionId: manual.value.id });

  expect((await reports.listAttempts()).map((item) => item.id)).toEqual([]);
  const deleted = await finance.deleteTransaction(manual.value.id);
  await finance.undoDelete(manual.value.id);
  expect((await finance.getTransaction(manual.value.id)).status).toBe('posted');
  expect(deleted.undoExpiresAt).toEqual(expect.any(Number));

  const conflict = makeConflict(financeRepository.requireTransaction(manual.value.id));
  financeRepository.addConflict(conflict);
  await finance.resolveConflict(conflict.id, 'keep_later');
  expect(financeRepository.requireConflict(conflict.id).status).toBe('resolved');

  const planningSnapshot = await planning.getReportingSnapshot(
    resolveReportPeriod({ kind: 'monthly', anchorDate: '2026-01-15', timeZone: 'Asia/Riyadh' })
  );
  const transactions = await finance.listTransactions(emptyTransactionFilters, null, 20);
  expect(transactions.items.map((item) => item.id)).toContain(manual.value.id);
  expect(planningSnapshot.budgets.map((budget) => budget.id)).toContain(fixtureBudget.id);
  expect(planningSnapshot.obligationPayments.map((item) => item.transactionId)).toContain(manual.value.id);
});

function toInput(transaction: ReturnType<typeof makeTransaction>) {
  return {
    accountId: transaction.accountId,
    amountMinor: transaction.amountMinor,
    categoryId: transaction.categoryId,
    currencyCode: transaction.currencyCode,
    destinationAccountId: transaction.destinationAccountId,
    feeMinor: transaction.feeMinor,
    merchant: transaction.merchant,
    notes: transaction.notes,
    occurredAt: transaction.occurredAt,
    title: transaction.title,
    type: transaction.type
  };
}

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
    async updateNotificationPhoneStatus(id: string, patch: Pick<NotificationEvent, 'phoneStatus' | 'syncStatus' | 'safeFailure'>) {
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
