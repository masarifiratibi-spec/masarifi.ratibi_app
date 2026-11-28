import { randomUUID } from 'node:crypto';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('shared AI traffic admission', () => {
  const pool = createLivePool();
  const owner = randomUUID(),
    ip = randomUUID();
  afterAll(() => pool.onModuleDestroy());

  async function admit(user: string, address: string, bucket: string, lane = 'normal') {
    const token = randomUUID();
    const { rows } = await pool.query<{ retry: number }>(
      'select private.ai_http_admit($1,$2,$3,$4,$5) retry',
      [token, user, address, bucket, lane],
    );
    const row = rows[0];
    if (!row) throw new Error('Expected an admission result');
    return { token, retry: row.retry };
  }
  const release = (token: string) => pool.query('select private.ai_http_release($1)', [token]);

  it('allows sending text, recording, uploading, processing and polling on the same account', async () => {
    for (const bucket of ['chat', 'create', 'upload', 'process', 'poll', 'poll', 'poll', 'poll']) {
      const grant = await admit(owner, ip, bucket, bucket === 'upload' ? 'upload' : 'normal');
      expect(grant.retry).toBe(0);
      await release(grant.token);
    }
  });

  it('shares burst and connection limits across devices and keeps other accounts on the same IP available', async () => {
    const user = randomUUID();
    const results = await Promise.all([1, 2, 3, 4].map(() => admit(user, ip, 'chat')));
    expect(results.filter((x) => x.retry === 0)).toHaveLength(3);
    expect(results.find((x) => x.retry > 0)?.retry).toBeLessThanOrEqual(10);
    for (const x of results) await release(x.token);
    const waits = await Promise.all(
      [ip, randomUUID(), ip].map((address) => admit(user, address, 'poll', 'wait')),
    );
    expect(waits.filter((x) => !x.retry)).toHaveLength(2);
    const other = await admit(randomUUID(), ip, 'poll', 'wait');
    expect(other.retry).toBe(0);
    for (const x of [...waits, other]) await release(x.token);
    const upload = await admit(user, ip, 'upload', 'upload');
    expect(upload.retry).toBe(0);
    expect((await admit(user, randomUUID(), 'upload', 'upload')).retry).toBe(1);
    await release(upload.token);
    expect((await admit(user, ip, 'upload', 'upload')).retry).toBe(0);
  });
  it('uses a rolling minute per IP even for new accounts', async () => {
    const address = randomUUID();
    await pool.query(
      `insert into private.ai_http_admissions
      select gen_random_uuid(),'fixture',$1,'create','normal',now()-interval '30 seconds',null,now()+interval '30 seconds'
      from generate_series(1,60)`,
      [address],
    );
    const blocked = await admit(randomUUID(), address, 'create');
    expect(blocked.retry).toBeGreaterThan(0);
    expect(blocked.retry).toBeLessThanOrEqual(30);
    expect((await admit(randomUUID(), address, 'poll')).retry).toBe(0);
  });
  it('limits paid worker slots across processes and releases them', async () => {
    const tokens = Array.from({ length: 6 }, () => randomUUID());
    const start = async (index: number, user: string) =>
      (
        await pool.query<{ ok: boolean }>('select private.ai_start_processing($1,$2,10) ok', [
          tokens[index],
          user,
        ])
      ).rows[0]?.ok;
    try {
      expect(await start(0, owner)).toBe(true);
      expect(await start(1, owner)).toBe(true);
      expect(await start(2, owner)).toBe(false);
      expect(await start(3, 'b')).toBe(true);
      expect(await start(4, 'c')).toBe(true);
      expect(await start(5, 'd')).toBe(false);
      await pool.query('select private.ai_end_processing($1)', [tokens[0]]);
      expect(await start(2, owner)).toBe(true);
    } finally {
      for (const token of tokens) await pool.query('select private.ai_end_processing($1)', [token]);
    }
  });
});
