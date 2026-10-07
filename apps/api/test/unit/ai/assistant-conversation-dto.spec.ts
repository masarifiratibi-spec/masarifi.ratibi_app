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
              version: 2,
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
  });
});
