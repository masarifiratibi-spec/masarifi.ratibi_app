import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('AI admission across worker connections', () => {
  const firstPool = createLivePool(),
    secondPool = createLivePool();
  const first = new AiRepository(firstPool),
    second = new AiRepository(secondPool);
  const voice = 'voice_transcription';
  const state = 'private.ai_route_circuits';

  afterAll(async () => {
    await Promise.all([firstPool.onModuleDestroy(), secondPool.onModuleDestroy()]);
  });

  it('shares failures, fences stale workers and leases one recovery probe', async () => {
    const reset = () =>
      firstPool.query(
        `update ${state} set failures='{}', open_until=null, probe_until=null, generation=gen_random_uuid() where workload=$1`,
        [voice],
      );
    await reset();
    try {
      const acquire = (repo: AiRepository) => repo.acquireCircuit(voice, 60000);
      const token = await acquire(first);
      expect(token).toBeTruthy();
      if (!token) throw Error('missing admission');
      // A failure outside the rolling window must not contribute to the threshold.
      await firstPool.query(
        `update ${state} set failures=array[clock_timestamp()-interval '61 seconds'] where workload=$1`,
        [voice],
      );
      await Promise.all(
        [first, second, first, second].map((repo) => repo.finishCircuit(voice, token, 'retryable')),
      );
      expect(await acquire(second)).toBe(token);
      await first.finishCircuit(voice, token, 'retryable');
      await second.finishCircuit(voice, token, 'success');
      expect(await acquire(second)).toBeNull();
      expect(await second.acquireCircuit('financial_assistant', 60000)).toBeTruthy();
      const expireOpen = () =>
        firstPool.query(`update ${state} set open_until=clock_timestamp() where workload=$1`, [
          voice,
        ]);
      await expireOpen();
      const probes = await Promise.all([acquire(first), acquire(second)]);
      expect(probes.filter(Boolean)).toHaveLength(1);
      const abandoned = probes.find((value): value is string => value !== null);
      if (!abandoned) throw Error('missing first probe');
      await firstPool.query(`update ${state} set probe_until=clock_timestamp() where workload=$1`, [
        voice,
      ]);
      const replacement = await acquire(second);
      expect(replacement).toBeTruthy();
      if (!replacement) throw Error('missing replacement probe');
      expect(replacement).not.toBe(abandoned);
      await first.finishCircuit(voice, abandoned, 'success');
      expect(await acquire(first)).toBeNull();
      await second.finishCircuit(voice, replacement, 'retryable');
      expect(await acquire(first)).toBeNull();
      await expireOpen();
      const probe = await acquire(first);
      if (!probe) throw Error('missing recovery probe');
      await first.finishCircuit(voice, probe, 'success');
      expect(await acquire(second)).toBeTruthy();
      expect(await acquire(first)).toBeTruthy();
    } finally {
      await reset();
    }
  });
});
