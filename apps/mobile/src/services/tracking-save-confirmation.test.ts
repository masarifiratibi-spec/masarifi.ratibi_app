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
import { coreFinanceService } from './mocks/core-finance-service';
import Constants from 'expo-constants';
jest.mock('expo-constants', () => ({
  expoConfig: { android: { package: 'com.masarifi.mobile.dev' } }
}));
jest.mock('@/config/client-runtime', () => ({
  resolveClientRuntime: () => ({
    apiUrl: 'https://api.staging.masarifiratibi.com',
    mode: 'live'
  })
}));
jest.mock('@/state/preferences', () => ({
  usePreferenceStore: { getState: () => ({ locale: 'ar' }) }
}));
jest.mock('./mocks/core-finance-service', () => ({
  coreFinanceService: { getTransaction: jest.fn() }
}));
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
  Constants.expoConfig!.android!.package = 'com.masarifi.mobile.dev';
  jest.mocked(coreFinanceService.getTransaction).mockResolvedValue({
    id: '10000000-0000-4000-8000-000000000011',
    type: 'expense',
    amountMinor: 100,
    currencyCode: 'SAR',
    title: 'متجر الاختبار',
    status: 'posted',
    source: 'automatic',
    syncStatus: 'synced',
    deletedAt: null
  } as never);
  jest
    .mocked(trackingNativeRuntime!.presentCaptureConfirmation)
    .mockResolvedValue(true);
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
it('refreshes accepted ledger effects and presents their details without waiting for push delivery', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
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
    ).toHaveBeenCalledWith(
      'owner',
      '20000000-0000-4000-8000-000000000019',
      'تم تسجيل مصروف',
      expect.stringContaining('1.00')
    );
  } finally {
    unsubscribe();
  }
});
it('presents one stable transaction identity when both channels report its acceptance', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'sms',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    },
    {
      itemId: 'notification',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  await reconcileTrackingSaves('owner', 'session');
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).toHaveBeenCalledTimes(1);
});
it('keeps the ordinary package outside DEV notification qualification', async () => {
  Constants.expoConfig!.android!.package = 'com.masarifi.mobile';
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
it('reconciles finance even when no notice was prepared', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: null
    }
  ]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(synchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
it('reports incoming money as income and formats the owned transaction currency', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest.mocked(coreFinanceService.getTransaction).mockResolvedValue({
    id: '10000000-0000-4000-8000-000000000011',
    type: 'income',
    amountMinor: 1250,
    currencyCode: 'KWD',
    title: 'إيداع',
    status: 'posted',
    source: 'automatic',
    syncStatus: 'synced',
    deletedAt: null
  } as never);
  await reconcileTrackingSaves('owner', 'session');
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).toHaveBeenCalledWith(
    'owner',
    '20000000-0000-4000-8000-000000000019',
    'تم تسجيل إيراد',
    expect.stringContaining('1.250')
  );
});
it('retries a failed presentation with the same durable notice ID', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest
    .mocked(trackingNativeRuntime!.presentCaptureConfirmation)
    .mockRejectedValueOnce(new Error('temporary_native_failure'));
  await expect(reconcileTrackingSaves('owner', 'session')).rejects.toThrow(
    'temporary_native_failure'
  );
  await reconcileTrackingSaves('owner', 'session');
  expect(
    jest
      .mocked(trackingNativeRuntime!.presentCaptureConfirmation)
      .mock.calls.map((call) => call[1])
  ).toEqual([
    '20000000-0000-4000-8000-000000000019',
    '20000000-0000-4000-8000-000000000019'
  ]);
});
it('does not present financial details after the owner changes during their lookup', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest
    .mocked(coreFinanceService.getTransaction)
    .mockImplementationOnce(async () => {
      useAppShellStore.setState({ session: null });
      return { id: '10000000-0000-4000-8000-000000000011' } as never;
    });
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(false);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
it('does not present a second notice from legacy push callbacks', async () => {
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
it('completes finance reconciliation when Android declines notification presentation', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest
    .mocked(trackingNativeRuntime!.presentCaptureConfirmation)
    .mockResolvedValueOnce(false);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(synchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
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
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
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
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
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
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest.mocked(ensureTrackingSyncDevice).mockImplementationOnce(async () => {
    useAppShellStore.setState({ session: null });
  });
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(false);
  expect(synchronizeLiveCoreFinance).not.toHaveBeenCalled();
});
