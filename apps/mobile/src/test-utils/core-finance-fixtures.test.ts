import {
  defaultCategorySeeds,
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeCoreFinanceScenario
} from './core-finance-fixtures';

it('provides complete deterministic synthetic fixtures', () => {
  expect(defaultCategorySeeds).toHaveLength(19);
  expect(fixtureCategories).toHaveLength(19);
  expect(fixtureTransactions).toHaveLength(500);
  expect(new Set(fixtureTransactions.map((item) => item.id)).size).toBe(500);
  expect(fixtureAccounts.some((account) => account.status === 'archived')).toBe(
    true
  );
  expect(
    fixtureAccounts.flatMap(({ name, institution, notes }) => [
      name,
      institution,
      notes
    ])
  ).not.toEqual(expect.arrayContaining([expect.stringMatching(/\b\d{10,}\b/)]));
});

it.each([
  'empty',
  'partial',
  'multi_currency',
  'archived',
  'offline',
  'conflict',
  'large'
] as const)('builds the %s scenario', (scenario) => {
  expect(makeCoreFinanceScenario(scenario)).toEqual(
    expect.objectContaining({
      accounts: expect.any(Array),
      transactions: expect.any(Array)
    })
  );
});
