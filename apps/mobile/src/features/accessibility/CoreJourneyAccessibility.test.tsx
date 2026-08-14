import React from 'react';

import { AppPrivacyGate } from '@/features/security/AppPrivacyGate';
import { SyncConflictScreen } from '@/features/transactions/SyncConflictScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { fixtureTransactions, makeConflict } from '@/test-utils/core-finance-fixtures';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate, changeLocale } from '@/localization/i18n';
import type { HomeSummary } from '@/domain/core-finance';

beforeEach(() => changeLocale('en'));

test('core journey exposes persistent names, roles, states, and non-color status text', () => {
  const home = renderWithProviders(<HomeScreen summary={homeSummary} />);
  expect(home.getByText(translate('coreFinance.home.title'))).toBeTruthy();
  expect(home.getByLabelText(translate('capture.manual'))).toBeTruthy();

  const conflict = makeConflict(fixtureTransactions[0]);
  const screen = renderWithQueryData(<SyncConflictScreen id={conflict.id} />, [
    [coreFinanceKeys.conflict(conflict.id), conflict]
  ]);
  expect(screen.getByText(translate('coreFinance.conflict.local'))).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.conflict.later'))).toBeTruthy();
  expect(screen.getByLabelText(translate('coreFinance.conflict.keepLocal')).props.accessibilityRole).toBe('button');
  expect(screen.getByLabelText(translate('coreFinance.conflict.keepLater')).props.accessibilityRole).toBe('button');
});

test('privacy protection is announced without exposing hidden content', () => {
  const screen = renderWithProviders(
    <AppPrivacyGate locked>
      <HomeScreen summary={homeSummary} />
    </AppPrivacyGate>
  );

  expect(screen.queryByText(translate('coreFinance.home.title'))).toBeNull();
  expect(screen.getByText(translate('appShell.security.protectedContent')).props.accessibilityLiveRegion).toBe('polite');
});

const homeSummary: HomeSummary = {
  totalBalanceMinor: 10_000,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 0,
  periodExpenseMinor: 500,
  activeAccountCount: 1,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};
