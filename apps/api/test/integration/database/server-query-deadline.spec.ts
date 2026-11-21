import { PoolService } from '../../../src/platform/database/pool.service';
import { describeLiveDatabase } from '../../live-database';

function createDeadlinePool(processKind?: string, connectionString = process.env.DATABASE_URL) {
  const connection = new URL(connectionString ?? '');
  if (!['127.0.0.1', 'localhost'].includes(connection.hostname))
    throw new Error('DISPOSABLE_LOOPBACK_DATABASE_REQUIRED');
  return new PoolService({
    get: (key: string) =>
      key === 'DATABASE_URL'
        ? connectionString
        : key === 'MASARIFI_DATABASE_POOL_MAX'
          ? 1
          : key === 'MASARIFI_PROCESS_KIND'
            ? processKind
            : undefined,
  } as never);
}

describeLiveDatabase('Server query deadline', () => {
  it.each([undefined, 'api', 'worker'])(
    'cancels database work for %s even when the caller continues waiting',
    async (processKind) => {
      const pool = createDeadlinePool(processKind);
      try {
        await expect(
          pool.withClient((client) => {
            const query = { text: 'select pg_sleep(3)', query_timeout: 5_000 };
            return client.query(query);
          }),
        ).rejects.toMatchObject({ code: '57014' });
        await expect(pool.query('select 1 as healthy')).resolves.toMatchObject({
          rows: [{ healthy: 1 }],
        });
      } finally {
        await pool.onModuleDestroy();
      }
    },
    10_000,
  );

  it('preserves a stricter server deadline', async () => {
    const connection = new URL(process.env.DATABASE_URL ?? '');
    connection.searchParams.set('options', '-c statement_timeout=100');
    const pool = createDeadlinePool('api', connection.toString());
    try {
      await expect(
        pool.withClient((client) => {
          const query = { text: 'select pg_sleep(0.3)', query_timeout: 5_000 };
          return client.query(query);
        }),
      ).rejects.toMatchObject({ code: '57014' });
    } finally {
      await pool.onModuleDestroy();
    }
  });
});
