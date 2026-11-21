import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { localDateInTimeZone } from '@/domain/financial-period';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { changeLocale, translate } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { SavingsGoalsScreen } from './SavingsGoalsScreen';
import { SavingsGoalDetailScreen } from './SavingsGoalDetailScreen';
import { SavingsGoalForm } from './SavingsGoalForm';
import { SavingsMovementForm } from './SavingsMovementForm';

jest.mock('@/services/mocks/core-finance-service', () => {
  const actual = jest.requireActual('@/services/mocks/core-finance-service');
  return {
    ...actual,
    coreFinanceService: actual.createSeededCoreFinanceService()
  };
});
jest.mock('@/services/mocks/financial-planning-service', () => {
  const actual = jest.requireActual(
    '@/services/mocks/financial-planning-service'
  );
  return {
    ...actual,
    financialPlanningService: actual.createSeededFinancialPlanningService()
  };
});

beforeEach(async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false, baseCurrencyCode: 'SAR' });
  await financialPlanningService.discardDraft('planning-form-goal:new');
  await financialPlanningService.discardDraft(
    'planning-form-goal-movement:goal-emergency'
  );
});

it('shows real progress and keeps completed goals reachable through filters', async () => {
  const screen = renderWithProviders(<SavingsGoalsScreen />);
  expect(await screen.findByText('Total saved')).toBeTruthy();
  const detail = await financialPlanningService.getGoal('goal-emergency');
  await waitFor(() =>
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)
  );
  if (detail.progress.percentage.status === 'available') {
    const percentage = detail.progress.percentage.value;
    expect(
      screen
        .getAllByRole('progressbar')
        .some(
          (node) =>
            node.props.accessibilityValue?.now === Math.min(100, percentage)
        )
    ).toBe(true);
  }
  fireEvent.press(screen.getByRole('button', { name: 'Completed' }));
  expect(screen.queryByText('Emergency fund')).toBeNull();
  expect(screen.getByRole('button', { name: 'New savings goal' })).toBeTruthy();
});

it('masks savings progress as well as amounts when balances are hidden', async () => {
  usePreferenceStore.setState({ hideBalances: true });
  const screen = renderWithProviders(
    <SavingsGoalDetailScreen goalId="goal-emergency" />
  );
  expect(await screen.findByText('Emergency fund')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByText(/\d+%/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
  expect(screen.getByRole('button', { name: 'Pause goal' })).toBeTruthy();
});

it('saves a localized goal with optional fields and removes the draft', async () => {
  changeLocale('ar');
  const screen = renderWithProviders(<SavingsGoalForm />);
  fireEvent.changeText(
    await screen.findByLabelText('اسم الهدف'),
    'هدف التجربة المعزول'
  );
  fireEvent.changeText(screen.getByLabelText('المبلغ المستهدف'), '١٢٣٫٤٥');
  fireEvent.press(screen.getByRole('button', { name: 'تفاصيل اختيارية' }));
  fireEvent.changeText(screen.getByLabelText('المبلغ المدخر حاليًا'), '٢٣٫٤٥');
  fireEvent.press(screen.getByRole('button', { name: 'حفظ الهدف' }));
  expect(
    await screen.findByText(translate('planning.state.saved'))
  ).toBeTruthy();
  const goal = (await financialPlanningService.listGoals({})).find(
    (g) => g.title === 'هدف التجربة المعزول'
  );
  expect(goal).toMatchObject({ targetMinor: 12345, openingTrackedMinor: 2345 });
  await waitFor(async () =>
    expect(
      await financialPlanningService.loadDraft('planning-form-goal:new')
    ).toBeNull()
  );
});

it('reviews an Arabic contribution without committing it before confirmation', async () => {
  changeLocale('ar');
  const before = await financialPlanningService.getGoal('goal-emergency');
  const screen = renderWithProviders(
    <SavingsMovementForm goalId="goal-emergency" />
  );
  fireEvent.changeText(await screen.findByLabelText('مبلغ الحركة'), '٥٠');
  fireEvent.press(screen.getByRole('button', { name: 'مراجعة الحركة' }));
  expect(
    await screen.findByRole('button', { name: 'تأكيد الحركة' })
  ).toBeTruthy();
  expect(await financialPlanningService.getGoal('goal-emergency')).toEqual(
    before
  );
  expect(
    screen.getByText(translate('planning.savings.trackingOnly'))
  ).toBeTruthy();
});

it('keeps missing progress unavailable rather than assuming an opening balance or zero', async () => {
  const goals = await financialPlanningService.listGoals({});
  const timeZone = usePreferenceStore.getState().timeZone;
  const today = localDateInTimeZone(Date.now(), timeZone);
  const summary = await financialPlanningService.getPlanningOverview({
    currencyCode: 'SAR',
    today,
    timeZone
  });
  const screen = renderWithQueryData(<SavingsGoalsScreen />, [
    [financialPlanningKeys.goals(), goals],
    [
      financialPlanningKeys.overview('SAR', today, timeZone),
      { ...summary, savings: [] }
    ]
  ]);
  expect(await screen.findByText('Total saved')).toBeTruthy();
  expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('does not overwrite another edit after a background goal refresh', async () => {
  const original = (await financialPlanningService.getGoal('goal-emergency'))
    .goal;
  let queryClient: QueryClient;
  function Editor() {
    queryClient = useQueryClient();
    return <SavingsGoalForm goalId={original.id} />;
  }
  const screen = renderWithProviders(<Editor />);
  const input = await screen.findByDisplayValue(original.title);
  fireEvent.changeText(input, 'Unsaved local goal title');
  await financialPlanningService.updateGoal(
    original.id,
    original.version,
    {
      title: 'Updated elsewhere',
      targetMinor: original.targetMinor + 10000,
      openingTrackedMinor: original.openingTrackedMinor,
      currencyCode: original.currencyCode,
      targetDate: original.targetDate,
      linkedAccountId: original.linkedAccountId,
      emergencyFund: original.emergencyFund
    },
    'external-update-version-test'
  );
  await act(async () => {
    await queryClient!.invalidateQueries({
      queryKey: financialPlanningKeys.goal(original.id)
    });
  });
  expect(screen.getByDisplayValue('Unsaved local goal title')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save goal' }));
  expect(
    await screen.findByText(translate('planning.state.error'))
  ).toBeTruthy();
  expect((await financialPlanningService.getGoal(original.id)).goal.title).toBe(
    'Updated elsewhere'
  );
});

it.each([
  ['reversal', 12300, 'Reversal', ''],
  ['correction', -12300, 'Correction', '−']
] as const)(
  'preserves the financial direction of a %s history row',
  async (kind, amountMinor, label, sign) => {
    const preview = await financialPlanningService.previewGoalMovement({
      goalId: 'goal-emergency',
      kind: 'contribution',
      amountMinor: 12300,
      movementDate: '2026-10-17'
    });
    const posted = await financialPlanningService.confirmGoalMovement(
      preview.previewId,
      'savings-review-contribution'
    );
    const detail = await financialPlanningService.getGoal('goal-emergency');
    const reversal = {
      ...posted.value.movement,
      id: 'history-reversal',
      kind,
      replacesMovementId: posted.value.movement.id
    };
    const screen = renderWithQueryData(
      <SavingsGoalDetailScreen goalId="goal-emergency" />,
      [
        [
          financialPlanningKeys.goal('goal-emergency'),
          {
            ...detail,
            movements: [{ ...reversal, amountMinor }]
          }
        ]
      ]
    );
    expect(await screen.findByText(label)).toBeTruthy();
    const amount = formatMinorAmount(
      Math.abs(reversal.amountMinor),
      detail.goal.currencyCode,
      'en'
    );
    expect(screen.getByText(`${sign}\u2066${amount}\u2069`)).toBeTruthy();
    expect(screen.queryByText(`+${amount}`)).toBeNull();
  }
);
