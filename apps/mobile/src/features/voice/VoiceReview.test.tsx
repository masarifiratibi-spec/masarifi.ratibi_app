import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceReview } from './VoiceReview';

it('separates payment method and account and confirms uncertainty', () => {
  const proposal = fixtureProposalGroup({
    scenario: 'low_confidence', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  }).proposals[0];
  const change = jest.fn();
  const confirm = jest.fn();
  renderWithProviders(
    <VoiceReview
      proposal={proposal}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={change}
      onConfirmField={confirm}
      onRemove={jest.fn()}
    />
  );
  expect(screen.getByText(translate('voice.review.paymentMethod'))).toBeTruthy();
  expect(screen.getByText(translate('voice.review.account'))).toBeTruthy();
  fireEvent.press(screen.getByText(translate('voice.review.confirmField')));
  expect(confirm).toHaveBeenCalledWith('amount');
});
