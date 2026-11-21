import { randomUUID } from 'node:crypto';

import type { PoolService } from '../../../src/platform/database/pool.service';
import { QueuePublisher } from '../../../src/platform/outbox/queue-publisher';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('outbox queue publication', () => {
  let pool: PoolService;

  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it('publishes with the restricted Worker role when PGMQ send has delay and headers overloads', async () => {
    const eventId = randomUUID();
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        // Keep both overload shapes present even on older local PGMQ versions.
        await client.query(`
          create or replace function pgmq.send(queue_name text, msg jsonb, headers jsonb)
          returns setof bigint language sql as $$select * from pgmq.send(queue_name, msg, 0)$$
        `);
        await client.query('set local role masarifi_worker');
        const publisher = new QueuePublisher({
          query: (sql: string, parameters: readonly unknown[]) =>
            client.query(sql, [...parameters]),
        } as PoolService);

        await publisher.publish({
          schemaVersion: 1,
          eventId,
          eventType: 'account.changed',
          occurredAt: '2026-10-04T00:00:00.000Z',
          producer: 'masarifi-api',
          aggregate: { type: 'account', id: null },
          correlationId: eventId,
          attempt: 1,
          payload: { sequence: 1 },
        });

        const queued = await client.query<{ message: { payload: { sequence: number } } }>(
          `select message from pgmq."q_platform-events" where message->>'eventId'=$1`,
          [eventId],
        );
        expect(queued.rows).toHaveLength(1);
        expect(queued.rows[0]?.message.payload).toEqual({ sequence: 1 });
      } finally {
        await client.query('rollback');
      }
    });
  });
});
