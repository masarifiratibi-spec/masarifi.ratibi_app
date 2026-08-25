import type { Account, Category, Transaction } from './core-finance';

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

export function createDefaultCategories(): Category[] {
  return defaultCategorySeeds.map(([id, labelAr, labelEn], index) => ({
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
  }));
}

export function createDefaultAccount(now = Date.now()): Account {
  return {
    id: 'account-default',
    name: 'Masarifi',
    type: 'bank',
    currencyCode: 'SAR',
    openingBalanceMinor: 0,
    institution: null,
    lastFour: null,
    creditLimitMinor: null,
    isDefault: true,
    iconKey: 'bank',
    colorKey: 'account-teal',
    notes: null,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
}

export function createDemoAccounts(now = Date.now()): Account[] {
  return [
    {
      ...createDefaultAccount(now),
      openingBalanceMinor: 0
    },
    {
      id: 'demo-account-cash',
      name: 'Cash Wallet',
      type: 'cash',
      currencyCode: 'SAR',
      openingBalanceMinor: 42_500,
      institution: null,
      lastFour: null,
      creditLimitMinor: null,
      isDefault: false,
      iconKey: 'wallet',
      colorKey: 'account-bronze',
      notes: 'Client demo account',
      status: 'active',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-account-card',
      name: 'Client Card',
      type: 'credit_card',
      currencyCode: 'SAR',
      openingBalanceMinor: 0,
      institution: 'Masarifi Bank',
      lastFour: '4821',
      creditLimitMinor: 500_000,
      isDefault: false,
      iconKey: 'card',
      colorKey: 'account-neutral',
      notes: 'Client demo card',
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
  ];
}

export function createDemoTransactions(now = Date.now()): Transaction[] {
  const date = new Date(now);
  const at = (day: number, hour: number) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day, hour);
  return [
    demoTransaction(1, now, {
      type: 'income',
      amountMinor: 12_500_00,
      categoryId: 'salary',
      title: 'Monthly salary',
      merchant: null,
      occurredAt: at(1, 9)
    }),
    demoTransaction(2, now, {
      amountMinor: 1_850_00,
      categoryId: 'housing',
      title: 'Rent payment',
      merchant: 'Building Management',
      occurredAt: at(2, 10)
    }),
    demoTransaction(3, now, {
      amountMinor: 243_75,
      categoryId: 'food',
      title: 'Grocery run',
      merchant: 'Tamimi Markets',
      occurredAt: at(4, 18)
    }),
    demoTransaction(4, now, {
      amountMinor: 78_50,
      accountId: 'demo-account-cash',
      categoryId: 'restaurants',
      title: 'Coffee meeting',
      merchant: 'Draft Cafe',
      paymentMethod: 'cash',
      occurredAt: at(6, 14)
    }),
    demoTransaction(5, now, {
      amountMinor: 320_00,
      accountId: 'demo-account-card',
      categoryId: 'shopping',
      title: 'Client dinner supplies',
      merchant: 'Mall Store',
      paymentMethod: 'card',
      occurredAt: at(10, 20)
    }),
    demoTransaction(6, now, {
      type: 'transfer',
      amountMinor: 500_00,
      accountId: 'account-default',
      destinationAccountId: 'demo-account-cash',
      categoryId: 'transfers',
      title: 'Wallet top-up',
      merchant: null,
      occurredAt: at(12, 11)
    }),
    demoTransaction(7, now, {
      amountMinor: 159_00,
      categoryId: 'utilities',
      title: 'Electricity bill',
      merchant: 'Utility Provider',
      occurredAt: at(15, 8)
    }),
    demoTransaction(8, now, {
      amountMinor: 49_99,
      categoryId: 'subscriptions',
      title: 'Streaming subscription',
      merchant: 'StreamBox',
      occurredAt: at(18, 7)
    }),
    demoTransaction(9, now, {
      type: 'refund',
      amountMinor: 25_00,
      categoryId: 'shopping',
      title: 'Card refund',
      merchant: 'Mall Store',
      originalTransactionId: 'demo-transaction-5',
      occurredAt: at(19, 13)
    })
  ];
}

function demoTransaction(
  index: number,
  now: number,
  overrides: Partial<Transaction>
): Transaction {
  return {
    id: `demo-transaction-${index}`,
    type: 'expense',
    amountMinor: 100_00,
    currencyCode: 'SAR',
    accountId: 'account-default',
    destinationAccountId: null,
    feeMinor: 0,
    categoryId: 'shopping',
    title: `Demo transaction ${index}`,
    merchant: 'Demo merchant',
    paymentMethod: 'card',
    occurredAt: now - index * 86_400_000,
    source: 'manual',
    status: 'posted',
    reviewStatus: 'none',
    syncStatus: 'synced',
    originalTransactionId: null,
    obligationId: null,
    notes: 'Client demo data',
    version: 1,
    adjustmentSign: 1,
    deletedAt: null,
    undoExpiresAt: null,
    createdAt: now - index * 86_400_000,
    updatedAt: now - index * 86_400_000,
    ...overrides
  };
}

// Legacy values are retained only to identify unchanged pre-remediation records.
export const legacyFixtureAccounts: Account[] = [
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

export function makeLegacyFixtureTransaction(
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

export const legacyFixtureTransactions = Array.from(
  { length: 500 },
  (_, index) => makeLegacyFixtureTransaction(index)
);

const legacyAccountFingerprints = new Set(
  legacyFixtureAccounts.map(fingerprint)
);
const legacyTransactionFingerprints = new Set(
  legacyFixtureTransactions.map(fingerprint)
);

export function isLegacyFixtureAccount(account: Account): boolean {
  return legacyAccountFingerprints.has(fingerprint(account));
}

export function isLegacyFixtureTransaction(transaction: Transaction): boolean {
  return legacyTransactionFingerprints.has(fingerprint(transaction));
}

function fingerprint(value: object): string {
  return JSON.stringify(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}
