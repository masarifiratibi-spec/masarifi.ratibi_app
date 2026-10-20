import { createBankNotificationService } from './bank-notification-service';
import { createAndroidBankNotificationService } from './bank-notification-service.android';

describe('bank notification platform service', () => {
  it.each([
    ['  Synthetic Wallet\n\u0000  ', 'Synthetic Wallet'],
    ['x'.repeat(120), 'x'.repeat(100)],
    ['\u0000\n ', undefined],
    [123, undefined],
    [null, undefined]
  ])(
    'keeps only a bounded safe OS source label: %p',
    async (sourceDisplayName, expected) => {
      const native = {
        isNotificationAccessEnabled: jest.fn(),
        openNotificationAccessSettings: jest.fn(),
        setNotificationCaptureEnabled: jest.fn(),
        acknowledgeNotifications: jest.fn(),
        readRecentNotifications: jest.fn().mockResolvedValue([
          {
            key: 'source-label',
            packageName: 'example.synthetic.wallet',
            title: 'Transfer received',
            text: 'Received EGP 2 from private person',
            postedAt: 1_800_000_000_000,
            sourceDisplayName
          }
        ])
      };
      const [notification] =
        await createAndroidBankNotificationService(native).readRecent(1);
      expect(notification).toEqual({
        key: 'source-label',
        packageName: 'example.synthetic.wallet',
        title: 'Transfer received',
        text: 'Received EGP 2 from private person',
        postedAt: 1_800_000_000_000,
        ...(expected ? { sourceDisplayName: expected } : {})
      });
    }
  );

  it('is explicitly unavailable outside Android', async () => {
    const service = createBankNotificationService();

    await expect(service.getAccessState()).resolves.toBe('unavailable');
    await expect(service.readRecent(100)).resolves.toEqual([]);
    await expect(service.acknowledge(['n-1'])).resolves.toBeUndefined();
  });

  it('reads bounded valid rows and acknowledges non-empty keys', async () => {
    const native = {
      isNotificationAccessEnabled: jest.fn().mockResolvedValue(true),
      openNotificationAccessSettings: jest.fn().mockResolvedValue(undefined),
      setNotificationCaptureEnabled: jest.fn().mockResolvedValue(undefined),
      readRecentNotifications: jest.fn().mockResolvedValue([
        {
          key: 'n-1',
          packageName: 'com.bank.app',
          title: 'Bank',
          text: 'Paid SAR 10',
          postedAt: 1_800_000_000_000,
          observedAt: 1_800_000_000_125,
          discovered: true
        },
        { key: '', packageName: 'bad', title: '', text: '', postedAt: -1 }
      ]),
      acknowledgeNotifications: jest.fn().mockResolvedValue(undefined)
    };
    const service = createAndroidBankNotificationService(native);

    await expect(service.getAccessState()).resolves.toBe('granted');
    await expect(service.readRecent(500)).resolves.toEqual([
      {
        key: 'n-1',
        packageName: 'com.bank.app',
        title: 'Bank',
        text: 'Paid SAR 10',
        postedAt: 1_800_000_000_000,
        observedAt: 1_800_000_000_125,
        discovered: true
      }
    ]);
    await service.acknowledge(['', 'n-1']);
    await service.openSettings();
    await service.setCaptureEnabled(false);

    expect(native.readRecentNotifications).toHaveBeenCalledWith(100);
    expect(native.acknowledgeNotifications).toHaveBeenCalledWith(['n-1']);
    expect(native.openNotificationAccessSettings).toHaveBeenCalledTimes(1);
    expect(native.setNotificationCaptureEnabled).toHaveBeenCalledWith(false);
  });

  it('maps disabled and missing native adapters without granting access', async () => {
    const native = {
      isNotificationAccessEnabled: jest.fn().mockResolvedValue(false),
      openNotificationAccessSettings: jest.fn(),
      setNotificationCaptureEnabled: jest.fn(),
      readRecentNotifications: jest.fn(),
      acknowledgeNotifications: jest.fn()
    };

    await expect(
      createAndroidBankNotificationService(native).getAccessState()
    ).resolves.toBe('denied');
    await expect(
      createAndroidBankNotificationService(null).getAccessState()
    ).resolves.toBe('unavailable');
  });
});
