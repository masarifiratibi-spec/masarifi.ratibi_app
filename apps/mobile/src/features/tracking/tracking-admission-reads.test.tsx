import React from 'react';
import { Text, Platform } from 'react-native';
import { act, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test-utils/render';
import { useAppShellStore } from '@/state/app-shell';
import {
  beginTrackingAdmission,
  admitTrackingOwner
} from '@/state/tracking-admission';
import { clearTrackingIsolation } from '@/test-utils/tracking-admission';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { useTrackingStatus } from './useAutomaticTracking';

function TrackingPreview() {
  const status = useTrackingStatus();
  return <Text>{status.data?.platform ?? status.fetchStatus}</Text>;
}

it('waits for owner admission before reading tracking and automatically loads after verification', async () => {
  const previousPlatform = Platform.OS;
  Platform.OS = 'android';
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: 'owner_tracking_reads' }
  });
  beginTrackingAdmission();
  const read = jest
    .spyOn(automaticTrackingService, 'getStatus')
    .mockResolvedValue({
      platform: 'android',
      mode: 'paused',
      permissionStatus: 'not_requested',
      serviceState: 'healthy',
      lastDetectedAt: null,
      lastSuccessfulTransactionId: null,
      detectedThisMonth: 0,
      reviewCount: 0,
      activeKeywordCount: 0,
      activeSenderCount: 0,
      lastUpdatedAt: 1
    });
  const view = renderWithProviders(<TrackingPreview />);
  try {
    await act(async () => {});
    expect(read).not.toHaveBeenCalled();
    expect(screen.getByText('idle')).toBeOnTheScreen();
    act(() => admitTrackingOwner('owner_tracking_reads'));
    expect(await screen.findByText('android')).toBeOnTheScreen();
  } finally {
    view.unmount();
    Platform.OS = previousPlatform;
    clearTrackingIsolation();
  }
});
