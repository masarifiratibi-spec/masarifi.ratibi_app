import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { changeLocale, translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { BudgetCard } from './ReportsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const props = {
  currency: 'SAR',
  direction: 'ltr' as const,
  hidden: false,
  startDate: '2026-08-07',
  endDate: '2026-08-19'
};
function budget(
  remaining: number | null,
  currencyCode = 'SAR',
  status = 'active'
) {
  return {
    budget: { periodKey: '2026-08', currencyCode, status },
    progress: {
      remainingMinor:
        remaining === null
          ? { status: 'unavailable' }
          : { status: 'available', value: remaining }
    }
  };
}
function renderMonth(budgets: ReturnType<typeof budget>[], hidden = false) {
  return renderWithQueryData(<BudgetCard {...props} hidden={hidden} />, [
    [financialPlanningKeys.budgetList('2026-08'), budgets]
  ]);
}
beforeEach(() => changeLocale('en'));
afterEach(() => jest.restoreAllMocks());

test.each([
  [200, 300, '5.00'],
  [200, -200, '0.00'],
  [-700, 200, '-5.00']
] as const)(
  'aggregates only the active full-month progress in the displayed currency',
  (first, second, expected) => {
    renderMonth([
      budget(first),
      budget(second),
      budget(900000, 'USD'),
      budget(800000, 'SAR', 'paused')
    ]);
    expect(screen.getByText(expected + '\u00a0SAR')).toBeTruthy();
    expect(screen.getByText('August 2026 · SAR · All accounts')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reports-budget-card'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/budgets',
      params: { periodKey: '2026-08' }
    });
  }
);

test('preserves hidden amounts in the card and its accessible name', () => {
  renderMonth([budget(123400)], true);
  expect(
    screen.getByText(translate('designSystem.privacy.hidden'))
  ).toBeTruthy();
  expect(screen.queryByLabelText(/1,234/)).toBeNull();
});

test.each([
  [budget(null), budget(200)],
  [budget(Number.MAX_SAFE_INTEGER), budget(1)]
])('an incomplete or unsafe sum shows unavailable', (first, second) => {
  renderMonth([first, second]);
  expect(screen.getByText(translate('reports.state.unavailable'))).toBeTruthy();
  expect(
    screen.queryByText(translate('reports.analytics.setBudget'))
  ).toBeNull();
});

test('keeps a link without a balance or a budget query for a cross-month period', () => {
  const read = jest.spyOn(financialPlanningService, 'listBudgets');
  renderWithProviders(<BudgetCard {...props} endDate="2026-09-03" />);
  fireEvent.press(screen.getByRole('button', { name: 'Budgets' }));
  expect(router.push).toHaveBeenCalledWith('/budgets');
  expect(read).not.toHaveBeenCalled();
});

test('only a successful empty month offers to set a budget', async () => {
  jest.spyOn(financialPlanningService, 'listBudgets').mockResolvedValueOnce([]);
  renderWithProviders(<BudgetCard {...props} />);
  expect(screen.getByText(translate('planning.state.loading'))).toBeTruthy();
  expect(
    screen.queryByText(translate('reports.analytics.setBudget'))
  ).toBeNull();
  expect(
    await screen.findByText(translate('reports.analytics.setBudget'))
  ).toBeTruthy();
});

test('failed budget reads stay unavailable', async () => {
  jest
    .spyOn(financialPlanningService, 'listBudgets')
    .mockRejectedValueOnce(new Error('unavailable'));
  renderWithProviders(<BudgetCard {...props} />);
  expect(
    await screen.findByText(translate('reports.state.unavailable'))
  ).toBeTruthy();
  expect(
    screen.queryByText(translate('reports.analytics.setBudget'))
  ).toBeNull();
});

test('a month with paused or other-currency budgets keeps its existing budgets link', () => {
  renderMonth([budget(100, 'SAR', 'paused'), budget(900, 'USD')]);
  expect(
    screen.getByText(translate('reports.analytics.noActiveBudget'))
  ).toBeTruthy();
  expect(
    screen.queryByText(translate('reports.analytics.setBudget'))
  ).toBeNull();
});
