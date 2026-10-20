import {
  presentTrackingConfirmation,
  reconcileTrackingSaves
} from './tracking-save-confirmation';
import { automaticTrackingService } from './automatic-tracking-service';
import {
  createLiveLedgerService,
  synchronizeLiveCoreFinance
} from './live/core-finance-service';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { subscribeTrackingSaves } from './tracking-save-events';
import { useAppShellStore } from '@/state/app-shell';
import { ensureTrackingSyncDevice } from './tracking-sync-device';
import { coreFinanceService } from './mocks/core-finance-service';
import Constants from 'expo-constants';
import { resolveClientRuntime } from '@/config/client-runtime';
import { usePreferenceStore } from '@/state/preferences';
import { openDatabase } from '@/storage/database';
jest.mock('expo-constants', () => ({
  expoConfig: { android: { package: 'com.masarifi.mobile.dev' } }
}));
jest.mock('@/config/client-runtime', () => ({
  resolveClientRuntime: jest.fn(() => ({
    apiUrl: 'https://api.staging.masarifiratibi.com',
    mode: 'live'
  }))
}));
jest.mock('@/state/preferences', () => ({
  usePreferenceStore: { getState: jest.fn(() => ({ locale: 'ar' })) }
}));
jest.mock('@/storage/database', () => ({
  openDatabase: jest.fn()
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
  createLiveLedgerService: jest.fn(),
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
  jest
    .mocked(usePreferenceStore.getState)
    .mockReturnValue({ locale: 'ar' } as never);
  jest.mocked(openDatabase).mockResolvedValue({
    getFirstAsync: jest.fn(async () => ({
      accountName: 'الحساب الافتراضي',
      categoryAr: 'التسوق',
      categoryEn: 'Shopping'
    }))
  } as never);
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
    .mocked(createLiveLedgerService)
    .mockReset()
    .mockReturnValue({
      getTransaction: coreFinanceService.getTransaction
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
it('verifies a DEV save independently of category mapping preparation', async () => {
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
    .mockRejectedValue(new Error('category mapping unavailable'));
  const readConfirmedTransaction = jest.fn().mockResolvedValue({
    id: '10000000-0000-4000-8000-000000000011',
    type: 'expense',
    amountMinor: 100,
    currencyCode: 'SAR',
    title: 'متجر الاختبار',
    status: 'posted',
    source: 'automatic',
    syncStatus: 'synced',
    deletedAt: null
  });
  jest.mocked(createLiveLedgerService).mockReturnValueOnce({
    getTransaction: readConfirmedTransaction
  } as never);

  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(readConfirmedTransaction).toHaveBeenCalledWith(
    '10000000-0000-4000-8000-000000000011'
  );
  expect(coreFinanceService.getTransaction).not.toHaveBeenCalled();
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).toHaveBeenCalledTimes(1);
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
      expect.stringMatching(/^دفع · .*1\.00.*SAR$/u),
      'متجر الاختبار · التسوق\nالحساب الافتراضي'
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
    expect.stringMatching(/^إيداع · .*1\.250.*KWD$/u),
    expect.stringContaining('إيداع')
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
it('refreshes the accepted server balance while retaining a failed cache synchronization for retry', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  jest.mocked(synchronizeLiveCoreFinance).mockRejectedValueOnce(new Error('INTERNAL_ERROR'));
  const refresh = jest.fn();
  const unsubscribe = subscribeTrackingSaves(refresh);
  try {
    await expect(reconcileTrackingSaves('owner', 'session')).rejects.toThrow('INTERNAL_ERROR');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith({
      ownerId: 'owner',
      transactionIds: ['10000000-0000-4000-8000-000000000011']
    });
    expect(trackingNativeRuntime?.presentCaptureConfirmation).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
  }
});
it('does not refresh a different owner after cache synchronization fails', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: null
    }
  ]);
  jest.mocked(synchronizeLiveCoreFinance).mockImplementationOnce(async () => {
    useAppShellStore.setState({ session: null });
    throw new Error('INTERNAL_ERROR');
  });
  const refresh = jest.fn();
  const unsubscribe = subscribeTrackingSaves(refresh);
  try {
    await expect(reconcileTrackingSaves('owner', 'session')).rejects.toThrow('INTERNAL_ERROR');
    expect(refresh).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});
it('presents a verified DEV save while whole-finance synchronization is still pending', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  let release!: () => void;
  jest.mocked(synchronizeLiveCoreFinance).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  let completed = false;
  const reconciliation = reconcileTrackingSaves('owner', 'session').then(
    (value) => {
      completed = true;
      return value;
    }
  );
  try {
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(
      trackingNativeRuntime?.presentCaptureConfirmation
    ).toHaveBeenCalledWith(
      'owner',
      '20000000-0000-4000-8000-000000000019',
      expect.stringMatching(/^دفع · .*1\.00.*SAR$/u),
      expect.stringContaining('متجر الاختبار')
    );
    expect(completed).toBe(false);
  } finally {
    release();
    await reconciliation;
  }
});
it('still waits for finance refresh when the independent notice fails', async () => {
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  const failure = new Error('native_unavailable');
  jest
    .mocked(trackingNativeRuntime!.presentCaptureConfirmation)
    .mockRejectedValueOnce(failure);
  let release!: () => void;
  jest.mocked(synchronizeLiveCoreFinance).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  let completed = false;
  const reconciliation = reconcileTrackingSaves('owner', 'session').catch(
    (error) => {
      completed = true;
      return error;
    }
  );
  try {
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    expect(completed).toBe(false);
  } finally {
    release();
  }
  expect(await reconciliation).toBe(failure);
});
it('keeps the early-notice path out of non-Staging environments', async () => {
  jest.mocked(resolveClientRuntime).mockReturnValueOnce({
    mode: 'live',
    apiUrl: 'https://outside-qualified-staging.invalid'
  } as never);
  jest.mocked(automaticTrackingService.listImportOutcomes!).mockResolvedValue([
    {
      itemId: 'item',
      status: 'accepted',
      transactionId: '10000000-0000-4000-8000-000000000011',
      notificationId: '20000000-0000-4000-8000-000000000019'
    }
  ]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(synchronizeLiveCoreFinance).toHaveBeenCalledTimes(1);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
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
it('shows English transaction content without a saved-status heading', async () => {
  jest
    .mocked(usePreferenceStore.getState)
    .mockReturnValue({ locale: 'en' } as never);
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([
      {
        itemId: 'item',
        status: 'accepted',
        transactionId: '10000000-0000-4000-8000-000000000011',
        notificationId: '20000000-0000-4000-8000-000000000019'
      }
    ]);
  await reconcileTrackingSaves('owner', 'session');
  expect(
    trackingNativeRuntime!.presentCaptureConfirmation
  ).toHaveBeenCalledWith(
    'owner',
    '20000000-0000-4000-8000-000000000019',
    'Payment · 1.00\u00a0SAR',
    'متجر الاختبار · Shopping\nالحساب الافتراضي'
  );
  expect(openDatabase).toHaveBeenCalledWith('owner');
});
it('still presents verified transaction details when optional cached labels are unavailable', async () => {
  jest
    .mocked(openDatabase)
    .mockRejectedValueOnce(new Error('cache unavailable'));
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([
      {
        itemId: 'item',
        status: 'accepted',
        transactionId: '10000000-0000-4000-8000-000000000011',
        notificationId: '20000000-0000-4000-8000-000000000019'
      }
    ]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(true);
  expect(
    trackingNativeRuntime!.presentCaptureConfirmation
  ).toHaveBeenCalledWith(
    'owner',
    '20000000-0000-4000-8000-000000000019',
    expect.stringMatching(/^دفع · /u),
    'متجر الاختبار'
  );
});
it('does not present cached details after ownership changes while reading them', async () => {
  jest.mocked(openDatabase).mockImplementationOnce(async () => {
    useAppShellStore.setState({ session: null });
    throw new Error('owner changed');
  });
  jest
    .mocked(automaticTrackingService.listImportOutcomes!)
    .mockResolvedValue([
      {
        itemId: 'item',
        status: 'accepted',
        transactionId: '10000000-0000-4000-8000-000000000011',
        notificationId: '20000000-0000-4000-8000-000000000019'
      }
    ]);
  expect(await reconcileTrackingSaves('owner', 'session')).toBe(false);
  expect(
    trackingNativeRuntime!.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
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
