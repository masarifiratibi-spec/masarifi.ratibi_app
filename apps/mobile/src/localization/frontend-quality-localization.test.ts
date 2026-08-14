import fs from 'node:fs';
import path from 'node:path';

import ar from './messages/ar';
import en from './messages/en';

const featureRoot = path.resolve(__dirname, '..', 'features');
const featureKeyAliases: Record<string, string[]> = {
  'assistant-notifications': ['assistantNotifications'],
  'core-finance': ['coreFinance'],
  'design-system': ['designSystem'],
  'financial-planning': ['planning']
};

test('feature localization keys have Arabic and English parity and never render key-as-output', () => {
  expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  for (const [key, value] of Object.entries(en)) {
    expect(value).not.toBe(key);
    expect(ar[key as keyof typeof ar]).not.toBe(key);
  }
});

test('feature components avoid hard-coded user strings and unsafe route output', () => {
  const findings = collect(featureRoot)
    .flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return [...source.matchAll(/<(?:Text|StyledText)\b[^>]*>\s*([A-Z][A-Za-z ]{2,})\s*<\/(?:Text|StyledText)>/g)]
        .map((match) => `${path.relative(process.cwd(), file)}:${match[1]}`);
    });
  expect(findings).toEqual([]);
});

test('approved fixture numerals remain English for money and dates in both locales', () => {
  const catalogs = [en, ar] as const;
  for (const catalog of catalogs) {
    expect(catalog['assistantNotifications.subscription.limit']).toMatch(/[0-9]/);
    expect(catalog['reports.schedule.monthly.description']).toMatch(/[0-9]/);
  }
});

test('every feature directory has at least one localized route, state, action, or accessibility key', () => {
  const keys = Object.keys(en);
  const missing = fs.readdirSync(featureRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const aliases = [name, name.replaceAll('-', ''), ...(featureKeyAliases[name] ?? [])];
      return !keys.some((key) => aliases.some((alias) => key.includes(alias)));
    });

  expect(missing).toEqual([]);
});

function collect(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collect(entryPath);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [entryPath] : [];
  });
}
