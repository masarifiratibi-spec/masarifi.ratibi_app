import React from 'react';
import { render } from '@testing-library/react-native';
import { changeLocale, translate } from '@/localization/i18n';
import { FinancialRefreshStatus } from './FinancialRefreshStatus';

it.each(['ar', 'en'] as const)(
  'labels retained financial data during refresh and failure in %s',
  (locale) => {
    changeLocale(locale);
    const view = render(
      <FinancialRefreshStatus
        query={{ dataUpdatedAt: 1, isFetching: true, isError: false }}
      />
    );
    expect(
      view.getByText(translate('coreFinance.state.refreshingSnapshot'))
    ).toBeTruthy();
    view.rerender(
      <FinancialRefreshStatus
        query={{ dataUpdatedAt: 1, isFetching: false, isError: true }}
      />
    );
    expect(
      view.getByText(translate('coreFinance.state.refreshFailedSnapshot'))
    ).toBeTruthy();
    view.rerender(
      <FinancialRefreshStatus
        query={{ dataUpdatedAt: 0, isFetching: true, isError: false }}
      />
    );
    expect(
      view.queryByText(translate('coreFinance.state.refreshingSnapshot'))
    ).toBeNull();
  }
);
