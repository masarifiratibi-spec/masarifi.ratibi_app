import type { PoolClient, QueryResultRow } from 'pg';

import type { PoolService } from '../../../src/platform/database/pool.service';

export async function withPlanningOwner<T>(
  pool: PoolService,
  userId: string,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return pool.withClient(async (client) => {
    await client.query('begin');
    try {
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ role: 'authenticated', sub: userId, sid: 'planning-integration' }),
      ]);
      await client.query('set local role masarifi_api');
      const result = await action(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export function planningOwnerQuery<T extends QueryResultRow = QueryResultRow>(
  pool: PoolService,
  userId: string,
  sql: string,
  values: unknown[],
) {
  return withPlanningOwner(pool, userId, (client) => client.query<T>(sql, values));
}
