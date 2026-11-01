import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const url = process.env.MASARIFI_MUTATION_ERASURE_LOCAL_URL;
const suite = url ? describe : describe.skip;

suite('client mutation guard in an owned local PostgreSQL fixture', () => {
  let db: Client;
  const root = resolve(__dirname, '../../../../..');
  const source = (file: string) => readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
  const original = source('20261023232159_report_closure_sync_reauthentication.sql');
  const erasure = source('20261016101500_account_owner_payload_erasure.sql');
  const functionSql = (text: string, name: string) => {
    const start = text.search(
      new RegExp(`create (?:or replace )?function private\\.${name}\\(`, 'i'),
    );
    if (start < 0) throw new Error('FUNCTION_SOURCE_NOT_FOUND');
    const end = text.indexOf('end $$;', start);
    if (end < 0) throw new Error('FUNCTION_SOURCE_NOT_TERMINATED');
    return text.slice(start, end + 'end $$;'.length);
  };

  beforeAll(async () => {
    if (!url) throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    const target = new URL(url);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '15491' ||
      !['/mutation_erasure_20261101', '/mutation_erasure_20261101_green'].includes(target.pathname)
    )
      throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query(`
      do $roles$ begin
        if not exists(select 1 from pg_roles where rolname='masarifi_migration') then create role masarifi_migration nologin; end if;
        if not exists(select 1 from pg_roles where rolname='masarifi_worker') then create role masarifi_worker nologin; end if;
        if not exists(select 1 from pg_roles where rolname='masarifi_api') then create role masarifi_api nologin; end if;
      end $roles$;
      create schema private authorization masarifi_migration;
      grant usage on schema private,public to masarifi_worker,masarifi_api;
      create table public.profiles(id text primary key,status text);
      create table public.admin_profiles(user_id text);
      create table private.account_deletion_requests(id uuid primary key,user_id text,status text,verified_at timestamptz,cooling_off_ends_at timestamptz);
      create table private.retention_holds(resource_id text,starts_at timestamptz,ends_at timestamptz);
      create table private.account_erasure_resources(request_id uuid,resource_id text);
      create table private.account_erasure_context(transaction_id bigint primary key,request_id uuid,user_id text,objects_locked boolean);
      create table public.client_mutations(id uuid primary key,user_id text,device_id uuid,operation_id uuid,domain text,resource_type text,
        schema_version int,depends_on uuid[],resource_id text,operation text,base_version bigint,payload_hash text,payload jsonb,
        created_at timestamptz,updated_at timestamptz,status text,error jsonb,result jsonb,locked_by text,locked_until timestamptz,
        lease_token uuid,authenticated_at timestamptz);
      grant select,insert,update,delete on all tables in schema private,public to masarifi_migration;
      grant select,update,delete on public.client_mutations to masarifi_worker,masarifi_api;
    `);
    await db.query(functionSql(erasure, 'assert_account_erasure_request'));
    await db.query(
      'alter function private.assert_account_erasure_request(uuid,text,boolean) owner to masarifi_migration',
    );
    await db.query(functionSql(original, 'guard_client_mutation'));
    await db.query('alter function private.guard_client_mutation() owner to masarifi_migration');
    await db.query(
      'create trigger client_mutations_guard before update or delete on public.client_mutations for each row execute function private.guard_client_mutation()',
    );
    const migration = process.env.MASARIFI_MUTATION_ERASURE_MIGRATION;
    if (migration) {
      await db.query('begin');
      await db.query(source(migration));
      await db.query('commit');
    }
  });
  afterAll(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await db.query('begin');
    await db.query(`insert into public.profiles values('owner','deletion_pending'),('other','active');
      insert into private.account_deletion_requests values('11111111-1111-4111-8111-111111111111','owner','processing',now(),now());
      insert into public.client_mutations(id,user_id,payload,status,created_at,updated_at) values
      ('22222222-2222-4222-8222-222222222222','owner','{"private":"owned"}','applied',now(),now()),
      ('33333333-3333-4333-8333-333333333333','other','{"private":"foreign"}','applied',now(),now());`);
  });
  afterEach(async () => {
    await db.query('rollback');
  });
  const context = async (locked = true) => {
    await db.query('insert into private.account_erasure_context values(txid_current(),$1,$2,$3)', [
      '11111111-1111-4111-8111-111111111111',
      'owner',
      locked,
    ]);
    await db.query('set local role masarifi_migration');
  };

  it('deletes only the owned mutation in the locked verified erasure transaction', async () => {
    await context();
    expect(
      (await db.query("delete from public.client_mutations where user_id='owner'")).rowCount,
    ).toBe(1);
    expect((await db.query('select user_id from public.client_mutations')).rows).toEqual([
      { user_id: 'other' },
    ]);
  });
  it.each(['no-context', 'unlocked', 'foreign-owner', 'api', 'worker'])(
    'rejects delete in %s without weakening the guard',
    async (condition) => {
      if (condition !== 'no-context') await context(condition !== 'unlocked');
      else await db.query('set local role masarifi_migration');
      if (condition === 'api') await db.query('set local role masarifi_api');
      if (condition === 'worker') await db.query('set local role masarifi_worker');
      await expect(
        db.query('delete from public.client_mutations where user_id=$1', [
          condition === 'foreign-owner' ? 'other' : 'owner',
        ]),
      ).rejects.toMatchObject({ code: '42501' });
    },
  );
  it('keeps payload immutable even in a locked erasure context', async () => {
    await context();
    await expect(
      db.query("update public.client_mutations set payload='{}' where user_id='owner'"),
    ).rejects.toMatchObject({ code: '42501', message: 'SYNC_MUTATION_IMMUTABLE' });
  });
  it('still honors active retention holds', async () => {
    await db.query("insert into private.retention_holds values('owner',now(),null)");
    await context();
    await expect(
      db.query("delete from public.client_mutations where user_id='owner'"),
    ).rejects.toMatchObject({ code: '55000', message: 'ERASURE_ACTIVE_HOLD' });
  });
});
