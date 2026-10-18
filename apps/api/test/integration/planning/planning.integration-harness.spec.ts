import { randomUUID } from 'node:crypto';

import { createLivePool, describeLiveDatabase } from '../../live-database';
import { planningOwnerQuery } from './planning.integration-harness';

describeLiveDatabase('planning owner-scoped integration commands', () => {
  const pool = createLivePool();
  const owner = `planning_harness_${randomUUID()}`;
  const other = `planning_harness_other_${randomUUID()}`;
  const account = randomUUID();
  const otherAccount = randomUUID();
  const sessionStateSql = `select current_user as role,public.current_clerk_user_id() as owner,
    coalesce(current_setting('request.jwt.claims',true),'') as claims`;

  beforeAll(async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query('set local role masarifi_migration');
        await client.query(
          "insert into public.profiles(id,status) values($1,'active'),($2,'active')",
          [owner, other],
        );
        await client.query(
          "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Owned','bank','SAR'),($3,$4,'Other','bank','SAR')",
          [account, owner, otherAccount, other],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  });
  afterAll(() => pool.onModuleDestroy());

  it('enforces the API role and owner RLS, then clears transaction-local identity', async () => {
    const before = (
      await pool.query<{ role: string; owner: string | null; claims: string }>(sessionStateSql)
    ).rows;
    const inside = await planningOwnerQuery<{ role: string; owner: string }>(
      pool,
      owner,
      sessionStateSql,
      [],
    );
    expect(inside.rows).toMatchObject([
      {
        role: 'masarifi_api',
        owner,
      },
    ]);
    expect(
      (
        await planningOwnerQuery<{ id: string }>(
          pool,
          owner,
          'select id from public.accounts where id=any($1::uuid[])',
          [[account, otherAccount]],
        )
      ).rows,
    ).toEqual([{ id: account }]);
    expect((await pool.query(sessionStateSql)).rows).toEqual(before);
  });

  it('rejects missing and mismatched owner identity without retaining failed command context', async () => {
    const before = (await pool.query(sessionStateSql)).rows;
    await expect(
      pool.query("select * from private.get_sync_bounds($1,'planning')", [owner]),
    ).rejects.toThrow(/AUTH_TOKEN_INVALID/);
    await expect(
      planningOwnerQuery(pool, owner, "select * from private.get_sync_bounds($1,'planning')", [
        other,
      ]),
    ).rejects.toThrow(/AUTH_TOKEN_INVALID/);
    const after = await pool.query<{ role: string; owner: string | null; claims: string }>(
      sessionStateSql,
    );
    expect(after.rows).toEqual(before);
    expect(
      (
        await planningOwnerQuery<{ id: string }>(
          pool,
          other,
          'select id from public.accounts where id=any($1::uuid[])',
          [[account, otherAccount]],
        )
      ).rows,
    ).toEqual([{ id: otherAccount }]);
  });
});
