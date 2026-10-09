import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('governed independent AI usage limits', () => {
  const pool = createLivePool();
  const admin = `usage_admin_${randomUUID()}`;
  const owner = `usage_owner_${randomUUID()}`;
  beforeAll(async () => {
    if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
      throw new Error('DISPOSABLE_LOCAL_DATABASE_REQUIRED');
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      admin,
      owner,
    ]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Quota regression' from public.roles where key='super-admin'",
      [admin],
    );
  });
  afterAll(() => pool.onModuleDestroy());
  const scenario = (run: (c: PoolClient) => Promise<void>) =>
    pool.withClient(async (c) => {
      await c.query('begin');
      try {
        await run(c);
      } finally {
        await c.query('rollback');
      }
    });
  const actor = async (c: PoolClient, user: string) => {
    await c.query('reset role');
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, sid: 'quota-regression' }),
    ]);
    await c.query('set local role masarifi_api');
  };
  const update = async (
    c: PoolClient,
    key: string,
    value: unknown,
    operation = randomUUID(),
    stale = false,
  ) => {
    await c.query('reset role');
    const version = Number(
      (
        await c.query<{ version: number | string }>(
          'select version from private.system_settings where setting_key=$1',
          [key],
        )
      ).rows[0]?.version ?? 1,
    );
    await actor(c, admin);
    return (
      await c.query<{ result: Record<string, unknown> }>(
        'select private.execute_operations_command($1,$2,$3::jsonb,$4,$5,$6) result',
        [
          'updateSetting',
          key,
          JSON.stringify({
            value,
            expectedVersion: version + (stale ? 1 : 0),
            reason: 'Independent AI quota acceptance',
          }),
          admin,
          operation,
          `sha256:${operation.replaceAll('-', '').padEnd(64, '0')}`,
        ],
      )
    ).rows[0]?.result as Record<string, unknown>;
  };
  const reserve = async (c: PoolClient, workload: string, operation = randomUUID()) => {
    await actor(c, owner);
    return (
      await c.query<{ result: Record<string, unknown> }>(
        'select private.reserve_ai_quota($1,$2::uuid,$3) result',
        [owner, operation, workload],
      )
    ).rows[0]?.result as Record<string, unknown>;
  };

  it.each([
    ['ai.chat.user_override', { userId: owner, rollingLimit: 1, monthlyLimit: null }],
    ['ai.voice.enabled', false],
    ['ai.chat.monthly_limit', null],
  ])('validates %s on a cold database plan without unrelated integer casts', async (key, value) => {
    await scenario(async (c) => {
      await c.query('discard plans');
      expect(await update(c, key, value)).toMatchObject({
        resourceId: key,
        status: 'updated',
      });
    });
  });

  it.each(['chat', 'voice'])(
    'updates %s daily limit through the governed command',
    async (feature) => {
      await scenario(async (c) => {
        expect(await update(c, `ai.${feature}.rolling_limit`, 2)).toMatchObject({
          resourceId: `ai.${feature}.rolling_limit`,
          status: 'updated',
        });
      });
    },
  );
  it('counts Chat and Voice independently and replays without another slot', async () => {
    await scenario(async (c) => {
      await update(c, 'ai.chat.rolling_limit', 1);
      await update(c, 'ai.voice.rolling_limit', 2);
      const operation = randomUUID();
      expect(await reserve(c, 'financial_assistant', operation)).toMatchObject({
        allowed: true,
        used: 1,
        limit: 1,
      });
      expect(await reserve(c, 'financial_assistant', operation)).toMatchObject({
        allowed: true,
        replayed: true,
        used: 1,
      });
      expect(await reserve(c, 'financial_assistant')).toMatchObject({ allowed: false, used: 1 });
      expect(await reserve(c, 'voice_transcription')).toMatchObject({
        allowed: true,
        used: 1,
        limit: 2,
      });
    });
  });
  it('applies a per-user Chat override without changing Voice', async () => {
    await scenario(async (c) => {
      await update(c, 'ai.chat.rolling_limit', 1);
      await update(c, 'ai.voice.rolling_limit', 3);
      await update(c, 'ai.chat.user_override', {
        userId: owner,
        rollingLimit: 2,
        monthlyLimit: null,
      });
      expect(await reserve(c, 'financial_assistant')).toMatchObject({ allowed: true, limit: 2 });
      expect(await reserve(c, 'voice_transcription')).toMatchObject({ allowed: true, limit: 3 });
    });
  });
  it('enforces a monthly limit independently of the rolling daily window', async () => {
    await scenario(async (c) => {
      await update(c, 'ai.chat.rolling_limit', 10);
      await update(c, 'ai.chat.monthly_limit', 1);
      expect(await reserve(c, 'financial_assistant')).toMatchObject({ allowed: true });
      await c.query('reset role');
      await c.query(
        "update private.ai_usage_events set created_at=clock_timestamp()-interval '25 hours' where user_id=$1",
        [owner],
      );
      expect(await reserve(c, 'financial_assistant')).toMatchObject({
        allowed: false,
        reason: 'AI_MONTHLY_QUOTA_EXCEEDED',
      });
      expect(await reserve(c, 'voice_transcription')).toMatchObject({ allowed: true });
    });
  });
  it.each(['chat', 'voice'])('disables only %s AI admission', async (feature) => {
    await scenario(async (c) => {
      await update(c, `ai.${feature}.enabled`, false);
      expect(
        await reserve(c, feature === 'chat' ? 'financial_assistant' : 'voice_transcription'),
      ).toMatchObject({ allowed: false, reason: 'AI_FEATURE_DISABLED' });
      expect(
        await reserve(c, feature === 'chat' ? 'voice_transcription' : 'financial_assistant'),
      ).toMatchObject({ allowed: true });
    });
  });
  it.each([0, 1001, 1.5, '15', true, null])('rejects invalid daily limit %p', async (value) => {
    await expect(
      scenario(async (c) => {
        await update(c, 'ai.chat.rolling_limit', value);
      }),
    ).rejects.toMatchObject({ code: '22023' });
  });
  it('rejects a stale version', async () => {
    await expect(
      scenario(async (c) => {
        await update(c, 'ai.chat.rolling_limit', 2, randomUUID(), true);
      }),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('audits a setting update exactly once on idempotent replay', async () => {
    await scenario(async (c) => {
      const operation = randomUUID();
      await update(c, 'ai.chat.rolling_limit', 2, operation);
      await c.query('reset role');
      const current = Number(
        (
          await c.query<{ version: number }>(
            "select version from private.system_settings where setting_key='ai.chat.rolling_limit'",
          )
        ).rows[0]?.version,
      );
      await actor(c, admin);
      const result = (
        await c.query<{ result: Record<string, unknown> }>(
          'select private.execute_operations_command($1,$2,$3::jsonb,$4,$5,$6) result',
          [
            'updateSetting',
            'ai.chat.rolling_limit',
            JSON.stringify({
              value: 2,
              expectedVersion: current - 1,
              reason: 'Independent AI quota acceptance',
            }),
            admin,
            operation,
            `sha256:${operation.replaceAll('-', '').padEnd(64, '0')}`,
          ],
        )
      ).rows[0]?.result;
      expect(result).toMatchObject({ replayed: true });
      await c.query('reset role');
      expect(
        (
          await c.query<{ n: number }>(
            "select count(*)::int n from audit.audit_events where actor_id=$1 and resource_id='ai.chat.rolling_limit'",
            [admin],
          )
        ).rows[0]?.n,
      ).toBe(1);
    });
  });
  it('denies a non-admin mutation', async () => {
    await expect(
      scenario(async (c) => {
        await actor(c, owner);
        await c.query(
          "select private.execute_operations_command('updateSetting','ai.chat.rolling_limit',$1::jsonb,$2,$3,$4)",
          [
            JSON.stringify({
              value: 2,
              expectedVersion: 1,
              reason: 'Independent AI quota acceptance',
            }),
            owner,
            randomUUID(),
            `sha256:${'a'.repeat(64)}`,
          ],
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('does not reuse a Chat operation as a Voice reservation', async () => {
    await expect(
      scenario(async (c) => {
        const operation = randomUUID();
        expect(await reserve(c, 'financial_assistant', operation)).toMatchObject({ allowed: true });
        await reserve(c, 'voice_transcription', operation);
      }),
    ).rejects.toMatchObject({ code: '42501', message: 'AI_QUOTA_OPERATION_OWNER_MISMATCH' });
  });
  it('keeps accepted operation recovery available after feature admission is disabled', async () => {
    await scenario(async (c) => {
      const operation = randomUUID();
      expect(await reserve(c, 'financial_assistant', operation)).toMatchObject({ allowed: true });
      await update(c, 'ai.chat.enabled', false);
      expect(await reserve(c, 'financial_assistant', operation)).toMatchObject({
        allowed: true,
        replayed: true,
        used: 1,
      });
      expect(await reserve(c, 'financial_assistant')).toMatchObject({
        allowed: false,
        reason: 'AI_FEATURE_DISABLED',
      });
    });
  });
  it('does not allow direct writes to override records from the API role', async () => {
    await expect(
      scenario(async (c) => {
        await actor(c, admin);
        await c.query(
          "insert into private.ai_user_quota_overrides(user_id,workload,rolling_limit) values($1,'financial_assistant',100)",
          [owner],
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('returns effective independent usage and governed audit history without secrets', async () => {
    await scenario(async (c) => {
      await update(c, 'ai.chat.user_override', { userId: owner, rollingLimit: 2, monthlyLimit: 4 });
      await reserve(c, 'financial_assistant');
      await actor(c, admin);
      const result = (
        await c.query<{ result: Record<string, unknown> }>(
          'select private.read_ai_usage_limits($1) result',
          [owner],
        )
      ).rows[0]?.result;
      if (!result) throw new Error('AI_USAGE_READ_MISSING');
      expect(result).toMatchObject({ userId: owner, directReadsConsumeQuota: false });
      expect(result.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ feature: 'chat', limit: 2, used: 1, monthlyLimit: 4 }),
          expect.objectContaining({ feature: 'voice', used: 0 }),
        ]),
      );
      expect(result.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'ai.chat.user_override', actorId: admin }),
        ]),
      );
      expect(result.settings).toHaveLength(10);
      expect(JSON.stringify(result)).not.toMatch(/api_key|credential|secret/i);
    });
  });
  it('audits the selected user previous override rather than another user command', async () => {
    await scenario(async (c) => {
      await update(c, 'ai.chat.user_override', { userId: owner, rollingLimit: 2, monthlyLimit: 4 });
      await update(c, 'ai.chat.user_override', {
        userId: admin,
        rollingLimit: 3,
        monthlyLimit: null,
      });
      await update(c, 'ai.chat.user_override', {
        userId: owner,
        rollingLimit: 5,
        monthlyLimit: null,
      });
      await c.query('reset role');
      const before = (
        await c.query<{ value: string }>(
          "select metadata->>'before' value from audit.audit_events where actor_id=$1 and resource_id='ai.chat.user_override' and (metadata->>'after')::jsonb->>'rollingLimit'='5'",
          [admin],
        )
      ).rows[0]?.value;
      if (!before) throw new Error('AI_USAGE_AUDIT_MISSING');
      expect(JSON.parse(before)).toEqual({ userId: owner, rollingLimit: 2, monthlyLimit: 4 });
    });
  });
});
