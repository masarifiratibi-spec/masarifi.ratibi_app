import { TrackingService } from '../../../src/tracking/tracking.service';
const principal = { userId: 'dev-owner', sessionId: 'dev-session', factorAgeSeconds: 0 };
const input = {
  deviceId: 'aaaaaaaa-1111-4111-8111-111111111111',
  smsActivationId: '42',
  deviceRegistration: {
    deviceFingerprint: 'synthetic-fingerprint',
    platform: 'android',
    appVersion: '1.0.0',
  },
  remindersEnabled: false,
  foreground: true,
  reminderLocale: 'en',
  reminderTimeZone: 'Asia/Riyadh',
};
describe('public release installation enrollment boundary', () => {
  function setup(enabled = true) {
    const registered: unknown[] = [];
    const enrolled: unknown[] = [];
    const service = new TrackingService(
      {
        ruleSnapshot: () => Promise.resolve({ rolloutMode: 'review' }),
        enrollInstallation: (...args: unknown[]) => {
          enrolled.push(args);
          return Promise.resolve({ rolloutMode: 'automatic' });
        },
      } as never,
      {} as never,
      {} as never,
      {
        registerDevice: (...args: unknown[]) => {
          registered.push(args);
          return Promise.resolve({ device: { id: 'bbbbbbbb-1111-4111-8111-111111111111' } });
        },
      } as never,
      { get: (key: string) => key === 'MASARIFI_MOBILE_AUTOMATION_ENABLED' && enabled } as never,
    );
    return {
      registered,
      enrolled,
      invoke: (body: unknown = input) => service.deviceRuleSnapshot(principal, body),
      legacyRead: () => service.ruleSnapshot(principal, input.deviceId),
    };
  }
  it('refuses enrollment when the generic server feature is disabled', async () => {
    const disabled = setup(false);
    await expect(disabled.invoke()).rejects.toMatchObject({ status: 404 });
    expect(disabled.registered).toEqual([]);
  });
  it('leaves legacy GET clients in their existing mode without enrolling a device', async () => {
    const legacy = setup();
    await expect(legacy.legacyRead()).resolves.toMatchObject({ rolloutMode: 'review' });
    expect(legacy.registered).toEqual([]);
    expect(legacy.enrolled).toEqual([]);
  });
  it.each([
    { ...input, userId: 'other-owner' },
    { ...input, smsActivationId: '9223372036854775808' },
    { ...input, foreground: 'true' },
    { ...input, reminderTimeZone: '../invalid' },
    { ...input, reminderLocale: 'de' },
    { ...input, deviceRegistration: { ...input.deviceRegistration, pushToken: 'untrusted' } },
  ])('rejects invalid input before registration (%j)', async (body) => {
    const value = setup();
    await expect(value.invoke(body)).rejects.toMatchObject({ status: 400 });
    expect(value.registered).toEqual([]);
  });
  it('enrolls a public release user without a DEV header and binds the registered server device', async () => {
    const value = setup();
    const result = await value.invoke();
    expect(result).toMatchObject({ rolloutMode: 'automatic' });
    expect(result.configurationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(value.registered).toEqual([[principal, input.deviceRegistration]]);
    expect(value.enrolled).toEqual([
      [
        principal,
        {
          deviceId: input.deviceId,
          notificationDeviceId: 'bbbbbbbb-1111-4111-8111-111111111111',
          smsActivationId: '42',
          remindersEnabled: false,
          foreground: true,
          reminderLocale: 'en',
          reminderTimeZone: 'Asia/Riyadh',
        },
      ],
    ]);
  });
});
