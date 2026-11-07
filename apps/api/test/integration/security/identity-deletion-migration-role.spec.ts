import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const databaseUrl = process.env.TEST_IDENTITY_GRANT_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('identity deletion migration under a non-inheriting maintenance login', () => {
  it('grants only worker deleted_at updates and removes its temporary owner membership', async () => {
    if (!databaseUrl) throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    const target = new URL(databaseUrl);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      process.env.TEST_IDENTITY_GRANT_FIXTURE_OWNED !== '1' ||
      !/^\/reliability_[a-z0-9_]+$/.test(target.pathname)
    )
      throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');

    const client = new Client({ connectionString: databaseUrl });
    const maintenance = `identity_grant_${randomUUID().replaceAll('-', '')}`;
    await client.connect();
    await client.query('begin');
    try {
      await client.query("set local statement_timeout='5s';set local lock_timeout='2s'");
      const fixture = (
        await client.query<{ superuser: boolean; owns_database: boolean }>(`
        select r.rolsuper superuser,d.datdba=r.oid owns_database
        from pg_roles r join pg_database d on d.datname=current_database()
        where r.rolname=session_user
      `)
      ).rows[0];
      expect(fixture).toEqual({ superuser: true, owns_database: true });
      await client.query(`create role ${maintenance} nologin nosuperuser noinherit createrole`);
      await client.query(
        `grant masarifi_migration to ${maintenance} with admin true,inherit false,set false`,
      );
      await client.query('revoke update(deleted_at) on public.profiles from masarifi_worker');
      const otherAclsBefore = (
        await client.query(`
        select attname,attacl::text acl from pg_attribute
        where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped
          and attname<>'deleted_at' order by attnum
      `)
      ).rows;
      // RESET ROLE in the migration must return to this restricted session user.
      await client.query(`set session authorization ${maintenance}`);
      const before = (
        await client.query<{
          restricted_session: boolean;
          superuser: boolean;
          inherits_owner: boolean;
          can_grant: boolean;
          worker_update: boolean;
        }>(`select
        current_user=session_user restricted_session,
        (select rolsuper from pg_roles where rolname=current_user) superuser,
        pg_has_role(current_user,'masarifi_migration','USAGE') inherits_owner,
        has_column_privilege(current_user,'public.profiles','deleted_at','UPDATE WITH GRANT OPTION') can_grant,
        has_column_privilege('masarifi_worker','public.profiles','deleted_at','UPDATE') worker_update
      `)
      ).rows[0];
      expect(before).toEqual({
        restricted_session: true,
        superuser: false,
        inherits_owner: false,
        can_grant: false,
        worker_update: false,
      });
      const migration = readFileSync(
        resolve(
          __dirname,
          '../../../../../supabase/migrations/20261016002526_identity_privacy_deleted_timestamp.sql',
        ),
        'utf8',
      );
      await client.query(migration);
      const after = (
        await client.query<{
          restricted_session: boolean;
          worker_update: boolean;
          self_granted_membership: boolean;
        }>(`select
        current_user=session_user restricted_session,
        has_column_privilege('masarifi_worker','public.profiles','deleted_at','UPDATE') worker_update,
        exists(select 1 from pg_auth_members a join pg_roles r on r.oid=a.roleid
          where r.rolname='masarifi_migration' and a.member=(select oid from pg_roles where rolname=current_user)
            and a.grantor=a.member) self_granted_membership
      `)
      ).rows[0];
      expect(after).toEqual({
        restricted_session: true,
        worker_update: true,
        self_granted_membership: false,
      });
      expect(
        (
          await client.query(`
        select attname,attacl::text acl from pg_attribute
        where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped
          and attname<>'deleted_at' order by attnum
      `)
        ).rows,
      ).toEqual(otherAclsBefore);
    } finally {
      await client.query('rollback');
      await client.query('reset session authorization');
      await client.end();
    }
  });
});
