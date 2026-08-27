import { randomUUID } from 'node:crypto';

import { PoolService } from '../src/platform/database/pool.service';

export const describeLiveDatabase =
  process.env.MASARIFI_LIVE_DATABASE_TESTS === '1' ? describe : describe.skip;

export function createLivePool(): PoolService {
  return new PoolService({
    get: (key: string) => {
      if (key === 'DATABASE_URL') return process.env.DATABASE_URL;
      if (key === 'MASARIFI_DATABASE_POOL_MAX') return 10;
      throw new Error(`UNEXPECTED_CONFIG_KEY:${key}`);
    },
  } as never);
}

export async function seedOutbox(pool: PoolService, count: number): Promise<string> {
  const aggregateId = randomUUID();
  await pool.query(
    `select private.enqueue_outbox_event(
       'spec_be_001.integration',
       'spec_be_001',
       $1::uuid,
       jsonb_build_object('sequence', sequence)
     )
     from generate_series(1, $2::integer) as sequence`,
    [aggregateId, count],
  );
  return aggregateId;
}

export async function removeOutbox(pool: PoolService, aggregateId: string): Promise<void> {
  await pool.query('delete from private.outbox_events where aggregate_id = $1', [aggregateId]);
}
