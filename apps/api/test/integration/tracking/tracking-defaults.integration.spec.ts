import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { classifyFinancialMessage, validateRuleSnapshot } from '@masarifi/transaction-parser';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('automatic database tracking defaults', () => {
  const pool = createLivePool();
  let owner: string;

  beforeEach(async () => {
    owner = `tracking_defaults_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
  });
  afterAll(async () => pool.onModuleDestroy());

  it('initializes a new profile without a restore request or Admin interaction', async () => {
    const result = await pool.query<{ total: number; ar: number; en: number }>(
      `select count(*)::int total,
        count(*) filter(where language_code='ar')::int ar,
        count(*) filter(where language_code='en')::int en
       from public.user_keyword_rules where user_id=$1 and origin='default'`,
      [owner],
    );
    expect(result.rows[0]).toEqual({ total: 101, ar: 47, en: 54 });
  });

  it('seeds idempotently while retaining disabled defaults and custom wording', async () => {
    await pool.query(
      "update public.user_keyword_rules set enabled=false where user_id=$1 and keyword='purchase'",
      [owner],
    );
    await pool.query(
      `insert into public.user_keyword_rules(user_id,keyword,group_key,language_code)
       values($1,'my custom purchase','expense','en')`,
      [owner],
    );
    await pool.query('select private.seed_default_keyword_rules($1)', [owner]);
    await pool.query('select private.seed_default_keyword_rules($1)', [owner]);
    const result = await pool.query<{ total: number; purchase: boolean; custom: number }>(
      `select count(*)::int total,
        bool_or(enabled) filter(where keyword='purchase') purchase,
        count(*) filter(where origin='custom')::int custom
       from public.user_keyword_rules where user_id=$1`,
      [owner],
    );
    expect(result.rows[0]).toEqual({ total: 102, purchase: false, custom: 1 });
  });

  it('restores from the active database pack and includes protected status wording', async () => {
    await pool.query(
      `insert into public.user_keyword_rules(user_id,keyword,group_key,language_code)
       values($1,'my custom purchase','expense','en')`,
      [owner],
    );
    await pool.query('select private.restore_default_keyword_rules($1)', [owner]);
    const result = await pool.query<{ keyword: string; priority: number }>(
      'select keyword,priority from public.user_keyword_rules where user_id=$1',
      [owner],
    );
    const entries = new Map(result.rows.map((r) => [r.keyword, r.priority]));
    expect(entries.get('purchase')).toBe(740);
    expect(entries.get('declined')).toBe(950);
    expect(entries.get('pending')).toBe(920);
    expect(entries.get('شراء عبر نقاط بيع')).toBe(820);
    expect(entries.get('سدادك')).toBe(790);
    expect(entries.has('my custom purchase')).toBe(true);
    expect(result.rows).toHaveLength(102);
  });

  it('backfills an existing empty profile and safely repeats the seed migration', async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        const legacy = `tracking_legacy_${randomUUID()}`;
        await client.query("insert into public.profiles(id,status) values($1,'active')", [legacy]);
        await client.query('delete from public.user_keyword_rules where user_id=$1', [legacy]);
        await client.query(
          `insert into public.user_keyword_rules(user_id,keyword,group_key,language_code,enabled)
           values($1,'purchase','expense','en',false)`,
          [legacy],
        );
        const migration = readFileSync(
          resolve(
            process.cwd(),
            '../../supabase/migrations/20261009113629_seed_tracking_keyword_defaults_automatically.sql',
          ),
          'utf8',
        ).replaceAll('\r\n', '\n');
        await client.query(migration);
        const first = (
          await client.query<{
            id: string;
            keyword: string;
            enabled: boolean;
            origin: string;
            version: string;
          }>(
            'select id,keyword,enabled,origin,version from public.user_keyword_rules where user_id=$1 order by keyword',
            [legacy],
          )
        ).rows;
        await client.query(migration);
        const second = (
          await client.query<{
            id: string;
            keyword: string;
            enabled: boolean;
            origin: string;
            version: string;
          }>(
            'select id,keyword,enabled,origin,version from public.user_keyword_rules where user_id=$1 order by keyword',
            [legacy],
          )
        ).rows;
        expect(second).toEqual(first);
        expect(second).toHaveLength(101);
        expect(second.find((row) => row.keyword === 'purchase')).toMatchObject({
          enabled: false,
          origin: 'custom',
          version: '1',
        });
      } finally {
        await client.query('rollback');
      }
    });
  });

  it('does not expose the internal backfill functions to clients', async () => {
    const result = await pool.query<{ allowed: boolean }>(
      `select has_function_privilege(role_name,function_name,'execute') allowed
       from unnest(array['anon','authenticated','masarifi_api','masarifi_worker']) role_name
       cross join unnest(array['private.seed_default_keyword_rules(text)','private.seed_profile_tracking_keywords()']) function_name`,
    );
    expect(result.rows).toHaveLength(8);
    expect(result.rows.every((row) => !row.allowed)).toBe(true);
  });

  it.each([
    ['شراء عبر نقاط بيع SAR 3.95', 'completed', 'pos_purchase', 'outgoing', 395, 'SAR'],
    ['bill payment مبلغ ٥٠ درهم', 'completed', 'bill_payment', 'outgoing', 5000, 'AED'],
    ['purchase SAR 4.00 declined', 'declined', 'purchase', 'outgoing', 400, 'SAR'],
    ['دفع ٤ ريال غير ناجحة', 'failed', 'payment', 'outgoing', 400, 'SAR'],
    [
      'refunded AED 12.95 will be credited within 2-3 working days',
      'pending',
      'refund',
      'incoming',
      1295,
      'AED',
    ],
    ['purchase AED 4 reversed', 'completed', 'reversal', 'incoming', 400, 'AED'],
  ])(
    'loads database rules with lifecycle precedence: %s',
    async (text, status, subtype, direction, amountMinor, currency) => {
      const result = await pool.query<{ snapshot: unknown }>(
        `select r.snapshot from public.tracking_rule_channels c
       join public.tracking_rule_releases r on r.id=c.release_id where c.environment='default'`,
      );
      const snapshot = validateRuleSnapshot(result.rows[0]?.snapshot);
      const parsed = classifyFinancialMessage({ text, receivedAt: Date.now() }, snapshot);
      expect(parsed).toMatchObject({ status, subtype, direction, amountMinor, currency });
      if (['failed', 'declined'].includes(status)) expect(parsed.disposition).toBe('ignore');
      if (status === 'pending' || subtype === 'reversal') expect(parsed.disposition).toBe('review');
      expect(snapshot.aiEnabled).toBe(false);
    },
  );
});
