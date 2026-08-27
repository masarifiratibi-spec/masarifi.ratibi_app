import type { PoolService } from '../../src/platform/database/pool.service';
import { withMigrationLock } from '../../src/platform/database/migration-runner';
import { createLivePool, describeLiveDatabase } from '../live-database';

describeLiveDatabase('migration lock contention', () => {
  let pool: PoolService;

  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it('allows exactly one migration job into the apply section', async () => {
    await pool.withClient(async (firstClient) => {
      await pool.withClient(async (secondClient) => {
        let release!: () => void;
        const hold = new Promise<void>((resolve) => {
          release = resolve;
        });
        let entered = 0;
        const first = withMigrationLock(firstClient, async () => {
          entered += 1;
          await hold;
        });
        await new Promise((resolve) => setTimeout(resolve, 50));

        await expect(
          withMigrationLock(secondClient, () => {
            entered += 1;
            return Promise.resolve();
          }),
        ).rejects.toThrow('MIGRATION_LOCK_UNAVAILABLE');
        release();
        await expect(first).resolves.toBeUndefined();
        expect(entered).toBe(1);
      });
    });
  });
});
