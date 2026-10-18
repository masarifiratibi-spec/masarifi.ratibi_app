jest.mock('@/config/demo-mode', () => ({
  ...jest.requireActual('@/config/demo-mode'),
  isFixtureModeEnabled: () => false
}));
jest.mock('@/storage/voice-batch-journal', () => ({
  loadVoiceBatches: jest.fn().mockResolvedValue([]),
  pruneVoiceBatches: jest.fn().mockResolvedValue(undefined),
  saveVoiceBatch: jest.fn().mockResolvedValue(undefined)
}));

it('uses cached read authentication in the wired Voice startup recovery while retaining fresh command authentication', async () => {
  const originalFetch = global.fetch;
  const originalApi = process.env.EXPO_PUBLIC_API_URL;
  const originalAutomatic = process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING;
  const sessionId = '55555555-5555-4555-8555-555555555555';
  const cancelled = {
    sessionId,
    batchId: null,
    status: 'cancelled',
    transactionIds: [],
    addedCount: 0,
    ledgerVersion: 0
  };
  const request = jest.fn(
    async (_url: string | URL | Request, init?: RequestInit) =>
      ({
        ok: true,
        status: 200,
        json: async () => (init?.method === 'GET' ? { items: [] } : cancelled)
      }) as Response
  );
  const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) =>
    skipCache ? 'fresh-write-token' : 'cached-read-token'
  );
  try {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
    process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING = 'true';
    global.fetch = request as typeof fetch;
    let service!: typeof import('./voice-analyzer-service').voiceAnalyzerService;
    jest.isolateModules(() => {
      const { registerLiveClerkBridge } = jest.requireActual<
        typeof import('./live/auth-service')
      >('./live/auth-service');
      registerLiveClerkBridge({
        getSession: async () => ({
          id: 'sess_live_startup',
          userId: 'user_live_startup',
          method: 'google',
          issuedAt: 1000,
          expiresAt: 61000
        }),
        getToken,
        startPhone: jest.fn(),
        verifyPhone: jest.fn(),
        resendPhone: jest.fn(),
        signInWithGoogle: jest.fn(),
        reverifyConflict: jest.fn(),
        signOut: jest.fn()
      });
      service = jest.requireActual<typeof import('./voice-analyzer-service')>(
        './voice-analyzer-service'
      ).voiceAnalyzerService;
    });
    await service.recoverBatches!();
    await service.cancelBatch!(sessionId);
    expect(
      request.mock.calls.map(([, init]) => ({
        method: init?.method,
        authorization: (init?.headers as Record<string, string>).authorization
      }))
    ).toEqual([
      { method: 'GET', authorization: 'Bearer cached-read-token' },
      { method: 'POST', authorization: 'Bearer fresh-write-token' }
    ]);
    expect(getToken.mock.calls).toEqual([
      [{ skipCache: false }],
      [{ skipCache: true }]
    ]);
  } finally {
    global.fetch = originalFetch;
    if (originalApi === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApi;
    if (originalAutomatic === undefined)
      delete process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING;
    else process.env.EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING = originalAutomatic;
  }
});
