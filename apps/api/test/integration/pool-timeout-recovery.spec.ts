import { PoolService } from '../../src/platform/database/pool.service';
import { describeLiveDatabase } from '../live-database';

describeLiveDatabase('Database callback timeout isolation', () => {
  it('discards a connection when a timed-out transaction cannot roll back', async () => {
    const connection = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost'].includes(connection.hostname))
      throw new Error('DISPOSABLE_LOOPBACK_DATABASE_REQUIRED');
    const pool = new PoolService({
      get: (key: string) =>
        key === 'DATABASE_URL'
          ? process.env.DATABASE_URL
          : key === 'MASARIFI_DATABASE_POOL_MAX'
            ? 1
            : undefined,
    } as never);
    let firstPid: number | undefined;
    try {
      await expect(
        pool.withClient(async (client) => {
          await client.query('begin');
          firstPid = (await client.query<{ pid: number }>('select pg_backend_pid() pid')).rows[0]
            ?.pid;
          await client.query("select set_config('client_test.owner', 'previous-owner', true)");
          try {
            await client.query('select pg_sleep(5)');
          } catch (error) {
            await client.query('rollback');
            throw error;
          }
        }),
      ).rejects.toThrow('Query read timeout');
      const next = await pool.withClient(
        async (client) =>
          (
            await client.query<{ pid: number; owner: string | null }>(
              "select pg_backend_pid() pid,current_setting('client_test.owner',true) owner",
            )
          ).rows[0],
      );
      expect(next?.owner || null).toBeNull();
      expect(next?.pid).not.toBe(firstPid);
    } finally {
      await pool.onModuleDestroy();
    }
  }, 15000);
});
