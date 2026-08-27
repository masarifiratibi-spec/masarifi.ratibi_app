import type { PoolService } from '../../../src/platform/database/pool.service';
import { OutboxRepository } from '../../../src/platform/outbox/outbox.repository';
import {
  createLivePool,
  describeLiveDatabase,
  removeOutbox,
  seedOutbox,
} from '../../live-database';

describeLiveDatabase('outbox lease recovery', () => {
  let pool: PoolService;
  let repository: OutboxRepository;

  beforeAll(() => {
    pool = createLivePool();
    repository = new OutboxRepository(pool);
  });
  afterAll(async () => pool.onModuleDestroy());

  it('reassigns an expired lease and rejects stale completion', async () => {
    const aggregateId = await seedOutbox(pool, 1);
    try {
      const first = await repository.claim('worker-a', 1, 1);
      expect(first).toHaveLength(1);
      const event = first[0];
      if (!event) throw new Error('EXPECTED_FIRST_CLAIM');
      await new Promise((resolve) => setTimeout(resolve, 1_100));

      const second = await repository.claim('worker-b', 1, 30);
      expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
      await expect(repository.complete(event.id, 'worker-a')).resolves.toBe(false);
      await expect(repository.complete(event.id, 'worker-b')).resolves.toBe(true);
    } finally {
      await removeOutbox(pool, aggregateId);
    }
  });
});
