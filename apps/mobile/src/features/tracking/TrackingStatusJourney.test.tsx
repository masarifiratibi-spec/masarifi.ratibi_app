import React from 'react';
import { screen } from '@testing-library/react-native';

import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { renderWithQueryData } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import { TrackingStatusScreen } from './TrackingStatusScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) }
}));

describe('TrackingStatusJourney', () => {
  it('shows status, recovery, and explanations', async () => {
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

    expect(
      screen.getByText(translate('tracking.status.enabled'))
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('tracking-permission-warning-banner')
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.permission.warning'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('tracking.howItWorks.detection'))
    ).toBeOnTheScreen();
  });
});
