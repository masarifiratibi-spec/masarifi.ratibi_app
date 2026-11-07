import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('governed AI request limit', () => {
  const pool = createLivePool();
  const admin = `quota_admin_${randomUUID()}`;
  const reader = `quota_reader_${randomUUID()}`;
  const key = 'ai.user.rolling_limit';
  const reason = 'Adjust approved Staging acceptance request limit without increasing the cost cap';

  beforeAll(async () => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
      throw new Error('DISPOSABLE_LOCAL_DATABASE_REQUIRED');
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      admin,
      reader,
    ]);
    await pool.query(
      "insert into public.admin_profiles(user_id,status) values($1,'active'),($2,'active')",
      [admin, reader],
    );
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Governed quota regression' from public.roles where key='super-admin'",
      [admin],
    );
  });
  afterAll(() => pool.onModuleDestroy());

  const transaction = async (
    actor: string,
    run: (c: PoolClient, version: number) => Promise<void>,
  ) =>
    pool.withClient(async (c) => {
      await c.query('begin');
      try {
        const rawVersion = (
          await c.query<{ version: string }>(
            'select version from private.system_settings where setting_key=$1',
            [key],
          )
        ).rows[0]?.version;
        if (rawVersion === undefined) throw new Error('REQUEST_LIMIT_SETTING_REQUIRED');
        const version = Number(rawVersion);
        await c.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, sid: 'disposable-quota-session' }),
        ]);
        await c.query('set local role masarifi_api');
        await run(c, version);
      } finally {
        await c.query('rollback');
      }
    });
  const command = (
    c: PoolClient,
    version: number,
    value: unknown,
    operation = randomUUID(),
    setting = key,
  ) =>
    c.query<{ result: unknown }>(
      'select private.execute_operations_command($1,$2,$3::jsonb,$4,$5,$6) result',
      [
        'updateSetting',
        setting,
        JSON.stringify({ value, expectedVersion: version, reason }),
        admin,
        operation,
        `sha256:${operation.replaceAll('-', '').padEnd(64, '0')}`,
      ],
    );

  it('updates and replays once through existing permissions, version checks and audit', async () => {
    await transaction(admin, async (c, version) => {
      const operation = randomUUID();
      const result = await command(c, version, 15, operation);
      expect(result.rows[0]?.result).toMatchObject({
        resourceId: key,
        status: 'updated',
        version: version + 1,
      });
      expect((await command(c, version, 15, operation)).rows[0]?.result).toMatchObject({
        replayed: true,
        version: version + 1,
      });
      await c.query('reset role');
      expect(
        (
          await c.query<{ value: unknown }>(
            'select value from private.system_settings where setting_key=$1',
            [key],
          )
        ).rows[0]?.value,
      ).toBe(15);
      const audit = await c.query<{ n: number }>(
        "select count(*)::int n from audit.audit_events where actor_id=$1 and action='operations.setting.update' and resource_id=$2",
        [admin, key],
      );
      expect(audit.rows[0]?.n).toBe(1);
    });
  });
  it.each([0, 1001, 1.5, '15', true])('rejects invalid limit %p', async (value) => {
    await expect(
      transaction(admin, async (c, version) => {
        await command(c, version, value);
      }),
    ).rejects.toMatchObject({ code: '22023' });
  });
  it('rejects a stale configuration version', async () => {
    await expect(
      transaction(admin, async (c, version) => {
        await command(c, version + 1, 15);
      }),
    ).rejects.toMatchObject({ code: '40001' });
  });
  it('does not let a reader inherit the Admin setting permission', async () => {
    await expect(
      transaction(reader, async (c, version) => {
        await c.query('select private.execute_operations_command($1,$2,$3::jsonb,$4,$5,$6)', [
          'updateSetting',
          key,
          JSON.stringify({ value: 15, expectedVersion: version, reason }),
          reader,
          randomUUID(),
          'sha256:' + 'b'.repeat(64),
        ]);
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('preserves the monthly budget, Voice override, Posting policy and financial records', async () => {
    const snapshot = async (c: PoolClient) =>
      (
        await c.query<{ value: unknown }>(`select jsonb_build_object(
      'protectedSettings',(select jsonb_object_agg(setting_key,value) from private.system_settings where setting_key in ('ai.global.monthly_budget','ai.voice.staging_owner_quota')),
      'posting',(select enabled from private.voice_automatic_policy),
      'transactions',(select count(*) from public.transactions),'postings',(select count(*) from public.transaction_postings)) value`)
      ).rows[0]?.value;
    await transaction(admin, async (c, version) => {
      await c.query('reset role');
      const before = await snapshot(c);
      await c.query('set local role masarifi_api');
      await command(c, version, 15);
      await c.query('reset role');
      expect(await snapshot(c)).toEqual(before);
    });
  });
});
