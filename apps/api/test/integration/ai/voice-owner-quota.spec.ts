import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('Opt-in Staging Voice owner allowance', () => {
  const pool = createLivePool();
  const owner = `voice_allowance_${randomUUID()}`,
    other = `voice_default_${randomUUID()}`;
  const fingerprint = createHash('sha256').update(owner).digest('hex');
  const setting = 'ai.voice.staging_owner_quota';
  const operationId = randomUUID();
  let oldBudget: unknown;
  let oldOverride: unknown;

  const reserve = (userId: string, workload = 'voice_transcription', id = randomUUID()) =>
    pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: userId, sid: 'offline' }),
        ]);
        await client.query('set local role masarifi_api');
        const result = await client.query<{ result: Record<string, unknown> }>(
          'select private.reserve_ai_quota($1,$2::uuid,$3) result',
          [userId, id, workload],
        );
        await client.query('commit');
        return result.rows[0]?.result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  const configure = (value: unknown) =>
    pool.query(
      `insert into private.system_settings(setting_key,value,sensitivity) values($1,$2,'internal')
     on conflict(setting_key) do update set value=excluded.value`,
      [setting, JSON.stringify(value)],
    );

  beforeAll(async () => {
    oldBudget = (
      await pool.query(
        "select value from private.system_settings where setting_key='ai.global.monthly_budget'",
      )
    ).rows[0]?.value;
    oldOverride = (
      await pool.query('select value from private.system_settings where setting_key=$1', [setting])
    ).rows[0]?.value;
    await pool.query(
      "update private.system_settings set value='2' where setting_key='ai.global.monthly_budget'",
    );
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      owner,
      other,
    ]);
    for (const user of [owner, other]) {
      for (let index = 0; index < 5; index++) {
        await pool.query(
          `insert into private.ai_usage_events(user_id,workload,model,provider,request_id,estimated_cost,reservation_status)
          values($1,'voice_transcription','pending','pending',$2,0.01,$3)`,
          [user, randomUUID(), index === 4 ? 'completed' : 'reserved'],
        );
      }
    }
    await configure({ scope: 'staging', ownerFingerprint: fingerprint, limit: 30 });
  });
  afterAll(async () => {
    await pool.query(
      "update private.system_settings set value=$1 where setting_key='ai.global.monthly_budget'",
      [JSON.stringify(oldBudget)],
    );
    if (oldOverride === undefined)
      await pool.query('delete from private.system_settings where setting_key=$1', [setting]);
    else await configure(oldOverride);
    await pool.onModuleDestroy();
  });

  it('admits the owner Voice request above five without modifying existing holds/history', async () => {
    const prior = (
      await pool.query(
        'select to_jsonb(e) value from private.ai_usage_events e where user_id=$1 order by id',
        [owner],
      )
    ).rows;
    expect(await reserve(owner, 'voice_transcription', operationId)).toMatchObject({
      allowed: true,
      limit: 30,
      used: 6,
      replayed: false,
    });
    const after = (
      await pool.query(
        'select to_jsonb(e) value from private.ai_usage_events e where user_id=$1 and request_id<>$2 order by id',
        [owner, operationId],
      )
    ).rows;
    expect(after).toEqual(prior);
    expect(
      (
        await pool.query(
          "select value from private.system_settings where setting_key='ai.global.monthly_budget'",
        )
      ).rows[0]?.value,
    ).toBe(2);
  });
  it('replays the same operation without another quota event', async () => {
    expect(await reserve(owner, 'voice_transcription', operationId)).toMatchObject({
      allowed: true,
      limit: 30,
      used: 6,
      replayed: true,
    });
  });
  it('keeps another owner at five', async () => {
    expect(await reserve(other)).toMatchObject({ allowed: false, limit: 5, used: 5 });
  });
  it('keeps the same owner Assistant allowance at five', async () => {
    expect(await reserve(owner, 'financial_assistant')).toMatchObject({ allowed: false, limit: 5 });
  });
  it.each([
    {},
    { scope: 'staging', ownerFingerprint: fingerprint, limit: 31 },
    { scope: 'staging', ownerFingerprint: fingerprint, limit: '30' },
    { scope: 'production', ownerFingerprint: fingerprint, limit: 30 },
    {
      scope: 'staging',
      ownerFingerprint: createHash('sha256').update(other).digest('hex'),
      limit: 30,
    },
  ])('does not broaden the owner Voice limit for disabled/foreign configuration', async (value) => {
    await configure(value);
    try {
      expect(await reserve(owner)).toMatchObject({ allowed: false, limit: 5 });
    } finally {
      await configure({ scope: 'staging', ownerFingerprint: fingerprint, limit: 30 });
    }
  });
  it('retains the existing global budget hard stop', async () => {
    await pool.query(
      "update private.system_settings set value='0.01' where setting_key='ai.global.monthly_budget'",
    );
    try {
      expect(await reserve(owner)).toMatchObject({
        allowed: false,
        limit: 30,
        reason: 'AI_BUDGET_EXHAUSTED',
      });
    } finally {
      await pool.query(
        "update private.system_settings set value='2' where setting_key='ai.global.monthly_budget'",
      );
    }
  });
  it('does not grant application roles direct helper execution', async () => {
    const result = await pool.query(
      "select has_function_privilege('masarifi_api','private.ai_effective_rolling_limit(text,text)','execute') allowed",
    );
    expect(result.rows[0]?.allowed).toBe(false);
  });
  it('admits the thirtieth event and rejects the thirty-first without releasing history', async () => {
    await pool.query(
      `insert into private.ai_usage_events(user_id,workload,model,provider,request_id,estimated_cost)
      select $1,'voice_transcription','pending','pending',gen_random_uuid()::text,0.001 from generate_series(1,23)`,
      [owner],
    );
    expect(await reserve(owner)).toMatchObject({ allowed: true, limit: 30, used: 30 });
    expect(await reserve(owner)).toMatchObject({ allowed: false, limit: 30, used: 30 });
  });
  it.each(['staging', 'production', 'wrong-owner'] as const)(
    'gates migration activation for %s',
    async (target) => {
      await configure({});
      const prefix = readFileSync(
        resolve(
          process.cwd(),
          '../../supabase/migrations/20261003083000_staging_voice_owner_quota.sql',
        ),
        'utf8',
      ).split('create function private.ai_effective_rolling_limit')[0];
      if (!prefix) throw new Error('activation SQL missing');
      const membershipBefore = (
        await pool.query<{ inherited: boolean }>(
          "select pg_has_role(current_user,'masarifi_migration','usage') inherited",
        )
      ).rows[0]?.inherited;
      const activate = pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query(
            "select set_config('masarifi.migration_target',$1,true),set_config('masarifi.staging_voice_owner_hash',$2,true)",
            [
              target === 'production' ? 'production' : 'staging',
              target === 'wrong-owner' ? '0'.repeat(64) : fingerprint,
            ],
          );
          await client.query(prefix);
          const configured = (
            await client.query<{ value: unknown }>(
              'select value from private.system_settings where setting_key=$1',
              [setting],
            )
          ).rows[0]?.value;
          await client.query('reset role; revoke masarifi_migration from current_user;');
          return configured;
        } finally {
          // Inspect real activation, then restore both fixture data and role membership.
          await client.query('rollback');
        }
      });
      try {
        if (target === 'staging') {
          await expect(activate).resolves.toEqual({
            scope: 'staging',
            ownerFingerprint: fingerprint,
            limit: 30,
          });
        } else {
          await expect(activate).rejects.toThrow(
            target === 'production'
              ? 'STAGING_QUOTA_TARGET_INVALID'
              : 'STAGING_QUOTA_BINDING_INVALID',
          );
        }
        expect(
          (
            await pool.query('select value from private.system_settings where setting_key=$1', [
              setting,
            ])
          ).rows[0]?.value,
        ).toEqual({});
        expect(
          (
            await pool.query(
              "select pg_has_role(current_user,'masarifi_migration','usage') inherited",
            )
          ).rows[0]?.inherited,
        ).toEqual(membershipBefore);
      } finally {
        await configure({ scope: 'staging', ownerFingerprint: fingerprint, limit: 30 });
      }
    },
  );
});
