import { ReadinessDependencies } from '../../../src/platform/health/readiness-dependencies';

describe('ReadinessDependencies', () => {
  it('reports up only when the internal logged queue exists', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ compatible: true, healthy: true }] }),
    };
    const indicator = new ReadinessDependencies(database as never);

    await expect(indicator.check(1_000)).resolves.toEqual({ database: 'up', queue: 'up' });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('q_platform-events'),
      [],
      1_000,
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('claim_client_mutations(text,integer,integer)'),
      [],
      1_000,
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('claim_planning_job(text,uuid,integer,integer)'),
      [],
      1_000,
    );
    expect(database.query).not.toHaveBeenCalledWith(
      expect.stringContaining('from private.planning_job_claims'),
      [],
      1_000,
    );
  });

  it('returns down without exposing the dependency error', async () => {
    const database = {
      query: jest.fn().mockRejectedValue(new Error('postgresql://secret-host')),
    };
    const indicator = new ReadinessDependencies(database as never);

    await expect(indicator.check(1_000)).resolves.toEqual({ database: 'down', queue: 'down' });
  });

  it('maps a bounded database timeout to down', async () => {
    const database = {
      query: jest.fn().mockRejectedValue(new Error('DATABASE_QUERY_TIMEOUT')),
    };
    const indicator = new ReadinessDependencies(database as never);

    await expect(indicator.check(1_000)).resolves.toEqual({ database: 'down', queue: 'down' });
    expect(database.query).toHaveBeenCalledWith(expect.any(String), [], 1_000);
  });
});
