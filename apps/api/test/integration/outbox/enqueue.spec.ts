import { randomUUID } from 'node:crypto';

import type { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool, describeLiveDatabase, removeOutbox } from '../../live-database';

describeLiveDatabase('enqueue outbox transaction boundary', () => {
  let pool: PoolService;

  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it('creates exactly one row in the caller transaction and rollback removes it', async () => {
    const aggregateId = randomUUID();
    await pool.withClient(async (client) => {
      await client.query('begin');
      await client.query(
        "select private.enqueue_outbox_event('spec_be_001.enqueued', 'spec_be_001', $1, '{\"ok\":true}'::jsonb)",
        [aggregateId],
      );
      const inside = await client.query<{ count: string }>(
        'select count(*)::text as count from private.outbox_events where aggregate_id = $1',
        [aggregateId],
      );
      expect(inside.rows[0]?.count).toBe('1');
      await client.query('rollback');
    });

    const afterRollback = await pool.query<{ count: string }>(
      'select count(*)::text as count from private.outbox_events where aggregate_id = $1',
      [aggregateId],
    );
    expect(afterRollback.rows[0]?.count).toBe('0');

    await pool.query(
      "select private.enqueue_outbox_event('spec_be_001.enqueued', 'spec_be_001', $1, '{\"ok\":true}'::jsonb)",
      [aggregateId],
    );
    const committed = await pool.query<{ count: string }>(
      'select count(*)::text as count from private.outbox_events where aggregate_id = $1',
      [aggregateId],
    );
    expect(committed.rows[0]?.count).toBe('1');
    await removeOutbox(pool, aggregateId);
  });
});
