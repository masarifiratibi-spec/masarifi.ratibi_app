import type { ExchangeRateEstimate, SyncConflict } from '@/domain/core-finance';
import {
  createDefaultCategories,
  defaultCategorySeeds,
  legacyFixtureAccounts,
  legacyFixtureTransactions,
  makeLegacyFixtureTransaction
} from '@/domain/core-finance-seeds';

const FIXTURE_NOW = Date.UTC(2026, 7, 8, 12);

export { defaultCategorySeeds };

export const fixtureCategories = createDefaultCategories();
export const fixtureAccounts = legacyFixtureAccounts;
export const makeTransaction = makeLegacyFixtureTransaction;
export const fixtureTransactions = legacyFixtureTransactions;

export const fixtureRates: ExchangeRateEstimate[] = [
  {
    baseCurrencyCode: 'SAR',
    quoteCurrencyCode: 'SAR',
    rate: 1,
    asOf: FIXTURE_NOW,
    status: 'available'
  },
  {
    baseCurrencyCode: 'SAR',
    quoteCurrencyCode: 'USD',
    rate: 3.75,
    asOf: FIXTURE_NOW,
    status: 'available'
  }
];

export function makeConflict(
  transaction = fixtureTransactions[0]
): SyncConflict {
  return {
    id: `conflict-${transaction.id}`,
    transactionId: transaction.id,
    localSnapshot: { ...transaction, title: 'Local title', version: 2 },
    laterSnapshot: { ...transaction, title: 'Later title', version: 2 },
    resolution: null,
    status: 'pending',
    createdAt: FIXTURE_NOW,
    resolvedAt: null
  };
}

export type CoreFinanceScenario =
  | 'empty'
  | 'partial'
  | 'multi_currency'
  | 'archived'
  | 'offline'
  | 'conflict'
  | 'large';

export function makeCoreFinanceScenario(scenario: CoreFinanceScenario) {
  if (scenario === 'empty')
    return {
      accounts: [],
      categories: fixtureCategories,
      transactions: [],
      conflicts: []
    };
  if (scenario === 'partial')
    return {
      accounts: fixtureAccounts.slice(0, 2),
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 3),
      conflicts: []
    };
  if (scenario === 'multi_currency')
    return {
      accounts: fixtureAccounts.slice(0, 3),
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 10),
      conflicts: []
    };
  if (scenario === 'archived')
    return {
      accounts: fixtureAccounts,
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 10),
      conflicts: []
    };
  if (scenario === 'offline')
    return {
      accounts: fixtureAccounts.slice(0, 3),
      categories: fixtureCategories,
      transactions: fixtureTransactions
        .slice(0, 10)
        .map((transaction) => ({
          ...transaction,
          syncStatus: 'pending' as const
        })),
      conflicts: []
    };
  if (scenario === 'conflict')
    return {
      accounts: fixtureAccounts.slice(0, 3),
      categories: fixtureCategories,
      transactions: fixtureTransactions.slice(0, 10),
      conflicts: [makeConflict()]
    };
  return {
    accounts: fixtureAccounts,
    categories: fixtureCategories,
    transactions: fixtureTransactions,
    conflicts: []
  };
}
