import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('idle AI queue database response budget', () => {
  const pool = createLivePool();
  const repository = new AiRepository(pool);
  afterAll(() => pool.onModuleDestroy());

  it.each(['work', 'analysis', 'purge'] as const)(
    'keeps the empty %s claim transaction within 180 PostgreSQL response bytes',
    async (kind) => {
      const observed = await pool.withClient(async (client) => {
        await client.query('select 1');
        const stream = Reflect.get(client, 'connection').stream as Socket;
        return { stream, before: stream.bytesRead };
      });
      const worker = 'wire-budget-test';
      const claims =
        kind === 'work'
          ? await repository.claimWork('voice.transcribe_extract', worker, 1, 120)
          : kind === 'analysis'
            ? await repository.claimAnalysisWork(worker, 1, 120)
            : await repository.claimAnalysisPurges(worker, 1, 120);
      expect(claims).toEqual([]);
      const bytes = observed.stream.bytesRead - observed.before;
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThanOrEqual(180);
    },
  );
});
import type { Socket } from 'node:net';
