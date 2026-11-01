import { AiRepository } from '../../../src/ai/ai.repository';

it('serializes the actual get-conversation projection with updatedAt separately from lastMessageAt', async () => {
  const query = jest.fn((sql: string) =>
    Promise.resolve({
      rows: sql.startsWith('select id,title')
        ? [
            {
              id: '99000000-0000-4000-8000-000000000001',
              title: 'Sample',
              status: 'active',
              last_message_at: new Date('2026-09-03T00:00:00Z'),
              created_at: new Date('2026-09-03T00:00:00Z'),
              ...(sql.includes('updated_at')
                ? { updated_at: new Date('2026-09-03T00:00:02Z') }
                : {}),
              // node-postgres returns PostgreSQL bigint columns as strings.
              version: '2',
            },
          ]
        : [],
    }),
  );
  const repository = new AiRepository({
    withClient: async (callback: (client: unknown) => Promise<unknown>) => callback({ query }),
  } as never);
  await expect(
    repository.getConversation(
      { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 },
      '99000000-0000-4000-8000-000000000001',
    ),
  ).resolves.toMatchObject({
    updatedAt: '2026-09-03T00:00:02.000Z',
    lastMessageAt: '2026-09-03T00:00:00.000Z',
    version: 2,
  });
});

it.each(['9007199254740993', '0', '-1', 'invalid', null])(
  'rejects an unrepresentable conversation version %s instead of losing its concurrency fence',
  async (version) => {
    const repository = new AiRepository({
      withClient: async (callback: (client: unknown) => Promise<unknown>) =>
        callback({
          query: (sql: string) =>
            Promise.resolve({
              rows: sql.startsWith('select id,title') ? [{ version }] : [],
            }),
        }),
    } as never);
    await expect(
      repository.getConversation(
        { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 },
        '99000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_CONVERSATION_SCHEMA_INVALID' } });
  },
);
