import type { PoolService } from '../../../src/platform/database/pool.service';
import {
  createLivePool,
  describeLiveDatabase,
  removeOutbox,
  seedOutbox,
} from '../../live-database';

interface ClaimedRow {
  id: string;
  aggregate_id: string;
  locked_by: string;
}

describeLiveDatabase('concurrent outbox claims', () => {
  let pool: PoolService;

  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it('enforces 1/100/101 bounds and gives workers disjoint leases', async () => {
    const aggregateId = await seedOutbox(pool, 201);
    try {
      await expect(
        pool.query('select * from private.claim_outbox_batch($1, $2, $3)', [
          'invalid-limit',
          101,
          30,
        ]),
      ).rejects.toThrow('OUTBOX_CLAIM_LIMIT_INVALID');

      const single = await pool.query<ClaimedRow>(
        'select * from private.claim_outbox_batch($1, $2, $3)',
        ['single-worker', 1, 30],
      );
      expect(single.rows).toHaveLength(1);

      const [first, second] = await Promise.all([
        pool.query<ClaimedRow>('select * from private.claim_outbox_batch($1, $2, $3)', [
          'worker-a',
          100,
          30,
        ]),
        pool.query<ClaimedRow>('select * from private.claim_outbox_batch($1, $2, $3)', [
          'worker-b',
          100,
          30,
        ]),
      ]);
      expect(first.rows).toHaveLength(100);
      expect(second.rows).toHaveLength(100);
      const firstIds = new Set(first.rows.map((row) => row.id));
      expect(second.rows.some((row) => firstIds.has(row.id))).toBe(false);
      expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(200);
      expect(first.rows.every((row) => row.locked_by === 'worker-a')).toBe(true);
      expect(second.rows.every((row) => row.locked_by === 'worker-b')).toBe(true);
    } finally {
      await removeOutbox(pool, aggregateId);
    }
  });
});
