import {
  createDefaultCategories,
  createDemoTransactions,
  isLegacyFixtureAccount,
  isLegacyFixtureTransaction,
  legacyFixtureAccounts,
  legacyFixtureTransactions,
  localizedDemoAccountName,
  localizedDemoTransactionTitle
} from './core-finance-seeds';

it('does not fingerprint the legacy transaction history when imported by live services', () => {
  const sort = jest.spyOn(Array.prototype, 'sort');
  try {
    jest.isolateModules(() => {
      jest.requireActual('./core-finance-seeds');
    });
    // Only the four retained account fingerprints may be prepared eagerly.
    expect(sort.mock.calls.length).toBeLessThanOrEqual(4);
  } finally {
    sort.mockRestore();
  }
});

it('requires every original transaction field before treating a record as a legacy fixture', () => {
  const original = legacyFixtureTransactions[0];
  for (const [field, value] of Object.entries(original)) {
    const changed = {
      ...original,
      [field]: typeof value === 'number' ? value + 1 : 'changed'
    };
    expect(isLegacyFixtureTransaction(changed)).toBe(false);
  }
});

it.each([
  'transaction-500',
  'transaction-050',
  'transaction--1',
  'transaction-1.0',
  'transaction-1suffix'
])('does not remove a record with the noncanonical legacy ID %s', (id) => {
  expect(
    isLegacyFixtureTransaction({ ...legacyFixtureTransactions[0], id })
  ).toBe(false);
});

it('detects legacy fixtures without locale collation during startup or lookup', () => {
  const compare = jest.spyOn(String.prototype, 'localeCompare');
  try {
    jest.isolateModules(() => {
      const seeds = jest.requireActual<typeof import('./core-finance-seeds')>(
        './core-finance-seeds'
      );
      expect(seeds.isLegacyFixtureAccount(seeds.legacyFixtureAccounts[0])).toBe(
        true
      );
      expect(
        seeds.isLegacyFixtureTransaction(seeds.legacyFixtureTransactions[0])
      ).toBe(true);
    });
    expect(compare).not.toHaveBeenCalled();
  } finally {
    compare.mockRestore();
  }
});

it('recognizes every legacy fixture regardless of object property insertion order', () => {
  for (const account of legacyFixtureAccounts) {
    const reordered = Object.fromEntries(
      Object.entries(account).reverse()
    ) as typeof account;
    expect(isLegacyFixtureAccount(reordered)).toBe(true);
  }
  for (const transaction of legacyFixtureTransactions) {
    const reordered = Object.fromEntries(
      Object.entries(transaction).reverse()
    ) as typeof transaction;
    expect(isLegacyFixtureTransaction(reordered)).toBe(true);
  }
});

it('does not identify edited or real financial records as legacy fixtures', () => {
  const account = legacyFixtureAccounts[0];
  for (const changed of [
    { ...account, id: 'real-account' },
    { ...account, openingBalanceMinor: account.openingBalanceMinor + 1 },
    { ...account, name: 'حساب شخصي' }
  ])
    expect(isLegacyFixtureAccount(changed)).toBe(false);

  const transaction = legacyFixtureTransactions[0];
  for (const changed of [
    { ...transaction, id: 'real-transaction' },
    { ...transaction, amountMinor: transaction.amountMinor + 1 },
    { ...transaction, version: transaction.version + 1 },
    { ...transaction, notes: 'ملاحظة شخصية' }
  ])
    expect(isLegacyFixtureTransaction(changed)).toBe(false);
});

it('initializes income or expense reference categories with one remittance category', () => {
  const categories = createDefaultCategories();

  expect(categories.filter((category) => category.id === 'remittance')).toEqual(
    [
      expect.objectContaining({
        kind: 'system',
        financialType: 'expense',
        iconKey: 'transfers',
        status: 'active'
      })
    ]
  );
  expect(categories.some((category) => category.id === 'transfers')).toBe(
    false
  );
  expect(
    categories.every(
      (category) =>
        category.financialType === 'income' ||
        category.financialType === 'expense'
    )
  ).toBe(true);
});

it('keeps demo transfers category-free', () => {
  const transfers = createDemoTransactions(1_800_000_000_000).filter(
    (transaction) => transaction.type === 'transfer'
  );

  expect(transfers).toHaveLength(1);
  expect(transfers[0].categoryId).toBeNull();
});

it.each([
  ['ar', 'فاتورة الكهرباء', 'مصاريفي'],
  ['en', 'Electricity bill', 'Masarifi']
] as const)(
  'localizes known demo finance copy in %s',
  (locale, title, account) => {
    expect(localizedDemoTransactionTitle('demo-transaction-7', locale)).toBe(
      title
    );
    expect(localizedDemoAccountName('account-default', locale)).toBe(account);
  }
);
