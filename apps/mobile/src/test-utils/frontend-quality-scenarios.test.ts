import { frontendQualityScenarios, requiredScenarioCoverage } from './frontend-quality-scenarios';

const requiredNames = [
  'new',
  'empty',
  'typical',
  'multi-account',
  'salary-present',
  'salary-absent',
  'budget-within',
  'budget-near',
  'budget-over',
  'debt-installment-overdue',
  'savings-active',
  'savings-completed',
  'automatic-event',
  'voice-event',
  'manual-event',
  'duplicate-event',
  'failed-event',
  'refund-event',
  'salary-event',
  'installment-event',
  'low-confidence',
  'assistant-insight',
  'report-delivery-success',
  'report-delivery-failure',
  'permission-denied',
  'offline',
  'pending',
  'conflict',
  'stale',
  'disabled',
  'read-only',
  'dense',
  'recovery'
];

describe('frontend quality scenarios', () => {
  it('covers every required named profile with stable IDs, clocks, density, and expected states', () => {
    expect(requiredScenarioCoverage).toEqual(requiredNames);
    expect(new Set(frontendQualityScenarios.map((item) => item.id)).size).toBe(frontendQualityScenarios.length);
    expect(frontendQualityScenarios).toHaveLength(requiredNames.length);
    for (const scenario of frontendQualityScenarios) {
      expect(requiredNames).toContain(scenario.id);
      expect(scenario.disposableProfileId).toMatch(/^spec010-/);
      expect(Number.isFinite(scenario.clock)).toBe(true);
      expect(['empty', 'typical', 'dense']).toContain(scenario.density.kind);
      expect(scenario.expectedRoutes.length).toBeGreaterThan(0);
      expect(scenario.expectedStates.length).toBeGreaterThan(0);
    }
    expect(frontendQualityScenarios.find((item) => item.id === 'dense')?.density).toMatchObject({
      kind: 'dense',
      counts: {
      transactions: expect.any(Number),
      notifications: expect.any(Number)
      }
    });
  });

  it('keeps cross-domain fixture relationships valid', () => {
    for (const scenario of frontendQualityScenarios) {
      const accountIds = new Set(scenario.records.accounts.map((item) => item.id));
      const categoryIds = new Set(scenario.records.categories.map((item) => item.id));
      const transactionIds = new Set(scenario.records.transactions.map((item) => item.id));
      const budgetIds = new Set(scenario.records.budgets.map((item) => item.id));
      const obligationIds = new Set(scenario.records.obligations.map((item) => item.id));
      const reportIds = new Set(scenario.records.reports.map((item) => item.id));
      const notificationTargetIds = new Set(
        scenario.records.notifications.map((item) => item.targetId).filter((item): item is string => Boolean(item))
      );
      const assistantEvidenceIds = new Set(scenario.records.assistantEvidence.map((item) => item.sourceId));
      const subscriptionOperationIds = new Set(scenario.records.subscriptionOperations.map((item) => item.id));
      const ticketIds = new Set(scenario.records.supportTickets.map((item) => item.id));

      for (const transaction of scenario.records.transactions) {
        expect(accountIds.has(transaction.accountId)).toBe(true);
        if (transaction.categoryId) expect(categoryIds.has(transaction.categoryId)).toBe(true);
      }
      for (const budget of scenario.records.budgets) {
        expect(budgetIds.has(budget.id)).toBe(true);
      }
      for (const obligation of scenario.records.obligations) {
        if (obligation.fundingAccountId) expect(accountIds.has(obligation.fundingAccountId)).toBe(true);
      }
      for (const payment of scenario.records.obligationPayments) {
        expect(obligationIds.has(payment.obligationId)).toBe(true);
        expect(transactionIds.has(payment.transactionId)).toBe(true);
      }
      for (const reportSource of scenario.records.reportSources) {
        expect(reportIds.has(reportSource.reportId)).toBe(true);
        expect(transactionIds.has(reportSource.transactionId)).toBe(true);
      }
      for (const targetId of notificationTargetIds) {
        expect(transactionIds.has(String(targetId)) || budgetIds.has(String(targetId)) || obligationIds.has(String(targetId))).toBe(true);
      }
      for (const sourceId of assistantEvidenceIds) {
        expect(reportIds.has(sourceId) || transactionIds.has(sourceId) || notificationTargetIds.has(sourceId)).toBe(true);
      }
      expect(subscriptionOperationIds.size).toBe(scenario.records.subscriptionOperations.length);
      for (const reply of scenario.records.supportReplies) {
        expect(ticketIds.has(reply.ticketId)).toBe(true);
      }
    }
  });
});
