import {
  parseUpdatePolicy,
  updateAvailable,
  registeredApplicationVersion,
  installedApplication,
  openAndroidStore,
  requestUpdatePolicy
} from './app-update';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '9.0.0', android: { versionCode: 999 } },
    platform: { android: { versionCode: 999 } }
  }
}));
jest.mock('expo-application', () => ({
  __esModule: true,
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '130'
}));
const policy = {
  schemaVersion: 1,
  enabled: true,
  release: { version: '1.0.1', versionCode: 140 },
  storeUrl: 'https://play.google.com/store/apps/details?id=com.masarifi.mobile'
};

test.each([
  [129, true],
  [139, true],
  [140, false],
  [141, false]
])(
  'uses installed build code %s even when the version name stays unchanged',
  (versionCode, expected) => {
    expect(
      updateAvailable(parseUpdatePolicy(policy), {
        version: '1.0.1',
        versionCode
      })
    ).toBe(expected);
  }
);
test('uses semantic numeric comparison for legacy installs and refuses unknown versions', () => {
  const next = parseUpdatePolicy({
    ...policy,
    release: { version: '1.10.0', versionCode: 200 }
  });
  expect(updateAvailable(next, { version: '1.9.0', versionCode: null })).toBe(
    true
  );
  expect(updateAvailable(next, { version: '1.10.0', versionCode: null })).toBe(
    false
  );
  expect(updateAvailable(next, { version: 'invalid', versionCode: null })).toBe(
    false
  );
  expect(
    updateAvailable(
      parseUpdatePolicy({ ...policy, enabled: false, release: null }),
      installedApplication()
    )
  ).toBe(false);
});
test('rejects malicious store URLs and malformed release metadata', () => {
  expect(() =>
    parseUpdatePolicy({ ...policy, storeUrl: 'https://evil.invalid' })
  ).toThrow();
  expect(() =>
    parseUpdatePolicy({
      ...policy,
      release: { version: '1.2', versionCode: -1 }
    })
  ).toThrow();
});
test('registers native build metadata without changing the marketing version', () => {
  expect(installedApplication()).toEqual({
    version: '1.0.0',
    versionCode: 130
  });
  expect(registeredApplicationVersion()).toBe('1.0.0+130');
});
test('opens only this package and falls back when the Play app is unavailable', async () => {
  const open = jest
    .fn()
    .mockRejectedValueOnce(new Error('no market'))
    .mockResolvedValueOnce(undefined);
  await openAndroidStore(open);
  expect(open.mock.calls).toEqual([
    ['market://details?id=com.masarifi.mobile'],
    [policy.storeUrl]
  ]);
});
test('propagates store-opening failure for a visible retry', async () => {
  await expect(
    openAndroidStore(async () => {
      throw new Error('unavailable');
    })
  ).rejects.toThrow();
});
test('uses a public policy endpoint and fails closed on an unsuccessful response', async () => {
  const request = jest.fn(async () => ({
    ok: true,
    json: async () => policy
  })) as unknown as typeof fetch;
  await expect(
    requestUpdatePolicy('https://api.example.com', request)
  ).resolves.toEqual(policy);
  expect(request).toHaveBeenCalledWith(
    'https://api.example.com/api/v1/meta/mobile-update',
    expect.objectContaining({ signal: expect.anything() })
  );
  await expect(
    requestUpdatePolicy(
      'https://api.example.com',
      async () => ({ ok: false }) as Response
    )
  ).rejects.toThrow();
  await expect(
    requestUpdatePolicy('http://api.example.com', request)
  ).rejects.toThrow();
});

test('aborts a slow public policy request and cleans up its timer', async () => {
  jest.useFakeTimers();
  try {
    const request = jest.fn(
      (_url: unknown, options: RequestInit | undefined) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () =>
            reject(new Error('cancelled'))
          );
        })
    ) as unknown as typeof fetch;
    const check = requestUpdatePolicy('https://api.example.com', request, {
      timeoutMs: 4_000
    });
    const rejected = expect(check).rejects.toThrow('cancelled');
    await jest.advanceTimersByTimeAsync(4_000);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
