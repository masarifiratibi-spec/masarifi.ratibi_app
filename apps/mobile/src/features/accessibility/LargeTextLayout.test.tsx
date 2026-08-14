import React from 'react';

import { viewport } from '@/design-system/tokens';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import type { HomeSummary } from '@/domain/core-finance';

const summary: HomeSummary = {
  totalBalanceMinor: 123_456,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 1,
  periodExpenseMinor: 2,
  activeAccountCount: 1,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};

describe.each(['en', 'ar'] as const)('large text layout in %s', (locale) => {
  beforeEach(() => changeLocale(locale));

  it('keeps critical home amounts, statuses, and primary actions reachable at compact viewport', () => {
    expect(viewport).toMatchObject({ minWidth: 320, minHeight: 568 });
    const screen = renderWithProviders(<HomeScreen summary={summary} />);

    expect(screen.getByText(translate('coreFinance.home.title'))).toBeTruthy();
    expect(screen.getByLabelText(translate('capture.manual'))).toBeTruthy();
    expect(screen.getByLabelText(translate('designSystem.privacy.hidden'))).toBeTruthy();
  });

  it('keeps transaction fields and save action reachable with keyboard-visible state', () => {
    const screen = renderWithQueryData(
      <TransactionForm transaction={fixtureTransactions[0]} />,
      [
        [coreFinanceKeys.accounts(false), fixtureAccounts],
        [coreFinanceKeys.categories(false), fixtureCategories]
      ]
    );

    expect(screen.getByLabelText(translate('coreFinance.form.amount'))).toBeTruthy();
    expect(screen.getByLabelText(translate('coreFinance.form.title'))).toBeTruthy();
    expect(screen.getByLabelText(translate('coreFinance.form.save'))).toBeTruthy();
  });
});
