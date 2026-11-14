import { PoolService } from '../../../src/platform/database/pool.service';
import { PlatformLogger } from '../../../src/platform/observability/platform-logger';
import { logContext } from '../../../src/platform/observability/log-context';

const mockFailure = Object.assign(
  new Error('fixture SQL parameters contain private financial text'),
  { code: '08006' },
);
jest.mock('pg', () => ({
  Pool: class {
    connect() {
      return Promise.reject(mockFailure);
    }
  },
}));

it('correlates a database connection failure without emitting SQL or parameters', async () => {
  const captured: Record<string, unknown>[] = [];
  jest.spyOn(PlatformLogger.prototype, 'error').mockImplementation((message, fields) => {
    captured.push({ message, ...logContext.getStore(), ...fields });
  });
  const pool = new PoolService({
    get: (key: string) =>
      ({
        DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture',
        MASARIFI_DATABASE_POOL_MAX: 2,
        MASARIFI_PROCESS_KIND: 'api',
      })[key],
  } as never);
  await expect(
    logContext.run({ requestId: 'fixture-db-request' }, () =>
      pool.query('select fixture_private_data', ['fixture-parameters']),
    ),
  ).rejects.toBe(mockFailure);
  expect(captured).toEqual([
    expect.objectContaining({
      requestId: 'fixture-db-request',
      message: 'database.failed',
      operation: 'database.connect',
      exception: expect.objectContaining({ code: '08006' }) as unknown,
    }),
  ]);
  expect(JSON.stringify(captured)).not.toContain('private financial text');
  expect(JSON.stringify(captured)).not.toContain('fixture-parameters');
  expect(JSON.stringify(captured)).not.toContain('select fixture_private_data');
});
