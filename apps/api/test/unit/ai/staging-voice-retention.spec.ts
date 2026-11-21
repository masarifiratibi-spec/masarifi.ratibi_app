import { createHash } from 'node:crypto';
import { AiWorker } from '../../../src/ai/ai.worker';

it.each([true, false])(
  'the shared engine honors authoritative canary media retention=%s',
  async (retainAcceptanceEvidence) => {
    const audio = Buffer.alloc(44);
    audio.write('RIFF');
    audio.write('WAVE', 8);
    const account = '11111111-1111-4111-8111-111111111111';
    const recordedAt = new Date().toISOString();
    const input = {
      contractVersion: 3,
      retainAcceptanceEvidence,
      storageRef: 'fixture/audio',
      sizeBytes: 44,
      contentType: 'audio/wav',
      contentHash: createHash('sha256').update(audio).digest('hex'),
      locale: 'en',
      recordedAt,
      timezoneOffsetMinutes: -180,
      defaultAccountId: account,
      operationId: 'fixture',
      aliases: [
        {
          alias: 'ACCOUNT-1',
          id: account,
          kind: 'account',
          version: 1,
          data: { currency: 'SAR', type: 'cash' },
        },
      ],
    };
    let retained = true,
      accepted = false;
    const repository = {
      renewVoiceWork: () => Promise.resolve(true),
      workInput: () => Promise.resolve(input),
      getRoute: () => Promise.resolve({ limits: { outputTokens: 1200 }, safetyRules: [] }),
      acceptVoiceBatch: () => {
        accepted = true;
        return Promise.resolve({ accepted: true });
      },
      recordFailure: () => Promise.resolve(),
      completeWork: () => Promise.resolve(),
    };
    const gateway = {
      complete: () => Promise.resolve({ value: { complete: true, language: 'en', events: [] } }),
    };
    const storage = {
      download: () => Promise.resolve(audio),
      delete: () => {
        retained = false;
        return Promise.resolve();
      },
    };
    const worker = new AiWorker(
      repository as never,
      storage as never,
      gateway as never,
      { getRequired: () => 120 } as never,
    );
    expect(
      await worker.processVoiceClaim({
        kind: 'voice.transcribe_extract',
        id: 'fixture',
        user_id: 'fixture',
        claim_token: 'fixture',
        attempt_count: 1,
      }),
    ).toBe(true);
    expect(accepted).toBe(true);
    expect(retained).toBe(retainAcceptanceEvidence);
  },
);
