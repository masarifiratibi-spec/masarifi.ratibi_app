import { appendFileSync, cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { PoolService } from '../../src/platform/database/pool.service';
import { MigrationRunner } from '../../src/platform/database/migration-runner';
import { createLivePool, describeLiveDatabase } from '../live-database';

describeLiveDatabase('migration checksum gate', () => {
  let pool: PoolService;

  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => pool.onModuleDestroy());

  it('rejects a historical checksum change before database DDL', async () => {
    const repositoryRoot = resolve(__dirname, '../../../..');
    const disposableRoot = mkdtempSync(join(tmpdir(), 'masarifi-migration-'));
    mkdirSync(join(disposableRoot, 'supabase'), { recursive: true });
    cpSync(
      join(repositoryRoot, 'supabase/migrations'),
      join(disposableRoot, 'supabase/migrations'),
      {
        recursive: true,
      },
    );
    cpSync(
      join(repositoryRoot, 'supabase/migration-checksums.sha256'),
      join(disposableRoot, 'supabase/migration-checksums.sha256'),
    );
    appendFileSync(
      join(disposableRoot, 'supabase/migrations/20260827000100_foundation_schemas_extensions.sql'),
      '\n-- tamper probe\n',
    );

    try {
      const before = await pool.query<{ count: string }>(
        'select count(*)::text as count from supabase_migrations.schema_migrations',
      );
      await expect(
        new MigrationRunner(pool, {
          get: () => 120_000,
        } as never).run(disposableRoot),
      ).rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
      const after = await pool.query<{ count: string }>(
        'select count(*)::text as count from supabase_migrations.schema_migrations',
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      rmSync(disposableRoot, { recursive: true, force: true });
    }
  });
});
