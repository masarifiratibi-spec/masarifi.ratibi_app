import React from 'react';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { createSeededFinancialPlanningService } from '@/services/financial-planning-service';
import * as queries from './financial-planning-queries';
import { SalaryOverviewScreen } from '@/features/salary/SalaryOverviewScreen';
import { ObligationOverviewScreen } from '@/features/obligations/ObligationOverviewScreen';
import { BudgetOverviewScreen } from '@/features/budgets/BudgetOverviewScreen';
import { SavingsGoalsScreen } from '@/features/savings/SavingsGoalsScreen';
import { SavingsGoalDetailScreen } from '@/features/savings/SavingsGoalDetailScreen';
import { ObligationDetailScreen } from '@/features/obligations/ObligationDetailScreen';

let financialPlanningService: ReturnType<
  typeof createSeededFinancialPlanningService
>;
beforeEach(() => {
  financialPlanningService = createSeededFinancialPlanningService();
});
afterEach(() => jest.restoreAllMocks());
const snapshot = (data: unknown) => ({
  data,
  isLoading: false,
  isError: true,
  isSuccess: false,
  isFetching: false,
  dataUpdatedAt: 100,
  refetch: jest.fn()
});

it.each(['en', 'ar'] as const)(
  'keeps cached salary and obligations visible after a failed refresh in %s',
  async (locale) => {
    changeLocale(locale);
    const salary = await financialPlanningService.getSalaryOverview({
      today: '2026-01-15',
      timeZone: 'Asia/Riyadh'
    });
    jest
      .spyOn(queries, 'useSalaryOverview')
      .mockReturnValue(snapshot(salary) as never);
    const salaryScreen = renderWithProviders(<SalaryOverviewScreen />);
    expect(
      salaryScreen.queryByText(translate('planning.state.error'))
    ).toBeNull();
    expect(
      salaryScreen.getByText(
        translate('coreFinance.state.refreshFailedSnapshot')
      )
    ).toBeTruthy();
    salaryScreen.unmount();
    const obligations = await financialPlanningService.getObligationsOverview(
      {}
    );
    jest
      .spyOn(queries, 'useObligationsOverview')
      .mockReturnValue(snapshot(obligations) as never);
    const obligationScreen = renderWithProviders(<ObligationOverviewScreen />);
    expect(
      obligationScreen.queryByText(translate('planning.state.error'))
    ).toBeNull();
    expect(
      obligationScreen.getByText(
        translate('coreFinance.state.refreshFailedSnapshot')
      )
    ).toBeTruthy();
  }
);

it('keeps cached budget and savings lists readable after a failed refresh', async () => {
  changeLocale('en');
  const budgets = await financialPlanningService.listBudgets('2026-01');
  expect(budgets.length).toBeGreaterThan(0);
  jest.spyOn(queries, 'useBudgets').mockReturnValue(snapshot(budgets) as never);
  const budgetScreen = renderWithProviders(
    <BudgetOverviewScreen periodKey="2026-01" />
  );
  expect(
    budgetScreen.queryByText(translate('planning.state.error'))
  ).toBeNull();
  expect(
    budgetScreen.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
  budgetScreen.unmount();
  const goals = await financialPlanningService.listGoals({});
  expect(goals.length).toBeGreaterThan(0);
  jest
    .spyOn(queries, 'useSavingsGoals')
    .mockReturnValue(snapshot(goals) as never);
  const savingsScreen = renderWithProviders(<SavingsGoalsScreen />);
  expect(
    savingsScreen.queryByText(translate('planning.state.error'))
  ).toBeNull();
  expect(
    savingsScreen.getByText(
      translate('coreFinance.state.refreshFailedSnapshot')
    )
  ).toBeTruthy();
});

it('retains saved obligation and savings detail amounts after refresh failure', async () => {
  changeLocale('en');
  const { items: obligations } = await financialPlanningService.listObligations(
    {}
  );
  const obligation = await financialPlanningService.getObligation(
    obligations[0].id
  );
  jest
    .spyOn(queries, 'useObligationDetail')
    .mockReturnValue({ ...snapshot(obligation), isRefetching: false } as never);
  const detail = renderWithProviders(
    <ObligationDetailScreen obligationId={obligations[0].id} />
  );
  expect(detail.queryByText(translate('planning.state.error'))).toBeNull();
  detail.unmount();
  const goals = await financialPlanningService.listGoals({});
  const goal = await financialPlanningService.getGoal(goals[0].id);
  jest
    .spyOn(queries, 'useSavingsGoal')
    .mockReturnValue(snapshot(goal) as never);
  const savings = renderWithProviders(
    <SavingsGoalDetailScreen goalId={goals[0].id} />
  );
  expect(savings.queryByText(translate('planning.state.error'))).toBeNull();
  expect(
    savings.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
  ).toBeTruthy();
});
