import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { notifyManager } from '@tanstack/react-query';
import { router } from 'expo-router';

import {
  completeCategorySelection,
  getCategorySelectionSession
} from '@/features/categories/category-selection-session';
import { changeLocale } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { BudgetAllocationEditor } from './BudgetAllocationEditor';
import { BudgetForm } from './BudgetForm';
import { BudgetOverviewScreen } from './BudgetOverviewScreen';
import { BudgetTransactionsScreen } from './BudgetTransactionsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() }
}));

beforeEach(() => jest.clearAllMocks());

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => act(callback));
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
});

it('renders budget overview, form, allocation, and transaction states', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false });
  const form = renderWithProviders(<BudgetForm />);
  expect(await form.findByLabelText('Budget name')).toBeTruthy();
  expect(form.queryByLabelText('Income target')).toBeNull();
  expect(form.queryByLabelText('Savings target')).toBeNull();
  expect(await form.findByLabelText(/Category Housing/)).toBeTruthy();
  fireEvent.changeText(form.getByLabelText('Budget name'), 'Client budget');
  fireEvent.changeText(form.getByLabelText('Expense limit'), '5000');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  form.unmount();

  const overview = renderWithProviders(<BudgetOverviewScreen />);
  expect(await overview.findByText('Budgets')).toBeTruthy();
  expect(await overview.findByText('Client budget')).toBeTruthy();
  expect(overview.getByText('Create budget')).toBeTruthy();
  overview.unmount();

  const allocation = renderWithProviders(
    <BudgetAllocationEditor budgetId="budget-jan" />
  );
  fireEvent.changeText(
    await allocation.findByLabelText('Amount to move'),
    '100'
  );
  fireEvent.press(allocation.getByText('Review allocation move'));
  expect(await allocation.findByText('Housing: 1,400.00 SAR')).toBeTruthy();
  fireEvent.press(allocation.getByText('Confirm allocation move'));
  expect(await allocation.findByText('Saved')).toBeTruthy();
  allocation.unmount();
  const transactions = renderWithProviders(
    <BudgetTransactionsScreen budgetId="budget-jan" />
  );
  expect(await transactions.findByText('Budget transactions')).toBeTruthy();
  expect(await transactions.findByText('2026-01')).toBeTruthy();
  transactions.unmount();
});

it('opens the creation form directly when the selected month is empty', async () => {
  changeLocale('en');
  const screen = renderWithProviders(
    <BudgetOverviewScreen periodKey="2040-12" />
  );

  expect(await screen.findByLabelText('Budget name')).toBeTruthy();
  expect(screen.queryByText('No planning records yet')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Save' }).props.accessibilityState
  ).toMatchObject({
    disabled: true
  });
});

it('assigns a category without requiring an optional category limit', async () => {
  changeLocale('en');
  const form = renderWithProviders(
    <BudgetForm initialPeriodKey="2042-05" />
  );
  fireEvent.changeText(await form.findByLabelText('Budget name'), 'Home');
  fireEvent.changeText(form.getByLabelText('Expense limit'), '1000');
  fireEvent.press(form.getByLabelText(/Category Housing/));
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  act(() => completeCategorySelection(route.params.requestId, 'housing'));
  fireEvent.press(form.getByText('Save'));

  expect(await form.findByText('Saved')).toBeTruthy();
  expect((await financialPlanningService.getBudget('2042-05'))?.categories).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ categoryId: 'housing', limitMinor: 0 })
    ])
  );
});

it('shows a localized duplicate-name error', async () => {
  changeLocale('en');
  await saveBudget('Home', '2042-06', 'duplicate-name-existing');
  const form = renderWithProviders(
    <BudgetForm initialPeriodKey="2042-06" />
  );
  fireEvent.changeText(await form.findByLabelText('Budget name'), ' home ');
  fireEvent.changeText(form.getByLabelText('Expense limit'), '1000');
  fireEvent.press(form.getByText('Save'));

  expect(await form.findByRole('alert')).toHaveTextContent(
    'A budget with this name already exists this month.'
  );
});

it('identifies and excludes categories owned by another monthly budget', async () => {
  changeLocale('en');
  await financialPlanningService.saveBudget(
    {
      name: 'Home',
      periodKey: '2042-07',
      currencyCode: 'SAR',
      configuredExpenseLimitMinor: 1_000_00,
      incomeTargetMinor: 0,
      savingsTargetMinor: 0,
      categories: [categoryBudget('housing', 500_00)]
    },
    'category-owner-home'
  );
  const form = renderWithProviders(
    <BudgetForm initialPeriodKey="2042-07" />
  );

  expect(await form.findByText('Housing — Home')).toBeTruthy();
  fireEvent.press(form.getByLabelText(/Category Food/));
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  expect(getCategorySelectionSession(route.params.requestId)?.excludedIds).toEqual(
    expect.arrayContaining(['housing'])
  );
});

it('disables save for an incomplete month without crashing the form', async () => {
  changeLocale('en');
  const form = renderWithProviders(<BudgetForm />);

  fireEvent.changeText(await form.findByLabelText('Budget month'), '2042-');
  expect(
    form.getByRole('button', { name: 'Save' }).props.accessibilityState
  ).toMatchObject({ disabled: true });
  expect(form.getByLabelText('Budget month')).toBeTruthy();
});

it('renders every budget saved in the selected month', async () => {
  changeLocale('en');
  await saveBudget('Home', '2041-03', 'budget-list-home');
  await saveBudget('Personal', '2041-03', 'budget-list-personal');

  const screen = renderWithProviders(
    <BudgetOverviewScreen periodKey="2041-03" />
  );

  expect(await screen.findByText('Home')).toBeTruthy();
  expect(screen.getByText('Personal')).toBeTruthy();
});

it('keeps budget values while selecting a category on the canonical screen', async () => {
  changeLocale('en');
  const form = renderWithProviders(<BudgetForm />);
  fireEvent.changeText(await form.findByLabelText('Expense limit'), '5000');
  fireEvent.press(await form.findByLabelText(/Category Housing/));

  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  const session = getCategorySelectionSession(route.params.requestId);
  expect(session?.excludedIds).toEqual(['salary', 'other-income', 'transfers']);
  fireEvent.changeText(form.getByLabelText('Expense limit'), '5000');
  act(() => completeCategorySelection(route.params.requestId, 'food'));

  expect(await form.findByLabelText(/Category Food/)).toBeTruthy();
  expect(form.getByDisplayValue('5000')).toBeTruthy();
});

it.each([
  ['JPY', '2031-01', '12345'],
  ['SAR', '2031-02', '123.45'],
  ['OMR', '2031-03', '12.345']
])(
  'round-trips %s budget create and edit amounts without changing minor units',
  async (currencyCode, periodKey, majorAmount) => {
    changeLocale('en');
    usePreferenceStore.setState({ baseCurrencyCode: currencyCode });
    const createForm = renderWithProviders(<BudgetForm />);

    fireEvent.changeText(
      await createForm.findByLabelText('Budget name'),
      `${currencyCode} precision`
    );
    fireEvent.changeText(
      await createForm.findByLabelText('Budget month'),
      periodKey
    );
    fireEvent.changeText(createForm.getByLabelText('Expense limit'), majorAmount);
    fireEvent.press(createForm.getByText('Save'));
    expect(await createForm.findByText('Saved')).toBeTruthy();
    createForm.unmount();

    const created = await financialPlanningService.getBudget(periodKey);
    expect(created?.budget).toMatchObject({
      currencyCode,
      configuredExpenseLimitMinor: 12_345,
      incomeTargetMinor: 0,
      savingsTargetMinor: 0
    });

    const editForm = renderWithProviders(
      <BudgetForm budgetId={created?.budget.id} />
    );
    await waitFor(() => expect(editForm.getByDisplayValue(majorAmount)).toBeTruthy());
    fireEvent.press(editForm.getByText('Save'));
    expect(await editForm.findByText('Saved')).toBeTruthy();

    const updated = await financialPlanningService.getBudgetById(
      created!.budget.id
    );
    expect(updated.budget).toMatchObject({
      currencyCode,
      configuredExpenseLimitMinor: 12_345,
      incomeTargetMinor: 0,
      savingsTargetMinor: 0
    });
  }
);

it('uses the budget currency when previewing a three-decimal allocation move', async () => {
  changeLocale('en');
  const saved = await financialPlanningService.saveBudget(
    {
      name: 'OMR allocation',
      periodKey: '2031-04',
      currencyCode: 'OMR',
      configuredExpenseLimitMinor: 50_000,
      incomeTargetMinor: 50_000,
      savingsTargetMinor: 10_000,
      categories: [
        categoryBudget('housing', 20_000),
        categoryBudget('food', 10_000)
      ]
    },
    'budget-allocation-precision-setup'
  );
  const editor = renderWithProviders(
    <BudgetAllocationEditor budgetId={saved.value.id} />
  );

  fireEvent.changeText(
    await editor.findByLabelText('Amount to move'),
    '1.234'
  );
  fireEvent.press(editor.getByText('Review allocation move'));

  expect(await editor.findByText('Housing: 18.766\u00a0OMR')).toBeTruthy();
  expect(editor.getByText('Food: 11.234\u00a0OMR')).toBeTruthy();
});

function categoryBudget(categoryId: string, limitMinor: number) {
  return {
    id: `precision-${categoryId}`,
    version: 1,
    syncStatus: 'pending' as const,
    createdAt: 1,
    updatedAt: 1,
    budgetId: 'pending',
    categoryId,
    limitMinor,
    alertThresholds: [80, 90, 100],
    status: 'active' as const
  };
}

async function saveBudget(name: string, periodKey: string, operationId: string) {
  return financialPlanningService.saveBudget(
    {
      name,
      periodKey,
      currencyCode: 'SAR',
      configuredExpenseLimitMinor: 1_000_00,
      incomeTargetMinor: 0,
      savingsTargetMinor: 0,
      categories: []
    },
    operationId
  );
}
