import React from 'react';

import { HomeScreen } from '@/features/home/HomeScreen';
import { SyncConflictScreen } from '@/features/transactions/SyncConflictScreen';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { rewritePhoneCopy } from '@/features/notifications/notification-policy';
import { buildAssistantSupportContext } from '@/features/support/support-context';
import { translate } from '@/localization/i18n';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import {
  fixtureTransactions,
  makeConflict
} from '@/test-utils/core-finance-fixtures';
import {
  makeAssistantResponse,
  makeNotificationEvent
} from '@/test-utils/assistant-notifications-fixtures';
import type { HomeSummary } from '@/domain/core-finance';
import { usePreferenceStore } from '@/state/preferences';

test('hidden financial values stay out of accessible output while safe labels remain', () => {
  usePreferenceStore.setState({ hideBalances: true });
  const screen = renderWithProviders(<HomeScreen summary={summary} />);

  expect(screen.getByLabelText(translate('designSystem.privacy.hidden'))).toBeTruthy();
  expect(screen.toJSON()).not.toEqual(expect.stringContaining('123456'));
});

test('conflict effects do not expose protected account identifiers', () => {
  const conflict = makeConflict({
    ...fixtureTransactions[0],
    accountId: 'account-private-canary',
    title: 'Safe merchant label'
  });
  const screen = renderWithQueryData(<SyncConflictScreen id={conflict.id} />, [
    [coreFinanceKeys.conflict(conflict.id), conflict]
  ]);

  expect(screen.getByText(translate('coreFinance.conflict.local'))).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toContain('account-private-canary');
});

test('notification phone copy and assistant support context keep protected evidence out', () => {
  const notification = {
    ...makeNotificationEvent(1),
    messageValues: { amount: '123.45 SAR', accountId: 'account-private-canary' }
  };
  const phoneCopy = rewritePhoneCopy(notification, { hideSensitiveValues: true });
  const supportContext = buildAssistantSupportContext(makeAssistantResponse(7), {
    appVersion: '1.0.0'
  });

  expect(phoneCopy.messageValues).toEqual({ amount: 'hidden', accountId: 'hidden' });
  expect(JSON.stringify(supportContext)).not.toContain('report-7');
  expect(supportContext).toMatchObject({
    itemKind: 'assistant_response',
    diagnosticCategory: 'assistant'
  });
});

const summary: HomeSummary = {
  totalBalanceMinor: 12_345_600,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 0,
  periodExpenseMinor: 0,
  activeAccountCount: 1,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};
