import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { buildPoolOptions, PoolService } from '../../../src/platform/database/pool.service';

function createService(): PoolService {
  return new PoolService(
    new PlatformConfigService(
      new ConfigService({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test',
        MASARIFI_DATABASE_POOL_MAX: 2,
      }),
    ),
  );
}

describe('buildPoolOptions', () => {
  it('creates a bounded pool without logging connection data', () => {
    const options = buildPoolOptions('postgresql://user:secret@localhost:5432/test', 12);

    expect(options).toMatchObject({
      connectionString: 'postgresql://user:secret@localhost:5432/test',
      max: 12,
      allowExitOnIdle: true,
    });
    expect(options.connectionTimeoutMillis).toBeLessThanOrEqual(1_000);
  });

  it('rejects an unbounded pool size', () => {
    expect(() => buildPoolOptions('postgresql://user:secret@localhost:5432/test', 51)).toThrow(
      'DATABASE_POOL_SIZE_INVALID',
    );
  });

  it('returns successful parameterized query results', async () => {
    jest
      .spyOn(Pool.prototype, 'query')
      .mockResolvedValueOnce({ rows: [{ healthy: true }] } as never);
    const service = createService();

    await expect(service.query<{ healthy: boolean }>('select $1', [true])).resolves.toMatchObject({
      rows: [{ healthy: true }],
    });
  });

  it('fails with a safe stable code when a query exceeds its deadline', async () => {
    jest.spyOn(Pool.prototype, 'query').mockReturnValueOnce(new Promise(() => undefined) as never);
    const service = createService();

    await expect(service.query('select 1', [], 1)).rejects.toThrow('DATABASE_QUERY_TIMEOUT');
  });

  it('closes the pool during module shutdown', async () => {
    const end = jest.spyOn(Pool.prototype, 'end');
    end.mockImplementationOnce(() => undefined);
    const service = createService();

    await service.onModuleDestroy();

    expect(end).toHaveBeenCalledTimes(1);
  });
});
