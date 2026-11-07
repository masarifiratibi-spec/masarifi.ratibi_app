import { randomUUID } from 'node:crypto';
import { financialGeneration } from '../../../src/platform/http/financial-generation';
import { FinancialResetService } from '../../../src/security/financial-reset.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('financial reset repository contract', () => {
  const pool = createLivePool(2);
  const service = new FinancialResetService(new SecurityRepository(pool));
  const owner = { userId: 'reset_' + randomUUID(), sessionId: 'session-a', factorAgeSeconds: null };
  const other = { ...owner, userId: 'reset_' + randomUUID(), sessionId: 'session-b' };
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      owner.userId,
      other.userId,
    ]);
  });
  afterAll(async () => {
    try {
      await pool.query('delete from public.profiles where id in ($1,$2)', [
        owner.userId,
        other.userId,
      ]);
    } finally {
      await pool.onModuleDestroy();
    }
  });

  it('serializes retries, returns the reset watermark and isolates owners on reused connections', async () => {
    const id = randomUUID();
    expect(await service.state(owner)).toEqual({
      generation: 0,
      resetAt: null,
      status: 'ready',
      requestId: null,
    });
    const expected = { id, generation: 1, status: 'completed' };
    await expect(
      Promise.all([service.reset(owner, id), service.reset(owner, id)]),
    ).resolves.toEqual([expected, expected]);
    expect(await service.receipt(owner, id)).toEqual(expected);
    const state = await service.state(owner);
    expect(typeof state.resetAt).toBe('string');
    expect(state).toEqual({
      generation: 1,
      resetAt: state.resetAt,
      status: 'ready',
      requestId: id,
    });
    await expect(service.receipt(other, id)).rejects.toMatchObject({ status: 404 });
    expect((await service.state(other)).generation).toBe(0);
    const nextId = randomUUID();
    await expect(
      financialGeneration.run('0', () => service.reset(owner, nextId)),
    ).rejects.toMatchObject({ message: 'FINANCIAL_GENERATION_STALE' });
    expect(await financialGeneration.run('1', () => service.reset(owner, nextId))).toEqual({
      id: nextId,
      generation: 2,
      status: 'completed',
    });
    expect(await service.reset(owner, id)).toEqual(expected);
  });
});
