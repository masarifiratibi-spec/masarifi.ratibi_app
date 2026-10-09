import { createHash, randomUUID } from 'node:crypto';

import { ReferenceRepository } from '../../../src/reference/reference.repository';
import { ReferenceService } from '../../../src/reference/reference.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('reference cache hashing with the restricted API role', () => {
  const pool = createLivePool();
  const repository = new ReferenceRepository(pool);
  const service = new ReferenceService(repository, {} as never);
  const owner = { userId: `hash_owner_${randomUUID()}`, sessionId: 'local', factorAgeSeconds: 0 };
  const other = { ...owner, userId: `hash_other_${randomUUID()}` };
  const inactive = { ...owner, userId: `hash_inactive_${randomUUID()}` };
  const systemId = randomUUID(),
    ownerId = randomUUID(),
    otherId = randomUUID();
  const read = (principal = owner) =>
    service.execute({
      operation: 'listCategories',
      principal,
      query: { limit: '100' },
      requestId: randomUUID(),
    }) as Promise<{ items: { id: string; labelEn: string }[] }>;

  beforeAll(async () => {
    await pool.query(
      "insert into public.profiles(id,status) values($1,'active'),($2,'active'),($3,'suspended')",
      [owner.userId, other.userId, inactive.userId],
    );
    await pool.query(
      `insert into public.categories(id,user_id,system_key,kind,label_ar,label_en,sort_order)
      values($1,null,$6,'expense','بقالة','Hash groceries',0),($2,$4,null,'expense','خاص','Owner only',1),($3,$5,null,'expense','خاص','Other only',2)`,
      [systemId, ownerId, otherId, owner.userId, other.userId, `hash-${systemId}`],
    );
  });
  afterAll(async () => {
    await pool.query('delete from public.categories where id=any($1::uuid[])', [
      [systemId, ownerId, otherId],
    ]);
    await pool.query('delete from public.profiles where id=any($1)', [
      [owner.userId, other.userId, inactive.userId],
    ]);
    await pool.onModuleDestroy();
  });

  it.each(['categories', 'currencies', 'countries'] as const)(
    'hashes %s without extension-schema access',
    async (resource) => {
      const privileges = await pool.query(
        "select has_schema_privilege('masarifi_api','extensions','USAGE') allowed",
      );
      expect(privileges.rows[0]?.allowed).toBe(false);
      const first = await repository.sharedHash(owner, resource);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(await repository.sharedHash(other, resource)).toBe(first);
      expect(await repository.sharedHash(owner, resource)).toBe(first);
    },
  );

  it('preserves the existing category fingerprint bytes including Arabic text', async () => {
    const expected = await pool.query<{
      bytes: string;
    }>(`select coalesce(string_agg(row_to_json(x)::text,'' order by x.key),'') bytes
      from (select id::text key,version,label_ar,label_en,kind,icon,color,sort_order from public.categories where user_id is null and active and deleted_at is null) x`);
    const row = expected.rows[0];
    if (!row) throw new Error('missing aggregate fingerprint');
    expect(await repository.sharedHash(owner, 'categories')).toBe(
      createHash('sha256').update(row.bytes, 'utf8').digest('hex'),
    );
  });

  it('refreshes system categories and keeps custom categories owner scoped on a cache hit', async () => {
    const first = await read();
    expect(first.items.some((x) => x.id === ownerId)).toBe(true);
    expect(first.items.some((x) => x.id === otherId)).toBe(false);
    const second = await read(other);
    expect(second.items.some((x) => x.id === otherId)).toBe(true);
    expect(second.items.some((x) => x.id === ownerId)).toBe(false);
    await pool.query(
      "update public.categories set label_en='Changed system category',version=version+1 where id=$1",
      [systemId],
    );
    expect((await read()).items.find((x) => x.id === systemId)?.labelEn).toBe(
      'Changed system category',
    );
    await pool.query(
      'update public.categories set active=false,deleted_at=clock_timestamp() where id=$1',
      [systemId],
    );
    expect((await read()).items.some((x) => x.id === systemId)).toBe(false);
  });

  it('rejects an inactive profile even after warming the shared cache', async () => {
    await read();
    await expect(read(inactive)).rejects.toMatchObject({ response: { code: 'PROFILE_INACTIVE' } });
  });
});
