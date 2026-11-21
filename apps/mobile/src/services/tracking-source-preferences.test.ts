import { TrackingSourcePreferences } from './tracking-source-preferences';

it('persists a notification destination while preserving SMS consent and boundaries', async () => {
  const original = { smsEnabled: true, notificationEnabled: true, smsActivatedAt: 1000, smsActivationId: '42', notificationActivatedAt: 2000 };
  const storage = memoryStorage(JSON.stringify(original));
  const preferences = new TrackingSourcePreferences(storage);
  const accountId = '10000000-0000-4000-8000-000000000002';
  await preferences.setNotificationAccount(accountId);
  expect(await new TrackingSourcePreferences(storage).load()).toEqual({ ...original, notificationAccountId: accountId });
  await preferences.setNotificationAccount(null);
  expect(await preferences.load()).toEqual(original);
});

it('rejects a malformed notification account before saving preferences', async () => {
  const storage = memoryStorage();
  await expect(new TrackingSourcePreferences(storage).setNotificationAccount('not-an-account')).rejects.toThrow();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('persists the native ID boundary for SMS received in the activation millisecond', async () => {
  const storage = memoryStorage();
  const preferences = new TrackingSourcePreferences(storage, async () => ({
    activatedAt: 1000,
    afterId: '42'
  }));
  await preferences.set('sms', true);
  expect(await new TrackingSourcePreferences(storage).load()).toMatchObject({
    smsActivatedAt: 1000,
    smsActivationId: '42'
  });
});

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key: string, next: string) => {
      value = next;
    }),
    removeItem: jest.fn(async () => {
      value = null;
    })
  };
}

it('persists SMS and notification sources independently', async () => {
  const preferences = new TrackingSourcePreferences(memoryStorage());

  await preferences.set('sms', true);
  await preferences.set('notification', true);
  await preferences.set('sms', false);

  await expect(preferences.load()).resolves.toMatchObject({
    smsEnabled: false,
    notificationEnabled: true
  });
});

it('falls back to both sources disabled for malformed storage', async () => {
  const preferences = new TrackingSourcePreferences(memoryStorage('{bad'));

  await expect(preferences.load()).resolves.toEqual({
    smsEnabled: false,
    notificationEnabled: false
  });
});

it('preserves each source activation boundary across restart and resets only on re-enable', async () => {
  const storage = memoryStorage();
  const clock = jest.spyOn(Date, 'now');
  clock.mockReturnValue(1000);
  const preferences = new TrackingSourcePreferences(storage);
  await preferences.set('sms', true);
  clock.mockReturnValue(2000);
  await preferences.set('notification', true);
  expect(await new TrackingSourcePreferences(storage).load()).toMatchObject({
    smsActivatedAt: 1000,
    notificationActivatedAt: 2000
  });
  await preferences.set('sms', true);
  expect(await preferences.load()).toMatchObject({ smsActivatedAt: 1000 });
  await preferences.set('sms', false);
  clock.mockReturnValue(3000);
  await preferences.set('sms', true);
  expect(await preferences.load()).toMatchObject({
    smsActivatedAt: 3000,
    notificationActivatedAt: 2000
  });
  clock.mockRestore();
});
