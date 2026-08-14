import type {
  Account,
  Category,
  ExchangeRateEstimate,
  SyncConflict,
  Transaction
} from '@/domain/core-finance';

const FIXTURE_NOW = Date.UTC(2026, 7, 8, 12);

export const defaultCategorySeeds = [
  ['housing', 'السكن', 'Housing'],
  ['food', 'الطعام', 'Food'],
  ['restaurants', 'المطاعم', 'Restaurants'],
  ['transportation', 'المواصلات', 'Transportation'],
  ['fuel', 'الوقود', 'Fuel'],
  ['shopping', 'التسوق', 'Shopping'],
  ['health', 'الصحة', 'Health'],
  ['education', 'التعليم', 'Education'],
  ['entertainment', 'الترفيه', 'Entertainment'],
  ['subscriptions', 'الاشتراكات الرقمية', 'Digital subscriptions'],
  ['utilities', 'الخدمات', 'Utilities'],
  ['communication', 'الاتصالات والإنترنت', 'Communication and internet'],
  ['travel', 'السفر', 'Travel'],
  ['charity', 'الصدقة', 'Charity'],
  ['fees', 'الرسوم', 'Fees'],
  ['salary', 'الراتب', 'Salary'],
  ['other-income', 'دخل آخر', 'Other income'],
  ['transfers', 'التحويلات', 'Transfers'],
  ['obligations', 'الالتزامات', 'Obligations']
] as const;

export const fixtureCategories: Category[] = defaultCategorySeeds.map(
  ([id, labelAr, labelEn], index) => ({
    id,
    kind: 'system',
    parentId: null,
    labelAr,
    labelEn,
    iconKey: id,
    colorKey: `category-${index % 8}`,
    isFavorite: index < 4,
    status: 'active',
    mergedIntoId: null,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW
  })
);

export const fixtureAccounts: Account[] = [
  {
    id: 'account-bank',
    name: 'Daily account',
    type: 'bank',
    currencyCode: 'SAR',
    openingBalanceMinor: 850_000,
    institution: 'Masarifi Bank',
    lastFour: '2048',
    creditLimitMinor: null,
    isDefault: true,
    iconKey: 'bank',
    colorKey: 'account-teal',
    notes: null,
    status: 'active',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW
  },
  {
    id: 'account-wallet',
    name: 'Wallet',
    type: 'wallet',
    currencyCode: 'SAR',
    openingBalanceMinor: 25_000,
    institution: null,
    lastFour: null,
    creditLimitMinor: null,
    isDefault: false,
    iconKey: 'wallet',
    colorKey: 'account-bronze',
    notes: null,
    status: 'active',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW
  },
  {
    id: 'account-usd',
    name: 'Travel',
    type: 'savings',
    currencyCode: 'USD',
    openingBalanceMinor: 50_000,
    institution: null,
    lastFour: '8812',
    creditLimitMinor: null,
    isDefault: false,
    iconKey: 'savings',
    colorKey: 'account-neutral',
    notes: null,
    status: 'active',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW
  },
  {
    id: 'account-archived',
    name: 'Old card',
    type: 'credit_card',
    currencyCode: 'SAR',
    openingBalanceMinor: 0,
    institution: 'Old Bank',
    lastFour: '0019',
    creditLimitMinor: 300_000,
    isDefault: false,
    iconKey: 'card',
    colorKey: 'account-neutral',
    notes: null,
    status: 'archived',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW
  }
];

export function makeTransaction(
  index: number,
  overrides: Partial<Transaction> = {}
): Transaction {
  const isIncome = index % 11 === 0;
  const type = isIncome ? 'income' : index % 17 === 0 ? 'refund' : 'expense';
  return {
    id: `transaction-${index}`,
    type,
    amountMinor: 500 + index * 37,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    destinationAccountId: null,
    feeMinor: 0,
    categoryId: isIncome ? 'salary' : defaultCategorySeeds[index % 15][0],
    title: isIncome ? 'Salary' : `Merchant ${index}`,
    merchant: isIncome ? null : `Merchant ${index}`,
    paymentMethod: 'card',
    occurredAt: FIXTURE_NOW - index * 3_600_000,
    source: index % 7 === 0 ? 'automatic' : 'manual',
    status: 'posted',
    reviewStatus: index % 31 === 0 ? 'required' : 'none',
    syncStatus: index % 23 === 0 ? 'pending' : 'synced',
    originalTransactionId:
      type === 'refund' ? `transaction-${Math.max(0, index - 1)}` : null,
    obligationId: null,
    notes: null,
    version: 1,
    adjustmentSign: 1,
    deletedAt: null,
    undoExpiresAt: null,
    createdAt: FIXTURE_NOW - index * 3_600_000,
    updatedAt: FIXTURE_NOW - index * 3_600_000,
    ...overrides
  };
}

export const fixtureTransactions = Array.from({ length: 500 }, (_, index) =>
  makeTransaction(index)
);

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
