import { AiRepository } from '../../../src/ai/ai.repository';

it('binds review captures to scoped extraction without choosing automatic financial admission', async () => {
  const reached: string[] = [];
  const query = (sql: string) => {
    reached.push(sql);
    if (sql.includes('claim_sync_idempotency_key'))
      return Promise.resolve({
        rows: [{ outcome: 'new', lease_token: '99000000-0000-4000-8000-000000000002' }],
      });
    if (sql.includes('create_voice_'))
      return Promise.resolve({
        rows: [{ result: { id: '99000000-0000-4000-8000-000000000001' } }],
      });
    return Promise.resolve({ rows: [] });
  };
  const repository = new AiRepository({
    withClient: async (callback: (client: unknown) => Promise<unknown>) => callback({ query }),
  } as never);
  await repository.createVoiceReviewSession(
    { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 },
    { contentHash: 'a'.repeat(64) },
    'voice-review-admission-1',
    300,
  );
  expect(reached.filter((sql) => sql.includes('create_voice_'))).toEqual([
    'select private.create_voice_review_session($1,$2::jsonb,$3::uuid,$4) result',
  ]);
});
