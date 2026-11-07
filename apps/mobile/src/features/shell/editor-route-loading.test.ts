const mockEditorInitializations: string[] = [];

jest.mock('@/features/transactions/TransactionForm', () => {
  mockEditorInitializations.push('transaction');
  return jest.requireActual('@/features/transactions/TransactionForm');
});
jest.mock('@/features/accounts/AccountForm', () => {
  mockEditorInitializations.push('account');
  return jest.requireActual('@/features/accounts/AccountForm');
});
jest.mock('@/features/budgets/BudgetAllocationEditor', () => {
  mockEditorInitializations.push('allocation');
  return jest.requireActual('@/features/budgets/BudgetAllocationEditor');
});
jest.mock('@/features/savings/SavingsMovementForm', () => {
  mockEditorInitializations.push('movement');
  return jest.requireActual('@/features/savings/SavingsMovementForm');
});
jest.mock('@/features/design-system/DesignSystemGallery', () => {
  mockEditorInitializations.push('gallery');
  return jest.requireActual('@/features/design-system/DesignSystemGallery');
});

it('discovers editor routes without initializing screens that have not been opened', () => {
  for (const route of [
    '../../../app/(tabs)/add',
    '../../../app/transactions/[id]/edit',
    '../../../app/accounts/new',
    '../../../app/accounts/[id]/edit',
    '../../../app/budgets/allocation/[budgetId]',
    '../../../app/savings/[goalId]/movement',
    '../../../app/design-system/index'
  ]) {
    expect(jest.requireActual(route).default).toEqual(expect.any(Function));
  }
  expect(mockEditorInitializations).toEqual([]);
});
