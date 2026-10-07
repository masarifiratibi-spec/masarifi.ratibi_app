import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('native assistant result and recovery under the API role', () => {
  const pool = createLivePool();
  const repository = new AiRepository(pool);
  const service = new AiService(
    repository,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const owner = {
    userId: `native_owner_${randomUUID()}`,
    sessionId: 'native-test',
    factorAgeSeconds: 0,
  };
  const other = { ...owner, userId: `native_other_${randomUUID()}` };
  let conversationId: string;
  let messageId: string;
  const key = `native-question-${randomUUID()}`;
  const input = {
    content: 'Sample spending?',
    intent: 'spending_summary',
    answer: 'Sample SAR 12.50',
    context: { timezone: 'Asia/Riyadh' },
    evidence: [],
    responseMode: 'async',
  };

  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
      throw new Error('DISPOSABLE_LOCAL_DATABASE_REQUIRED');
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      owner.userId,
      other.userId,
    ]);
    await repository.setConsent(
      owner,
      'assistant-privacy-v1',
      true,
      1,
      `native-consent-${randomUUID()}`,
    );
    const created = await repository.createConversation(
      owner,
      'Native contract sample',
      `native-create-${randomUUID()}`,
    );
    conversationId = String((Reflect.get(created, 'resource') as Record<string, unknown>).id);
  });
  afterAll(() => pool.onModuleDestroy());

  it('returns a numeric conversation version from the real pg projection', async () => {
    const row = await repository.getConversation(owner, conversationId);
    expect(row.version).toEqual(expect.any(Number));
    expect(row.updatedAt).toEqual(expect.any(String));
  });
  it('returns 404 for a truly absent acceptance, rather than a database permission error', async () => {
    await expect(repository.messageAcceptance(owner, conversationId, key)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('persists, reads and replays exactly one deterministic question/answer pair without a provider', async () => {
    const accepted = await repository.saveDeterministicMessage(owner, conversationId, input, key);
    messageId = String((Reflect.get(accepted, 'resource') as Record<string, unknown>).id);
    await expect(repository.messageAcceptance(owner, conversationId, key)).resolves.toMatchObject({
      id: messageId,
      status: 'completed',
    });
    await expect(service.getMessageResult(owner, conversationId, messageId)).resolves.toMatchObject(
      {
        status: 'completed',
        request: { content: 'Sample spending?' },
        response: {
          content: 'Sample SAR 12.50',
          snapshot: { model: 'deterministic-v1', provider: 'masarifi' },
        },
      },
    );
    await repository.saveDeterministicMessage(owner, conversationId, input, key);
    const turns = await repository.recentConversationTurns(owner, conversationId, 20);
    expect(turns.map((turn) => turn.content)).toEqual(['Sample spending?', 'Sample SAR 12.50']);
    const listed = await service.listMessages(owner, conversationId, { limit: 20 });
    expect(listed.items.map((item) => item.id)).toContain(messageId);
  });
  it('does not disclose another owner’s acceptance, result or history', async () => {
    await expect(repository.messageAcceptance(other, conversationId, key)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.getMessageResult(other, conversationId, messageId)).rejects.toMatchObject({
      status: 404,
    });
    expect(await repository.recentConversationTurns(other, conversationId, 20)).toEqual([]);
  });
  it('accepts and replays a typed question with no client intent hint', async () => {
    const typedService = new AiService(
      repository,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        resolve: () =>
          Promise.resolve({
            answer: 'Sample typed SAR 12.50',
            context: {},
            evidence: [],
          }),
      } as never,
      {} as never,
    );
    const typedKey = `native-typed-${randomUUID()}`;
    const body = { content: 'How much did I spend?', responseMode: 'async' };
    const accepted = await typedService.createMessage(owner, conversationId, body, typedKey);
    expect(accepted.status).toBe('completed');
    const replay = await typedService.createMessage(owner, conversationId, body, typedKey);
    expect(replay).toEqual({ ...accepted, replayed: true });
    await expect(
      typedService.getMessageResult(owner, conversationId, String(accepted.id)),
    ).resolves.toMatchObject({
      status: 'completed',
      response: { content: 'Sample typed SAR 12.50' },
    });
  });
  it('preserves forced RLS and denies raw writes and public-client reads', async () => {
    const result = await pool.query<{ safe: boolean }>(`select bool_and(
      c.relrowsecurity and c.relforcerowsecurity
      and has_table_privilege('masarifi_api',c.oid,'SELECT')
      and not has_table_privilege('masarifi_api',c.oid,'INSERT,UPDATE,DELETE')
      and not has_table_privilege('anon',c.oid,'SELECT')
      and not has_table_privilege('authenticated',c.oid,'SELECT')
    ) safe from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('assistant_messages','assistant_response_snapshots','assistant_action_previews')`);
    expect(result.rows[0]?.safe).toBe(true);
  });
});
