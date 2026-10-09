import { presentTrackingConfirmation } from './tracking-save-confirmation';
import { requestJson } from './live/http-client';
import { phoneNotificationService } from './platform/phone-notification-service';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';

jest.mock('./live/http-client', () => ({ requestJson: jest.fn() }));
jest.mock('./automatic-tracking-service', () => ({
  automaticTrackingService: {}
}));
jest.mock('./live/core-finance-service', () => ({
  synchronizeLiveCoreFinance: jest.fn()
}));
jest.mock('./platform/phone-notification-service', () => ({
  phoneNotificationService: { getPermission: jest.fn(async () => 'granted') }
}));
jest.mock('./platform/tracking-native-runtime.android', () => ({
  trackingNativeRuntime: {
    presentCaptureConfirmation: jest.fn(async () => true)
  }
}));
const notificationId = '20000000-0000-4000-8000-000000000019';
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
  usePreferenceStore.setState({ locale: 'en' });
  jest
    .mocked(phoneNotificationService.getPermission)
    .mockResolvedValue('granted');
});
it.each(['en', 'ar'] as const)(
  'shows ledger amount, currency and direction in the %s confirmation',
  async (locale) => {
    usePreferenceStore.setState({ locale });
    jest.mocked(requestJson).mockResolvedValue({
      notificationId,
      ready: true,
      allowed: true,
      transaction: {
        id: '30000000-0000-4000-8000-000000000001',
        amountMinor: 125,
        currency: 'EGP',
        direction: 'outgoing'
      }
    });
    expect(await presentTrackingConfirmation('owner', notificationId)).toBe(
      true
    );
    expect(
      trackingNativeRuntime?.presentCaptureConfirmation
    ).toHaveBeenCalledWith(
      'owner',
      notificationId,
      expect.any(String),
      expect.stringContaining('EGP')
    );
    const body = jest.mocked(trackingNativeRuntime!.presentCaptureConfirmation)
      .mock.calls[0]?.[3];
    expect(body).toContain(locale === 'ar' ? '١٫٢٥' : '1.25');
    expect(body).toContain(locale === 'ar' ? 'مصروف' : 'Expense');
  }
);
it('waits for committed server delivery eligibility without presenting success early', async () => {
  jest
    .mocked(requestJson)
    .mockResolvedValue({ notificationId, ready: false, allowed: false });
  expect(await presentTrackingConfirmation('owner', notificationId)).toBe(
    false
  );
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
it('uses the existing currency precision for a three-decimal currency', async () => {
  jest
    .mocked(requestJson)
    .mockResolvedValue({
      notificationId,
      ready: true,
      allowed: true,
      transaction: {
        id: '30000000-0000-4000-8000-000000000001',
        amountMinor: 125,
        currency: 'BHD',
        direction: 'incoming'
      }
    });
  await presentTrackingConfirmation('owner', notificationId);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).toHaveBeenCalledWith(
    'owner',
    notificationId,
    expect.any(String),
    'Incoming: 0.125 BHD'
  );
});
it('does not present a popup when notification permission is denied', async () => {
  jest
    .mocked(requestJson)
    .mockResolvedValue({ notificationId, ready: true, allowed: true });
  jest
    .mocked(phoneNotificationService.getPermission)
    .mockResolvedValue('denied');
  expect(await presentTrackingConfirmation('owner', notificationId)).toBe(true);
  expect(
    trackingNativeRuntime?.presentCaptureConfirmation
  ).not.toHaveBeenCalled();
});
