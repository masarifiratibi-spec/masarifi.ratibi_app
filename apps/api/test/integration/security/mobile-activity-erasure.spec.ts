import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const databaseUrl = process.env.MASARIFI_ACTIVITY_ERASURE_LOCAL_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('mobile activity erasure regression from 2026-11-01 on local PostgreSQL', () => {
  let db: Client;
  const migrations = resolve(__dirname, '../../../../../supabase/migrations');
  const source = (name: string) => readFileSync(resolve(migrations, name), 'utf8');
  const request = '11111111-1111-4111-8111-111111111111';
  const functionSql = (sql: string, name: string) => {
    const start = sql.search(
      new RegExp(`create (?:or replace )?function private\\.${name}\\(`, 'i'),
    );
    const end = sql.indexOf('end $$;', start);
    if (start < 0 || end < 0) throw new Error('FIXTURE_FUNCTION_REQUIRED');
    return sql.slice(start, end + 'end $$;'.length);
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    const target = new URL(databaseUrl);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '15491' ||
      target.pathname !== '/activity_erasure_20261101'
    )
      throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    await db.query('begin');
    await db.query(`
      do $roles$ begin
        if not exists(select 1 from pg_roles where rolname='masarifi_migration') then create role masarifi_migration nologin; end if;
        if not exists(select 1 from pg_roles where rolname='masarifi_worker') then create role masarifi_worker nologin; end if;
        if not exists(select 1 from pg_roles where rolname='masarifi_api') then create role masarifi_api nologin; end if;
      end $roles$;
      create schema private authorization masarifi_migration;
      create schema audit authorization masarifi_migration;
      grant usage on schema private,public to masarifi_worker,masarifi_api;
      create table public.profiles(id text primary key,status text,locale text,timezone text,last_seen_at timestamptz);
      create table public.admin_profiles(user_id text);
      create table private.account_deletion_requests(id uuid primary key,user_id text,status text,verified_at timestamptz,cooling_off_ends_at timestamptz);
      create table private.retention_holds(resource_id text,starts_at timestamptz,ends_at timestamptz);
      create table private.account_erasure_context(transaction_id bigint primary key,request_id uuid,user_id text,objects_locked boolean);
    `);
    const payloadSql = functionSql(
      source('20261016201500_owner_outbox_erasure_lookup.sql'),
      'erase_account_owner_payload',
    );
    // Empty domain tables let the real payload function run without external providers.
    const tables = new Set([
      ...Array.from(
        payloadSql.matchAll(/(?:from|join|update) ((?:public|private|audit)\.[a-z_]+)/g),
        (m) => {
          if (!m[1]) throw new Error('FIXTURE_TABLE_REQUIRED');
          return m[1];
        },
      ),
      ...Array.from(payloadSql.matchAll(/\('(public|private)','([a-z_]+)'\)/g), (m) => {
        if (!m[1] || !m[2]) throw new Error('FIXTURE_TABLE_REQUIRED');
        return `${m[1]}.${m[2]}`;
      }),
    ]);
    for (const table of tables) {
      if (
        [
          'public.profiles',
          'private.account_deletion_requests',
          'private.retention_holds',
          'private.account_erasure_context',
        ].includes(table)
      )
        continue;
      await db.query(`create table ${table}(id uuid,user_id text,request_id uuid,resource_id text,resource_type text,
        actor_id text,payload jsonb,aggregate_id uuid,aggregate_type text,event_type text,metadata jsonb,
        session_id uuid,command_evidence jsonb,transaction_id uuid,account_id uuid)`);
    }
    const activitySql = source('20261023095047_admin_report_measurements.sql');
    const activityTable = activitySql.match(
      /create table private\.mobile_activity_buckets \([\s\S]*?\n\);/,
    )?.[0];
    if (!activityTable) throw new Error('ACTIVITY_SCHEMA_REQUIRED');
    await db.query(activityTable);
    await db.query(`alter table private.mobile_activity_buckets owner to masarifi_migration;
      alter table private.mobile_activity_buckets enable row level security;
      revoke all on private.mobile_activity_buckets from public,masarifi_api,masarifi_worker;
      grant select,insert,update,delete on all tables in schema private,public,audit to masarifi_migration;`);
    await db.query(
      functionSql(
        source('20261016101500_account_owner_payload_erasure.sql'),
        'assert_account_erasure_request',
      ),
    );
    await db.query(
      'alter function private.assert_account_erasure_request(uuid,text,boolean) owner to masarifi_migration',
    );
    await db.query(payloadSql);
    await db.query(`alter function private.erase_account_owner_payload(uuid,text) owner to masarifi_migration;
      revoke all on function private.erase_account_owner_payload(uuid,text) from public,masarifi_api;
      grant execute on function private.erase_account_owner_payload(uuid,text) to masarifi_worker;`);
    await db.query(source('20261101105635_mobile_activity_owner_erasure.sql'));
  });
  afterAll(async () => {
    await db.query('rollback');
    await db.end();
  });
  beforeEach(async () => {
    await db.query('savepoint scenario');
    await db.query(`insert into public.profiles(id,status) values('owner','deletion_pending'),('other','active');
      insert into private.account_deletion_requests values('${request}','owner','processing',now(),now());
      insert into private.mobile_activity_buckets(user_id,platform,bucket_at,observed_at) values
        ('owner','android','2026-11-01T10:00:00Z','2026-11-01T10:01:00Z'),
        ('owner','ios','2026-11-01T10:00:00Z','2026-11-01T10:02:00Z'),
        ('other','android','2026-11-01T10:00:00Z','2026-11-01T10:03:00Z');`);
  });
  afterEach(async () => db.query('rollback to scenario'));
  const lockContext = async () =>
    db.query('insert into private.account_erasure_context values(txid_current(),$1,$2,true)', [
      request,
      'owner',
    ]);

  it('erases owned activity idempotently and preserves the other owner exactly', async () => {
    const before = (
      await db.query("select * from private.mobile_activity_buckets where user_id='other'")
    ).rows;
    await lockContext();
    await db.query('set local role masarifi_worker');
    await db.query('select private.erase_account_owner_payload($1,$2)', [request, 'owner']);
    await db.query('reset role');
    await lockContext();
    await db.query('set local role masarifi_worker');
    await db.query('select private.erase_account_owner_payload($1,$2)', [request, 'owner']);
    await db.query('reset role');
    expect((await db.query('select * from private.mobile_activity_buckets')).rows).toEqual(before);
  });

  it.each([
    ['unlocked', '42501', 'ERASURE_OBJECTS_NOT_LOCKED'],
    ['foreign', '42501', 'ERASURE_REQUEST_FORBIDDEN'],
    ['held', '55000', 'ERASURE_ACTIVE_HOLD'],
  ])('rejects %s erasure before touching activity', async (condition, code, message) => {
    if (condition !== 'unlocked') await lockContext();
    if (condition === 'held')
      await db.query("insert into private.retention_holds values('owner',now(),null)");
    await db.query('set local role masarifi_worker');
    await db.query('savepoint denied');
    await expect(
      db.query('select private.erase_account_owner_payload($1,$2)', [
        request,
        condition === 'foreign' ? 'other' : 'owner',
      ]),
    ).rejects.toMatchObject({ code, message });
    await db.query('rollback to denied');
    await db.query('reset role');
    expect(
      (
        await db.query<{ count: number }>(
          'select count(*)::int count from private.mobile_activity_buckets',
        )
      ).rows[0]?.count,
    ).toBe(3);
  });
});
