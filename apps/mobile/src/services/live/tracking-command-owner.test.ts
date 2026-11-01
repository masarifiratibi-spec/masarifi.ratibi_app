import { createLiveAutomaticTrackingService } from './automatic-tracking-service';
import { captureLiveClerkIdentity } from './auth-service';
import { useAppShellStore } from '@/state/app-shell';

jest.mock('./auth-service', () => ({
  ...jest.requireActual('./auth-service'),
  captureLiveClerkIdentity: jest.fn()
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

it.each(
  (['clear', 'mode', 'keywords', 'sender'] as const).flatMap((kind) =>
    (['read', 'token'] as const).map((stage) => [kind, stage] as const)
  )
)(
  'does not apply a %s command to a replacement owner during %s',
  async (kind, stage) => {
    const previous = useAppShellStore.getState().session;
    const session = {
      userId: 'a',
      status: 'authenticated' as const,
      method: 'google' as const,
      restoration: 'restored' as const,
      issuedAt: 1,
      expiresAt: 9999999999999
    };
    useAppShellStore.setState({ session });
    jest.mocked(captureLiveClerkIdentity).mockImplementation(async () => {
      if (stage === 'token')
        useAppShellStore.setState({ session: { ...session, userId: 'b' } });
      return {
        userId: 'a',
        token: 'token',
        sessionId: 'session-a',
        assertCurrent: async () => undefined
      };
    });
    const request = jest.fn(async (_url: unknown, options?: RequestInit) => {
      if (options?.method === 'GET' && stage === 'read')
        useAppShellStore.setState({ session: { ...session, userId: 'b' } });
      return new Response(
        JSON.stringify(
          kind === 'mode'
            ? { sourceRetentionDays: 0, historyRetentionDays: 7, version: 1 }
            : { items: [], nextCursor: null }
        ),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    const service = createLiveAutomaticTrackingService({
      token: async () => 'token',
      request: request as typeof fetch
    });
    try {
      const command =
        kind === 'clear'
          ? service.clearHistory()
          : kind === 'mode'
            ? service.setMode('paused')
            : kind === 'keywords'
              ? service.saveKeywordRules(
                  [
                    {
                      id: 'draft',
                      group: 'financial',
                      language: 'en',
                      value: 'salary',
                      normalizedValue: 'salary',
                      origin: 'custom',
                      enabled: true
                    }
                  ],
                  []
                )
              : service.saveSenderRule({
                  sender: 'Bank',
                  displayLabel: 'Bank',
                  institutionKey: null,
                  origin: 'custom',
                  enabled: true,
                  trusted: false
                });
      await expect(command).rejects.toMatchObject({
        code: 'permission_required'
      });
      expect(
        request.mock.calls.every(([, options]) => options?.method === 'GET')
      ).toBe(true);
    } finally {
      useAppShellStore.setState({ session: previous });
    }
  }
);
