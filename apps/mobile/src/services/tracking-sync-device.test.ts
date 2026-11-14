import { ensureTrackingSyncDevice } from './tracking-sync-device';
import { captureLiveClerkIdentity } from './live/auth-service';
import { getDeviceRegistration } from './platform/phone-notification-service';

jest.mock('./live/auth-service', () => ({
  captureLiveClerkIdentity: jest.fn()
}));
jest.mock('./platform/phone-notification-service', () => ({
  getDeviceRegistration: jest.fn()
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'registration-attempt' }));
const assertCurrent = jest.fn(),
  request = jest.fn();
const originalFetch = globalThis.fetch,
  originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const registration = {
  deviceFingerprint: 'installation-fingerprint',
  platform: 'android' as const,
  appVersion: '0.0.1'
};
const registered = {
  deviceId: '20000000-0000-4000-8000-000000000001',
  registeredAt: '2026-10-14T20:00:00Z',
  version: 1
};
function response(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}
beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = request;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  jest.mocked(captureLiveClerkIdentity).mockResolvedValue({
    userId: 'owner',
    token: 'private-token',
    assertCurrent
  });
  jest.mocked(getDeviceRegistration).mockResolvedValue(registration);
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
});
it('registers this installation through the real HTTP contract without push', async () => {
  request
    .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
    .mockResolvedValueOnce(response(registered, 201));
  await ensureTrackingSyncDevice('owner');
  expect(request).toHaveBeenLastCalledWith(
    'https://api.example.test/api/v1/me/devices/register',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(registration),
      headers: expect.objectContaining({
        Authorization: 'Bearer private-token'
      })
    })
  );
  expect(JSON.parse(request.mock.calls[1]![1].body)).not.toHaveProperty(
    'pushToken'
  );
});
it('uses an existing current active device on a later page without registration', async () => {
  request
    .mockResolvedValueOnce(
      response({
        items: [{ current: false, revokedAt: null }],
        nextCursor: 'page-2'
      })
    )
    .mockResolvedValueOnce(
      response({
        items: [{ current: true, revokedAt: null }],
        nextCursor: null
      })
    );
  await ensureTrackingSyncDevice('owner');
  expect(request).toHaveBeenCalledTimes(2);
  expect(getDeviceRegistration).not.toHaveBeenCalled();
});
it('refuses repeated pagination with the actual typed HTTP error', async () => {
  request.mockResolvedValue(response({ items: [], nextCursor: 'repeated' }));
  await expect(ensureTrackingSyncDevice('owner')).rejects.toMatchObject({
    name: 'HttpError',
    code: 'contract_mismatch'
  });
  expect(getDeviceRegistration).not.toHaveBeenCalled();
});
it('does not register after an owner mismatch or failed lookup', async () => {
  await expect(ensureTrackingSyncDevice('another')).rejects.toThrow(
    'tracking_owner_changed'
  );
  expect(request).not.toHaveBeenCalled();
  request.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(ensureTrackingSyncDevice('owner')).rejects.toMatchObject({
    code: 'provider_unavailable'
  });
  expect(getDeviceRegistration).not.toHaveBeenCalled();
});
it.each(['lookup', 'metadata', 'registration'] as const)(
  'rejects a session change after %s completes',
  async (boundary) => {
    request
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response(registered));
    const successfulChecks =
      boundary === 'lookup' ? 1 : boundary === 'metadata' ? 2 : 3;
    for (let i = 0; i < successfulChecks; i++)
      assertCurrent.mockResolvedValueOnce(undefined);
    assertCurrent.mockRejectedValueOnce(new Error('owner_changed'));
    await expect(ensureTrackingSyncDevice('owner')).rejects.toThrow(
      'owner_changed'
    );
    expect(request).toHaveBeenCalledTimes(boundary === 'registration' ? 2 : 1);
    if (boundary === 'lookup')
      expect(getDeviceRegistration).not.toHaveBeenCalled();
  }
);
it.each([
  {
    body: { code: 'PROVIDER_UNAVAILABLE' },
    status: 503,
    code: 'provider_unavailable'
  },
  { body: { deviceId: 'invalid' }, status: 201, code: 'contract_mismatch' }
])(
  'retains reconciliation on registration HTTP/contract failure $code',
  async ({ body, status, code }) => {
    request
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response(body, status));
    await expect(ensureTrackingSyncDevice('owner')).rejects.toMatchObject({
      name: 'HttpError',
      code
    });
  }
);
