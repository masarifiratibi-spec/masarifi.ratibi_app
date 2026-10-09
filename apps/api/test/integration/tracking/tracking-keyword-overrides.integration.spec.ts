import { randomUUID } from 'node:crypto';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('persisted published keyword safety', () => {
  const pool = createLivePool();
  let owner: string;
  beforeEach(async () => {
    owner = `tracking_keyword_policy_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
  });
  afterAll(async () => pool.onModuleDestroy());
  async function defaultRow(keyword = 'purchase') {
    const row = (
      await pool.query<{
        id: string;
        version: string;
        keyword: string;
        group_key: string;
        language_code: string;
        priority: number;
      }>(
        "select id,version,keyword,group_key,language_code,priority from public.user_keyword_rules where user_id=$1 and keyword=$2 and origin='default'",
        [owner, keyword],
      )
    ).rows[0];
    if (!row) throw new Error('Seeded default keyword missing');
    return row;
  }
  it('accepts a persisted neutral financial keyword', async () => {
    const result = await pool.query<{ rule: { group_key: string; origin: string } }>(
      "select private.upsert_keyword_rule($1,null,'MyBank alert','financial','en','contains',null,100,true,null) rule",
      [owner],
    );
    expect(result.rows[0]?.rule).toMatchObject({ group_key: 'financial', origin: 'custom' });
  });
  it('rejects default wording edits without losing the original override', async () => {
    const row = await defaultRow();
    await expect(
      pool.query(
        "select private.upsert_keyword_rule($1,$2,'rewritten default',$3,$4,'contains',null,100,true,$5)",
        [owner, row.id, row.group_key, row.language_code, row.version],
      ),
    ).rejects.toMatchObject({ message: 'TRACKING_DEFAULT_IMMUTABLE' });
    expect((await defaultRow()).id).toBe(row.id);
  });
  it('rejects default deletion instead of silently reactivating the release phrase', async () => {
    const row = await defaultRow();
    await expect(
      pool.query('select private.delete_keyword_rule($1,$2,$3)', [owner, row.id, row.version]),
    ).rejects.toMatchObject({ message: 'TRACKING_DEFAULT_IMMUTABLE' });
    expect((await defaultRow()).id).toBe(row.id);
  });
  it('allows default action toggles while preserving published priority and identity', async () => {
    const row = await defaultRow();
    const result = await pool.query<{
      rule: { enabled: boolean; priority: number; id: string; origin: string };
    }>("select private.upsert_keyword_rule($1,$2,$3,$4,$5,'contains',null,100,false,$6) rule", [
      owner,
      row.id,
      row.keyword,
      row.group_key,
      row.language_code,
      row.version,
    ]);
    expect(result.rows[0]?.rule).toMatchObject({
      id: row.id,
      origin: 'default',
      enabled: false,
      priority: row.priority,
    });
  });
  it('does not disable lifecycle precedence through a default keyword toggle', async () => {
    const row = await defaultRow('failed');
    await expect(
      pool.query(
        "select private.upsert_keyword_rule($1,$2,$3,$4,$5,'contains',null,100,false,$6)",
        [owner, row.id, row.keyword, row.group_key, row.language_code, row.version],
      ),
    ).rejects.toMatchObject({ message: 'TRACKING_RULE_PROTECTED' });
  });
});
