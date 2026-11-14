import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { evaluatePromptCorpus } from '../../../src/ai/ai.worker';
import { createLivePool, describeLiveDatabase } from '../../live-database';
type AdminRow = { value: { id: string; version: number; data: Record<string, unknown> } };
function firstRow<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('EXPECTED_DATABASE_ROW');
  return row;
}

describeLiveDatabase('Task3 governed AI/import recovery', () => {
  const pool = createLivePool();
  afterAll(() => pool.onModuleDestroy());
  async function transaction(run: (client: PoolClient, actor: string) => Promise<void>) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        const actor = `task3_${randomUUID()}`;
        await client.query("insert into public.profiles(id,status) values($1,'active')", [actor]);
        await client.query(
          "insert into public.admin_profiles(user_id,status) values($1,'active')",
          [actor],
        );
        await client.query(
          "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Task3 recovery verification' from public.roles where key='super-admin'",
          [actor],
        );
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, sid: 'task3-native', role: 'authenticated' }),
        ]);
        await run(client, actor);
      } finally {
        await client.query('rollback');
      }
    });
  }
  it('scopes overview and bounded lists before pagination with unavailable attempt counts', async () =>
    transaction(async (client, actor) => {
      const marker = randomUUID();
      await client.query(
        `insert into private.ai_usage_events(user_id,workload,model,provider,request_id,platform,created_at) values($1,'financial_assistant',$2,'test',$3,'ios',now()-interval '2 days'),($1,'financial_assistant',$2,'test',$4,'android',now()-interval '60 days'),($1,'financial_assistant',$2,'test',$5,'ios',now()-interval '60 days')`,
        [actor, marker, randomUUID(), randomUUID(), randomUUID()],
      );
      for (const [platform, period, count] of [
        ['ios', '7d', 1],
        ['android', '90d', 1],
        ['ios', '90d', 2],
      ] as const) {
        const response = await client.query<AdminRow>(
          'select value from private.read_admin_ai_filtered($1,null,2,$2::jsonb)',
          ['overview', JSON.stringify({ platform, period, search: marker })],
        );
        expect(firstRow(response.rows).value.data).toMatchObject({
          requests: count,
          totalAttempts: null,
          fallbackAttempts: null,
          attribution: 'event_native_session',
        });
        expect(firstRow(response.rows).value.data.observedAt).toBeTruthy();
      }
      const first = await client.query<AdminRow>(
        'select value from private.read_admin_ai_filtered($1,null,1,$2::jsonb)',
        ['usage', JSON.stringify({ platform: 'ios', search: marker })],
      );
      const second = await client.query<AdminRow>(
        'select value from private.read_admin_ai_filtered($1,$2,1,$3::jsonb)',
        [
          'usage',
          firstRow(first.rows).value.id,
          JSON.stringify({ platform: 'ios', search: marker }),
        ],
      );
      expect(first.rows).toHaveLength(1);
      expect(second.rows).toHaveLength(1);
      expect(firstRow(first.rows).value.id).not.toBe(firstRow(second.rows).value.id);
    }));
  it('applies feature provider model status and inclusive date bounds to actual usage rows', async () =>
    transaction(async (client, actor) => {
      const provider = randomUUID(),
        model = randomUUID(),
        marker = `filter-${randomUUID()}`;
      await client.query('insert into private.ai_providers(id,key,display_name) values($1,$2,$2)', [
        provider,
        marker,
      ]);
      await client.query(
        "insert into private.ai_models(id,provider_id,model_id,capabilities,max_context,cost_policy) values($1,$2,$3,array['text'],1000,'{}')",
        [model, provider, `test/${marker}`],
      );
      await client.query(
        "insert into private.ai_usage_events(user_id,workload,model,provider,request_id,reservation_status,created_at) values($1,'voice_transcription',$2,$3,$4,'completed','2026-10-20T23:59:00Z')",
        [actor, `test/${marker}`, marker, randomUUID()],
      );
      const filters = {
        search: marker,
        feature: 'voice_parsing',
        providerId: provider,
        modelId: model,
        status: 'completed',
        dateFrom: '2026-10-20',
        dateTo: '2026-10-20',
      };
      const read = async (extra: Partial<Record<string, string>>) =>
        (
          await client.query<AdminRow>(
            "select value from private.read_admin_ai_filtered('usage',null,1,$1)",
            [JSON.stringify({ ...filters, ...extra })],
          )
        ).rows;
      expect(await read({})).toHaveLength(1);
      for (const mismatch of [
        { feature: 'financial_assistant' },
        { providerId: randomUUID() },
        { modelId: randomUUID() },
        { status: 'reserved' },
        { dateFrom: '2026-10-21' },
        { dateTo: '2026-10-19' },
      ]) {
        expect(await read(mismatch)).toHaveLength(0);
      }
    }));
  it('clones approved cases into a draft without copying successful evaluation', async () =>
    transaction(async (client, actor) => {
      await client.query(
        "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=now() where id='99030000-0000-4000-8000-000000000003'",
        [actor],
      );
      const created = await client.query<AdminRow>(
        'select private.mutate_admin_ai($1,null,null,$2,$3,$4,$5) value',
        [
          'prompts',
          JSON.stringify({
            workload: 'financial_assistant',
            template: 'Use only aliased evidence for financial answers. Never use tools.',
            schemaVersion: 1,
          }),
          actor,
          'Create a governed prompt draft',
          randomUUID(),
        ],
      );
      const draft = firstRow(created.rows).value;
      const cases = await client.query<{ source_test_case_id: string; source_version: string }>(
        'select * from private.ai_prompt_test_cases where prompt_version_id=$1',
        [draft.id],
      );
      expect(cases.rows.length).toBeGreaterThan(0);
      expect(
        cases.rows.every((row) => row.source_test_case_id && Number(row.source_version) === 1),
      ).toBe(true);
      expect(draft.data.evaluation_passed).toBe(false);
      await client.query('savepoint publish_gate');
      await expect(
        client.query('select private.publish_ai_prompt_version($1,$2,$3,$4,$5)', [
          draft.id,
          draft.version,
          actor,
          'Publish before evaluation must fail',
          randomUUID(),
        ]),
      ).rejects.toMatchObject({ message: 'AI_PROMPT_PUBLISH_CONFLICT' });
      await client.query('rollback to savepoint publish_gate');
      await client.query('select private.test_ai_prompt_version($1,$2,$3,$4,$5)', [
        draft.id,
        draft.version,
        actor,
        'Evaluate the cloned approved corpus',
        randomUUID(),
      ]);
      expect(
        firstRow(
          (
            await client.query<{ status: string }>(
              'select status from private.ai_prompt_versions where id=$1',
              [draft.id],
            )
          ).rows,
        ).status,
      ).toBe('testing');
      const claim = firstRow(
        (
          await client.query<{ claim_token: string }>(
            "select * from private.claim_ai_work('ai.evaluate_route','task3-evaluation',1,120)",
          )
        ).rows,
      );
      const input = firstRow(
        (
          await client.query<{ value: { template: string; cases: unknown[] } }>(
            'select private.get_ai_work_input($1,$2,$3) value',
            ['ai.evaluate_route', draft.id, claim.claim_token],
          )
        ).rows,
      ).value;
      evaluatePromptCorpus(input.template, input.cases);
      await client.query('select private.complete_ai_work($1,$2,$3,$4,null)', [
        'ai.evaluate_route',
        draft.id,
        claim.claim_token,
        'completed',
      ]);
      await client.query('select private.publish_ai_prompt_version($1,$2,$3,$4,$5)', [
        draft.id,
        draft.version,
        actor,
        'Publish after successful corpus evaluation',
        randomUUID(),
      ]);
      expect(
        firstRow(
          (
            await client.query<{ status: string }>(
              'select status from private.ai_prompt_versions where id=$1',
              [draft.id],
            )
          ).rows,
        ).status,
      ).toBe('approved');
      await client.query('savepoint immutable_corpus');
      await expect(
        client.query(
          "update private.ai_prompt_test_cases set expected_rules='{}' where prompt_version_id=$1",
          [draft.id],
        ),
      ).rejects.toMatchObject({ message: 'AI_EVALUATION_CORPUS_IMMUTABLE' });
      await client.query('rollback to savepoint immutable_corpus');
      await expect(
        client.query(
          "insert into private.ai_prompt_test_cases(prompt_version_id,case_key,fixture_redacted,expected_rules) values($1,'late-case','{}','{}')",
          [draft.id],
        ),
      ).rejects.toMatchObject({ message: 'AI_EVALUATION_CORPUS_IMMUTABLE' });
      await client.query('rollback to savepoint immutable_corpus');
      const spare = firstRow(
        (
          await client.query<{ id: string }>(
            "insert into private.ai_prompt_versions(workload,version_no,template,schema_version) values('financial_assistant',99999,'Unpublished fixture',1) returning id",
          )
        ).rows,
      ).id;
      const lateCase = firstRow(
        (
          await client.query<{ id: string }>(
            "insert into private.ai_prompt_test_cases(prompt_version_id,case_key,fixture_redacted,expected_rules) values($1,'moved-case','{}','{}') returning id",
            [spare],
          )
        ).rows,
      ).id;
      await client.query('savepoint immutable_reassignment');
      await expect(
        client.query('update private.ai_prompt_test_cases set prompt_version_id=$1 where id=$2', [
          draft.id,
          lateCase,
        ]),
      ).rejects.toMatchObject({ message: 'AI_EVALUATION_CORPUS_IMMUTABLE' });
      await client.query('rollback to savepoint immutable_reassignment');
    }));
  it('captures only unambiguous native session devices at admission and propagates failure attribution', async () =>
    transaction(async (client, actor) => {
      await client.query(
        "insert into public.user_devices(user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,'task3-native','ios','1.0')",
        [actor, `h1:${'a'.repeat(64)}`],
      );
      const insert = async (sid: string, nativeRequest: boolean) => {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, sid, nativeRequest }),
        ]);
        return firstRow(
          (
            await client.query<{ platform: string | null; request_id: string }>(
              "insert into private.ai_usage_events(user_id,workload,model,provider,request_id) values($1,'financial_assistant','model','provider',$2) returning platform,request_id",
              [actor, randomUUID()],
            )
          ).rows,
        );
      };
      expect((await insert('another-session', true)).platform).toBeNull();
      expect((await insert('task3-native', false)).platform).toBeNull();
      const native = await insert('task3-native', true);
      expect(native.platform).toBe('ios');
      await client.query("select set_config('request.jwt.claims','{}',true)");
      const failure = await client.query<{ platform: string | null }>(
        "insert into private.ai_failure_events(user_id,workload,failure_code,request_id) values($1,'financial_assistant','TEST_FAILURE',$2) returning platform",
        [actor, native.request_id],
      );
      expect(firstRow(failure.rows).platform).toBe('ios');
      await client.query(
        "insert into public.user_devices(user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,'task3-native','android','1.0')",
        [actor, `h1:${'b'.repeat(64)}`],
      );
      expect((await insert('task3-native', true)).platform).toBeNull();
    }));
  it('filters import sessions before the server limit and exposes fresh parent revisions through publish retire rollback', async () =>
    transaction(async (client, actor) => {
      const rule = randomUUID(),
        version = randomUUID();
      await client.query(
        "insert into public.parser_rules(id,name,source_type) values($1,$2,'file')",
        [rule, `task3-${rule}`],
      );
      await client.query(
        "insert into public.parser_rule_versions(id,parser_rule_id,version_no,definition,definition_hash,created_by,corpus_status) values($1,$2,1,'{}',$3,$4,'passed')",
        [version, rule, 'c'.repeat(64), actor],
      );
      await client.query(
        "insert into public.parser_test_cases(parser_version_id,name,input_fixture,expected_output,last_result) values($1,'fictional fixture','fictional test','{}','passed')",
        [version],
      );
      const readVersion = async () =>
        firstRow(
          (
            await client.query<{ value: Record<string, unknown>[] }>(
              "select private.read_tracking_admin('versions',null,25,null,$1,null,null,$2) value",
              [actor, JSON.stringify({ parserVersionId: version })],
            )
          ).rows,
        ).value[0];
      expect(await readVersion()).toMatchObject({
        version_no: 1,
        parent_rule_version: 1,
        status: 'draft',
      });
      await client.query('select private.publish_parser_version($1,1,$2,$3)', [
        version,
        actor,
        'Publish tested parser version',
      ]);
      expect(await readVersion()).toMatchObject({
        version_no: 1,
        parent_rule_version: 2,
        status: 'published',
      });
      await client.query(
        "select private.mutate_tracking_admin('versions',$1,'retire','{}',2,$2,$3)",
        [version, 'Retire the published parser version', actor],
      );
      expect(await readVersion()).toMatchObject({
        version_no: 1,
        parent_rule_version: 3,
        status: 'retired',
      });
      await client.query(
        "select private.mutate_tracking_admin('versions',$1,'rollback','{}',3,$2,$3)",
        [version, 'Restore the reviewed parser version', actor],
      );
      expect(await readVersion()).toMatchObject({
        version_no: 1,
        parent_rule_version: 4,
        status: 'published',
      });
    }));
});

describeLiveDatabase('Task3 service cursors against actual SQL', () => {
  const pool = createLivePool();
  const actor = `task3_cursor_${randomUUID()}`;
  const principal = { userId: actor, sessionId: 'cursor-session', factorAgeSeconds: 0 };
  const prefix = `task3-${randomUUID()}`;
  const providerIds = [randomUUID(), randomUUID(), randomUUID()];
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [actor]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      actor,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Cursor scope regression setup' from public.roles where key='super-admin'",
      [actor],
    );
    for (const [index, id] of providerIds.entries())
      await pool.query('insert into private.ai_providers(id,key,display_name) values($1,$2,$3)', [
        id,
        `${prefix}-${String(index)}`,
        `${prefix} provider ${String(index)}`,
      ]);
    for (let index = 0; index < 3; index++)
      await pool.query(
        "insert into public.import_sessions(user_id,source_type,source_name,request_hash,status,completed_at) values($1,$2,$3,$4,'failed',now())",
        [actor, index === 2 ? 'sms' : 'file', prefix, String(index).repeat(64)],
      );
  });
  afterAll(async () => {
    await pool.query('delete from private.ai_providers where id=any($1::uuid[])', [providerIds]);
    await pool.query('delete from public.import_sessions where user_id=$1', [actor]);
    await pool.onModuleDestroy();
  });
  it('rejects reused AI cursors across changed filters and still pages the filtered set', async () => {
    const { AiRepository } = await import('../../../src/ai/ai.repository');
    const { AiService } = await import('../../../src/ai/ai.service');
    const service = new AiService(
      new AiRepository(pool),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const first = await service.adminList(principal, 'providers', { search: prefix, limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = await service.adminList(principal, 'providers', {
      search: ` ${prefix} `,
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    await expect(
      service.adminList(principal, 'providers', {
        search: prefix,
        status: 'healthy',
        limit: 1,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      (
        await service.adminList(principal, 'providers', {
          search: prefix,
          status: 'healthy',
          limit: 1,
        })
      ).items,
    ).toEqual([]);
  });
  it('filters imports by search source status severity and binds cursors to that scope', async () => {
    const { TrackingRepository } = await import('../../../src/tracking/tracking.repository');
    const { TrackingService } = await import('../../../src/tracking/tracking.service');
    const service = new TrackingService(new TrackingRepository(pool), {} as never, {} as never);
    const filters = {
      search: prefix,
      sourceType: 'file',
      status: 'failed',
      severity: 'high',
      limit: 1,
    };
    const first = (await service.adminRead(principal, 'sessions', null, filters)) as {
      items: { id: string; sourceType: string }[];
      nextCursor: string;
    };
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.sourceType).toBe('file');
    expect(first.nextCursor).toBeTruthy();
    const second = (await service.adminRead(principal, 'sessions', null, {
      ...filters,
      cursor: first.nextCursor,
    })) as typeof first;
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect(second.nextCursor).toBeNull();
    await expect(
      service.adminRead(principal, 'sessions', null, {
        ...filters,
        sourceType: 'sms',
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await service.adminRead(principal, 'sessions', null, { ...filters, severity: 'info' }),
    ).toMatchObject({ items: [] });
    expect(
      await service.adminRead(principal, 'sessions', null, {
        ...filters,
        search: 'no-matching-import',
      }),
    ).toMatchObject({ items: [] });
  });
});
