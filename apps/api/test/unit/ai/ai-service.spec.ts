import { AiService } from '../../../src/ai/ai.service';

const owner = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
const proposalId = '99000000-0000-4000-8000-000000000011';
const accountId = '99000000-0000-4000-8000-000000000013';

it('projects database session rows to the exact public polling contract', async () => {
  const publicSession = {
    id: proposalId,
    locale: 'en',
    status: 'processing',
    durationMs: 2832,
    expiresAt: '2099-10-03T00:00:00.000Z',
    confirmedAt: null,
    failureCode: null,
    version: 3,
    createdAt: '2026-10-02T00:00:00.000Z',
  };
  const service = new AiService(
    {
      getVoiceSession: () =>
        Promise.resolve({
          ...publicSession,
          contentType: 'audio/m4a',
          sizeBytes: 46885,
          finalizedAt: publicSession.createdAt,
          operationId: accountId,
          attemptCount: 1,
          nextAttemptAt: publicSession.createdAt,
          updatedAt: publicSession.createdAt,
          deletedAt: null,
        }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  expect(await service.getVoiceSession(owner, proposalId)).toEqual(publicSession);
});

describe('Voice availability gate', () => {
  it.each([
    [false, true],
    [true, false],
  ])(
    'denies flag=%s route=%s before any session/upload/financial side effects',
    async (enabled, available) => {
      const repository = {
        workloadAvailable: jest.fn(() => Promise.resolve(available)),
        createVoiceSession: jest.fn(),
      };
      const storage = { signedUpload: jest.fn() };
      const ledger = { createTransaction: jest.fn() };
      const service = new AiService(
        repository as never,
        storage as never,
        ledger as never,
        {} as never,
        {} as never,
        {} as never,
        { getRequired: () => enabled } as never,
      );
      await expect(
        service.createVoiceSession(
          owner,
          { locale: 'ar', durationMs: 1000, contentType: 'audio/mp4', sizeBytes: 64 },
          'voice-create-fixture',
        ),
      ).rejects.toMatchObject({ status: 503, response: { code: 'AI_UNAVAILABLE' } });
      expect(repository.createVoiceSession).not.toHaveBeenCalled();
      expect(storage.signedUpload).not.toHaveBeenCalled();
      expect(ledger.createTransaction).not.toHaveBeenCalled();
      if (!enabled) expect(repository.workloadAvailable).not.toHaveBeenCalled();
    },
  );

  it('returns a private upload only after eligibility, without changing finances', async () => {
    const repository = {
      workloadAvailable: () => Promise.resolve(true),
      createVoiceSession: () =>
        Promise.resolve({
          resource: {
            id: proposalId,
            storageRef: 'private-fixture',
            contentType: 'audio/mp4',
            sizeBytes: 64,
            version: 1,
            locale: 'en',
            status: 'uploaded',
            durationMs: 1000,
            expiresAt: '2026-10-02T01:00:00.000Z',
            createdAt: '2026-10-02T00:00:00.000Z',
            uploadDeadline: '2026-10-02T00:00:00.000Z',
          },
        }),
    };
    const ledger = { createTransaction: jest.fn() };
    const service = new AiService(
      repository as never,
      {
        signedUpload: () =>
          Promise.resolve({
            url: 'https://storage.example.test/private-upload',
            token: 'fixture',
            headers: {},
          }),
      } as never,
      ledger as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getRequired: (key: string) => (key === 'MASARIFI_AI_PROVIDER_ENABLED' ? true : 300),
        get: () => undefined,
      } as never,
    );
    await expect(
      service.createVoiceSession(
        owner,
        {
          locale: 'en',
          durationMs: 1000,
          contentType: 'audio/mp4',
          sizeBytes: 64,
          contentHash: 'a'.repeat(64),
          recordedAt: new Date().toISOString(),
          timezoneOffsetMinutes: 0,
        },
        'voice-create-fixture',
      ),
    ).resolves.toEqual({
      session: {
        id: proposalId,
        version: 1,
        locale: 'en',
        status: 'uploaded',
        durationMs: 1000,
        expiresAt: '2026-10-02T01:00:00.000Z',
        createdAt: '2026-10-02T00:00:00.000Z',
        confirmedAt: null,
        failureCode: null,
      },
      upload: {
        method: 'PUT',
        path: '/api/v1/voice/sessions/' + proposalId + '/audio',
        expiresAt: '2026-10-02T00:00:00.000Z',
      },
    });
    expect(ledger.createTransaction).not.toHaveBeenCalled();
  });
});

describe('AiService financial action bridge', () => {
  const repository = {
    operationId: jest.fn(() => '99000000-0000-4000-8000-000000000014'),
    claimAction: jest.fn(),
    completeAction: jest.fn(() => Promise.resolve({})),
    setConsent: jest.fn(() =>
      Promise.resolve({ resource: { policyVersion: 'assistant-privacy-v1', version: 4 } }),
    ),
  };
  const ledger = {
    createTransaction: jest.fn<
      Promise<unknown>,
      [{ principal: typeof owner; body: Record<string, unknown>; idempotencyKey?: string }]
    >(),
    reviseTransaction: jest.fn(),
  };
  const service = new AiService(
    repository as never,
    {} as never,
    ledger as never,
    {} as never,
    {} as never,
    {} as never,
    { getRequired: jest.fn(() => false) } as never,
  );

  it('rejects incomplete legacy Voice authorization before claiming or changing finances', async () => {
    await expect(
      service.confirmVoice(owner, proposalId, { expectedVersion: 1 }, 'voice-confirm-key-0001'),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_FAILED' } });
    expect(repository.claimAction).not.toHaveBeenCalled();
    expect(ledger.createTransaction).not.toHaveBeenCalled();
  });

  it('passes the consent version through grant and revoke commands', async () => {
    await expect(
      service.grantConsent(
        owner,
        { policyVersion: 'assistant-privacy-v1', accepted: true, expectedVersion: 3 },
        'grant-consent-key',
      ),
    ).resolves.toMatchObject({ version: 4 });
    await service.revokeConsent(owner, 4, 'revoke-consent-key');

    expect(repository.setConsent.mock.calls).toEqual([
      [owner, 'assistant-privacy-v1', true, 3, 'grant-consent-key'],
      [owner, 'assistant-privacy-v1', false, 4, 'revoke-consent-key'],
    ]);
  });
});
