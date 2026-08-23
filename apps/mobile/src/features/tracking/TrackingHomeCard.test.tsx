import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { TrackingStatusSnapshot } from '@/domain/automatic-tracking';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { TrackingHomeCard } from './TrackingHomeCard';
import { useTrackingStatus } from './useAutomaticTracking';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./useAutomaticTracking', () => ({ useTrackingStatus: jest.fn() }));

const mockUseTrackingStatus = useTrackingStatus as jest.Mock;

function status(
  overrides: Partial<TrackingStatusSnapshot> = {}
): TrackingStatusSnapshot {
  return {
    platform: 'android',
    mode: 'review_all',
    permissionStatus: 'not_requested',
    serviceState: 'healthy',
    lastDetectedAt: null,
    lastSuccessfulTransactionId: null,
    detectedThisMonth: 0,
    reviewCount: 0,
    activeKeywordCount: 0,
    activeSenderCount: 0,
    lastUpdatedAt: 0,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
});

it('opens tracking for an Android user who has not answered permission yet', () => {
  mockUseTrackingStatus.mockReturnValue({
    data: status(),
    isLoading: false,
    isError: false
  });

  renderWithProviders(<TrackingHomeCard />);
  fireEvent.press(screen.getByRole('button'));

  expect(screen.getByText(translate('tracking.home.enableTitle'))).toBeTruthy();
  expect(router.push).toHaveBeenCalledWith('/tracking');
});

it.each([
  'granted',
  'denied',
  'permanently_denied',
  'revoked',
  'unavailable'
] as const)(
  'stays hidden after Android permission is %s',
  (permissionStatus) => {
    mockUseTrackingStatus.mockReturnValue({
      data: status({ permissionStatus }),
      isLoading: false,
      isError: false
    });

    renderWithProviders(<TrackingHomeCard />);

    expect(screen.queryByRole('button')).toBeNull();
  }
);

it.each([
  { data: status({ platform: 'ios', permissionStatus: null }) },
  { data: undefined, isLoading: true },
  { data: undefined, isError: true }
])('stays hidden for an ineligible or unresolved state', (query) => {
  mockUseTrackingStatus.mockReturnValue({
    isLoading: false,
    isError: false,
    ...query
  });

  renderWithProviders(<TrackingHomeCard />);

  expect(screen.queryByRole('button')).toBeNull();
});
