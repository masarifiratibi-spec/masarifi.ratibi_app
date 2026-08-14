import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { renderWithQueryData } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import { TrackingStatusScreen } from './TrackingStatusScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() }
}));

describe('TrackingStatusJourney', () => {
  it('shows status, recovery, and manual fallback actions', async () => {
    renderWithQueryData(<TrackingStatusScreen />, [
      [
        automaticTrackingKeys.status,
        {
          platform: 'android',
          mode: 'automatic_clear',
          permissionStatus: 'denied',
          serviceState: 'offline',
          lastDetectedAt: null,
          lastSuccessfulTransactionId: null,
          detectedThisMonth: 2,
          reviewCount: 1,
          activeKeywordCount: 3,
          activeSenderCount: 4,
          lastUpdatedAt: 1
        }
      ]
    ]);

    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText(translate('tracking.action.manual')));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/add');
    await waitFor(() => expect(screen.queryByText('2')).toBeNull());
  });
});
