import { randomUUID } from 'node:crypto';

import { PoolService } from '../../../src/platform/database/pool.service';
import { describeLiveDatabase } from '../../live-database';

describeLiveDatabase('per-owner staging job quotas', () => {
  const pool = new PoolService({
    get: (key: string) => (key === 'DATABASE_URL' ? process.env.DATABASE_URL : 4),
  } as never);

  afterAll(async () => pool.onModuleDestroy());

  it.each([
    ['import', 25, 'IMPORT_QUOTA_EXCEEDED'],
    ['report_generation', 10, 'REPORT_QUOTA_EXCEEDED'],
  ] as const)('limits %s jobs atomically while preserving replay', async (kind, limit, code) => {
    const userId = `quota_${kind}_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [userId]);

    for (let index = 0; index < limit; index += 1) {
      await expect(reserve(userId, kind, `operation-${String(index)}`)).resolves.toMatchObject({
        allowed: true,
        replayed: false,
      });
    }
    await expect(reserve(userId, kind, 'operation-0')).resolves.toMatchObject({
      allowed: true,
      replayed: true,
    });
    await expect(reserve(userId, kind, 'overflow')).rejects.toThrow(code);
  });

  function reserve(userId: string, kind: string, operationKey: string) {
    return pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ role: 'authenticated', sub: userId, sid: 'quota-session' }),
        ]);
        await client.query('set local role masarifi_api');
        const result = await client.query<{ result: Record<string, unknown> }>(
          'select private.reserve_user_job_quota($1,$2,$3) result',
          [userId, kind, operationKey],
        );
        await client.query('commit');
        return result.rows[0]?.result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  }
});
