import { randomUUID } from 'node:crypto';
import { prioritizeImportFixtureMarks } from './import-reconcile-fixture';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import {
  EngagementRepository,
  type SourceNotificationClaim,
} from '../../../src/engagement/engagement.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { EngagementWorker } from '../../../src/engagement/engagement.worker';

describeLiveDatabase('N+1 regression: direct assistant reads and batched database work', () => {
  const pool = createLivePool();
  const owner = `nplusone_${randomUUID()}`;
  const other = `nplusone_${randomUUID()}`;
  const principal = { userId: owner, sessionId: 'nplusone-session', factorAgeSeconds: 0 };
  const templateKeys: string[] = [];
  const conversationId = randomUUID(),
    questionId = randomUUID(),
    answerId = randomUUID(),
    previewId = randomUUID();

  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      owner,
      other,
    ]);
    await pool.query('insert into public.assistant_conversations(id,user_id) values($1,$2)', [
      conversationId,
      owner,
    ]);
    await pool.query(
      `insert into public.assistant_messages(id,user_id,conversation_id,role,content_redacted,work_status,context_payload,created_at)
       values($1,$2,$3,'user','My question','completed','{"timezone":"Asia/Riyadh"}',now()-interval '1 second')`,
      [questionId, owner, conversationId],
    );
    await pool.query(
      `insert into public.assistant_messages(id,user_id,conversation_id,reply_to_message_id,role,content_redacted,work_status)
       values($1,$2,$3,$4,'assistant','My answer','completed')`,
      [answerId, owner, conversationId, questionId],
    );
    await pool.query(
      `insert into public.assistant_response_snapshots(user_id,message_id,schema_version,evidence_refs,model,provider)
       values($1,$2,1,'[{"kind":"budget","alias":"BUDGET-1","version":8}]','approved-model','approved-provider')`,
      [owner, answerId],
    );
    await pool.query(
      `insert into public.assistant_action_previews(id,user_id,message_id,schema_version,action_type,payload,status,expires_at)
       values($1,$2,$3,1,'savings_goal.create','{}','validated',now()+interval '10 minutes')`,
      [previewId, owner, answerId],
    );
  });
  afterAll(async () => {
    try {
      await pool.query(
        'delete from private.notification_deliveries where user_id=any($1::text[])',
        [[owner, other]],
      );
      await pool.query('delete from public.notification_events where user_id=any($1::text[])', [
        [owner, other],
      ]);
      await pool.query('delete from public.notification_templates where key=any($1::text[])', [
        templateKeys,
      ]);
      await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query("set local masarifi.ai_privacy_delete='on'");
          await client.query('delete from public.profiles where id=any($1::text[])', [
            [owner, other],
          ]);
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });
    } finally {
      await pool.onModuleDestroy();
    }
  });

  it.each(['response', 'preview'] as const)(
    'returns only the requested %s and its question with private fields removed',
    async (kind) => {
      let statements = 0;
      const countedPool = Object.create(pool) as typeof pool;
      countedPool.withClient = (work) =>
        pool.withClient((client) =>
          work(
            new Proxy(client, {
              get(target, key): unknown {
                if (key !== 'query') return Reflect.get(target, key);
                return (sql: string, values?: unknown[]) => {
                  statements += 1;
                  return client.query(sql, values);
                };
              },
            }),
          ),
        );
      const service = new AiService(
        new AiRepository(countedPool),
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const page = await service.getResponseContext(
        principal,
        kind,
        kind === 'response' ? answerId : previewId,
      );
      expect(page.nextCursor).toBeNull();
      expect(statements).toBe(5);
      expect(page.items).toHaveLength(2);
      expect(page.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: questionId,
            content: 'My question',
            actionTimezone: 'Asia/Riyadh',
            snapshot: null,
            preview: null,
          }),
          expect.objectContaining({
            id: answerId,
            content: 'My answer',
            replyToMessageId: questionId,
            snapshot: expect.objectContaining({
              evidenceRefs: [{ kind: 'budget', alias: 'BUDGET-1', version: 8 }],
            }) as unknown,
            preview: expect.objectContaining({ id: previewId, status: 'validated' }) as unknown,
          }),
        ]),
      );
      const answer = page.items.find((row) => row.id === answerId);
      if (!answer) throw new Error('ASSISTANT_ANSWER_MISSING');
      expect(answer).not.toHaveProperty('userId');
      expect(answer.preview).not.toHaveProperty('decisionToken');
    },
  );

  it('does not disclose another owner, deleted conversations, or deleted previews', async () => {
    const repository = new AiRepository(pool);
    await expect(
      repository.responseContext({ ...principal, userId: other }, 'response', answerId),
    ).resolves.toEqual([]);
    await pool.query('update public.assistant_action_previews set deleted_at=now() where id=$1', [
      previewId,
    ]);
    await expect(repository.responseContext(principal, 'preview', previewId)).resolves.toEqual([]);
    await pool.query('update public.assistant_action_previews set deleted_at=null where id=$1', [
      previewId,
    ]);
    await pool.query(
      "update public.assistant_conversations set status='deleted',deleted_at=now() where id=$1",
      [conversationId],
    );
    await expect(repository.responseContext(principal, 'response', answerId)).resolves.toEqual([]);
    await pool.query(
      "update public.assistant_conversations set status='active',deleted_at=null where id=$1",
      [conversationId],
    );
  });

  it('keeps template locale and preferences per owner and inserts all channels idempotently', async () => {
    const eventType = `audit.batch_${randomUUID().replaceAll('-', '')}`;
    templateKeys.push(eventType);
    await pool.query(
      `insert into public.notification_templates(key,locale,channel,template_version,body,status,published_at,system_seed)
       select $1,l,c,1,l||' update','published',now(),true from unnest(array['ar','en']) l
       cross join unnest(array['in_app','push']) c`,
      [eventType],
    );
    await pool.query(
      `insert into public.notification_preferences(user_id,event_type,channel,enabled)
       values($1,$2,'push',false)`,
      [owner, eventType],
    );
    const sources: SourceNotificationClaim[] = [owner, other].map((user_id, index) => ({
      source_event_id: randomUUID(),
      source_id: null,
      event_type: eventType,
      user_id,
      locale: index === 0 ? 'en' : 'ar',
      time_zone: 'Asia/Riyadh',
      occurred_at: new Date().toISOString(),
      expires_at: null,
    }));
    const repository = new EngagementRepository(pool, {} as never);
    const templates = await repository.loadSourceTemplatesBatch(sources);
    expect(
      templates.map((rows) => rows.map((row) => [row.locale, row.channel, row.enabled])),
    ).toEqual([
      [
        ['en', 'in_app', true],
        ['en', 'push', false],
      ],
      [
        ['ar', 'in_app', true],
        ['ar', 'push', true],
      ],
    ]);
    const entries = sources.map((source, index) => ({
      source,
      deliveries: (templates[index] ?? []).map((template) => ({
        channel: template.channel,
        provider: template.channel === 'in_app' ? ('database' as const) : ('push' as const),
        title: 'Safe update',
        body: template.body,
        status: template.enabled ? ('queued' as const) : ('suppressed' as const),
        errorCode: template.enabled ? undefined : 'PREFERENCE_DISABLED',
        nextAttemptAt: new Date(),
      })),
    }));
    await expect(repository.createNotificationsFromSources(entries)).resolves.toBe(2);
    await expect(repository.createNotificationsFromSources(entries)).resolves.toBe(0);
    const result = await pool.query(
      `select d.user_id,d.channel,d.status,d.error_code,e.data from private.notification_deliveries d
       join public.notification_events e on e.id=d.event_id where e.type=$1 order by d.user_id,d.channel`,
      [eventType],
    );
    expect(result.rows).toHaveLength(4);
    expect(
      result.rows.find((row) => row.user_id === owner && row.channel === 'push'),
    ).toMatchObject({
      status: 'suppressed',
      error_code: 'PREFERENCE_DISABLED',
      data: { route: 'notification_detail', targetKind: 'settings', targetId: 'notifications' },
    });
    expect(
      result.rows.find((row) => row.user_id === other && row.channel === 'push'),
    ).toMatchObject({ status: 'queued' });
  });

  it('does not let one invalid source block valid notifications in the batch', async () => {
    const eventType = `audit.failure_${randomUUID().replaceAll('-', '')}`;
    templateKeys.push(eventType);
    await pool.query(
      `insert into public.notification_templates(key,locale,channel,template_version,body,status,published_at,system_seed)
       values($1,'en','in_app',1,'Safe update','published',now(),true)`,
      [eventType],
    );
    const occurred_at = new Date().toISOString();
    const sources: SourceNotificationClaim[] = [0, 1].map((index) => ({
      source_event_id: randomUUID(),
      source_id: null,
      event_type: eventType,
      user_id: owner,
      locale: 'en',
      time_zone: 'Asia/Riyadh',
      occurred_at,
      expires_at: index === 0 ? '2000-01-01T00:00:00.000Z' : null,
    }));
    // Substitute queue input only; template reads, transactions and writes use PostgreSQL.
    const queuePool = Object.create(pool) as typeof pool;
    queuePool.withClient = (work) =>
      pool.withClient((client) =>
        work(
          new Proxy(client, {
            get(target, key): unknown {
              if (key !== 'query') return Reflect.get(target, key);
              return (sql: string, values?: unknown[]) => {
                if (sql.includes('from private.outbox_events o'))
                  return Promise.resolve({ rows: sources });
                if (sql.includes('enqueue_credit_card_due_reminders'))
                  return Promise.resolve({ rows: [] });
                return client.query(sql, values);
              };
            },
          }),
        ),
      );
    const worker = new EngagementWorker(
      new EngagementRepository(queuePool, {} as never),
      {} as never,
      {} as never,
      {
        getRequired: () => 100,
      } as never,
    );
    await expect(worker.runJob('source.consume')).resolves.toBe(2);
    const created = await pool.query(
      'select source_event_id from public.notification_events where type=$1',
      [eventType],
    );
    expect(created.rows).toEqual([{ source_event_id: sources[1]?.source_event_id }]);
  });

  it('reconciles a bounded batch using one UPDATE statement, including zero-item sessions', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        const ids = [randomUUID(), randomUUID(), randomUUID()];
        for (const [index, id] of ids.entries()) {
          await client.query(
            `insert into public.import_sessions(id,user_id,source_type,request_hash,item_count,updated_at)
             values($1,$2,'manual',$3,9,'1900-01-01'::timestamptz + $4::integer*interval '1 second')`,
            [id, owner, id.replaceAll('-', '').repeat(2), index],
          );
        }
        for (const [index, status] of ['parsed', 'rejected', 'failed'].entries()) {
          await client.query(
            `insert into public.import_items(user_id,session_id,source_item_key,normalized_hash,source_hash,status)
             values($1,$2,$3,repeat('a',64),repeat('b',64),$4)`,
            [owner, ids[0], `item-${String(index)}`, status],
          );
        }
        await prioritizeImportFixtureMarks(client, ids);
        await client.query('create temporary table nplusone_updates(count integer) on commit drop');
        await client.query('insert into nplusone_updates values(0)');
        await client.query('grant all on nplusone_updates to masarifi_migration');
        await client.query(`create function pg_temp.count_nplusone_updates() returns trigger language plpgsql as $$
          begin update pg_temp.nplusone_updates set count=count+1; return null; end $$`);
        await client.query(`create trigger nplusone_statement_count after update on public.import_sessions
          for each statement execute function pg_temp.count_nplusone_updates()`);
        const result = await client.query<{ changed: number }>(
          'select private.reconcile_import_sessions(2) changed',
        );
        expect(result.rows[0]?.changed).toBe(2);
        expect(
          (await client.query<{ count: number }>('select count from nplusone_updates')).rows[0]
            ?.count,
        ).toBe(1);
        const counts = await client.query(
          'select item_count,accepted_count,rejected_count from public.import_sessions where id=any($1::uuid[]) order by updated_at,id',
          [ids],
        );
        expect(counts.rows).toEqual(
          expect.arrayContaining([
            { item_count: 3, accepted_count: 0, rejected_count: 2 },
            { item_count: 0, accepted_count: 0, rejected_count: 0 },
            { item_count: 9, accepted_count: 0, rejected_count: 0 },
          ]),
        );
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('skips locked import sessions so concurrent workers can reconcile different batches', async () => {
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      await pool.query(
        `insert into public.import_sessions(id,user_id,source_type,request_hash,item_count,updated_at)
         values($1,$2,'manual',$3,9,'1900-01-01')`,
        [id, owner, id.replaceAll('-', '').repeat(2)],
      );
    }
    try {
      await prioritizeImportFixtureMarks(pool, ids);
      await pool.withClient(async (locker) => {
        await locker.query('begin');
        try {
          await locker.query('select id from public.import_sessions where id=$1 for update', [
            ids[0],
          ]);
          expect(
            (await pool.query('select private.reconcile_import_sessions(1) changed')).rows[0]
              ?.changed,
          ).toBe(1);
          expect(
            (
              await pool.query('select item_count from public.import_sessions where id=$1', [
                ids[0],
              ])
            ).rows[0]?.item_count,
          ).toBe(9);
          expect(
            (
              await pool.query('select item_count from public.import_sessions where id=$1', [
                ids[1],
              ])
            ).rows[0]?.item_count,
          ).toBe(0);
        } finally {
          await locker.query('rollback');
        }
      });
    } finally {
      await pool.query('delete from public.import_sessions where id=any($1::uuid[])', [ids]);
      await pool.query(
        'delete from private.import_reconcile_changes where session_id=any($1::uuid[])',
        [ids],
      );
    }
  });

  it.each([0, 1001, null])('rejects invalid reconciliation batch limit %s', async (limit) => {
    await expect(
      pool.query('select private.reconcile_import_sessions($1)', [limit]),
    ).rejects.toMatchObject({ message: 'IMPORT_RECONCILE_LIMIT_INVALID' });
  });

  it('includes missing questions in one page lookup and preserves the legacy cursor', async () => {
    const repo = new AiRepository(pool);
    const service = new AiService(
      repo,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const lookup = jest.spyOn(repo, 'responseQuestions');
    const legacy = await service.listMessages(principal, conversationId, { limit: 1 });
    expect(lookup).not.toHaveBeenCalled();
    const enriched = await service.listMessages(principal, conversationId, {
      limit: 1,
      includeQuestions: 'true',
    });
    expect(enriched).toMatchObject({
      ...legacy,
      questions: [expect.objectContaining({ id: questionId })],
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(
      await repo.responseQuestions({ ...principal, userId: other }, conversationId, [questionId]),
    ).toEqual([]);
  });

  it('skips pre-reset financial events while retaining newer events and app reminders', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          "insert into private.financial_reset_receipts values($1,$2,1,'2026-01-02')",
          [owner, randomUUID()],
        );
        const sources = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-01'].map(
          (occurred_at, source_index) => ({
            source_index,
            user_id: owner,
            occurred_at,
            event_type: source_index === 3 ? 'reminder.app_inactive.3d' : 'transaction.created',
          }),
        );
        await client.query('set local role masarifi_worker');
        const result = await client.query(
          'select source_index from private.eligible_notification_sources($1) order by source_index',
          [JSON.stringify(sources)],
        );
        expect(result.rows).toEqual([{ source_index: 2 }, { source_index: 3 }]);
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('closes a resolved review with correct counts and emits its final version exactly once', async () => {
    const id = randomUUID();
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          `insert into public.import_sessions(id,user_id,source_type,request_hash,status,updated_at)
          values($1,$2,'manual',repeat('a',64),'review','1890-01-01')`,
          [id, owner],
        );
        await prioritizeImportFixtureMarks(client, [id]);
        await client.query('select private.reconcile_import_sessions(1)');
        await client.query('select private.reconcile_import_sessions(1)');
        const receipt = await client.query(
          `select s.status,s.completed_at is not null completed,
          o.payload->>'version'=s.version::text current_version from public.import_sessions s
          join private.outbox_events o on o.aggregate_id=s.id and o.event_type='import.session.changed.v1'
          where s.id=$1 and o.payload->>'status'='complete'`,
          [id],
        );
        expect(receipt.rows).toEqual([
          { status: 'complete', completed: true, current_version: true },
        ]);
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('restricts the direct assistant function to the API role', async () => {
    const result = await pool.query(`select role,
      has_function_privilege(role,'private.get_assistant_response_context(text,uuid,uuid)','execute') allowed
      from unnest(array['anon','authenticated','service_role','masarifi_worker','masarifi_api']) role`);
    expect(result.rows).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: false },
      { role: 'service_role', allowed: false },
      { role: 'masarifi_worker', allowed: false },
      { role: 'masarifi_api', allowed: true },
    ]);
  });
});
