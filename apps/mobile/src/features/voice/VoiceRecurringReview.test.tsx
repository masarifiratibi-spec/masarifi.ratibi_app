import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceRecurringReview } from './VoiceRecurringReview';

it('requires an explicit recurring or obligation choice', () => {
  const change = jest.fn();
  renderWithProviders(
    <VoiceRecurringReview
      value={{
        kind: 'existing_obligation', cadence: 'monthly',
        candidateObligationIds: ['car'], confidence: 95, confirmed: false
      }}
      onChange={change}
    />
  );
  fireEvent.press(screen.getByText(translate('voice.recurring.existing')));
  expect(change).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true }));
});
