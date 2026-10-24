// The pinned Supabase CLI writes migration history under the effective DDL role.
// Bootstrap the unchanged historical prefix, then use the application's runner
// for migrations that deliberately switch roles. Never modify applied SQL.
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const api = join(root, 'apps/api');
const apiRequire = createRequire(join(api, 'package.json'));
const prefix = '20261016101500';
const operation = process.argv[2];
const connectionString = process.env.DATABASE_URL;
const database = new URL(connectionString ?? 'invalid:');
if (process.env.MASARIFI_LIVE_DATABASE_TESTS !== '1' ||
    database.protocol !== 'postgresql:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
    database.port !== '54322' || database.pathname !== '/postgres' ||
    !['start', 'reset', 'migrate'].includes(operation)) {
  throw new Error('DISPOSABLE_DATABASE_ONLY');
}

apiRequire('ts-node').register({ project: join(api, 'tsconfig.json'), transpileOnly: true });
const { verifyMigrationManifest } = require(join(api, 'src/platform/database/migration-checksums.ts'));
const { applyPendingMigrations, assertCompatibleMigrationHistory, withMigrationLock } =
  require(join(api, 'src/platform/database/migration-runner.ts'));
const migrationsDirectory = join(root, 'supabase/migrations');
verifyMigrationManifest(migrationsDirectory, join(root, 'supabase/migration-checksums.sha256'));
const files = readdirSync(migrationsDirectory).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
if (!files.some(name => name.startsWith(`${prefix}_`))) throw new Error('BOOTSTRAP_PREFIX_MISSING');
function cli(args) {
  const result = spawnSync(process.execPath, [join(api, 'node_modules/supabase/dist/supabase.js'), ...args],
    { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('DISPOSABLE_DATABASE_BOOTSTRAP_FAILED');
}

async function main() {
  if (operation === 'start') {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'masarifi-ci-'));
    try {
      mkdirSync(join(temporaryRoot, 'supabase/migrations'), { recursive: true });
      for (const name of ['config.toml', 'seed.sql']) {
        copyFileSync(join(root, 'supabase', name), join(temporaryRoot, 'supabase', name));
      }
      for (const name of files.filter(name => name.slice(0, 14) <= prefix)) {
        copyFileSync(join(migrationsDirectory, name), join(temporaryRoot, 'supabase/migrations', name));
      }
      cli(['start', '--workdir', temporaryRoot]);
    } finally {
      // mkdtemp owns this exact directory; no repository or database files enter it.
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  } else if (operation === 'reset') {
    cli(['db', 'reset', '--local', '--version', prefix, '--no-seed', '--yes', '--workdir', root]);
  }

  const client = new (apiRequire('pg').Client)({ connectionString });
  await client.connect();
  try {
    await withMigrationLock(client, async () => {
      const migrations = files.map(name => ({ version: name.slice(0, 14), name: name.slice(15, -4),
        sql: readFileSync(join(migrationsDirectory, name), 'utf8') }));
      const history = await client.query('select version from supabase_migrations.schema_migrations order by version');
      const applied = history.rows.map(row => row.version);
      assertCompatibleMigrationHistory(applied, migrations.map(migration => migration.version));
      for (const migration of migrations.filter(item => !applied.includes(item.version))) {
        console.log(`Applying canonical migration ${migration.version}_${migration.name}.sql`);
        // These historical operator-run files assume the DDL membership already
        // exists. The intervening erasure migration revokes it. Supply it only
        // on this guarded disposable database, retaining original SQL/history.
        const requiresMembership = ['20261017085837', '20261017111007'].includes(migration.version);
        const membership = requiresMembership ? await client.query(
          `select pg_has_role(current_user, 'masarifi_migration', 'SET') as allowed,
           exists(select 1 from pg_auth_members
             where roleid='masarifi_migration'::regrole and member=current_user::regrole
               and grantor=current_user::regrole) as existing_grant`) : undefined;
        const needsGrant = requiresMembership && membership.rows[0].allowed !== true;
        if (needsGrant && membership.rows[0].existing_grant) throw new Error('BOOTSTRAP_MEMBERSHIP_OPTIONS_UNEXPECTED');
        let granted = false;
        if (needsGrant) {
          await client.query('grant masarifi_migration to current_user with set true, inherit false granted by current_user');
          granted = true;
        }
        try {
          await applyPendingMigrations(client, [migration], [], 60_000);
        } finally {
          if (granted) await client.query('revoke masarifi_migration from current_user granted by current_user');
        }
      }
      const result = await client.query('select count(*)::int as count from supabase_migrations.schema_migrations');
      if (result.rows[0].count !== migrations.length) throw new Error('MIGRATION_HISTORY_INCOMPLETE');
      console.log(`Verified ${migrations.length} canonical migrations on the disposable database.`);
    });
  } finally {
    await client.end();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'DISPOSABLE_DATABASE_FAILED');
  process.exitCode = 1;
});
