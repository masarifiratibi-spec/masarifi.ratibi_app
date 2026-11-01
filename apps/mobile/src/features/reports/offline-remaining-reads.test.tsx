import React from 'react';
import { act, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { createMockReportsService } from '@/services/mocks/reports-service';
import { createSeededFinancialPlanningService } from '@/services/mocks/financial-planning-service';
import { createSeededCoreFinanceService } from '@/services/mocks/core-finance-service';
import { emptyTransactionFilters } from '@/domain/core-finance';
import * as reportQueries from './report-queries';
import * as planningQueries from '@/features/financial-planning/financial-planning-queries';
import * as coreQueries from '@/features/core-finance/core-finance-queries';
import { ReportsScreen } from './ReportsScreen';
import { BudgetTransactionsScreen } from '@/features/budgets/BudgetTransactionsScreen';
import { financialPlanningService } from '@/services/financial-planning-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

afterEach(() => jest.restoreAllMocks());
const snapshot = (data: unknown, isError = true) => ({
  data,
  isError,
  error: isError ? Error('offline') : null,
  isPending: false,
  isLoading: false,
  isFetching: false,
  dataUpdatedAt: 100,
  refetch: jest.fn()
});

it.each(['ar', 'en'] as const)(
  'keeps a saved report trend readable with a stale caption after refresh failure in %s',
  async (locale) => {
    changeLocale(locale);
    const report = await createMockReportsService().getReport({
      kind: 'monthly',
      anchorDate: '2026-01-15',
      currencyCode: 'SAR',
      timeZone: 'Asia/Riyadh',
      monthStartDay: 1
    });
    jest
      .spyOn(reportQueries, 'useReport')
      .mockReturnValue(snapshot(report, false) as never);
    jest.spyOn(reportQueries, 'useNetWorthTrend').mockReturnValue(
      snapshot([
        { at: Date.UTC(2026, 0, 1), minorUnits: 10000 },
        { at: Date.UTC(2026, 0, 15), minorUnits: 12000 }
      ]) as never
    );
    const view = renderWithProviders(<ReportsScreen />);
    expect(view.getByTestId('reports-trend-dates')).toBeTruthy();
    expect(view.queryByText(translate('reports.state.error'))).toBeNull();
    expect(
      view.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    view.unmount();
  }
);

it('retains the exact saved budget and its transaction/category reads during a transport failure', async () => {
  changeLocale('en');
  const planning = createSeededFinancialPlanningService();
  const budgets = await planning.listBudgets('2026-01');
  const finance = createSeededCoreFinanceService();
  const transactions = await finance.listTransactions(emptyTransactionFilters);
  const categories = await finance.listCategories(true);
  jest
    .spyOn(planningQueries, 'useBudgetById')
    .mockReturnValue(snapshot(budgets[0]) as never);
  jest
    .spyOn(coreQueries, 'useTransactions')
    .mockReturnValue(snapshot(transactions) as never);
  jest
    .spyOn(coreQueries, 'useCategories')
    .mockReturnValue(snapshot(categories) as never);
  const view = renderWithProviders(
    <BudgetTransactionsScreen budgetId={budgets[0].budget.id} />
  );
  expect(view.queryByText(translate('planning.state.error'))).toBeNull();
  expect(view.getAllByText(transactions.items[0].title).length).toBeGreaterThan(
    0
  );
  expect(
    view.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
  view.unmount();
});

it('waits for the actual budget scope instead of requesting a fictitious1970 transaction period', async () => {
  const budgets =
    await createSeededFinancialPlanningService().listBudgets('2026-01');
  let release!: (budget: (typeof budgets)[number]) => void;
  jest.spyOn(financialPlanningService, 'getBudgetById').mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const transactions = jest.spyOn(coreFinanceService, 'listTransactions');
  const view = renderWithProviders(
    <BudgetTransactionsScreen budgetId={budgets[0].budget.id} />
  );
  try {
    await waitFor(() =>
      expect(financialPlanningService.getBudgetById).toHaveBeenCalledTimes(1)
    );
    expect(transactions).not.toHaveBeenCalled();
    await act(async () => release(budgets[0]));
    await waitFor(() => expect(transactions).toHaveBeenCalledTimes(1));
    expect(transactions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        categoryIds: budgets[0].categories.map((item) => item.categoryId)
      })
    );
  } finally {
    await act(async () => release?.(budgets[0]));
    view.unmount();
  }
});
