import fs from 'node:fs';
import path from 'node:path';

import ar from './messages/ar';
import en from './messages/en';

describe('appShell message namespace', () => {
  it('keeps Arabic and English appShell keys in parity', () => {
    const enKeys = appShellKeys(en);
    const arKeys = appShellKeys(ar);

    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(90);
  });

  it('does not contain empty or copied appShell messages', () => {
    const enCatalog: Record<string, string> = en;
    const arCatalog: Record<string, string> = ar;

    for (const key of appShellKeys(en)) {
      expect(enCatalog[key].trim()).not.toBe('');
      expect(arCatalog[key].trim()).not.toBe('');
      expect(arCatalog[key]).not.toBe(enCatalog[key]);
    }
  });

  it('keeps SPEC-003 UI labels out of JSX literals', () => {
    const files = [
      ...collect('app/(public)'),
      ...collect('app/(onboarding)'),
      ...collect('app/(tabs)'),
      ...collect('app/accounts'),
      ...collect('app/assistant'),
      ...collect('app/modals'),
      ...collect('app/security'),
      ...collect('src/features/auth'),
      ...collect('src/features/onboarding'),
      ...collect('src/features/shell'),
      ...collect('src/features/security')
    ];
    const offenders = files.filter((file) =>
      hasUserFacingLiteral(fs.readFileSync(file, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });
});

function appShellKeys(catalog: Record<string, string>) {
  return Object.keys(catalog)
    .filter((key) => key.startsWith('appShell.'))
    .sort();
}

function hasUserFacingLiteral(source: string): boolean {
  return (
    />[^<>{}\n]*[\p{L}][^<>{}\n]*<\//u.test(source) ||
    /(['"`])[^\n'"`]*\p{Script=Arabic}[^\n'"`]*\1/u.test(source)
  );
}

function collect(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collect(entryPath);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [entryPath]
      : [];
  });
}
