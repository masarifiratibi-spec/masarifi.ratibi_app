import {
  presentTrackingConfirmation,
  reconcileTrackingSaves
} from './tracking-save-confirmation';
import { automaticTrackingService } from './automatic-tracking-service';
import { synchronizeLiveCoreFinance } from './live/core-finance-service';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { subscribeTrackingSaves } from './tracking-save-events';
import { useAppShellStore } from '@/state/app-shell';
import { ensureTrackingSyncDevice } from './tracking-sync-device';
jest.mock('./tracking-sync-device', () => ({
  ensureTrackingSyncDevice: jest.fn()
}));
jest.mock('./automatic-tracking-service', () => ({
  automaticTrackingService: { listImportOutcomes: jest.fn() }
}));
jest.mock('./live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: jest.fn()
}));
jest.mock('./live/http-client', () => ({
  requestJson: jest.fn(async () => ({ ready: true, allowed: true }))
}));
jest.mock('./platform/phone-notification-service', () => ({
  phoneNotificationService: { getPermission: jest.fn(async () => 'granted') }
}));
jest.mock('./platform/tracking-native-runtime.android', () => ({
  trackingNativeRuntime: { presentCaptureConfirmation: jest.fn() }
}));
beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 2,
      restoration: 'restored'
    }
  });
});
it('does not acknowledge a save without a verified accepted ledger outcome', async () => {
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(false);
  expect(ensureTrackingSyncDevice).not.toHaveBeenCalled();
});
it('refreshes accepted ledger effects without waiting for a notification ID', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: 'transaction',
      notificationId: null
    }
  ]);
  const refresh = jest.fn(),
    unsubscribe = subscribeTrackingSaves(refresh);
  try {
    expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
    expect(synchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
    expect(ensureTrackingSyncDevice).toHaveBeenCalledWith('owner');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      trackingNativeRuntime?.presentCaptureConfirmation
    ).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});
it('keeps confirmed Tracking captures quiet even when notification permission exists', async () => {
  expect(
    await presentTrackingConfirmation(
      'owner',
      '20000000-0000-4000-8000-000000000019'
    )
  ).toBe(true);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
it('does not refresh or acknowledge another owners capture', async () => {
  expect(await reconcileTrackingSaves('another', 'session')).toBe(false);
  expect(synchronizeLiveCoreFinance).not.toHaveBeenCalled();
});
it('retains failure when authoritative finance synchronization fails', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: 'transaction',
      notificationId: null
    }
  ]);
  jest
    .mocked(synchronizeLiveCoreFinance)
    .mockRejectedValueOnce(new Error('offline'));
  await expect(reconcileTrackingSaves('owner', 'session')).rejects.toThrow(
    'offline'
  );
});
it('retains the capture when sync-device registration fails', async () => {
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([
      {
        itemId: 'item',
        status: 'accepted',
        transactionId: 'transaction',
        notificationId: null
      }
    ]);
  jest
    .mocked(ensureTrackingSyncDevice)
    .mockRejectedValueOnce(new Error('offline'));
  await expect(reconcileTrackingSaves('owner', 'session')).rejects.toThrow(
    'offline'
  );
  expect(synchronizeLiveCoreFinance).not.toHaveBeenCalled();
});
it('does not sync a new owner when the session changes during device registration', async () => {
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([
      {
        itemId: 'item',
        status: 'accepted',
        transactionId: 'transaction',
        notificationId: null
      }
    ]);
  jest.mocked(ensureTrackingSyncDevice).mockImplementationOnce(async () => {
    useAppShellStore.setState({ session: null });
  });
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(false);
  expect(synchronizeLiveCoreFinance).not.toHaveBeenCalled();
});
