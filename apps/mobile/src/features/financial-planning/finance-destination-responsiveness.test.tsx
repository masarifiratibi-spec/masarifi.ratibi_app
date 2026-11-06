import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

import { CategoryListScreen } from '@/features/categories/CategoryListScreen';
import { SalaryOverviewScreen } from '@/features/salary/SalaryOverviewScreen';
import { ObligationOverviewScreen } from '@/features/obligations/ObligationOverviewScreen';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { financialPlanningService } from '@/services/financial-planning-service';
import { changeLocale, translate } from '@/localization/i18n';
import { FoundationProviders } from '@/state/FoundationProviders';
import { usePreferenceStore } from '@/state/preferences';
import { localDateInTimeZone } from '@/domain/financial-period';
import { fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { financialPlanningKeys } from './financial-planning-queries';
import { render } from '@testing-library/react-native';

jest.mock('@/services/financial-planning-service', () => {
  const actual = jest.requireActual<
    typeof import('@/services/mocks/financial-planning-service')
  >('@/services/mocks/financial-planning-service');
  return {
    ...actual,
    financialPlanningService: actual.createSeededFinancialPlanningService()
  };
});

afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false, timeZone: 'Asia/Riyadh' });
});

it('keeps category search mounted after a first read fails and through retry', async () => {
  const read = jest
    .spyOn(coreFinanceService, 'listCategories')
    .mockRejectedValueOnce(new Error('Network unavailable'));
  const view = renderWithProviders(<CategoryListScreen />);
  try {
    fireEvent.changeText(
      view.getByLabelText(translate('coreFinance.categories.search')),
      'housing'
    );
    await view.findByText(translate('coreFinance.state.error'));
    expect(view.getByDisplayValue('housing')).toBeOnTheScreen();
    expect(
      view.queryByText(translate('coreFinance.categories.empty'))
    ).toBeNull();
    read.mockResolvedValue(fixtureCategories);
    fireEvent.press(view.getByText(translate('coreFinance.action.retry')));
    await waitFor(() =>
      expect(view.queryByText(translate('coreFinance.state.error'))).toBeNull()
    );
    expect(view.getByDisplayValue('housing')).toBeOnTheScreen();
  } finally {
    view.unmount();
  }
});

it.each(['salary', 'obligations'] as const)(
  'keeps the %s cards and controls after a first read fails',
  async (kind) => {
    jest
      .spyOn(
        financialPlanningService,
        kind === 'salary' ? 'getSalaryOverview' : 'getObligationsOverview'
      )
      .mockRejectedValue(new Error('Network unavailable'));
    const view = renderWithProviders(
      kind === 'salary' ? (
        <SalaryOverviewScreen />
      ) : (
        <ObligationOverviewScreen />
      )
    );
    try {
      await view.findByText(translate('planning.state.error'));
      if (kind === 'salary') {
        expect(
          view.getByText(translate('planning.salary.cycleDetails'))
        ).toBeOnTheScreen();
        expect(
          view.queryByText(translate('planning.salary.emptySubtitle'))
        ).toBeNull();
        expect(
          view.queryByRole('button', {
            name: translate('planning.salary.confirmReceipt')
          })
        ).toBeNull();
      } else {
        expect(view.getByTestId('obligations-hero')).toBeOnTheScreen();
        fireEvent.press(
          view.getByText(translate('planning.obligation.filter.completed'))
        );
        expect(view.getByTestId('obligations-filters')).toBeOnTheScreen();
        expect(
          view.queryByText(translate('planning.obligation.noUpcoming'))
        ).toBeNull();
      }
      expect(view.getAllByText('—').length).toBeGreaterThan(0);
      expect(view.queryByText(/^0(?:\.00)?$/)).toBeNull();
    } finally {
      view.unmount();
    }
  }
);

it.each(['salary', 'obligations'] as const)(
  'refreshes the %s in the background without a loading banner',
  async (kind) => {
    const today = localDateInTimeZone(Date.now(), 'Asia/Riyadh');
    const key =
      kind === 'salary'
        ? financialPlanningKeys.salary(today, 'Asia/Riyadh')
        : [...financialPlanningKeys.obligations(), 'overview'];
    const data =
      kind === 'salary'
        ? await financialPlanningService.getSalaryOverview({
            today,
            timeZone: 'Asia/Riyadh'
          })
        : await financialPlanningService.getObligationsOverview({});
    let finish!: (value: never) => void;
    const pending = new Promise<never>((resolve) => {
      finish = resolve;
    });
    jest
      .spyOn(
        financialPlanningService,
        kind === 'salary' ? 'getSalaryOverview' : 'getObligationsOverview'
      )
      .mockReturnValue(pending);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity }
      }
    });
    client.setQueryData(key, data);
    const view = render(
      <FoundationProviders client={client}>
        {kind === 'salary' ? (
          <SalaryOverviewScreen />
        ) : (
          <ObligationOverviewScreen />
        )}
      </FoundationProviders>
    );
    try {
      let refresh!: Promise<void>;
      await act(async () => {
        refresh = client.invalidateQueries({ queryKey: key });
      });
      await waitFor(() =>
        expect(client.getQueryState(key)?.fetchStatus).toBe('fetching')
      );
      // Query notifications are scheduled; observe the committed fetching render.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(
        view.queryByText(translate('coreFinance.state.refreshingSnapshot'))
      ).toBeNull();
      expect(
        kind === 'salary'
          ? view.getByText(translate('planning.salary.cycleDetails'))
          : view.getByTestId('obligations-hero')
      ).toBeOnTheScreen();
      await act(async () => {
        finish(data as never);
        await refresh;
      });
    } finally {
      finish(data as never);
      view.unmount();
      client.clear();
    }
  }
);

it.each(['categories', 'salary', 'obligations'] as const)(
  'withdraws cached %s UI after an authoritative access denial',
  async (kind) => {
    const today = localDateInTimeZone(Date.now(), 'Asia/Riyadh');
    const key =
      kind === 'categories'
        ? coreFinanceKeys.categories(true)
        : kind === 'salary'
          ? financialPlanningKeys.salary(today, 'Asia/Riyadh')
          : [...financialPlanningKeys.obligations(), 'overview'];
    const data =
      kind === 'categories'
        ? fixtureCategories
        : kind === 'salary'
          ? await financialPlanningService.getSalaryOverview({
              today,
              timeZone: 'Asia/Riyadh'
            })
          : await financialPlanningService.getObligationsOverview({});
    const denied = { code: 'session_expired', status: 401 };
    if (kind === 'categories')
      jest
        .spyOn(coreFinanceService, 'listCategories')
        .mockRejectedValue(denied);
    else
      jest
        .spyOn(
          financialPlanningService,
          kind === 'salary' ? 'getSalaryOverview' : 'getObligationsOverview'
        )
        .mockRejectedValue(denied);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity }
      }
    });
    client.setQueryData(key, data);
    const view = render(
      <FoundationProviders client={client}>
        {kind === 'categories' ? (
          <CategoryListScreen />
        ) : kind === 'salary' ? (
          <SalaryOverviewScreen />
        ) : (
          <ObligationOverviewScreen />
        )}
      </FoundationProviders>
    );
    try {
      await act(async () => {
        await client.invalidateQueries({ queryKey: key });
      });
      await view.findByText(
        translate(
          kind === 'categories'
            ? 'coreFinance.state.error'
            : 'planning.state.error'
        )
      );
      expect(
        view.queryByLabelText(translate('coreFinance.categories.search'))
      ).toBeNull();
      expect(
        view.queryByText(translate('planning.salary.cycleDetails'))
      ).toBeNull();
      expect(view.queryByTestId('obligations-hero')).toBeNull();
    } finally {
      view.unmount();
      client.clear();
    }
  }
);
