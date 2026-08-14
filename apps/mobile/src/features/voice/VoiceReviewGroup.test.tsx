import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { fixtureProposalGroup } from '@/services/mocks/voice-fixtures';
import { fixtureAccounts, fixtureCategories } from '@/test-utils/core-finance-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceReviewGroup } from './VoiceReviewGroup';

it('renders separate proposals and group save actions', () => {
  const save = jest.fn();
  const saveAll = jest.fn();
  const group = fixtureProposalGroup({
    scenario: 'multiple', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  renderWithProviders(
    <VoiceReviewGroup
      group={group}
      accounts={fixtureAccounts.filter((item) => item.status === 'active')}
      categories={fixtureCategories}
      onChange={jest.fn()}
      onConfirmField={jest.fn()}
      onRemove={jest.fn()}
      onSave={save}
      onSaveAll={saveAll}
      onReRecord={jest.fn()}
    />
  );
  expect(screen.getAllByText(translate('voice.review.amount'))).toHaveLength(2);
  fireEvent.press(screen.getByText(translate('voice.review.confirmSelected')));
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText(translate('voice.review.confirmAll')));
  expect(saveAll).toHaveBeenCalledTimes(1);
});
