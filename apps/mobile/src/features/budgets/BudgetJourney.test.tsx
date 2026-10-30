import React from 'react';
import { act, fireEvent, waitFor, render } from '@testing-library/react-native';
import { notifyManager, QueryClient } from '@tanstack/react-query';
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
import { FoundationProviders } from '@/state/FoundationProviders';
import { BudgetOverviewScreen } from './BudgetOverviewScreen';
import { HttpError } from '@/services/live/http-client';
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
  expect(await transactions.findByText('January 2026')).toBeTruthy();
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
    disabled: false
  });
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(
    await screen.findAllByText(
      'Complete the required fields with valid values.'
    )
  ).not.toHaveLength(0);
});

it('saves a limit entered for the displayed default category without requiring the picker', async () => {
  changeLocale('en');
  const form = renderWithProviders(<BudgetForm initialPeriodKey="2042-09" />);
  fireEvent.changeText(
    await form.findByLabelText('Budget name'),
    'Typed category'
  );
  fireEvent.changeText(form.getByLabelText('Expense limit'), '1000');
  expect(form.getByLabelText(/Category Housing/)).toBeTruthy();
  fireEvent.changeText(form.getByLabelText('Category limit'), '125');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  expect(
    (await financialPlanningService.getBudget('2042-09'))?.categories
  ).toEqual([
    expect.objectContaining({ categoryId: 'housing', limitMinor: 12500 })
  ]);
});

it('assigns a category without requiring an optional category limit', async () => {
  changeLocale('en');
  const form = renderWithProviders(<BudgetForm initialPeriodKey="2042-05" />);
  fireEvent.changeText(await form.findByLabelText('Budget name'), 'Home');
  fireEvent.changeText(form.getByLabelText('Expense limit'), '1000');
  fireEvent.press(form.getByLabelText(/Category Housing/));
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  act(() => completeCategorySelection(route.params.requestId, 'housing'));
  fireEvent.press(form.getByText('Save'));

  expect(await form.findByText('Saved')).toBeTruthy();
  expect(
    (await financialPlanningService.getBudget('2042-05'))?.categories
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ categoryId: 'housing', limitMinor: 0 })
    ])
  );
});

it('shows a localized duplicate-name error', async () => {
  changeLocale('en');
  await saveBudget('Home', '2042-06', 'duplicate-name-existing');
  const form = renderWithProviders(<BudgetForm initialPeriodKey="2042-06" />);
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
  const form = renderWithProviders(<BudgetForm initialPeriodKey="2042-07" />);

  expect(await form.findByText('Housing — Home')).toBeTruthy();
  fireEvent.press(form.getByLabelText(/Category Food/));
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  expect(
    getCategorySelectionSession(route.params.requestId)?.excludedIds
  ).toEqual(expect.arrayContaining(['housing']));
});

it('shows validation when saving an incomplete month', async () => {
  changeLocale('en');
  const form = renderWithProviders(<BudgetForm />);

  fireEvent.changeText(await form.findByLabelText('Budget month'), '2042-');
  expect(
    form.getByRole('button', { name: 'Save' }).props.accessibilityState
  ).toMatchObject({ disabled: false });
  fireEvent.press(form.getByRole('button', { name: 'Save' }));
  expect(
    await form.findAllByText('Complete the required fields with valid values.')
  ).not.toHaveLength(0);
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

it('requires confirmation before deleting a saved budget', async () => {
  changeLocale('en');
  await saveBudget(
    'Delete confirmation',
    '2041-04',
    'budget-delete-confirmation'
  );
  const deleteBudget = jest.spyOn(financialPlanningService, 'deleteBudget');
  try {
    const screen = renderWithProviders(
      <BudgetOverviewScreen periodKey="2041-04" />
    );

    fireEvent.press(await screen.findByText('Delete budget'));
    expect(
      await screen.findByText(
        'This budget and its category allocations will be deleted.'
      )
    ).toBeTruthy();
    expect(deleteBudget).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText(
        'This budget and its category allocations will be deleted.'
      )
    ).toBeNull();
    expect(deleteBudget).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Delete budget'));
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Delete budget' }).at(-1)!
    );
    await waitFor(() => expect(deleteBudget).toHaveBeenCalledTimes(1));
  } finally {
    deleteBudget.mockRestore();
  }
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
    fireEvent.changeText(
      createForm.getByLabelText('Expense limit'),
      majorAmount
    );
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
    await waitFor(() =>
      expect(editForm.getByDisplayValue(majorAmount)).toBeTruthy()
    );
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

  fireEvent.changeText(await editor.findByLabelText('Amount to move'), '1.234');
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

async function saveBudget(
  name: string,
  periodKey: string,
  operationId: string
) {
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


it.each(['2026-13', '2026-', ''])('keeps editable draft fields when the month is invalid: %s', async (invalidPeriod) => {
  changeLocale('en');
  const listOriginal = financialPlanningService.listBudgets.bind(financialPlanningService);
  const list = jest.spyOn(financialPlanningService, 'listBudgets').mockImplementation(async period => {
    if (['2026-13', '2026-', ''].includes(period)) throw new Error('Live budget endpoint rejects invalid month');
    return listOriginal(period);
  });
  let mountedForm: ReturnType<typeof renderWithProviders> | undefined;
  try {
    await financialPlanningService.discardDraft('planning-form-budget:new');
    const form = renderWithProviders(<BudgetForm initialPeriodKey="2038-04" />);
    mountedForm = form;
    fireEvent.changeText(await form.findByLabelText('Budget name'), 'Retained correction');
    fireEvent.changeText(form.getByLabelText('Expense limit'), '1000');
    fireEvent.changeText(form.getByLabelText('Category limit'), '125');
    fireEvent.changeText(form.getByLabelText('Budget month'), invalidPeriod);
    await waitFor(() => {
      expect(list).not.toHaveBeenCalledWith(invalidPeriod);
      expect(form.getByLabelText('Budget month')).toHaveProp('value', invalidPeriod);
      expect(form.getByLabelText('Budget name')).toHaveProp('value', 'Retained correction');
      expect(form.getByLabelText('Expense limit')).toHaveProp('value', '1000');
      expect(form.getByLabelText('Category limit')).toHaveProp('value', '125');
    });
    fireEvent.press(form.getByText('Save'));
    expect(await form.findAllByText('Complete the required fields with valid values.')).not.toHaveLength(0);
    fireEvent.changeText(form.getByLabelText('Budget month'), '2038-05');
    await waitFor(() => expect(list).toHaveBeenCalledWith('2038-05'));
    expect(form.getByLabelText('Budget name')).toHaveProp('value', 'Retained correction');
    expect(form.getByLabelText('Category limit')).toHaveProp('value', '125');
  } finally {
    mountedForm?.unmount();
    await financialPlanningService.discardDraft('planning-form-budget:new');
    list.mockRestore();
  }
});


it('recovers an invalid retained month even when a prior query failure is cached', async () => {
  changeLocale('en');
  await financialPlanningService.discardDraft('planning-form-budget:new');
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr', hydrated: true });
  await financialPlanningService.saveDraft({ id: 'planning-form-budget:new', kind: 'budget', entityId: null, payload: { name: 'Retained invalid month', periodKey: '2026-13', expenseLimit: '1000', categoryLimits: { housing: '125' }, selectedCategoryIds: ['housing'], rolloverEnabled: true, copiedFromBudgetId: null }, status: 'editing', updatedAt: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  await expect(client.fetchQuery({
    queryKey: ['planning', 'budgets', '2026-13'],
    queryFn: async () => { throw new Error('Previous invalid month request'); }
  })).rejects.toThrow('Previous invalid month request');
  const form = render(<FoundationProviders client={client}><BudgetForm initialPeriodKey="2026-13" /></FoundationProviders>);
  try {
    expect(await form.findByLabelText('Budget name')).toHaveProp('value', 'Retained invalid month');
    expect(form.getByLabelText('Budget month')).toHaveProp('value', '2026-13');
    expect(form.getByLabelText('Expense limit')).toHaveProp('value', '1000');
    expect(form.getByLabelText('Category limit')).toHaveProp('value', '125');
    fireEvent.changeText(form.getByLabelText('Budget month'), '2038-06');
    await waitFor(() => expect(form.getByLabelText('Budget name')).toHaveProp('value', 'Retained invalid month'));
    expect(form.getByLabelText('Expense limit')).toHaveProp('value', '1000');
  } finally {
    form.unmount();
    client.clear();
    await financialPlanningService.discardDraft('planning-form-budget:new');
  }
});


it.each([
  ['en', 'Resume saved draft', null, '/budgets/new'],
  ['ar', 'متابعة المسودة المحفوظة', null, '/budgets/new'],
  ['en', 'Resume saved draft', 'retained-edit', '/budgets/edit/retained-edit'],
  [
    'ar',
    'متابعة المسودة المحفوظة',
    'retained-edit',
    '/budgets/edit/retained-edit'
  ]
] as const)(
  'recovers an existing draft from an unavailable budget list in %s without claiming the list is empty',
  async (locale, label, entityId, destination) => {
    changeLocale(locale);
    const id = `planning-form-budget:${entityId ?? 'new'}`;
    await financialPlanningService.saveDraft({
      id,
      kind: 'budget',
      entityId,
      payload: {
        name: 'Saved draft',
        periodKey: '2026-13',
        expenseLimit: '1000'
      },
      status: 'editing',
      updatedAt: 1
    });
    const original = await financialPlanningService.loadDraft(id);
    const list = jest
      .spyOn(financialPlanningService, 'listBudgets')
      .mockRejectedValue(new HttpError('provider_unavailable', 503));
    const view = renderWithProviders(<BudgetOverviewScreen />);
    try {
      const button = await view.findByRole('button', {
        name: `${label}: Saved draft`
      });
      expect(
        view.getByText(
          locale === 'ar' ? 'التخطيط غير متاح' : 'Planning is unavailable'
        )
      ).toBeTruthy();
      expect(
        view.queryByLabelText(locale === 'ar' ? 'اسم الميزانية' : 'Budget name')
      ).toBeNull();
      fireEvent.press(button);
      expect(router.push).toHaveBeenCalledWith(destination);
      expect(await financialPlanningService.loadDraft(id)).toEqual(original);
    } finally {
      view.unmount();
      list.mockRestore();
      await financialPlanningService.discardDraft(id);
    }
  }
);

it.each([
  ['forbidden', 403],
  ['session_expired', 401]
] as const)(
  'withholds saved-draft recovery when the budget list denies access: %s',
  async (code, status) => {
    changeLocale('en');
    await financialPlanningService.saveDraft({
      id: 'planning-form-budget:new',
      kind: 'budget',
      entityId: null,
      payload: { name: 'Private draft', periodKey: '2026-13' },
      status: 'editing',
      updatedAt: 1
    });
    const list = jest
      .spyOn(financialPlanningService, 'listBudgets')
      .mockRejectedValue(new HttpError(code, status));
    const view = renderWithProviders(<BudgetOverviewScreen />);
    try {
      await view.findByText('Planning is unavailable');
      expect(
        view.queryByRole('button', { name: /^Resume saved draft/ })
      ).toBeNull();
    } finally {
      view.unmount();
      list.mockRestore();
      await financialPlanningService.discardDraft('planning-form-budget:new');
    }
  }
);

it('recovers an existing-budget edit draft while its canonical record is unavailable, without saving or rewriting it', async () => {
  changeLocale('en');
  const id = 'planning-form-budget:missing-live-budget';
  const original = await financialPlanningService.saveDraft({
    id,
    kind: 'budget',
    entityId: 'missing-live-budget',
    payload: {
      name: 'Retained edit',
      periodKey: '2026-13',
      expenseLimit: '1234',
      categoryLimits: { housing: '125' },
      selectedCategoryIds: ['housing'],
      rolloverEnabled: true,
      copiedFromBudgetId: null
    },
    status: 'editing',
    updatedAt: 1
  });
  const get = jest
    .spyOn(financialPlanningService, 'getBudgetById')
    .mockRejectedValue(new HttpError('provider_unavailable', 503));
  const view = renderWithProviders(
    <BudgetForm budgetId="missing-live-budget" />
  );
  try {
    expect(await view.findByLabelText('Budget name')).toHaveProp(
      'value',
      'Retained edit'
    );
    expect(view.getByLabelText('Budget month')).toHaveProp('value', '2026-13');
    expect(view.getByLabelText('Expense limit')).toHaveProp('value', '1234');
    expect(view.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(await financialPlanningService.loadDraft(id)).toEqual(original);
  } finally {
    view.unmount();
    get.mockRestore();
    await financialPlanningService.discardDraft(id);
  }
});

it('withdraws a visible local edit draft when its canonical budget denies access', async () => {
  changeLocale('en');
  const id = 'planning-form-budget:denied-budget';
  await financialPlanningService.saveDraft({
    id,
    kind: 'budget',
    entityId: 'denied-budget',
    payload: { name: 'Private edit', periodKey: '2026-13' },
    status: 'editing',
    updatedAt: 1
  });
  let deny!: (error: Error) => void;
  const pending = new Promise<never>((_, reject) => {
    deny = reject;
  });
  const get = jest
    .spyOn(financialPlanningService, 'getBudgetById')
    .mockReturnValue(pending);
  const view = renderWithProviders(<BudgetForm budgetId="denied-budget" />);
  try {
    expect(await view.findByLabelText('Budget name')).toHaveProp(
      'value',
      'Private edit'
    );
    await act(async () => deny(new HttpError('forbidden', 403)));
    await view.findByText('Planning is unavailable');
    expect(view.queryByLabelText('Budget name')).toBeNull();
  } finally {
    view.unmount();
    get.mockRestore();
    await financialPlanningService.discardDraft(id);
  }
});
