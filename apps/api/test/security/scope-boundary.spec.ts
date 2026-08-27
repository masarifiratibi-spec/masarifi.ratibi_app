import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function scopeViolations(paths: string[], source: string): string[] {
  const clientChanges = paths.filter(
    (path) => path.startsWith('apps/mobile/') || path.startsWith('apps/admin-web/'),
  );
  const edgeFunctions = paths.filter((path) => path.startsWith('supabase/functions/'));
  const forbiddenTechnology = /\b(redis|bullmq|prisma)\b/i.test(source)
    ? ['forbidden-technology']
    : [];
  return [...clientChanges, ...edgeFunctions, ...forbiddenTechnology];
}

describe('SPEC-BE-001 scope boundary', () => {
  const root = resolve(__dirname, '../../../..');

  it('leaves clients untouched and excludes forbidden technology', () => {
    const paths = (process.env.MASARIFI_CHANGED_PATHS ?? '').split(/\r?\n/).filter(Boolean);
    const source = [
      'apps/api/package.json',
      'apps/api/src/app.module.ts',
      'apps/api/src/worker.module.ts',
      'docker/local/compose.backend.yml',
      'docker/test/compose.backend.yml',
    ]
      .map((path) => readFileSync(resolve(root, path), 'utf8'))
      .join('\n');

    expect(scopeViolations(paths, source)).toEqual([]);
  });

  it('rejects client edits, Edge Functions, and forbidden dependencies', () => {
    expect(
      scopeViolations(
        ['apps/mobile/source.ts', 'apps/admin-web/page.tsx', 'supabase/functions/new/index.ts'],
        'dependencies: redis bullmq prisma',
      ),
    ).toEqual([
      'apps/mobile/source.ts',
      'apps/admin-web/page.tsx',
      'supabase/functions/new/index.ts',
      'forbidden-technology',
    ]);
    expect(scopeViolations(['.agents/plugins/example/plugin.json'], '')).toEqual([]);
  });
});
