import { withMigrationLock } from '../../../src/platform/database/migration-runner';

describe('withMigrationLock', () => {
  it('runs once while holding the dedicated advisory lock and always unlocks', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ unlocked: true }] }),
    };
    const action = jest.fn().mockResolvedValue('done');

    await expect(withMigrationLock(client, action)).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('pg_advisory_unlock'), [
      expect.any(String),
    ]);
  });

  it('rejects contention without entering the apply section', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }),
    };
    const action = jest.fn();

    await expect(withMigrationLock(client, action)).rejects.toThrow('MIGRATION_LOCK_UNAVAILABLE');
    expect(action).not.toHaveBeenCalled();
  });

  it('unlocks when migration work fails', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ unlocked: true }] }),
    };

    await expect(
      withMigrationLock(client, () => Promise.reject(new Error('APPLY_FAILED'))),
    ).rejects.toThrow('APPLY_FAILED');
    expect(client.query).toHaveBeenLastCalledWith(expect.stringContaining('pg_advisory_unlock'), [
      expect.any(String),
    ]);
  });
});
