import type { Account, Category, Transaction } from '@/domain/core-finance';
import type {
  Budget,
  Obligation,
  ObligationPayment
} from '@/domain/financial-planning';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from './core-finance-fixtures';
import {
  financialPlanningSeed,
  fixturePayment
} from './financial-planning-fixtures';
import {
  makeAssistantResponse,
  makeNotificationEvent,
  oneThousandNotificationEvents
} from './assistant-notifications-fixtures';

export const requiredScenarioCoverage = [
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
] as const;

export type FrontendQualityScenarioId = (typeof requiredScenarioCoverage)[number];

type Density =
  | { kind: 'empty' }
  | { kind: 'typical'; counts: { transactions: number; notifications: number } }
  | { kind: 'dense'; counts: { transactions: number; notifications: number } };

export type FrontendQualityScenario = {
  id: FrontendQualityScenarioId;
  descriptionKey: string;
  disposableProfileId: `spec010-${string}`;
  clock: number;
  density: Density;
  expectedRoutes: readonly string[];
  expectedStates: readonly string[];
  records: ScenarioRecords;
};

type ScenarioRecords = {
  accounts: readonly Account[];
  categories: readonly Category[];
  transactions: readonly Transaction[];
  budgets: readonly Budget[];
  obligations: readonly Obligation[];
  obligationPayments: readonly ObligationPayment[];
  reports: readonly { id: string }[];
  reportSources: readonly { reportId: string; transactionId: string }[];
  notifications: readonly { id: string; targetId: string | null }[];
  assistantEvidence: readonly { sourceId: string }[];
  subscriptionOperations: readonly { id: string }[];
  supportTickets: readonly { id: string }[];
  supportReplies: readonly { ticketId: string }[];
};

const clock = Date.UTC(2026, 0, 15, 12);
const report = { id: 'report-0' };
const paymentTransaction: Transaction = {
  ...fixtureTransactions[0],
  id: fixturePayment.transactionId,
  accountId: fixtureAccounts[0].id,
  categoryId: fixtureCategories[0].id
};

function records(id: FrontendQualityScenarioId): ScenarioRecords {
  const empty = id === 'new' || id === 'empty';
  const dense = id === 'dense';
  const transactions = empty
    ? []
    : dense
      ? [
          ...Array.from({ length: 999 }, (_, index) => makeTransaction(index)),
          paymentTransaction
        ]
      : [...fixtureTransactions.slice(0, 12), paymentTransaction];
  const notification = makeNotificationEvent(1);
  const response = makeAssistantResponse(0);
  const assistantEvidence = [report.id, response.snapshot.reportReference]
    .filter((sourceId): sourceId is string => Boolean(sourceId))
    .map((sourceId) => ({ sourceId }));
  return {
    accounts: empty ? [] : fixtureAccounts,
    categories: fixtureCategories,
    transactions,
    budgets: empty ? [] : financialPlanningSeed.budgets,
    obligations: empty ? [] : financialPlanningSeed.obligations,
    obligationPayments: empty ? [] : financialPlanningSeed.payments,
    reports: empty ? [] : [report],
    reportSources: empty ? [] : [{ reportId: report.id, transactionId: transactions[0].id }],
    notifications: empty
      ? []
      : dense
        ? oneThousandNotificationEvents.map((item, index) => ({
            id: item.id,
            targetId: transactions[index % transactions.length].id
          }))
        : [{ id: notification.id, targetId: transactions[0].id }],
    assistantEvidence: empty ? [] : assistantEvidence,
    subscriptionOperations: empty ? [] : [{ id: `subscription-operation-${id}` }],
    supportTickets: empty ? [] : [{ id: `support-ticket-${id}` }],
    supportReplies: empty ? [] : [{ ticketId: `support-ticket-${id}` }]
  };
}

export const frontendQualityScenarios: readonly FrontendQualityScenario[] =
  requiredScenarioCoverage.map((id) => {
    const scenarioRecords = records(id);
    const density: Density =
      id === 'dense'
        ? {
            kind: 'dense',
            counts: {
              transactions: scenarioRecords.transactions.length,
              notifications: scenarioRecords.notifications.length
            }
          }
        : id === 'new' || id === 'empty'
          ? { kind: 'empty' }
          : {
              kind: 'typical',
              counts: {
                transactions: scenarioRecords.transactions.length,
                notifications: scenarioRecords.notifications.length
              }
            };
    return {
      id,
      descriptionKey: `frontendQuality.scenarios.${id}.description`,
      disposableProfileId: 'spec010-disposable',
      clock,
      density,
      expectedRoutes: routesFor(id),
      expectedStates: statesFor(id),
      records: scenarioRecords
    };
  });

function routesFor(id: FrontendQualityScenarioId): readonly string[] {
  if (id === 'permission-denied') return ['/tracking/status'];
  if (id === 'assistant-insight') return ['/assistant'];
  if (id.startsWith('report')) return ['/reports'];
  if (id.includes('saving')) return ['/savings'];
  if (id.includes('debt') || id.includes('installment')) return ['/obligations'];
  return ['/(tabs)', '/transactions'];
}

function statesFor(id: FrontendQualityScenarioId): readonly string[] {
  if (id === 'new' || id === 'empty') return ['empty'];
  if (id === 'offline') return ['offline'];
  if (id === 'pending') return ['pending'];
  if (id === 'conflict') return ['conflict'];
  if (id === 'disabled') return ['disabled'];
  if (id === 'read-only') return ['read-only'];
  if (id === 'stale') return ['stale'];
  if (id === 'recovery') return ['error', 'retry'];
  return ['success'];
}
