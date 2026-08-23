import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { makeSenderRule } from '@/test-utils/automatic-tracking-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import { SenderRuleList } from './SenderRuleList';

describe('TrackingRulesJourney', () => {
  it('renders sender search, empty, and enabled states', () => {
    renderWithQueryData(<SenderRuleList />, [
      [
        automaticTrackingKeys.senders({ search: '' }),
        [makeSenderRule('masarifi-bank', { displayLabel: 'Masarifi Bank' })]
      ]
    ]);

    expect(screen.getByText('Masarifi Bank')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText(translate('tracking.senders.search')), '');
    expect(
      screen.getByLabelText(
        [
          'Masarifi Bank',
          translate('tracking.senders.enabled'),
          translate('tracking.action.disable')
        ].join(', ')
      )
    ).toBeOnTheScreen();
  });
});
