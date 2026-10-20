import { SecurityService } from '../../../src/security/security.service';

describe('immediate account deletion admission', () => {
  const operationId = '9d04a565-4fe1-4e37-89a8-cb1323d65651';

  it.each([
    [undefined, operationId],
    ['short', operationId],
    ['A'.repeat(64), operationId],
    ['a'.repeat(64), 'non-uuid-operation'],
  ])(
    'requires a strong recovery capability and bound operation before execution (%s, %s)',
    async (token, key) => {
      const execute = jest.fn();
      const service = new SecurityService(
        { consumeRateLimit: () => Promise.resolve(true), execute } as never,
        { get: () => undefined, getRequired: () => 0 } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        service.execute({
          operation: 'createMyDeletionRequest',
          principal: {
            userId: 'user_disposable',
            sessionId: 'session_disposable',
            factorAgeSeconds: 0,
          },
          body: {
            confirmation: 'DELETE_MY_ACCOUNT',
            ...(token === undefined ? {} : { completionToken: token }),
          },
          query: {},
          params: {},
          requestId: 'request-1',
          idempotencyKey: key,
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(execute).not.toHaveBeenCalled();
    },
  );
});


describe('session-authorized self deletion on isolated Staging DEV', () => {
  const owner = 'user_DevDeletion123';
  const operationId = '9d04a565-4fe1-4e37-89a8-cb1323d65651';
  const configuration: Record<string, unknown> = {
    MASARIFI_PROCESS_KIND: 'api',
    SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
    MASARIFI_DELETION_COOLING_OFF_HOURS: 0,
    MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
    MASARIFI_STAGING_SELF_DELETION_OWNER_ID: owner,
  };
  const input = {
    operation: 'createMyDeletionRequest',
    principal: { userId: owner, sessionId: 'active-session', factorAgeSeconds: 36_000 },
    body: { confirmation: 'DELETE_MY_ACCOUNT', completionToken: 'a'.repeat(64) },
    query: {}, params: {}, requestId: 'dev-delete', idempotencyKey: operationId,
  };
  const service = (patch: Record<string, unknown> = {}) => {
    const values = { ...configuration, ...patch };
    return new SecurityService(
      { consumeRateLimit: () => Promise.resolve(true), execute: () => Promise.resolve({ id: 'request-one' }) } as never,
      { get: (key: string) => values[key], getRequired: (key: string) => values[key] } as never,
      {} as never, {} as never,
      { runDeletionRequestForOwner: () => Promise.resolve({ id: 'request-one', status: 'completed' }) } as never,
    );
  };
  it('completes the explicitly scoped owner request using its authenticated session without an OTP step', async () => {
    await expect(service().execute(structuredClone(input))).resolves.toMatchObject({ status: 'completed' });
  });
  it.each([
    { MASARIFI_STAGING_SELF_DELETION_OWNER_ID: undefined },
    { MASARIFI_STAGING_SELF_DELETION_OWNER_ID: 'user_OtherOwner' },
    { SUPABASE_URL: 'https://other.supabase.co' },
    { MASARIFI_PROCESS_KIND: 'worker' },
    { MASARIFI_DELETION_COOLING_OFF_HOURS: 72 },
  ])('retains recent authentication outside the exact isolated scope: %j', async (patch) => {
    await expect(service(patch).execute(structuredClone(input))).rejects.toMatchObject({ status: 403 });
  });
  it('does not relax privacy export verification for the same owner', async () => {
    await expect(service().execute({ ...input, operation: 'createMyPrivacyExport', body: {} }))
      .rejects.toMatchObject({ status: 403 });
  });
  it('refuses another owner even when that owner has just authenticated', async () => {
    await expect(service().execute({
      ...structuredClone(input),
      principal: { userId: 'user_OtherOwner', sessionId: 'another-session', factorAgeSeconds: 0 },
    })).rejects.toMatchObject({ status: 403 });
  });
  describe('all authenticated Staging owners', () => {
    const enabled = {
      MASARIFI_STAGING_SELF_DELETION_OWNER_ID: undefined,
      MASARIFI_STAGING_SELF_DELETION_ENABLED: true,
    };
    it.each(['user_NewGoogleOwner', 'user_AnotherDeviceOwner'])(
      'completes self deletion for %s without an owner allowlist or factor-age challenge',
      async (userId) => {
        await expect(service(enabled).execute({
          ...structuredClone(input),
          principal: { userId, sessionId: 'authenticated-session', factorAgeSeconds: null },
        })).resolves.toMatchObject({ status: 'completed' });
      },
    );
    it.each(['userId', 'ownerId', 'email'])(
      'rejects caller-selected %s instead of deleting a different account',
      async (field) => {
        await expect(service(enabled).execute({
          ...structuredClone(input),
          body: { ...input.body, [field]: 'user_Victim' },
        })).rejects.toMatchObject({ status: 400 });
      },
    );
    it.each([
      { MASARIFI_STAGING_SELF_DELETION_ENABLED: false },
      { SUPABASE_URL: 'https://other.supabase.co' },
      { MASARIFI_PROCESS_KIND: 'worker' },
      { MASARIFI_DELETION_COOLING_OFF_HOURS: 72 },
    ])('retains recent authentication outside the enabled Staging API: %j', async (patch) => {
      await expect(service({ ...enabled, ...patch }).execute(structuredClone(input)))
        .rejects.toMatchObject({ status: 403 });
    });
    it('keeps export verification enabled for an authenticated owner', async () => {
      await expect(service(enabled).execute({ ...input, operation: 'createMyPrivacyExport', body: {} }))
        .rejects.toMatchObject({ status: 403 });
    });
  });
});
