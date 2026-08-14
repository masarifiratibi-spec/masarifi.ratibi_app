import React from 'react';

import { HomeScreen } from '@/features/home/HomeScreen';
import { rewritePhoneCopy } from '@/features/notifications/notification-policy';
import { buildAssistantSupportContext } from '@/features/support/support-context';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import {
  makeAssistantResponse,
  makeNotificationEvent
} from '@/test-utils/assistant-notifications-fixtures';
import type { HomeSummary } from '@/domain/core-finance';

const canary = 'SPEC010_PRIVATE_CANARY';

test('canary values stay out of visible and accessible privacy surfaces', () => {
  const screen = renderWithProviders(<HomeScreen summary={summary} />);
  const phone = rewritePhoneCopy(
    {
      ...makeNotificationEvent(1),
      messageValues: { body: canary, amount: '123 SAR' }
    },
    { hideSensitiveValues: true }
  );
  const support = buildAssistantSupportContext(
    {
      ...makeAssistantResponse(1),
      question: canary
    },
    { appVersion: '1.0.0' }
  );

  expect(screen.getByLabelText(translate('designSystem.privacy.hidden'))).toBeTruthy();
  expect(JSON.stringify(screen.toJSON())).not.toContain(canary);
  expect(JSON.stringify(phone)).not.toContain(canary);
  expect(JSON.stringify(support)).not.toContain(canary);
});

const summary: HomeSummary = {
  totalBalanceMinor: 9_999_999,
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
