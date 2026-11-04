import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('production Tracking migration executor preservation', () => {
  let pool: PoolService;
  const sql = readFileSync(
    resolve(
      __dirname,
      '../../../../../supabase/migrations/20261104180948_tracking_production_installation_consent.sql',
    ),
    'utf8',
  );
  const prologue = sql.slice(0, sql.indexOf('-- Explicit production authority'));
  const epilogue = sql.slice(sql.lastIndexOf('reset role;'));
  const memberships = `select roleid::text,member::text,grantor::text,admin_option,inherit_option,set_option
    from pg_auth_members order by 1,2,3`;
  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it.each(['existing-set-true', 'existing-set-false', 'absent'] as const)(
    'restores the exact executor and grantor-specific membership: %s',
    async (kind) => {
      await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          const role = 'tracking_migration_test_' + randomUUID().replaceAll('-', '');
          await client.query(`create role "${role}"`);
          await client.query(
            `grant "${role}" to current_user with set true,inherit false granted by current_user`,
          );
          await client.query(
            `grant masarifi_migration to "${role}" with admin true,inherit false,set false granted by current_user`,
          );
          await client.query(`set local role "${role}"`);
          if (kind !== 'absent') {
            await client.query(
              `grant masarifi_migration to current_user with inherit true,set ${kind === 'existing-set-true' ? 'true' : 'false'} granted by current_user`,
            );
          }
          const before = (await client.query(memberships)).rows;
          await client.query(prologue);
          await client.query(epilogue);
          expect(
            (await client.query<{ name: string }>('select current_user name')).rows[0]?.name,
          ).toBe(role);
          expect((await client.query(memberships)).rows).toEqual(before);
        } finally {
          await client.query('rollback');
        }
      });
    },
  );
});
