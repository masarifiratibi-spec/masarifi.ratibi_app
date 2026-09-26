import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { buildPoolOptions, PoolService } from '../../../src/platform/database/pool.service';

function createService(processKind = 'api'): PoolService {
  return new PoolService(
    new PlatformConfigService(
      new ConfigService({
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/test',
        MASARIFI_DATABASE_POOL_MAX: 2,
        MASARIFI_PROCESS_KIND: processKind,
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

  it.each([
    ['api', 'masarifi_api'],
    ['worker', 'masarifi_worker'],
  ])('activates the %s database role before the first query', async (processKind, role) => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ healthy: true }] });
    const release = jest.fn();
    jest.spyOn(Pool.prototype, 'connect').mockResolvedValueOnce({ query, release } as never);
    const service = createService(processKind);

    await expect(service.query<{ healthy: boolean }>('select $1', [true])).resolves.toMatchObject({
      rows: [{ healthy: true }],
    });

    expect(query).toHaveBeenNthCalledWith(1, `set role ${role}`);
    expect(query).toHaveBeenNthCalledWith(2, 'select $1', [true]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('returns successful parameterized query results', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ healthy: true }] });
    jest
      .spyOn(Pool.prototype, 'connect')
      .mockResolvedValueOnce({ query, release: jest.fn() } as never);
    const service = createService();

    await expect(service.query<{ healthy: boolean }>('select $1', [true])).resolves.toMatchObject({
      rows: [{ healthy: true }],
    });
  });

  it('fails with a safe stable code when a query exceeds its deadline', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockReturnValueOnce(new Promise(() => undefined));
    const release = jest.fn();
    jest.spyOn(Pool.prototype, 'connect').mockResolvedValueOnce({ query, release } as never);
    const service = createService();

    await expect(service.query('select 1', [], 1)).rejects.toThrow('DATABASE_QUERY_TIMEOUT');
    expect(release).toHaveBeenCalledWith(true);
  });

  it('closes the pool during module shutdown', async () => {
    const end = jest.spyOn(Pool.prototype, 'end');
    end.mockImplementationOnce(() => undefined);
    const service = createService();

    await service.onModuleDestroy();

    expect(end).toHaveBeenCalledTimes(1);
  });
});
