import { AiService } from '../../../src/ai/ai.service';

it.each(['listConversations', 'listMessages'] as const)(
  'paginates %s beyond 100 rows within the SQL limit without loss',
  async (method) => {
    const principal = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
    const conversationId = '99000000-0000-4000-8000-000000000001';
    const rows = Array.from({ length: 205 }, (_, index) => ({
      id: `99000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      conversationId,
      role: 'user',
      createdAt: '2026-10-01T00:00:00.000Z',
      lastMessageAt: '2026-10-01T00:00:00.000Z',
    }));
    const repository = {
      [method]: jest.fn((...args: unknown[]) => {
        const limit = args.at(-1) as number;
        if (limit > 100) throw new Error('AI_LIMIT_INVALID');
        const cursor = args.at(-2) as { id: string | null };
        const offset = cursor.id ? rows.findIndex((row) => row.id === cursor.id) + 1 : 0;
        return Promise.resolve(rows.slice(offset, offset + limit));
      }),
    };
    const service = new AiService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const ids: unknown[] = [];
    let cursor: string | null = null;
    do {
      const query: { limit: string; cursor?: string } = {
        limit: '100',
        ...(cursor ? { cursor } : {}),
      };
      const result: { items: Record<string, unknown>[]; nextCursor: string | null } =
        method === 'listConversations'
          ? await service.listConversations(principal, query)
          : await service.listMessages(principal, conversationId, query);
      ids.push(...result.items.map((row) => row.id));
      cursor = result.nextCursor;
    } while (cursor);
    expect(ids).toEqual(rows.map((row) => row.id));
    expect(repository[method]).toHaveBeenCalledTimes(3);
  },
);
