import { randomUUID } from 'node:crypto';

import {
  applyPendingMigrations,
  type MigrationFile,
} from '../../../src/platform/database/migration-runner';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('migration executor role restoration', () => {
  const pool = createLivePool();
  const suffix = randomUUID().replaceAll('-', '');
  const executor = `migration_executor_${suffix}`;
  const ddl = `migration_ddl_${suffix}`;
  const schema = `migration_role_${suffix}`;
  const versions: string[] = [];
  let initialized = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('DISPOSABLE_LOOPBACK_REQUIRED');
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(`create role ${executor} nologin noinherit`);
        await client.query(`create role ${ddl} nologin noinherit`);
        await client.query(
          `grant ${executor}, ${ddl} to current_user with set true, inherit false`,
        );
        await client.query(`grant ${ddl} to ${executor} with set true, inherit false`);
        await client.query(`create schema ${schema} authorization ${ddl}`);
        await client.query(`grant usage on schema supabase_migrations to ${executor}`);
        await client.query(
          `grant insert(version, statements, name) on supabase_migrations.schema_migrations to ${executor}`,
        );
        const privileges = await client.query<{ allowed: boolean }>(
          "select has_schema_privilege($1, 'supabase_migrations', 'USAGE') allowed",
          [ddl],
        );
        expect(privileges.rows[0]?.allowed).toBe(false);
        await client.query('commit');
        initialized = true;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  });

  afterAll(async () => {
    try {
      if (!initialized) return;
      await pool.withClient(async (client) => {
        await client.query(
          'delete from supabase_migrations.schema_migrations where version=any($1::text[])',
          [versions],
        );
        // SET membership deliberately does not inherit ownership privileges.
        await client.query(`set role ${ddl}`);
        try {
          await client.query(`drop schema if exists ${schema} cascade`);
        } finally {
          await client.query('reset role');
        }
        // Revoke the exact fixture ACLs as their original grantor.
        await client.query(
          `revoke insert(version, statements, name) on supabase_migrations.schema_migrations from ${executor}`,
        );
        await client.query(`revoke usage on schema supabase_migrations from ${executor}`);
        await client.query(`drop role ${executor}, ${ddl}`);
      });
    } finally {
      await pool.onModuleDestroy();
    }
  });

  function migration(name: string, tail = ''): MigrationFile {
    const version = `role_fixture_${suffix}_${name}`;
    versions.push(version);
    return {
      version,
      name,
      sql: `-- Original SQL must remain unchanged in history.\nset local role ${ddl};\ncreate table ${schema}.${name} as select current_user::text as created_by;\n${tail}`,
    };
  }

  it('records exact SQL as the entry executor and skips an already-applied migration', async () => {
    const file = migration('successful');
    await pool.withClient(async (client) => {
      await client.query(`set role ${executor}`);
      try {
        await applyPendingMigrations(client, [file], [], 5_000);
        expect(
          (await client.query<{ role: string }>('select current_user as role')).rows[0]?.role,
        ).toBe(executor);
        // Re-execution would fail CREATE TABLE; filtering must avoid executing it.
        await applyPendingMigrations(client, [file], [file.version], 5_000);
      } finally {
        await client.query('reset role');
      }
      await client.query(`set role ${ddl}`);
      try {
        expect((await client.query(`select created_by from ${schema}.successful`)).rows).toEqual([
          { created_by: ddl },
        ]);
      } finally {
        await client.query('reset role');
      }
      expect(
        (
          await client.query(
            'select version, statements, name from supabase_migrations.schema_migrations where version=$1',
            [file.version],
          )
        ).rows,
      ).toEqual([{ version: file.version, statements: [file.sql], name: file.name }]);
      // Restoring execution context must not revoke historical cross-file membership.
      expect(
        (
          await client.query<{ allowed: boolean }>("select pg_has_role($1, $2, 'SET') allowed", [
            executor,
            ddl,
          ])
        ).rows[0]?.allowed,
      ).toBe(true);
    });
  });

  it('rolls back DDL and local role changes when migration SQL fails', async () => {
    const file = migration(
      'sql_failure',
      "do $$ begin raise exception 'synthetic migration failure'; end $$;",
    );
    await pool.withClient(async (client) => {
      await client.query(`set role ${executor}`);
      try {
        await expect(applyPendingMigrations(client, [file], [], 5_000)).rejects.toThrow(
          'MIGRATION_APPLY_FAILED',
        );
        expect(
          (await client.query<{ role: string }>('select current_user as role')).rows[0]?.role,
        ).toBe(executor);
      } finally {
        await client.query('reset role');
      }
      expect(
        (
          await client.query<{ present: boolean }>(
            `select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname=$1 and c.relname=$2) as present`,
            [schema, 'sql_failure'],
          )
        ).rows[0]?.present,
      ).toBe(false);
      expect(
        (
          await client.query(
            'select version from supabase_migrations.schema_migrations where version=$1',
            [file.version],
          )
        ).rows,
      ).toEqual([]);
    });
  });

  it('rolls back successful DDL when history insertion is denied to the executor', async () => {
    const file = migration('history_failure');
    await pool.withClient(async (client) => {
      await client.query(
        `revoke insert(version, statements, name) on supabase_migrations.schema_migrations from ${executor}`,
      );
      await client.query(`set role ${executor}`);
      try {
        await expect(applyPendingMigrations(client, [file], [], 5_000)).rejects.toThrow(
          'MIGRATION_APPLY_FAILED',
        );
        expect(
          (await client.query<{ role: string }>('select current_user as role')).rows[0]?.role,
        ).toBe(executor);
      } finally {
        await client.query('reset role');
        await client.query(
          `grant insert(version, statements, name) on supabase_migrations.schema_migrations to ${executor}`,
        );
      }
      expect(
        (
          await client.query<{ present: boolean }>(
            `select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname=$1 and c.relname=$2) as present`,
            [schema, 'history_failure'],
          )
        ).rows[0]?.present,
      ).toBe(false);
      expect(
        (
          await client.query(
            'select version from supabase_migrations.schema_migrations where version=$1',
            [file.version],
          )
        ).rows,
      ).toEqual([]);
    });
  });
});
