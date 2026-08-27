import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildMigrationManifest,
  verifyMigrationManifest,
} from '../../../src/platform/database/migration-checksums';

function fixture(): { root: string; migrations: string; manifest: string } {
  const root = mkdtempSync(join(tmpdir(), 'masarifi-migrations-'));
  const migrations = join(root, 'migrations');
  const manifest = join(root, 'migration-checksums.sha256');
  mkdirSync(migrations);
  writeFileSync(join(migrations, '20260827000200_second.sql'), 'select 2;\n');
  writeFileSync(join(migrations, '20260827000100_first.sql'), 'select 1;\n');
  return { root, migrations, manifest };
}

describe('migration checksums', () => {
  it('builds a stable ordered SHA-256 manifest', () => {
    const { migrations } = fixture();
    const manifest = buildMigrationManifest(migrations);

    expect(manifest).toMatch(/^[a-f0-9]{64} {2}migrations\/20260827000100_first\.sql/m);
    expect(manifest.indexOf('first.sql')).toBeLessThan(manifest.indexOf('second.sql'));
  });

  it('accepts an exact manifest and rejects changed, missing, or extra SQL', () => {
    const { migrations, manifest } = fixture();
    writeFileSync(manifest, buildMigrationManifest(migrations));
    expect(() => {
      verifyMigrationManifest(migrations, manifest);
    }).not.toThrow();

    writeFileSync(join(migrations, '20260827000100_first.sql'), 'select 10;\n');
    expect(() => {
      verifyMigrationManifest(migrations, manifest);
    }).toThrow('MIGRATION_CHECKSUM_MISMATCH');

    writeFileSync(join(migrations, '20260827000300_extra.sql'), 'select 3;\n');
    expect(() => {
      verifyMigrationManifest(migrations, manifest);
    }).toThrow('MIGRATION_CHECKSUM_MISMATCH');
  });

  it('rejects invalid production migration filenames', () => {
    const { migrations } = fixture();
    writeFileSync(join(migrations, 'bad.sql'), 'select 3;\n');

    expect(() => buildMigrationManifest(migrations)).toThrow('MIGRATION_FILENAME_INVALID');
  });
});
