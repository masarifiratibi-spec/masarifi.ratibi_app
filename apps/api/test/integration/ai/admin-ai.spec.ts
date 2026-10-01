import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('governed Admin AI operations', () => {
  const pool = createLivePool(),
    repository = new AiRepository(pool);
  const adminId = `ai_admin_${randomUUID()}`,
    readerId = `ai_reader_${randomUUID()}`,
    audioModelId = randomUUID(),
    unreviewedProviderId = randomUUID();
  const vertexProviderId = '99010000-0000-4000-8000-000000000007';
  const admin = { userId: adminId, sessionId: 'admin-session', factorAgeSeconds: 0 },
    reader = { userId: readerId, sessionId: 'reader-session', factorAgeSeconds: 0 };
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      adminId,
      readerId,
    ]);
    await pool.query(
      "insert into public.admin_profiles(user_id,status) values($1,'active'),($2,'active')",
      [adminId, readerId],
    );
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Phase 09 governed integration' from public.roles where key='super-admin'",
      [adminId],
    );
    await pool.query(
      "insert into private.ai_providers(id,key,display_name) values($1,$2,'Unreviewed test provider')",
      [unreviewedProviderId, `test-${randomUUID()}`],
    );
    await pool.query(
      `insert into private.ai_models(id,provider_id,model_id,capabilities,approved,max_context,structured_output,cost_policy)
      values($1,'99010000-0000-4000-8000-000000000003',$2,array['audio_input','structured_output'],true,128000,true,'{}')`,
      [audioModelId, `test/voice-${randomUUID()}`],
    );
  });
  afterAll(async () => {
    await pool.query('delete from private.ai_models where id=$1', [audioModelId]);
    await pool.query('delete from private.ai_providers where id=$1', [unreviewedProviderId]);
    await pool.onModuleDestroy();
  });

  it('rebinds an audio model through audited, versioned, idempotent Admin governance', async () => {
    const input = {
      expectedVersion: 1,
      reason: 'Owner approved existing reviewed Vertex audio routing',
      providerId: vertexProviderId,
    };
    const result = await repository.adminMutate(
      admin,
      'models',
      audioModelId,
      input,
      'admin-model-provider-key-0001',
      randomUUID(),
    );
    expect(result).toMatchObject({
      resource: { kind: 'model', version: 2, data: { providerId: vertexProviderId } },
    });
    await expect(
      repository.adminMutate(
        admin,
        'models',
        audioModelId,
        input,
        'admin-model-provider-key-0001',
        randomUUID(),
      ),
    ).resolves.toMatchObject({ replayed: true });
    await expect(
      repository.adminMutate(
        admin,
        'models',
        audioModelId,
        input,
        'admin-model-provider-stale-0001',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_ADMIN_CONFLICT' } });
    await expect(
      repository.adminMutate(
        reader,
        'models',
        audioModelId,
        { ...input, expectedVersion: 2 },
        'admin-model-provider-denied-0001',
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(
      (
        await pool.query<{ count: string }>(
          "select count(*)::text count from audit.audit_events where actor_id=$1 and action='ai.config-updated'",
          [adminId],
        )
      ).rows[0]?.count,
    ).toBe('1');
  });

  it.each([null, 12, 'not-a-provider-uuid', randomUUID(), 'unreviewed'])(
    'rejects invalid or unreviewed model provider %s without changing the model',
    async (provider) => {
      const providerId = provider === 'unreviewed' ? unreviewedProviderId : provider;
      await expect(
        repository.adminMutate(
          admin,
          'models',
          audioModelId,
          { expectedVersion: 2, reason: 'Reject unsafe provider reassignment', providerId },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ response: { code: 'AI_MUTATION_INVALID' } });
      expect(
        (
          await pool.query<{ provider_id: string; version: string }>(
            'select provider_id,version from private.ai_models where id=$1',
            [audioModelId],
          )
        ).rows[0],
      ).toMatchObject({ provider_id: vertexProviderId, version: '2' });
    },
  );

  it('reads redacted resources, audits a versioned change, and replays the same Admin key', async () => {
    const [provider] = await repository.adminRead(admin, 'providers', null, 1);
    if (!provider) throw new Error('AI_PROVIDER_FIXTURE_MISSING');
    const result = await repository.adminMutate(
      admin,
      'providers',
      String(provider.id),
      {
        expectedVersion: provider.version,
        reason: 'Approve provider after privacy review',
        approved: false,
      },
      'admin-provider-key-0001',
      randomUUID(),
    );
    await expect(
      repository.adminMutate(
        admin,
        'providers',
        String(provider.id),
        {
          expectedVersion: provider.version,
          reason: 'Approve provider after privacy review',
          approved: false,
        },
        'admin-provider-key-0001',
        randomUUID(),
      ),
    ).resolves.toMatchObject({ replayed: true });
    expect(result).toMatchObject({ resource: { kind: 'provider' } });
    expect(
      (
        await pool.query<{ count: string }>(
          "select count(*)::text count from audit.audit_events where actor_id=$1 and action='ai.config-updated'",
          [adminId],
        )
      ).rows[0]?.count,
    ).toBe('2');
  });

  it('denies a valid admin identity without the exact permission', async () => {
    await expect(repository.adminRead(reader, 'providers', null, 1)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('acknowledges failures while preserving immutable incident evidence', async () => {
    const failureId = randomUUID();
    await pool.query(
      `insert into private.ai_failure_events(id,workload,failure_code,request_id)
      values($1,'financial_assistant','AI_PROVIDER_TIMEOUT',$2)`,
      [failureId, randomUUID()],
    );
    await expect(
      repository.adminMutate(
        admin,
        'failures',
        failureId,
        {
          expectedVersion: 1,
          reason: 'Acknowledge provider timeout for investigation',
          status: 'acknowledged',
        },
        'admin-failure-key-0001',
        randomUUID(),
      ),
    ).resolves.toMatchObject({ resource: { kind: 'failure', version: 2 } });
    await expect(
      pool.query("update private.ai_failure_events set failure_code='AI_TAMPERED' where id=$1", [
        failureId,
      ]),
    ).rejects.toMatchObject({ message: 'IMMUTABLE_RECORD' });
  });

  it('rejects a provider or safety change that would weaken an enabled route', async () => {
    await pool.query(
      "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where workload='voice_transcription'",
      [adminId],
    );
    await pool.query(
      "update private.ai_feature_routes set enabled=true where workload='voice_transcription'",
    );
    const provider = (
      await pool.query<{ id: string; version: number }>(
        "select id,version from private.ai_providers where key='google'",
      )
    ).rows[0];
    const rule = (
      await pool.query<{ id: string; version: number }>(
        "select id,version from private.ai_safety_rules where key='global.no_tools'",
      )
    ).rows[0];
    if (!provider || !rule) throw new Error('AI_POLICY_FIXTURE_MISSING');
    await expect(
      repository.adminMutate(
        admin,
        'providers',
        provider.id,
        {
          expectedVersion: provider.version,
          reason: 'Attempt to disable an active fallback',
          approved: false,
        },
        'admin-policy-provider-0001',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_ROUTE_POLICY_INVALID' } });
    await expect(
      repository.adminMutate(
        admin,
        'models',
        '99020000-0000-4000-8000-000000000006',
        {
          expectedVersion: 1,
          reason: 'Reject provider outside the enabled Voice allowlist',
          providerId: vertexProviderId,
        },
        'admin-policy-model-provider-0001',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_ROUTE_POLICY_INVALID' } });
    await expect(
      repository.adminMutate(
        admin,
        'safety-rules',
        rule.id,
        {
          expectedVersion: rule.version,
          reason: 'Attempt to disable active output controls',
          enabled: false,
        },
        'admin-policy-safety-0001',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_ROUTE_POLICY_INVALID' } });
    expect(
      (
        await pool.query<{ route: unknown }>(
          "select private.get_effective_ai_route('voice_transcription') route",
        )
      ).rows[0]?.route,
    ).not.toBeNull();
    await pool.query(
      "update private.ai_feature_routes set enabled=false where workload='voice_transcription'",
    );
    await pool.query(
      "update private.ai_prompt_versions set status='draft',evaluation_passed=false,approved_by=null,published_at=null where id='99030000-0000-4000-8000-000000000001'",
    );
  });

  it('serializes provider reassignment with route activation before checking compliance', async () => {
    const modelId = '99020000-0000-4000-8000-000000000006';
    const routeId = '99060000-0000-4000-8000-000000000001';
    const claims = JSON.stringify({ sub: adminId, role: 'authenticated' });
    await pool.query(
      "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where workload='voice_transcription'",
      [adminId],
    );
    try {
      const model = (
        await pool.query<{ version: string }>('select version from private.ai_models where id=$1', [
          modelId,
        ])
      ).rows[0];
      const route = (
        await pool.query<{ version: string }>(
          'select version from private.ai_feature_routes where id=$1',
          [routeId],
        )
      ).rows[0];
      if (!model || !route) throw new Error('AI_POLICY_FIXTURE_MISSING');
      await pool.withClient(async (a) => {
        await a.query('begin');
        try {
          await a.query("select set_config('request.jwt.claims',$1,true)", [claims]);
          await a.query('set local role masarifi_api');
          await a.query('select private.mutate_admin_ai($1,$2,$3,$4,$5,$6,$7)', [
            'models',
            modelId,
            model.version,
            { providerId: vertexProviderId },
            adminId,
            'Reviewed provider change during concurrent activation',
            randomUUID(),
          ]);
          await pool.withClient(async (b) => {
            await b.query('begin');
            try {
              await b.query("select set_config('request.jwt.claims',$1,true)", [claims]);
              await b.query('set local role masarifi_api');
              await b.query("set local lock_timeout='250ms'");
              await expect(
                b.query('select private.mutate_admin_ai($1,$2,$3,$4,$5,$6,$7)', [
                  'routes',
                  routeId,
                  route.version,
                  { enabled: true },
                  adminId,
                  'Activate Voice while provider reassignment is pending',
                  randomUUID(),
                ]),
              ).rejects.toMatchObject({ code: '55P03' });
            } finally {
              await b.query('rollback');
            }
          });
          await a.query('commit');
        } finally {
          await a.query('rollback');
        }
      });
      await expect(
        repository.adminMutate(
          admin,
          'routes',
          routeId,
          {
            expectedVersion: Number(route.version),
            enabled: true,
            reason: 'Recheck Voice compliance after provider change commits',
          },
          randomUUID(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ response: { code: 'AI_ROUTE_MODEL_INVALID' } });
    } finally {
      await pool.query(
        "update private.ai_models set provider_id='99010000-0000-4000-8000-000000000003' where id=$1",
        [modelId],
      );
      await pool.query(
        "update private.ai_prompt_versions set status='draft',evaluation_passed=false,approved_by=null,published_at=null where workload='voice_transcription'",
      );
    }
  });
});
