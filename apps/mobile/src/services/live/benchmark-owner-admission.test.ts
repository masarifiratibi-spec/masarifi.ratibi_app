import { z } from 'zod';
import * as SecureStore from 'expo-secure-store';
import { useAppShellStore } from '@/state/app-shell';
import {
  benchmarkEnvironment,
  installBenchmarkEnvironment
} from '@/test-utils/benchmark-runtime';
import {
  captureLiveClerkOwner,
  captureLiveReadClerkIdentity,
  createLiveAuthService,
  createLiveIdentityService,
  getLiveClerkToken,
  registerLiveClerkBridge,
  type LiveClerkBridge
} from './auth-service';
import { requestJson } from './http-client';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

const expectedOwner = benchmarkEnvironment.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
const otherOwner = 'user_otherOwner';
const deniedOwner = {
  code: 'forbidden',
  domainCode: 'BENCHMARK_OWNER_NOT_ADMITTED'
};
function fixture(userId = expectedOwner) {
  let current = {
    id: 'session-owner',
    userId,
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: Date.now() + 60000
  };
  const bridge = {
    getSession: jest.fn(async () => current),
    getToken: jest.fn(async () => 'inert-token'),
    startPhone: jest.fn(),
    verifyPhone: jest.fn(async () => ({
      status: 'authenticated' as const,
      session: {
        ...current,
        status: 'authenticated' as const,
        restoration: 'restored' as const
      }
    })),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(async () => current),
    reverifyConflict: jest.fn(async () => current),
    signOut: jest.fn()
  } satisfies LiveClerkBridge;
  return {
    bridge,
    changeOwner(next: string) {
      current = { ...current, userId: next };
    }
  };
}
beforeEach(() => {
  useAppShellStore.setState({ session: null });
  jest.clearAllMocks();
});

test.each(['missing pin', 'invalid pin', 'wrong restored owner'] as const)(
  '%s blocks bootstrap and tokens without signing out or deleting data',
  async (scenario) => {
    const restoreEnvironment = installBenchmarkEnvironment();
    if (scenario === 'missing pin')
      delete process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID;
    if (scenario === 'invalid pin')
      process.env.EXPO_PUBLIC_BENCHMARK_OWNER_ID = 'not-a-clerk-user';
    const { bridge } = fixture(
      scenario === 'wrong restored owner' ? otherOwner : expectedOwner
    );
    const request = jest.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const network = jest.spyOn(global, 'fetch').mockImplementation(request);
    try {
      const restore = (async () => {
        registerLiveClerkBridge(bridge);
        await createLiveAuthService(bridge).restoreSession();
        await createLiveIdentityService().getProfileSetup();
      })();
      if (scenario === 'wrong restored owner')
        await expect(restore).rejects.toMatchObject(deniedOwner);
      else await expect(restore).rejects.toThrow(/benchmark/i);
    const profile = createLiveIdentityService().getProfileSetup();
    if (scenario === 'wrong restored owner')
      await expect(profile).rejects.toMatchObject(deniedOwner);
    else await expect(profile).rejects.toThrow(/benchmark/i);
      const bootstrap = (async () => {
        registerLiveClerkBridge(bridge);
        return requestJson(
          '/api/v1/sync/bootstrap',
          z.object({ ok: z.boolean() })
        );
      })();
      if (scenario === 'wrong restored owner')
        await expect(bootstrap).rejects.toMatchObject(deniedOwner);
      else await expect(bootstrap).rejects.toThrow(/benchmark/i);
      expect(bridge.getToken).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      expect(bridge.signOut).not.toHaveBeenCalled();
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
      expect((await bridge.getSession()).userId).toBe(
        scenario === 'wrong restored owner' ? otherOwner : expectedOwner
      );
    } finally {
      restoreEnvironment();
      network.mockRestore();
    }
  }
);

test.each(['google', 'phone', 'reverification'] as const)(
  'wrong %s result never exposes an authenticated financial owner',
  async (method) => {
    const restoreEnvironment = installBenchmarkEnvironment();
    const { bridge } = fixture(otherOwner);
    try {
      const service = createLiveAuthService(bridge);
      const result =
        method === 'google'
          ? service.signInWithGoogle()
          : method === 'phone'
            ? service.verifyPhone({ sessionId: 'attempt', code: '123456' })
            : service.reverifyConflict({} as never);
      await expect(result).rejects.toMatchObject(deniedOwner);
      expect(bridge.getToken).not.toHaveBeenCalled();
      expect(bridge.signOut).not.toHaveBeenCalled();
    } finally {
      restoreEnvironment();
    }
  }
);

test('matching owner can restore and read /me and bootstrap through real financial transport', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  const { bridge } = fixture();
  const profile = {
    id: expectedOwner,
    displayName: null,
    primaryEmailMasked: null,
    phoneMasked: null,
    locale: 'en',
    timezone: 'Asia/Riyadh',
    status: 'active',
    version: 1
  };
  const request = jest.fn(
    async (url: RequestInfo | URL) =>
      new Response(
        JSON.stringify(String(url).endsWith('/me') ? profile : { ok: true }),
        { status: 200 }
      )
  );
  const network = jest.spyOn(global, 'fetch').mockImplementation(request);
  try {
    registerLiveClerkBridge(bridge);
    const auth = createLiveAuthService(bridge);
    await expect(auth.restoreSession()).resolves.toMatchObject({
      userId: expectedOwner,
      status: 'authenticated'
    });
    await auth.touchActivity();
    await expect(
      requestJson('/api/v1/sync/bootstrap', z.object({ ok: z.boolean() }))
    ).resolves.toEqual({ ok: true });
    expect(request.mock.calls.map(([url]) => String(url))).toEqual([
      `${benchmarkEnvironment.EXPO_PUBLIC_API_URL}/api/v1/me`,
      `${benchmarkEnvironment.EXPO_PUBLIC_API_URL}/api/v1/sync/bootstrap`
    ]);
    expect(bridge.getToken).toHaveBeenCalled();
  } finally {
    restoreEnvironment();
    network.mockRestore();
  }
});

test('owner changes during token retrieval cannot publish a financial credential or request', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  const f = fixture();
  f.bridge.getToken.mockImplementation(async () => {
    f.changeOwner(otherOwner);
    return 'inert-late-token';
  });
  const request = jest.fn();
  try {
    registerLiveClerkBridge(f.bridge);
    await expect(
      requestJson('/api/v1/me', z.unknown(), { request })
    ).rejects.toMatchObject(deniedOwner);
    expect(request).not.toHaveBeenCalled();
    await expect(getLiveClerkToken()).rejects.toMatchObject(deniedOwner);
    await expect(captureLiveReadClerkIdentity()).rejects.toMatchObject(
      deniedOwner
    );
  } finally {
    restoreEnvironment();
  }
});

test('wrong saved local owner is fenced while ordinary restored sessions retain their behavior', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: otherOwner,
      method: 'google',
      issuedAt: 1,
      expiresAt: Date.now() + 60000,
      restoration: 'local'
    }
  });
  try {
    await expect(captureLiveClerkOwner()).rejects.toMatchObject(deniedOwner);
  } finally {
    restoreEnvironment();
    useAppShellStore.setState({ session: null });
  }
  const { bridge } = fixture(otherOwner);
  await expect(
    createLiveAuthService(bridge).restoreSession()
  ).resolves.toMatchObject({ userId: otherOwner, status: 'authenticated' });
});

test('signed-out benchmark retains authentication UI without publishing any stale SDK token', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  const raw = fixture().bridge;
  const bridge = { ...raw, getSession: jest.fn(async () => null) };
  const request = jest.fn(async () => new Response('{}', { status: 200 }));
  try {
    registerLiveClerkBridge(bridge);
    await expect(
      createLiveAuthService(bridge).restoreSession()
    ).resolves.toMatchObject({ status: 'signed_out' });
    await expect(
      requestJson('/api/v1/me', z.unknown(), { request })
    ).rejects.toMatchObject({ code: 'session_expired' });
    expect(bridge.getToken).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(bridge.signOut).not.toHaveBeenCalled();
  } finally {
    restoreEnvironment();
  }
});
