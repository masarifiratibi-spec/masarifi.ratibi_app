import { createEngagementApi } from './engagement-service';
import {
  getLiveClerkToken,
  registerLiveClerkBridge,
  type LiveClerkBridge
} from './auth-service';
import { useAppShellStore } from '@/state/app-shell';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
const response = (status = 200): Response =>
  ({ ok: status < 400, status, json: async () => ({}) }) as Response;
afterEach(() => jest.useRealTimers());

it('treats an actual server401 as an access denial rather than an offline response', async () => {
  const request = jest.fn(async () => response(401));
  const api = createEngagementApi({
    baseUrl: 'https://inert.invalid',
    token: async () => 'fixture-token',
    request
  });
  await expect(api.getTicket('fixture-ticket')).rejects.toMatchObject({
    code: 'forbidden'
  });
});

it('uses existing cached read credentials for GETs while retaining fresh credentials for POSTs', async () => {
  const previous = useAppShellStore.getState().session;
  const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) =>
    skipCache ? 'write-token' : 'read-token'
  );
  const clerkSession = {
    id: 'read-session',
    userId: 'owner-a',
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: 9999999999999
  };
  registerLiveClerkBridge({
    getSession: async () => clerkSession,
    getToken,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  useAppShellStore.setState({
    session: {
      ...clerkSession,
      status: 'authenticated',
      restoration: 'restored'
    }
  });
  const request = jest.fn(
    async (_url: Parameters<typeof fetch>[0], _init?: RequestInit) => response()
  );
  const api = createEngagementApi({
    baseUrl: 'https://inert.invalid',
    token: getLiveClerkToken,
    request
  });
  try {
    await api.getTicket('fixture-ticket');
    await api.markNotificationRead(
      'fixture-notification',
      1,
      'fixture-operation'
    );
    expect(
      new Headers(request.mock.calls[0][1]?.headers).get('authorization')
    ).toBe('Bearer read-token');
    expect(
      new Headers(request.mock.calls[1][1]?.headers).get('authorization')
    ).toBe('Bearer write-token');
    expect(getToken.mock.calls).toEqual([
      [{ skipCache: false }],
      [{ skipCache: true }]
    ]);
  } finally {
    useAppShellStore.setState({ session: previous });
  }
});

it('bounds an unresolved engagement GET using the existing read deadline and abort signal', async () => {
  jest.useFakeTimers();
  const request = jest.fn(
    (_url: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      new Promise<Response>(() => {})
  );
  const api = createEngagementApi({
    baseUrl: 'https://inert.invalid',
    token: async () => 'fixture-token',
    request
  });
  try {
    const rejected = expect(
      api.getTicket('fixture-ticket')
    ).rejects.toMatchObject({ code: 'provider_unavailable' });
    await jest.advanceTimersByTimeAsync(15001);
    await rejected;
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
